import { http } from "./http";
import { useAuthStore } from "../store/auth";
import { oauthApi } from "./oauth";
import { ERP_ANALYSIS } from "./endpoints";
import { isApiEnabled } from "./mobileConfig";
import {
  isMissingBaMethodError,
  isBaPermissionDeniedError,
  isBaSchemaMismatchError,
  isTransientGatewayError,
} from "./baErrors";
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
  ALL_TERRITORIES,
  baTerritoryRequestParams,
  filterRowsByTerritory,
  isKnownTerritoryName,
  territoryFilters,
} from "../utils/dashboardTerritory";
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

function looksLikeTableRank(id: string): boolean {
  return /^\d{1,4}$/.test(String(id || "").trim());
}

/** Map display name / link / rank row → ERPNext Customer name for APIs. */
export async function resolveCustomerParty(input: string): Promise<string> {
  const trimmed = String(input || "").trim();
  if (!trimmed) return trimmed;

  const scope = useAuthStore.getState().permissions?.scope;
  if (isKnownTerritoryName(trimmed, scope)) {
    return trimmed;
  }

  if (!looksLikeTableRank(trimmed)) {
    const shell = await fetchCustomerDocShell(trimmed);
    if (shell?.customer.id) return shell.customer.id;
  }

  try {
    const hits = await searchCustomers(trimmed);
    const lower = trimmed.toLowerCase();
    const exact = hits.find(
      (h) =>
        h.id.toLowerCase() === lower || h.name.toLowerCase() === lower
    );
    if (exact?.id) return exact.id;
    if (hits.length === 1) return hits[0].id;
  } catch {
    /* fall through */
  }

  return trimmed;
}

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
export type CustomerSearchOptions = {
  /** Dashboard territory chip (omit or `__all__` for no filter). */
  territory?: string;
};

async function searchCustomersViaFrappe(
  query: string,
  territory?: string
): Promise<CustomerSearchHit[]> {
  await prepare();
  const q = (query || "").trim();
  const territoryFilter = String(territory || "").trim();
  const restrictTerritory =
    territoryFilter && territoryFilter !== ALL_TERRITORIES
      ? territoryFilter
      : "";

  if (!restrictTerritory) {
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
  }

  const filters: unknown[] = [["disabled", "=", 0]];
  if (restrictTerritory) {
    filters.push(["territory", "=", restrictTerritory]);
  }
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
      const res = await http.get<any>(
        "/api/method/frappe.client.get",
        {
          doctype: "Customer",
          name: customer,
        },
        { silentError: true }
      );
      doc = unwrapFrappeMessage(res) || res?.message || res;
    } catch {
      const encoded = encodeURIComponent(customer);
      const res = await http.get<any>(
        `/api/resource/Customer/${encoded}`,
        undefined,
        { silentError: true }
      );
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

/** BA often sends 0 instead of null for missing Today / MTD / YTD. */
function isMissingPeriodSales(v: number | null | undefined): boolean {
  return v == null || v === 0;
}

/** Desk/SDB-backed sales block from get_customer_360 — do not overwrite with statement/SI. */
function hasAuthoritativeBaSales(
  s: Customer360["sales"] | null | undefined
): boolean {
  if (!s) return false;
  const gpPct = s.gp_pct;
  return (
    !isMissingPeriodSales(s.ytd) &&
    !isMissingPeriodSales(s.mtd) &&
    gpPct != null &&
    Number.isFinite(Number(gpPct))
  );
}

/** BA bug pattern: COGS missing → gp ≈ ytd and gp_pct ≈ 100 (desk GP report lower). */
function salesGpLooksLikeMissingCogs(
  s: Customer360["sales"] | null | undefined
): boolean {
  if (!s?.ytd || !(Number(s.ytd) > 0)) return false;
  const ytd = Number(s.ytd);
  const gp =
    s.gp != null && Number.isFinite(Number(s.gp)) ? Number(s.gp) : null;
  const pct =
    s.gp_pct != null && Number.isFinite(Number(s.gp_pct))
      ? Number(s.gp_pct)
      : null;
  if (pct != null && pct >= 99) return true;
  if (gp != null && gp >= ytd * 0.99) return true;
  return false;
}

/** When API still sends ~100% GP, recompute from submitted SI item valuation. */
async function reconcileSuspiciousSalesGp(
  next: Customer360,
  params: {
    company?: string;
    from_date?: string;
    to_date?: string;
  },
  party: string
): Promise<void> {
  if (!salesGpLooksLikeMissingCogs(next.sales)) return;
  const partyId = String(next.customer.id || party).trim();
  if (!partyId) return;

  const fromInvoices = await fetchCustomerSalesFromInvoices({
    customer: partyId,
    company: params.company || next.meta.company || undefined,
    from_date: params.from_date || `${new Date().getFullYear()}-01-01`,
    to_date: params.to_date || toIsoDate(new Date()),
  });

  if (
    fromInvoices?.gp != null &&
    fromInvoices.gp_pct != null &&
    fromInvoices.gp_pct < 95 &&
    Number.isFinite(fromInvoices.gp_pct)
  ) {
    next.sales = {
      ...(next.sales || {
        today: null,
        mtd: null,
        ytd: null,
        ytd_ly: null,
        growth_pct: null,
        gp: null,
        gp_pct: null,
        avg_invoice: null,
        last_invoice_date: null,
      }),
      gp: fromInvoices.gp,
      gp_pct: fromInvoices.gp_pct,
    };
    if (__DEV__) {
      console.log("📊 Customer GP reconciled from SI (API had ~100% margin):", {
        gp: fromInvoices.gp,
        gpPct: fromInvoices.gp_pct,
        ytd: next.sales.ytd,
      });
    }
  }
}

function needsAvgInvoiceEnrichment(
  s: Customer360["sales"] | null | undefined
): boolean {
  // Backend sends avg_invoice (incl. 0 when no YTD invoices) — do not recompute.
  return s?.avg_invoice == null;
}

function needsSalesEnrichment(data: Customer360): boolean {
  if (hasAuthoritativeBaSales(data.sales)) return false;
  const s = data.sales;
  if (!s) return true;
  return (
    isMissingPeriodSales(s.today) ||
    isMissingPeriodSales(s.mtd) ||
    isMissingPeriodSales(s.ytd) ||
    s.gp == null ||
    s.gp_pct == null
  );
}

/** Prefer live SI totals when BA/statement left placeholders at 0. */
function preferLiveSalesMetric(
  fromInvoices: number | null | undefined,
  existing: number | null | undefined
): number | null {
  if (fromInvoices != null && Number.isFinite(fromInvoices) && fromInvoices > 0) {
    return fromInvoices;
  }
  if (existing != null && Number.isFinite(existing) && existing !== 0) {
    return existing;
  }
  if (fromInvoices != null && Number.isFinite(fromInvoices)) {
    return fromInvoices;
  }
  return existing ?? null;
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

/**
 * Desk-aligned avg monthly sales: calendar YTD net ÷ months Jan…as-of.
 * Not avg invoice (YTD ÷ invoice count).
 */
export function computeCustomerAvgMonthlySales(
  ytd: number | null | undefined,
  toDate?: string | null
): number | null {
  if (ytd == null || !Number.isFinite(Number(ytd)) || Number(ytd) <= 0) {
    return null;
  }
  const end = toDate ? new Date(toDate) : new Date();
  const endSafe = Number.isNaN(end.getTime()) ? new Date() : end;
  const yearStart = toIsoDate(new Date(endSafe.getFullYear(), 0, 1));
  const to = toIsoDate(endSafe);
  const months = monthsBetweenInclusive(yearStart, to);
  return months > 0 ? Number(ytd) / months : null;
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Net sales per invoice — aligned with SDB / desk `Net_Amount` and sales KPI cards. */
function salesInvoiceNetAmount(row: Record<string, unknown>): number {
  return (
    Number(
      row.base_net_total ??
        row.net_total ??
        row.base_grand_total ??
        row.grand_total
    ) || 0
  );
}

function paymentEntryReceivedAmount(row: Record<string, unknown>): number {
  const pt = String(row.payment_type || "").trim();
  if (pt && pt !== "Receive") return 0;
  const candidates = [row.base_received_amount, row.received_amount];
  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n) && n !== 0) return Math.abs(n);
  }
  const fallback = [row.base_paid_amount, row.paid_amount];
  for (const c of fallback) {
    const n = Number(c);
    if (Number.isFinite(n) && n !== 0) return Math.abs(n);
  }
  return 0;
}

function uniquePartyCandidates(id?: string, name?: string): string[] {
  const out: string[] = [];
  for (const v of [id, name]) {
    const t = String(v || "").trim();
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}

/** Load Receive payments — tries Customer id and display name, with/without company. */
async function listCustomerPaymentEntries(opts: {
  partyCandidates: string[];
  company?: string;
  from_date: string;
  to_date: string;
}): Promise<Record<string, unknown>[]> {
  await prepare();
  const fields = [
    "name",
    "posting_date",
    "paid_amount",
    "received_amount",
    "base_paid_amount",
    "base_received_amount",
    "payment_type",
  ];

  for (const party of opts.partyCandidates) {
    for (const useCompany of [true, false]) {
      for (const paymentType of ["Receive", ""] as const) {
        const filters: unknown[] = [
          ["party_type", "=", "Customer"],
          ["party", "=", party],
          ["docstatus", "=", 1],
          ["posting_date", ">=", opts.from_date],
          ["posting_date", "<=", opts.to_date],
        ];
        if (paymentType) {
          filters.push(["payment_type", "=", paymentType]);
        }
        if (useCompany && opts.company) {
          filters.push(["company", "=", opts.company]);
        }
        try {
          const res = await http.get<any>(
            "/api/method/frappe.client.get_list",
            {
              doctype: "Payment Entry",
              fields: JSON.stringify(fields),
              filters: JSON.stringify(filters),
              limit_page_length: 5000,
              order_by: "posting_date asc",
            },
            { silentError: true }
          );
          const raw = unwrapFrappeMessage(res);
          const rows = Array.isArray(raw)
            ? raw
            : Array.isArray(res?.message)
              ? res.message
              : [];
          if (rows.length) return rows as Record<string, unknown>[];
        } catch {
          /* next candidate */
        }
      }
    }
  }
  return [];
}

function paymentsToMonthlyBuckets(
  rows: Record<string, unknown>[],
  monthCount: number
): number[] {
  const collection = Array.from({ length: monthCount }, () => 0);
  for (const row of rows) {
    const d = String(row.posting_date || "");
    if (!d || d.length < 7) continue;
    const mi = Number(d.slice(5, 7)) - 1;
    if (mi < 0 || mi >= monthCount) continue;
    collection[mi] += paymentEntryReceivedAmount(row);
  }
  return collection;
}

function mergeCollectionSeries(
  ba: number[] | undefined,
  live: number[] | undefined,
  len: number
): number[] {
  const out: number[] = [];
  for (let i = 0; i < len; i++) {
    const l = live?.[i] ?? 0;
    const b = ba?.[i] ?? 0;
    if (l > 0) out.push(l);
    else if (b > 0) out.push(b);
    else out.push(0);
  }
  return out;
}

/** Prefer BA/SDB monthly bars when present; use live SI only to fill zero months. */
function mergeSalesSeries(
  ba: number[] | undefined,
  live: number[] | undefined,
  len: number,
  preferBaWhenPositive: boolean
): number[] {
  const out: number[] = [];
  for (let i = 0; i < len; i++) {
    const b = ba?.[i] ?? 0;
    const l = live?.[i] ?? 0;
    if (preferBaWhenPositive && b > 0) out.push(b);
    else if (l > 0) out.push(l);
    else if (b > 0) out.push(b);
    else out.push(0);
  }
  return out;
}

function collectionSeriesHasValue(arr?: number[]): boolean {
  return Boolean(arr?.some((n) => Number(n) > 0));
}

/**
 * Live Payment Entry totals → average monthly amount paid by customer.
 */
async function fetchAvgMonthlyPaid(params: {
  customer: string;
  customer_name?: string;
  company?: string;
}): Promise<number | null> {
  try {
    const today = new Date();
    const yearStart = `${today.getFullYear()}-01-01`;
    const to = toIsoDate(today);
    const rows = await listCustomerPaymentEntries({
      partyCandidates: uniquePartyCandidates(
        params.customer,
        params.customer_name
      ),
      company: params.company,
      from_date: yearStart,
      to_date: to,
    });
    if (!rows.length) return null;

    let total = 0;
    for (const row of rows) {
      total += paymentEntryReceivedAmount(row);
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
  customer_name?: string;
  company?: string;
  to_date?: string;
}): Promise<{ sales: number[]; sales_ly: number[]; collection: number[] } | null> {
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
  let collection = Array.from({ length: monthCount }, () => 0);

  try {
    await prepare();

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
      limit_page_length: 5000,
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
      sales[mi] += salesInvoiceNetAmount(row);
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
      sales_ly[mi] += salesInvoiceNetAmount(row);
    }

    const peRows = await listCustomerPaymentEntries({
      partyCandidates: uniquePartyCandidates(
        params.customer,
        params.customer_name
      ),
      company: params.company,
      from_date: yearStart,
      to_date: to,
    });
    collection = paymentsToMonthlyBuckets(peRows, monthCount);

    return { sales, sales_ly, collection };
  } catch (e) {
    console.warn("⚠️ Customer monthly trend (SI) failed:", e);
    try {
      const peRows = await listCustomerPaymentEntries({
        partyCandidates: uniquePartyCandidates(
          params.customer,
          params.customer_name
        ),
        company: params.company,
        from_date: yearStart,
        to_date: to,
      });
      collection = paymentsToMonthlyBuckets(peRows, monthCount);
      if (collectionSeriesHasValue(collection)) {
        return { sales, sales_ly, collection };
      }
    } catch {
      /* ignore */
    }
    return null;
  }
}

/**
 * Ensure charts cover Jan…current month. Prefer BA values; fill missing
 * months from live SI / PE (zeros when no activity). Attach % vs LY.
 */
async function ensureCustomerChartsYtd(
  data: Customer360,
  params: {
    customer: string;
    customer_name?: string;
    company?: string;
    to_date?: string;
  }
): Promise<Customer360["charts"]> {
  const end = params.to_date ? new Date(params.to_date) : new Date();
  const endSafe = Number.isNaN(end.getTime()) ? new Date() : end;
  const padded = completeCustomerChartsYtd(data.charts, endSafe);
  if (!padded?.months?.length) return data.charts ?? null;

  const hasBaSalesLy = Array.isArray(data.charts?.sales_ly);
  const hasBaGrowth = Array.isArray(data.charts?.sales_growth_pct);

  /** Live SI + PE — source of truth for month sales (BA often sends 0 for skipped months). */
  const live = await fetchCustomerMonthlyTrend(params);

  let sales = padded.sales;
  const len = padded.months?.length || padded.sales?.length || 0;
  let collection = padded.collection;

  const preferBaChartSales =
    hasAuthoritativeBaSales(data.sales) &&
    collectionSeriesHasValue(padded.sales);

  if (live?.sales?.length && len > 0) {
    sales = mergeSalesSeries(
      padded.sales,
      live.sales,
      len,
      preferBaChartSales
    );
  }

  if (live?.collection?.length && len > 0) {
    collection = mergeCollectionSeries(
      padded.collection,
      live.collection,
      len
    );
  } else if (
    len > 0 &&
    !collectionSeriesHasValue(padded.collection) &&
    live?.collection?.length
  ) {
    collection = live.collection;
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
      collection: merged.collection,
    });
  }
  return merged;
}

async function fetchYtdInvoiceCountForAvg(params: {
  customer: string;
  company?: string;
}): Promise<number | null> {
  try {
    await prepare();
    const todayIso = toIsoDate(new Date());
    const yearStart = `${new Date().getFullYear()}-01-01`;
    const filters: unknown[] = [
      ["customer", "=", params.customer],
      ["docstatus", "=", 1],
      ["posting_date", ">=", yearStart],
      ["posting_date", "<=", todayIso],
    ];
    if (params.company) {
      filters.push(["company", "=", params.company]);
    }
    const res = await http.get<any>(
      "/api/method/frappe.client.get_list",
      {
        doctype: "Sales Invoice",
        fields: JSON.stringify(["name"]),
        filters: JSON.stringify(filters),
        limit_page_length: 5000,
      },
      { silentError: true }
    );
    const raw = unwrapFrappeMessage(res);
    const rows = Array.isArray(raw)
      ? raw
      : Array.isArray(res?.message)
        ? res.message
        : [];
    return rows.length > 0 ? rows.length : null;
  } catch {
    return null;
  }
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
      limit_page_length: 5000,
      order_by: "posting_date desc",
    });

    const raw = unwrapFrappeMessage(res);
    const rows = Array.isArray(raw)
      ? raw
      : Array.isArray(res?.message)
        ? res.message
        : [];
    if (!rows.length) {
      return null;
    }

    let todaySum = 0;
    let mtdSum = 0;
    let ytdSum = 0;
    let periodSum = 0;
    let count = 0;
    let lastDate: string | null = null;
    const names: string[] = [];

    let ytdInvoiceCount = 0;
    let ytdInvoiceSum = 0;

    for (const row of rows) {
      const amt = salesInvoiceNetAmount(row);
      const d = String(row.posting_date || "");
      if (!d) continue;
      count += 1;
      periodSum += amt;
      if (row.name) names.push(String(row.name));
      if (!lastDate || d > lastDate) lastDate = d;
      if (d === todayIso) todaySum += amt;
      if (d >= monthStart && d <= todayIso) mtdSum += amt;
      if (d >= yearStart && d <= todayIso) {
        ytdSum += amt;
        ytdInvoiceSum += amt;
        ytdInvoiceCount += 1;
      }
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
      avg_invoice:
        ytdInvoiceCount > 0
          ? ytdInvoiceSum / ytdInvoiceCount
          : count > 0
            ? periodSum / count
            : null,
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

  // Statement API is open-outstanding scope — do not map total_invoiced → YTD sales.
  const invoiced = Number(
    stmt.sales_ytd ?? stmt.ytd ?? stmt.total_sales ?? NaN
  );
  const mtd = Number(stmt.sales_mtd ?? stmt.mtd ?? NaN);
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
    today: preferLiveSalesMetric(derivedToday, existing?.today),
    mtd: preferLiveSalesMetric(derivedMtd, existing?.mtd),
    ytd: preferLiveSalesMetric(derivedYtd, existing?.ytd),
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

  const scope = useAuthStore.getState().permissions?.scope;
  if (
    (needsIdentityEnrichment(next) || next.customer.credit_limit == null) &&
    !isKnownTerritoryName(party, scope)
  ) {
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

  const partyId = String(next.customer.id || party).trim();
  const needStmt =
    Boolean(partyId) ||
    needsReceivablesEnrichment(next) ||
    needsSalesEnrichment(next);

  if (needStmt && partyId) {
    try {
      const { defaultStatementFromDate } = await import("./customerStatement");
      const stmt = await optimizedApis.getCustomerStatement({
        customer: partyId,
        company: params.company || next.meta.company || undefined,
        from_date: defaultStatementFromDate(),
        to_date: params.to_date || toIsoDate(new Date()),
      });
      if (stmt && typeof stmt === "object") {
        if (__DEV__) {
          console.log("📊 Customer statement keys:", Object.keys(stmt), {
            total_invoiced: stmt.total_invoiced,
            items: Array.isArray(stmt.items) ? stmt.items.length : 0,
          });
        }

        const {
          computeStatementOverdueFromItems,
          reconcileStatementOverdue,
        } = await import("./customerStatement");
        const asOf = String(stmt.to_date || toIsoDate(new Date()));
        const outstanding =
          Number(
            stmt.total_outstanding ??
              stmt.outstanding ??
              stmt.customer_outstanding
          ) || null;
        const priorOverdue = next.receivables?.overdue ?? null;
        const overdueFromItems = computeStatementOverdueFromItems(
          stmt.items,
          asOf
        );
        const serverOverdueRaw = stmt.total_overdue ?? stmt.overdue;
        const serverOverdue =
          serverOverdueRaw != null &&
          Number.isFinite(Number(serverOverdueRaw))
            ? Number(serverOverdueRaw)
            : null;
        let overdue = reconcileStatementOverdue(
          outstanding,
          serverOverdue,
          overdueFromItems
        );
        if (
          (overdue == null || overdue === 0) &&
          outstanding != null &&
          outstanding > 0 &&
          priorOverdue != null &&
          priorOverdue > 0
        ) {
          overdue = Math.min(priorOverdue, outstanding);
        }

        let current = next.receivables?.current ?? null;
        if (
          outstanding != null &&
          overdue != null &&
          Number.isFinite(Number(overdue))
        ) {
          current = Math.max(0, Number(outstanding) - Number(overdue));
        }

        let avgMonthly = next.receivables?.avg_monthly_sales ?? null;
        if (!hasAuthoritativeBaSales(next.sales)) {
          const invoiced = Number(stmt.total_invoiced);
          if (Number.isFinite(invoiced) && invoiced > 0) {
            const from = String(stmt.from_date || params.from_date || "");
            const to = String(stmt.to_date || params.to_date || "");
            const months = monthsBetweenInclusive(from, to);
            if (months > 0) avgMonthly = invoiced / months;
          }
        }

        const avgPaid =
          paidFromStatementItems(stmt) ??
          next.receivables?.avg_monthly_paid ??
          null;

        if (
          outstanding != null ||
          overdue != null ||
          avgMonthly != null ||
          avgPaid != null
        ) {
          next.receivables = {
            ...(next.receivables || {}),
            outstanding:
              outstanding != null && Number.isFinite(outstanding)
                ? outstanding
                : next.receivables?.outstanding ?? null,
            overdue:
              overdue != null && Number.isFinite(Number(overdue))
                ? overdue
                : next.receivables?.overdue ?? null,
            current,
            avg_monthly_sales: avgMonthly,
            avg_monthly_paid: avgPaid,
            oldest_invoice: next.receivables?.oldest_invoice ?? null,
          };
        }

        // Statement is open AR — never replace SDB/desk sales KPIs from get_customer_360
        if (!hasAuthoritativeBaSales(next.sales)) {
          next.sales = applyStatementToSales(next.sales, stmt, params);
        }

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

  // Avg invoice: BA sales block often omits it — fill without overwriting SDB mtd/ytd/gp
  if (needsAvgInvoiceEnrichment(next.sales)) {
    const avgFromSi = await fetchCustomerSalesFromInvoices({
      customer: String(next.customer.id || party),
      company: params.company || next.meta.company || undefined,
      from_date: params.from_date || `${new Date().getFullYear()}-01-01`,
      to_date: params.to_date || toIsoDate(new Date()),
    });
    if (avgFromSi?.avg_invoice != null && avgFromSi.avg_invoice > 0) {
      next.sales = {
        ...(next.sales || {
          today: null,
          mtd: null,
          ytd: null,
          ytd_ly: null,
          growth_pct: null,
          gp: null,
          gp_pct: null,
        }),
        avg_invoice: avgFromSi.avg_invoice,
        last_invoice_date:
          avgFromSi.last_invoice_date || next.sales?.last_invoice_date || null,
      };
    } else if (
      hasAuthoritativeBaSales(next.sales) &&
      next.sales!.ytd != null &&
      next.sales!.ytd! > 0
    ) {
      const derived = await fetchYtdInvoiceCountForAvg({
        customer: String(next.customer.id || party),
        company: params.company || next.meta.company || undefined,
      });
      if (derived != null && derived > 0) {
        next.sales = {
          ...next.sales!,
          avg_invoice: next.sales!.ytd! / derived,
        };
      }
    }
  }

  // Live SI list when Today / MTD / YTD / GP are incomplete
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
        today: preferLiveSalesMetric(fromInvoices.today, next.sales?.today),
        mtd: preferLiveSalesMetric(fromInvoices.mtd, next.sales?.mtd),
        ytd: preferLiveSalesMetric(fromInvoices.ytd, next.sales?.ytd),
        ytd_ly: next.sales?.ytd_ly ?? null,
        growth_pct: next.sales?.growth_pct ?? null,
        gp:
          next.sales?.gp != null && next.sales.gp !== 0
            ? next.sales.gp
            : fromInvoices.gp ?? next.sales?.gp ?? null,
        gp_pct:
          next.sales?.gp_pct != null && next.sales.gp_pct !== 0
            ? next.sales.gp_pct
            : fromInvoices.gp_pct ?? next.sales?.gp_pct ?? null,
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
      customer_name: next.customer.name,
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
    customer_name: next.customer.name,
    company: params.company || next.meta.company || undefined,
    to_date: params.to_date,
  });

  if (
    next.receivables?.avg_monthly_paid == null &&
    collectionSeriesHasValue(next.charts?.collection)
  ) {
    const nums = (next.charts!.collection || []).filter(
      (n): n is number => typeof n === "number" && Number.isFinite(n)
    );
    if (nums.length) {
      next.receivables = {
        ...(next.receivables || {}),
        avg_monthly_paid: nums.reduce((a, b) => a + b, 0) / nums.length,
      };
    }
  }

  if (!next.activity?.last_payment && next.charts?.collection) {
    const peRows = await listCustomerPaymentEntries({
      partyCandidates: uniquePartyCandidates(
        String(next.customer.id || party),
        next.customer.name
      ),
      company: params.company || next.meta.company || undefined,
      from_date: `${new Date().getFullYear()}-01-01`,
      to_date: params.to_date || toIsoDate(new Date()),
    });
    let lastPay: string | null = null;
    for (const row of peRows) {
      const d = String(row.posting_date || "");
      if (d && (!lastPay || d > lastPay)) lastPay = d;
    }
    if (lastPay) {
      next.activity = {
        ...(next.activity || {
          last_quotation: null,
          last_sales_order: null,
          last_delivery: null,
          last_invoice: null,
          last_payment: null,
        }),
        last_payment: lastPay,
      };
    }
  }

  // MTD backup from current-month chart bar when SI list was unavailable
  if (next.sales && next.sales.mtd == null && next.charts?.sales?.length) {
    const mi = new Date().getMonth();
    const chartMtd = next.charts.sales[mi];
    if (chartMtd != null && Number.isFinite(Number(chartMtd))) {
      next.sales = { ...next.sales, mtd: Number(chartMtd) };
    }
  }

  // Avg monthly sales = YTD net ÷ months (BA often sends avg_invoice here by mistake)
  const avgMonthlyFromYtd = computeCustomerAvgMonthlySales(
    next.sales?.ytd,
    params.to_date || toIsoDate(new Date())
  );
  if (avgMonthlyFromYtd != null) {
    next.receivables = { ...(next.receivables || {}) };
    const prev = next.receivables.avg_monthly_sales;
    next.receivables.avg_monthly_sales = avgMonthlyFromYtd;
    if (__DEV__ && prev != null && Math.abs(prev - avgMonthlyFromYtd) > 1) {
      console.log("📊 Customer avg monthly sales from YTD:", {
        was: prev,
        now: avgMonthlyFromYtd,
        ytd: next.sales?.ytd,
        avgInvoice: next.sales?.avg_invoice,
      });
    }
  } else if (next.receivables || next.sales || next.charts) {
    next.receivables = { ...(next.receivables || {}) };
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
  }

  if (next.receivables || next.sales || next.charts) {
    next.receivables = { ...(next.receivables || {}) };
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

  await reconcileSuspiciousSalesGp(next, params, party);

  return next;
}

export async function searchCustomers(
  query: string,
  options?: CustomerSearchOptions
): Promise<CustomerSearchHit[]> {
  const state = useAuthStore.getState();
  const cfg = state.mobileConfig;
  const territory = String(options?.territory || "").trim();

  const demo = demoDataOnlyWhenNoServer(() => getDemoCustomerSearch(query));
  if (demo !== undefined) {
    return filterRowsByTerritory(demo, territory);
  }

  const applyTerritory = (hits: CustomerSearchHit[]) =>
    filterRowsByTerritory(hits, territory);

  const tryBaSearch = async () => {
    await prepare();
    const company = resolveCompanyName(
      state.permissions.scope?.company
    );
    const territoryParams = baTerritoryRequestParams(
      territoryFilters(territory)
    );
    const response = await http.get<any>(
      ERP_ANALYSIS.customer360.search,
      filterBaParams(
        {
          q: query,
          search: query,
          company,
          limit: 25,
          ...territoryParams,
        },
        cfg
      )
    );
    return applyTerritory(
      normalizeCustomerSearch(unwrapFrappeMessage(response))
    );
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
      } else if (
        isBaPermissionDeniedError(error) ||
        isTransientGatewayError(error)
      ) {
        const ax = error as { response?: { data?: unknown; status?: number } };
        const status = ax?.response?.status;
        console.warn(
          status === 403
            ? "⚠️ BA search_customers denied (403) — falling back to Frappe Customer search"
            : `⚠️ BA search_customers unavailable (HTTP ${status ?? "?"}) — falling back to Frappe Customer search`,
          ax?.response?.data || (error as Error)?.message
        );
      } else {
        throw error;
      }
    }
  }

  // Real ERP Customer list — never sample names on a configured server
  try {
    return applyTerritory(await searchCustomersViaFrappe(query, territory));
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
  const party = await resolveCustomerParty(params.customer);

  const demo = demoDataOnlyWhenNoServer(() =>
    getDemoCustomer360(party)
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
          customer: party,
          customer_name: party,
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
        salesGp: normalized.sales?.gp,
        salesGpPct: normalized.sales?.gp_pct,
        outstanding: normalized.receivables?.outstanding,
        overdue: normalized.receivables?.overdue,
        current: normalized.receivables?.current,
        avgMonthly: normalized.receivables?.avg_monthly_sales,
        avgPaid: normalized.receivables?.avg_monthly_paid,
        openSo: normalized.orders?.open_so_count,
      });
    }
    const enriched = await enrichCustomer360FromLive(normalized, {
      customer: party,
      company,
      from_date: params.from_date,
      to_date: params.to_date,
    });
    if (__DEV__) {
      console.log("📊 Customer 360 after enrich:", {
        salesToday: enriched.sales?.today,
        salesMtd: enriched.sales?.mtd,
        salesYtd: enriched.sales?.ytd,
        salesGp: enriched.sales?.gp,
        salesGpPct: enriched.sales?.gp_pct,
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
  const shell = await fetchCustomerDocShell(party);
  if (shell) {
    return enrichCustomer360FromLive(shell, {
      customer: party,
      company:
        params.company ||
        resolveCompanyName(state.permissions.scope?.company),
      from_date: params.from_date,
      to_date: params.to_date,
    });
  }
  throw new BaApiUnavailableError("get_customer_360");
}
