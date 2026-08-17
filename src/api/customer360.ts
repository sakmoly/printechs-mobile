import { http } from "./http";
import { useAuthStore } from "../store/auth";
import { oauthApi } from "./oauth";
import { ERP_ANALYSIS } from "./endpoints";
import { isApiEnabled } from "./mobileConfig";
import { isMissingBaMethodError, isBaPermissionDeniedError, isBaSchemaMismatchError } from "./baErrors";
import {
  BaApiUnavailableError,
  demoDataOnlyWhenNoServer,
  filterBaParams,
  isBaMethodKnownMissing,
  markBaMethodMissing,
  resolveCompanyName,
  unwrapFrappeMessage,
} from "./apiResilience";
import { optimizedApis } from "./optimized-apis";
import {
  getDemoCustomer360,
  getDemoCustomerSearch,
  isGenericCustomerLabel,
  normalizeCustomer360,
  normalizeCustomerSearch,
  completeCustomerChartsYtd,
  monthLabelToIndex,
  salesGrowthPct,
  type Customer360,
  type CustomerSearchHit,
} from "./customer360Types";

async function prepare() {
  const serverUrl = useAuthStore.getState().serverConfig.serverUrl;
  http.setBaseUrl(serverUrl);
  const token = await oauthApi.getValidToken();
  if (!token) throw new Error("No valid access token available");
  return useAuthStore.getState();
}

/**
 * Live Customer typeahead via core Frappe (works when erp_analysis.customer
 * is not installed yet on the site). Real ERP data only — never sample.
 */
async function searchCustomersViaFrappe(
  query: string
): Promise<CustomerSearchHit[]> {
  await prepare();
  const q = (query || "").trim();

  try {
    const linkRes = await http.get<any>(
      "/api/method/frappe.desk.search.search_link",
      {
        doctype: "Customer",
        txt: q,
        page_length: 25,
      }
    );
    const rows = unwrapFrappeMessage(linkRes);
    const list = Array.isArray(rows)
      ? rows
      : Array.isArray(rows?.results)
        ? rows.results
        : Array.isArray(linkRes?.message)
          ? linkRes.message
          : [];
    if (list.length) {
      return list
        .map((r: any) => {
          const id = String(r.value || r.name || r.customer || "");
          const desc = String(r.description || "")
            .split(",")[0]
            .trim();
          const nameCandidate = isGenericCustomerLabel(desc)
            ? ""
            : desc;
          const name =
            nameCandidate ||
            String(r.customer_name || r.value || r.name || id || "Customer");
          return {
            id,
            name: isGenericCustomerLabel(name) ? id || "Customer" : name,
            customer_group: undefined,
            territory: undefined,
          };
        })
        .filter((h: CustomerSearchHit) => h.id);
    }
  } catch (e) {
    console.warn("⚠️ search_link Customer failed, trying get_list:", e);
  }

  const filters: unknown[] = [["disabled", "=", 0]];
  const orFilters = q
    ? [
        ["name", "like", `%${q}%`],
        ["customer_name", "like", `%${q}%`],
      ]
    : undefined;

  const listRes = await http.get<any>("/api/method/frappe.client.get_list", {
    doctype: "Customer",
    fields: JSON.stringify([
      "name",
      "customer_name",
      "customer_group",
      "territory",
    ]),
    filters: JSON.stringify(filters),
    ...(orFilters ? { or_filters: JSON.stringify(orFilters) } : {}),
    limit_page_length: 25,
    order_by: "modified desc",
  });

  const raw = unwrapFrappeMessage(listRes);
  const rows = Array.isArray(raw)
    ? raw
    : Array.isArray(listRes?.message)
      ? listRes.message
      : [];
  return rows
    .map((r: any) => ({
      id: String(r.name || ""),
      name: String(r.customer_name || r.name || "Customer"),
      customer_group: r.customer_group || undefined,
      territory: r.territory || undefined,
    }))
    .filter((h: CustomerSearchHit) => h.id);
}

function creditLimitFromDoc(doc: any): number | null {
  const limits = doc?.credit_limits;
  if (Array.isArray(limits) && limits.length) {
    const sum = limits.reduce(
      (acc: number, row: any) => acc + (Number(row.credit_limit) || 0),
      0
    );
    if (sum > 0) return sum;
  }
  const n = Number(doc?.credit_limit);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function fetchCustomerDocShell(
  customer: string
): Promise<Customer360 | null> {
  try {
    await prepare();
    // Prefer frappe.client.get (works with OAuth Bearer) over /api/resource
    // which some sites restrict and which mishandled auth previously.
    let doc: any = null;
    try {
      const res = await http.get<any>("/api/method/frappe.client.get", {
        doctype: "Customer",
        name: customer,
      });
      doc = unwrapFrappeMessage(res) || res?.message || res;
    } catch {
      const encoded = encodeURIComponent(customer);
      const res = await http.get<any>(`/api/resource/Customer/${encoded}`);
      doc = res?.data || res?.message || res;
    }
    if (!doc?.name && !doc?.customer_name) return null;
    return {
      meta: {
        currency: "SAR",
        company:
          resolveCompanyName(
            useAuthStore.getState().permissions.scope?.company
          ) || "",
      },
      customer: {
        id: String(doc.name || customer),
        name: String(doc.customer_name || doc.name || customer),
        customer_group: doc.customer_group || undefined,
        territory: doc.territory || undefined,
        credit_limit: creditLimitFromDoc(doc),
        mobile: doc.mobile_no || undefined,
        email: doc.email_id || undefined,
      },
      sales: null,
      receivables: null,
      orders: null,
      activity: null,
      charts: null,
    };
  } catch {
    return null;
  }
}

function needsIdentityEnrichment(data: Customer360): boolean {
  return (
    isGenericCustomerLabel(data.customer?.name) ||
    !data.customer?.id ||
    (!data.customer?.mobile && !data.customer?.email)
  );
}

function needsReceivablesEnrichment(data: Customer360): boolean {
  const ar = data.receivables;
  if (!ar) return true;
  return (
    ar.outstanding == null ||
    ar.avg_monthly_sales == null ||
    ar.avg_monthly_paid == null
  );
}

function needsSalesEnrichment(data: Customer360): boolean {
  const s = data.sales;
  if (!s) return true;
  // BA often sends YTD (or a partial recent-invoice sum) without Today / MTD / GP
  return (
    s.today == null ||
    s.mtd == null ||
    s.ytd == null ||
    s.gp == null ||
    s.gp_pct == null ||
    s.avg_invoice == null
  );
}

function monthsBetweenInclusive(fromIso: string, toIso: string): number {
  if (!fromIso || !toIso) return 0;
  const from = new Date(fromIso);
  const to = new Date(toIso);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 0;
  const months =
    (to.getFullYear() - from.getFullYear()) * 12 +
    (to.getMonth() - from.getMonth()) +
    1;
  return Math.max(1, months);
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Live Payment Entry totals → average monthly amount paid by customer.
 */
async function fetchAvgMonthlyPaid(params: {
  customer: string;
  company?: string;
}): Promise<number | null> {
  try {
    await prepare();
    const today = new Date();
    const yearStart = `${today.getFullYear()}-01-01`;
    const to = toIsoDate(today);

    const filters: unknown[] = [
      ["party_type", "=", "Customer"],
      ["party", "=", params.customer],
      ["docstatus", "=", 1],
      ["payment_type", "=", "Receive"],
      ["posting_date", ">=", yearStart],
      ["posting_date", "<=", to],
    ];
    if (params.company) {
      filters.push(["company", "=", params.company]);
    }

    const res = await http.get<any>("/api/method/frappe.client.get_list", {
      doctype: "Payment Entry",
      fields: JSON.stringify([
        "name",
        "posting_date",
        "paid_amount",
        "received_amount",
        "base_paid_amount",
        "base_received_amount",
      ]),
      filters: JSON.stringify(filters),
      limit_page_length: 500,
      order_by: "posting_date desc",
    });

    const raw = unwrapFrappeMessage(res);
    const rows = Array.isArray(raw)
      ? raw
      : Array.isArray(res?.message)
        ? res.message
        : [];
    if (!rows.length) return 0;

    let total = 0;
    for (const row of rows) {
      const amt =
        Number(
          row.base_received_amount ??
            row.received_amount ??
            row.base_paid_amount ??
            row.paid_amount
        ) || 0;
      total += Math.abs(amt);
    }
    const months = Math.max(1, today.getMonth() + 1);
    return total / months;
  } catch (e) {
    console.warn("⚠️ Customer Payment Entry avg failed:", e);
    return null;
  }
}

function paidFromStatementItems(stmt: any): number | null {
  if (!stmt || typeof stmt !== "object") return null;
  const direct = Number(
    stmt.total_collected ??
      stmt.total_paid ??
      stmt.collection_ytd ??
      stmt.payments_total
  );
  if (Number.isFinite(direct) && direct >= 0) {
    const from = String(stmt.from_date || "");
    const to = String(stmt.to_date || toIsoDate(new Date()));
    const months = monthsBetweenInclusive(from, to) || new Date().getMonth() + 1;
    return direct / Math.max(1, months);
  }

  const items = Array.isArray(stmt.items) ? stmt.items : [];
  if (!items.length) return null;

  let paid = 0;
  let hit = false;
  for (const it of items) {
    const voucher = String(it.voucher_type || it.type || it.remark || "");
    const isPayment =
      /payment/i.test(voucher) ||
      it.credit > 0 ||
      (Number(it.amount) < 0 && !it.invoice);
    const amt = Number(
      it.paid_amount ?? it.credit ?? (isPayment ? Math.abs(Number(it.amount) || 0) : 0)
    );
    if (isPayment && amt > 0) {
      paid += amt;
      hit = true;
    }
  }
  if (!hit) return null;
  const from = String(stmt.from_date || `${new Date().getFullYear()}-01-01`);
  const to = String(stmt.to_date || toIsoDate(new Date()));
  const months = monthsBetweenInclusive(from, to);
  return months > 0 ? paid / months : null;
}

async function fetchCustomerMonthlyTrend(params: {
  customer: string;
  company?: string;
  to_date?: string;
}): Promise<{ sales: number[]; sales_ly: number[]; collection: number[] } | null> {
  try {
    await prepare();
    const end = params.to_date ? new Date(params.to_date) : new Date();
    const endSafe = Number.isNaN(end.getTime()) ? new Date() : end;
    const year = endSafe.getFullYear();
    const yearStart = `${year}-01-01`;
    const to = toIsoDate(endSafe);
    const lyStart = `${year - 1}-01-01`;
    const lyEnd = toIsoDate(
      new Date(year - 1, endSafe.getMonth(), endSafe.getDate())
    );
    const monthCount = endSafe.getMonth() + 1;
    const sales = Array.from({ length: monthCount }, () => 0);
    const sales_ly = Array.from({ length: monthCount }, () => 0);
    const collection = Array.from({ length: monthCount }, () => 0);

    const siFilters: unknown[] = [
      ["customer", "=", params.customer],
      ["docstatus", "=", 1],
      ["posting_date", ">=", yearStart],
      ["posting_date", "<=", to],
    ];
    if (params.company) siFilters.push(["company", "=", params.company]);

    const siRes = await http.get<any>("/api/method/frappe.client.get_list", {
      doctype: "Sales Invoice",
      fields: JSON.stringify([
        "posting_date",
        "grand_total",
        "base_grand_total",
      ]),
      filters: JSON.stringify(siFilters),
      limit_page_length: 500,
      order_by: "posting_date asc",
    });
    const siRaw = unwrapFrappeMessage(siRes);
    const siRows = Array.isArray(siRaw)
      ? siRaw
      : Array.isArray(siRes?.message)
        ? siRes.message
        : [];
    for (const row of siRows) {
      const d = String(row.posting_date || "");
      if (!d || d.length < 7) continue;
      const mi = Number(d.slice(5, 7)) - 1;
      if (mi < 0 || mi >= monthCount) continue;
      sales[mi] +=
        Number(row.base_grand_total ?? row.grand_total) || 0;
    }

    const siLyFilters: unknown[] = [
      ["customer", "=", params.customer],
      ["docstatus", "=", 1],
      ["posting_date", ">=", lyStart],
      ["posting_date", "<=", lyEnd],
    ];
    if (params.company) siLyFilters.push(["company", "=", params.company]);

    const siLyRes = await http.get<any>("/api/method/frappe.client.get_list", {
      doctype: "Sales Invoice",
      fields: JSON.stringify([
        "posting_date",
        "grand_total",
        "base_grand_total",
      ]),
      filters: JSON.stringify(siLyFilters),
      limit_page_length: 500,
      order_by: "posting_date asc",
    });
    const siLyRaw = unwrapFrappeMessage(siLyRes);
    const siLyRows = Array.isArray(siLyRaw)
      ? siLyRaw
      : Array.isArray(siLyRes?.message)
        ? siLyRes.message
        : [];
    for (const row of siLyRows) {
      const d = String(row.posting_date || "");
      if (!d || d.length < 7) continue;
      const mi = Number(d.slice(5, 7)) - 1;
      if (mi < 0 || mi >= monthCount) continue;
      sales_ly[mi] +=
        Number(row.base_grand_total ?? row.grand_total) || 0;
    }

    const peFilters: unknown[] = [
      ["party_type", "=", "Customer"],
      ["party", "=", params.customer],
      ["docstatus", "=", 1],
      ["payment_type", "=", "Receive"],
      ["posting_date", ">=", yearStart],
      ["posting_date", "<=", to],
    ];
    if (params.company) peFilters.push(["company", "=", params.company]);

    const peRes = await http.get<any>("/api/method/frappe.client.get_list", {
      doctype: "Payment Entry",
      fields: JSON.stringify([
        "posting_date",
        "paid_amount",
        "received_amount",
        "base_paid_amount",
        "base_received_amount",
      ]),
      filters: JSON.stringify(peFilters),
      limit_page_length: 500,
      order_by: "posting_date asc",
    });
    const peRaw = unwrapFrappeMessage(peRes);
    const peRows = Array.isArray(peRaw)
      ? peRaw
      : Array.isArray(peRes?.message)
        ? peRes.message
        : [];
    for (const row of peRows) {
      const d = String(row.posting_date || "");
      if (!d || d.length < 7) continue;
      const mi = Number(d.slice(5, 7)) - 1;
      if (mi < 0 || mi >= monthCount) continue;
      const amt =
        Number(
          row.base_received_amount ??
            row.received_amount ??
            row.base_paid_amount ??
            row.paid_amount
        ) || 0;
      collection[mi] += Math.abs(amt);
    }

    return { sales, sales_ly, collection };
  } catch (e) {
    console.warn("⚠️ Customer monthly trend fallback failed:", e);
    return null;
  }
}

/**
 * Ensure charts cover Jan…current month. Prefer BA values; fill missing
 * months from live SI / PE (zeros when no activity). Attach % vs LY.
 */
async function ensureCustomerChartsYtd(
  data: Customer360,
  params: { customer: string; company?: string; to_date?: string }
): Promise<Customer360["charts"]> {
  const end = params.to_date ? new Date(params.to_date) : new Date();
  const endSafe = Number.isNaN(end.getTime()) ? new Date() : end;
  const padded = completeCustomerChartsYtd(data.charts, endSafe);
  if (!padded?.months?.length) return data.charts ?? null;

  const originalLabels = data.charts?.months || [];
  const originalIdx = new Set<number>();
  for (const label of originalLabels) {
    const mi = monthLabelToIndex(label);
    if (mi != null) originalIdx.add(mi);
  }

  const needsFill =
    padded.months.length > originalLabels.length ||
    !originalIdx.has(0) ||
    (endSafe.getMonth() >= 1 && !originalIdx.has(1));

  const hasBaSalesLy = Array.isArray(data.charts?.sales_ly);
  const hasBaGrowth = Array.isArray(data.charts?.sales_growth_pct);
  const needsLy = !hasBaSalesLy || !hasBaGrowth;

  let live: {
    sales: number[];
    sales_ly: number[];
    collection: number[];
  } | null = null;

  if (needsFill || needsLy) {
    live = await fetchCustomerMonthlyTrend(params);
  }

  let sales = padded.sales;
  let collection = padded.collection;

  if (live && needsFill) {
    sales = (padded.sales || []).map((v, i) =>
      originalIdx.has(i) && v != null ? Number(v) : live!.sales[i] ?? 0
    );
    collection = (padded.collection || []).map((v, i) =>
      originalIdx.has(i) && v != null ? Number(v) : live!.collection[i] ?? 0
    );
    if (!Array.isArray(data.charts?.sales)) sales = live.sales;
    if (!Array.isArray(data.charts?.collection)) collection = live.collection;
  }

  const salesSeries = sales || [];
  let sales_ly = padded.sales_ly;
  if (!hasBaSalesLy && live) {
    sales_ly = live.sales_ly;
  } else if (!sales_ly && live) {
    sales_ly = live.sales_ly;
  }

  const sales_growth_pct = salesSeries.map((ty, i) => {
    if (hasBaGrowth && padded.sales_growth_pct?.[i] != null) {
      return padded.sales_growth_pct[i];
    }
    return salesGrowthPct(ty, sales_ly?.[i]);
  });

  const merged = {
    ...padded,
    sales: salesSeries,
    sales_ly,
    sales_growth_pct,
    collection,
  };

  if (__DEV__) {
    console.log("📊 Customer charts YTD:", {
      months: merged.months,
      sales: merged.sales,
      sales_ly: merged.sales_ly,
      growth: merged.sales_growth_pct,
    });
  }
  return merged;
}

async function fetchCustomerSalesFromInvoices(params: {
  customer: string;
  company?: string;
  from_date?: string;
  to_date?: string;
}): Promise<NonNullable<Customer360["sales"]> | null> {
  try {
    await prepare();
    const today = new Date();
    const todayIso = toIsoDate(today);
    const monthStart = toIsoDate(new Date(today.getFullYear(), today.getMonth(), 1));
    const yearStart = `${today.getFullYear()}-01-01`;
    // Always pull YTD window so Today / MTD / YTD cards are correct
    // regardless of the profile period filter.
    const from = yearStart;
    const to = params.to_date && params.to_date > todayIso ? params.to_date : todayIso;

    const filters: unknown[] = [
      ["customer", "=", params.customer],
      ["docstatus", "=", 1],
      ["posting_date", ">=", from],
      ["posting_date", "<=", to],
    ];
    if (params.company) {
      filters.push(["company", "=", params.company]);
    }

    const fields = [
      "name",
      "posting_date",
      "grand_total",
      "base_grand_total",
      "net_total",
      "base_net_total",
    ];

    const res = await http.get<any>("/api/method/frappe.client.get_list", {
      doctype: "Sales Invoice",
      fields: JSON.stringify(fields),
      filters: JSON.stringify(filters),
      limit_page_length: 500,
      order_by: "posting_date desc",
    });

    const raw = unwrapFrappeMessage(res);
    const rows = Array.isArray(raw)
      ? raw
      : Array.isArray(res?.message)
        ? res.message
        : [];
    if (!rows.length) {
      return {
        today: 0,
        mtd: 0,
        ytd: 0,
        ytd_ly: null,
        growth_pct: null,
        gp: null,
        gp_pct: null,
        avg_invoice: null,
        last_invoice_date: null,
      };
    }

    let todaySum = 0;
    let mtdSum = 0;
    let ytdSum = 0;
    let periodSum = 0;
    let count = 0;
    let lastDate: string | null = null;
    const names: string[] = [];

    for (const row of rows) {
      const amt =
        Number(row.base_grand_total ?? row.grand_total ?? row.base_net_total ?? row.net_total) ||
        0;
      const d = String(row.posting_date || "");
      if (!d) continue;
      count += 1;
      periodSum += amt;
      if (row.name) names.push(String(row.name));
      if (!lastDate || d > lastDate) lastDate = d;
      if (d === todayIso) todaySum += amt;
      if (d >= monthStart && d <= todayIso) mtdSum += amt;
      if (d >= yearStart && d <= todayIso) ytdSum += amt;
    }

    const gpFromItems = await fetchCustomerGpFromInvoiceItems(names, ytdSum);

    return {
      today: todaySum,
      mtd: mtdSum,
      ytd: ytdSum,
      ytd_ly: null,
      growth_pct: null,
      gp: gpFromItems?.gp ?? null,
      gp_pct: gpFromItems?.gp_pct ?? null,
      avg_invoice: count > 0 ? periodSum / count : null,
      last_invoice_date: lastDate,
    };
  } catch (e) {
    console.warn("⚠️ Customer SI sales fallback failed:", e);
    return null;
  }
}

/**
 * Derive GP from Sales Invoice Item valuation (incoming_rate × qty).
 * Returns null when cost data is missing or GP ≈ sales (unreliable).
 */
async function fetchCustomerGpFromInvoiceItems(
  invoiceNames: string[],
  salesTotal: number
): Promise<{ gp: number; gp_pct: number } | null> {
  if (!invoiceNames.length || !(salesTotal > 0)) return null;
  try {
    // Chunk parent filters — Frappe `in` lists can get large
    const chunkSize = 50;
    let cogs = 0;
    let valuedSales = 0;
    let valuedRows = 0;

    for (let i = 0; i < invoiceNames.length; i += chunkSize) {
      const chunk = invoiceNames.slice(i, i + chunkSize);
      const res = await http.get<any>(
        "/api/method/frappe.client.get_list",
        {
          doctype: "Sales Invoice Item",
          fields: JSON.stringify([
            "parent",
            "qty",
            "incoming_rate",
            "base_amount",
            "amount",
            "base_net_amount",
            "net_amount",
          ]),
          filters: JSON.stringify([["parent", "in", chunk]]),
          limit_page_length: 500,
        },
        { silentError: true }
      );
      const raw = unwrapFrappeMessage(res);
      const rows = Array.isArray(raw)
        ? raw
        : Array.isArray(res?.message)
          ? res.message
          : [];
      for (const row of rows) {
        const qty = Number(row.qty) || 0;
        const rate = Number(row.incoming_rate) || 0;
        const lineSales =
          Number(
            row.base_amount ??
              row.base_net_amount ??
              row.amount ??
              row.net_amount
          ) || 0;
        if (rate > 0 && qty !== 0) {
          cogs += Math.abs(rate * qty);
          valuedSales += Math.abs(lineSales);
          valuedRows += 1;
        }
      }
    }

    if (!valuedRows || cogs <= 0) return null;

    // Scale COGS to full sales when only some lines have valuation
    const cogsFull =
      valuedSales > 0 && valuedSales < salesTotal * 0.95
        ? (cogs / valuedSales) * salesTotal
        : cogs;
    const gp = salesTotal - cogsFull;
    if (!(gp > 0) || gp / salesTotal >= 0.95) return null;
    return { gp, gp_pct: (gp / salesTotal) * 100 };
  } catch (e) {
    if (__DEV__) {
      console.log("ℹ️ Customer GP from SI items skipped:", e);
    }
    return null;
  }
}

function applyStatementToSales(
  existing: Customer360["sales"] | null | undefined,
  stmt: any,
  _params: { from_date?: string; to_date?: string }
): Customer360["sales"] | null {
  if (!stmt || typeof stmt !== "object") return existing || null;

  const invoiced = Number(
    stmt.total_invoiced ?? stmt.sales_ytd ?? stmt.ytd ?? stmt.total_sales
  );
  const mtd = Number(stmt.sales_mtd ?? stmt.mtd ?? stmt.total_invoiced_mtd);
  const today = Number(stmt.sales_today ?? stmt.today);
  const items = Array.isArray(stmt.items) ? stmt.items : [];

  let derivedYtd = Number.isFinite(invoiced) ? invoiced : null;
  let derivedMtd = Number.isFinite(mtd) ? mtd : null;
  let derivedToday = Number.isFinite(today) ? today : null;
  let lastDate: string | null = null;
  let avgInvoice: number | null = null;

  if (items.length) {
    const todayIso = toIsoDate(new Date());
    const monthStart = toIsoDate(
      new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    );
    const yearStart = `${new Date().getFullYear()}-01-01`;
    let sum = 0;
    let cnt = 0;
    let t = 0;
    let m = 0;
    let y = 0;
    for (const it of items) {
      const amt = Number(it.amount ?? it.grand_total ?? it.debit ?? 0) || 0;
      const d = String(it.posting_date || it.date || "");
      // Statement lines can be invoices or payments — prefer positive invoice amounts
      if (amt <= 0 && !it.invoice) continue;
      if (it.voucher_type && /payment/i.test(String(it.voucher_type))) continue;
      if (d) {
        if (!lastDate || d > lastDate) lastDate = d;
        if (d === todayIso) t += Math.abs(amt);
        if (d >= monthStart) m += Math.abs(amt);
        if (d >= yearStart) y += Math.abs(amt);
      }
      if (it.invoice || amt > 0) {
        sum += Math.abs(amt);
        cnt += 1;
      }
    }
    if (derivedToday == null && t > 0) derivedToday = t;
    if (derivedMtd == null && m > 0) derivedMtd = m;
    if (derivedYtd == null && y > 0) derivedYtd = y;
    if (cnt > 0) avgInvoice = sum / cnt;
  }

  const hasAny =
    derivedToday != null ||
    derivedMtd != null ||
    derivedYtd != null ||
    lastDate != null;

  if (!hasAny && !existing) return null;

  return {
    today: existing?.today ?? derivedToday,
    mtd: existing?.mtd ?? derivedMtd,
    ytd: existing?.ytd ?? derivedYtd,
    ytd_ly: existing?.ytd_ly ?? null,
    growth_pct: existing?.growth_pct ?? null,
    gp: existing?.gp ?? null,
    gp_pct: existing?.gp_pct ?? null,
    avg_invoice: existing?.avg_invoice ?? avgInvoice,
    last_invoice_date:
      existing?.last_invoice_date ||
      lastDate ||
      stmt.last_invoice_date ||
      null,
  };
}

/**
 * Fill gaps from live Customer master + statement — never invent figures.
 */
async function enrichCustomer360FromLive(
  base: Customer360,
  params: {
    customer: string;
    company?: string;
    from_date?: string;
    to_date?: string;
  }
): Promise<Customer360> {
  let next: Customer360 = {
    ...base,
    customer: { ...base.customer },
    sales: base.sales ? { ...base.sales } : null,
    receivables: base.receivables ? { ...base.receivables } : null,
  };

  const party = params.customer || next.customer.id || next.customer.name;

  if (needsIdentityEnrichment(next) || next.customer.credit_limit == null) {
    const shell = await fetchCustomerDocShell(party);
    if (shell) {
      next.customer = {
        ...shell.customer,
        ...next.customer,
        id: next.customer.id || shell.customer.id,
        name: isGenericCustomerLabel(next.customer.name)
          ? shell.customer.name
          : next.customer.name,
        customer_group:
          next.customer.customer_group || shell.customer.customer_group,
        territory: next.customer.territory || shell.customer.territory,
        mobile: next.customer.mobile || shell.customer.mobile,
        email: next.customer.email || shell.customer.email,
        credit_limit:
          next.customer.credit_limit ?? shell.customer.credit_limit ?? null,
      };
      if (!next.meta.company && shell.meta.company) {
        next.meta = { ...next.meta, company: shell.meta.company };
      }
    }
  }

  const needStmt =
    needsReceivablesEnrichment(next) || needsSalesEnrichment(next);

  if (needStmt) {
    try {
      const stmt = await optimizedApis.getCustomerStatement({
        customer: String(next.customer.id || party),
        company: params.company || next.meta.company || undefined,
        from_date: params.from_date || `${new Date().getFullYear()}-01-01`,
        to_date: params.to_date || toIsoDate(new Date()),
      });
      if (stmt && typeof stmt === "object") {
        if (__DEV__) {
          console.log("📊 Customer statement keys:", Object.keys(stmt), {
            total_invoiced: stmt.total_invoiced,
            items: Array.isArray(stmt.items) ? stmt.items.length : 0,
          });
        }

        const outstanding =
          Number(
            stmt.total_outstanding ??
              stmt.outstanding ??
              stmt.customer_outstanding
          ) || null;
        const today = toIsoDate(new Date());
        let overdueFromItems: number | null = null;
        if (Array.isArray(stmt.items)) {
          overdueFromItems = stmt.items.reduce((acc: number, it: any) => {
            const amt = Number(it.outstanding ?? it.outstanding_amount) || 0;
            const due = String(it.due_date || "");
            if (amt > 0 && due && due < today) return acc + amt;
            return acc;
          }, 0);
        }
        const overdue =
          next.receivables?.overdue != null
            ? next.receivables.overdue
            : Number(stmt.total_overdue ?? stmt.overdue) ||
              overdueFromItems;

        let current = next.receivables?.current ?? null;
        if (
          current == null &&
          outstanding != null &&
          overdue != null &&
          Number.isFinite(overdue)
        ) {
          current = Math.max(0, outstanding - Number(overdue));
        }

        let avgMonthly = next.receivables?.avg_monthly_sales ?? null;
        const invoiced = Number(stmt.total_invoiced);
        if (avgMonthly == null && Number.isFinite(invoiced) && invoiced > 0) {
          const from = String(stmt.from_date || params.from_date || "");
          const to = String(stmt.to_date || params.to_date || "");
          const months = monthsBetweenInclusive(from, to);
          if (months > 0) avgMonthly = invoiced / months;
        }

        let avgPaid =
          next.receivables?.avg_monthly_paid ?? paidFromStatementItems(stmt);

        if (
          outstanding != null ||
          overdue != null ||
          avgMonthly != null ||
          avgPaid != null
        ) {
          next.receivables = {
            ...(next.receivables || {}),
            outstanding:
              next.receivables?.outstanding ??
              (outstanding != null && Number.isFinite(outstanding)
                ? outstanding
                : null),
            overdue:
              next.receivables?.overdue ??
              (overdue != null && Number.isFinite(Number(overdue))
                ? Number(overdue)
                : null),
            current,
            avg_monthly_sales:
              avgMonthly ?? next.receivables?.avg_monthly_sales ?? null,
            avg_monthly_paid:
              avgPaid ?? next.receivables?.avg_monthly_paid ?? null,
            oldest_invoice: next.receivables?.oldest_invoice ?? null,
          };
        }

        // Sales section from statement totals / line items
        next.sales = applyStatementToSales(next.sales, stmt, params);

        if (
          isGenericCustomerLabel(next.customer.name) &&
          stmt.customer
        ) {
          next.customer.name = String(stmt.customer);
        }
      }
    } catch (e) {
      console.warn("⚠️ Customer statement enrich skipped:", e);
    }
  }

  // Live SI list when Today / MTD / YTD / GP / avg are incomplete
  if (needsSalesEnrichment(next)) {
    const fromInvoices = await fetchCustomerSalesFromInvoices({
      customer: String(next.customer.id || party),
      company: params.company || next.meta.company || undefined,
      from_date: params.from_date || `${new Date().getFullYear()}-01-01`,
      to_date: params.to_date || toIsoDate(new Date()),
    });
    if (fromInvoices) {
      // Prefer live SI for period totals — BA often only has YTD or a partial list
      next.sales = {
        ...(next.sales || {}),
        today: fromInvoices.today,
        mtd: fromInvoices.mtd,
        ytd: fromInvoices.ytd ?? next.sales?.ytd ?? null,
        ytd_ly: next.sales?.ytd_ly ?? null,
        growth_pct: next.sales?.growth_pct ?? null,
        gp: next.sales?.gp ?? fromInvoices.gp ?? null,
        gp_pct: next.sales?.gp_pct ?? fromInvoices.gp_pct ?? null,
        avg_invoice:
          fromInvoices.avg_invoice ?? next.sales?.avg_invoice ?? null,
        last_invoice_date:
          fromInvoices.last_invoice_date ||
          next.sales?.last_invoice_date ||
          null,
      };
      if (__DEV__) {
        console.log("📊 Customer sales from SI list:", {
          today: next.sales.today,
          mtd: next.sales.mtd,
          ytd: next.sales.ytd,
          avg: next.sales.avg_invoice,
          gp: next.sales.gp,
          gpPct: next.sales.gp_pct,
        });
      }
    }
  }

  // Live Payment Entry avg when BA has no monthly paid figure
  if (next.receivables?.avg_monthly_paid == null) {
    const avgPaid = await fetchAvgMonthlyPaid({
      customer: String(next.customer.id || party),
      company: params.company || next.meta.company || undefined,
    });
    if (avgPaid != null) {
      next.receivables = {
        ...(next.receivables || {}),
        avg_monthly_paid: avgPaid,
      };
      if (__DEV__) {
        console.log("📊 Customer avg monthly paid from PE:", avgPaid);
      }
    }
  }

  // Pad BA charts to YTD (Jan…current) and fill gaps from live SI / PE
  next.charts = await ensureCustomerChartsYtd(next, {
    customer: String(next.customer.id || party),
    company: params.company || next.meta.company || undefined,
    to_date: params.to_date,
  });

  // MTD backup from current-month chart bar when SI list was unavailable
  if (next.sales && next.sales.mtd == null && next.charts?.sales?.length) {
    const mi = new Date().getMonth();
    const chartMtd = next.charts.sales[mi];
    if (chartMtd != null && Number.isFinite(Number(chartMtd))) {
      next.sales = { ...next.sales, mtd: Number(chartMtd) };
    }
  }

  // Derive AR KPIs from sales / charts without inventing values
  if (next.receivables || next.sales || next.charts) {
    next.receivables = { ...(next.receivables || {}) };
    if (
      next.receivables.avg_monthly_sales == null &&
      next.sales?.ytd != null &&
      next.sales.ytd > 0
    ) {
      next.receivables.avg_monthly_sales =
        next.sales.ytd / (new Date().getMonth() + 1);
    }
    if (
      next.receivables.avg_monthly_sales == null &&
      Array.isArray(next.charts?.sales) &&
      next.charts.sales.length
    ) {
      const nums = next.charts.sales.filter(
        (n): n is number => typeof n === "number" && Number.isFinite(n)
      );
      if (nums.length) {
        next.receivables.avg_monthly_sales =
          nums.reduce((a, b) => a + b, 0) / nums.length;
      }
    }
    if (
      next.receivables.avg_monthly_paid == null &&
      Array.isArray(next.charts?.collection) &&
      next.charts.collection.length
    ) {
      const nums = next.charts.collection.filter(
        (n): n is number => typeof n === "number" && Number.isFinite(n)
      );
      if (nums.length) {
        next.receivables.avg_monthly_paid =
          nums.reduce((a, b) => a + b, 0) / nums.length;
      }
    }
  }

  return next;
}

export async function searchCustomers(
  query: string
): Promise<CustomerSearchHit[]> {
  const state = useAuthStore.getState();
  const cfg = state.mobileConfig;

  const demo = demoDataOnlyWhenNoServer(() => getDemoCustomerSearch(query));
  if (demo !== undefined) return demo;

  const tryBaSearch = async () => {
    await prepare();
    const company = resolveCompanyName(
      state.permissions.scope?.company
    );
    const response = await http.get<any>(
      ERP_ANALYSIS.customer360.search,
      filterBaParams({ q: query, search: query, company, limit: 25 }, cfg)
    );
    return normalizeCustomerSearch(unwrapFrappeMessage(response));
  };

  if (
    isApiEnabled(cfg, "search_customers") &&
    !isBaMethodKnownMissing("search_customers")
  ) {
    try {
      return await tryBaSearch();
    } catch (error) {
      if (isMissingBaMethodError(error)) {
        markBaMethodMissing("search_customers");
      } else if (isBaPermissionDeniedError(error)) {
        // Ozdah / multi-client: BA Access Profile may deny search_customers
        // while standard Customer read still works — fall through to Frappe.
        const ax = error as { response?: { data?: unknown; status?: number } };
        console.warn(
          "⚠️ BA search_customers denied (403) — falling back to Frappe Customer search",
          ax?.response?.data || (error as Error)?.message
        );
      } else {
        throw error;
      }
    }
  }

  // Real ERP Customer list — never sample names on a configured server
  try {
    return await searchCustomersViaFrappe(query);
  } catch (e) {
    console.warn("⚠️ Live Customer search failed:", e);
    return [];
  }
}

export async function fetchCustomer360(params: {
  customer: string;
  company?: string;
  from_date?: string;
  to_date?: string;
}): Promise<Customer360> {
  const state = useAuthStore.getState();
  const cfg = state.mobileConfig;

  const demo = demoDataOnlyWhenNoServer(() =>
    getDemoCustomer360(params.customer)
  );
  if (demo !== undefined) return demo;

  const tryBa360 = async () => {
    await prepare();
    const company =
      params.company ||
      resolveCompanyName(state.permissions.scope?.company);
    const response = await http.get<any>(
      ERP_ANALYSIS.customer360.get,
      filterBaParams(
        {
          customer: params.customer,
          company,
          from_date: params.from_date,
          to_date: params.to_date,
        },
        cfg
      )
    );
    const unwrapped = unwrapFrappeMessage(response);
    if (__DEV__) {
      const keys =
        unwrapped && typeof unwrapped === "object"
          ? Object.keys(unwrapped)
          : [];
      console.log("📊 Customer 360 raw keys:", keys, {
        customerType: typeof unwrapped?.customer,
        profileKeys:
          unwrapped?.profile && typeof unwrapped.profile === "object"
            ? Object.keys(unwrapped.profile)
            : null,
        receivablesKeys:
          unwrapped?.receivables && typeof unwrapped.receivables === "object"
            ? Object.keys(unwrapped.receivables)
            : null,
        aging:
          unwrapped?.receivables?.aging_buckets ||
          unwrapped?.receivables?.aging ||
          null,
        statementKeys:
          unwrapped?.statement && typeof unwrapped.statement === "object"
            ? Object.keys(unwrapped.statement)
            : null,
      });
    }
    const normalized = normalizeCustomer360(unwrapped);
    if (__DEV__) {
      console.log("📊 Customer 360 normalized:", {
        name: normalized.customer.name,
        salesToday: normalized.sales?.today,
        salesMtd: normalized.sales?.mtd,
        salesYtd: normalized.sales?.ytd,
        outstanding: normalized.receivables?.outstanding,
        overdue: normalized.receivables?.overdue,
        current: normalized.receivables?.current,
        avgMonthly: normalized.receivables?.avg_monthly_sales,
        avgPaid: normalized.receivables?.avg_monthly_paid,
        openSo: normalized.orders?.open_so_count,
      });
    }
    const enriched = await enrichCustomer360FromLive(normalized, {
      customer: params.customer,
      company,
      from_date: params.from_date,
      to_date: params.to_date,
    });
    if (__DEV__) {
      console.log("📊 Customer 360 after enrich:", {
        salesToday: enriched.sales?.today,
        salesMtd: enriched.sales?.mtd,
        salesYtd: enriched.sales?.ytd,
        avgInvoice: enriched.sales?.avg_invoice,
      });
    }
    return enriched;
  };

  if (
    isApiEnabled(cfg, "get_customer_360") &&
    !isBaMethodKnownMissing("get_customer_360")
  ) {
    try {
      return await tryBa360();
    } catch (error) {
      if (isMissingBaMethodError(error)) {
        markBaMethodMissing("get_customer_360");
      } else if (isBaSchemaMismatchError(error) || isBaPermissionDeniedError(error)) {
        // Ozdah / multi-client: BA may SELECT Printechs-only columns (e.g. credit_limit)
        // or deny Access Profile — fall through to live Customer + SI enrichment.
        const ax = error as { response?: { data?: unknown } };
        console.warn(
          "⚠️ BA get_customer_360 failed — falling back to live Customer shell",
          ax?.response?.data || (error as Error)?.message
        );
      } else {
        throw error;
      }
    }
  }

  // Master data only (name/contact) from live Customer doctype — no fake KPIs
  const shell = await fetchCustomerDocShell(params.customer);
  if (shell) {
    return enrichCustomer360FromLive(shell, {
      customer: params.customer,
      company:
        params.company ||
        resolveCompanyName(state.permissions.scope?.company),
      from_date: params.from_date,
      to_date: params.to_date,
    });
  }
  throw new BaApiUnavailableError("get_customer_360");
}
