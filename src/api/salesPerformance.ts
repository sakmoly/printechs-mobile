import { http } from "./http";
import { useAuthStore } from "../store/auth";
import { oauthApi } from "./oauth";
import { ERP_ANALYSIS } from "./endpoints";
import { isApiEnabled } from "./mobileConfig";
import {
  BaApiUnavailableError,
  demoDataOnlyWhenNoServer,
  filterBaParams,
  requireBaMethodEnabled,
  restoreTerritoryBaParams,
  unwrapFrappeMessage,
  withBaDemoFallback,
} from "./apiResilience";
import {
  isBaPermissionDeniedError,
  isMissingBaMethodError,
} from "./baErrors";
import {
  getDemoProductPerformance,
  getDemoSalespersonPerformance,
  normalizeProductPerformance,
  normalizeSalespersonPerformance,
  type InvoicePerfRow,
  type ItemPerfRow,
  type ProductLevel,
  type ProductPerformance,
  type SalespersonPerformance,
} from "./salesPerformanceTypes";

export type SalesPerfParams = {
  company?: string;
  from_date?: string;
  to_date?: string;
  period?: string;
  territory?: string;
  division?: string;
  branch?: string;
  salesperson?: string;
  customer?: string;
  invoice?: string;
};

export type ProductPerfParams = SalesPerfParams & {
  level?: ProductLevel;
  brand?: string;
  item_group?: string;
  item_code?: string;
};

async function prepareRequest() {
  const serverUrl = useAuthStore.getState().serverConfig.serverUrl;
  http.setBaseUrl(serverUrl);
  const token = await oauthApi.getValidToken();
  if (!token) throw new Error("No valid access token available");
  return useAuthStore.getState().mobileConfig;
}

function rowHasDetailKpis(row: any): boolean {
  if (!row || typeof row !== "object") return false;
  return (
    row.gp != null ||
    row.gross_profit != null ||
    row.gp_pct != null ||
    row.collection != null ||
    row.collected != null ||
    row.outstanding != null ||
    row.total_outstanding != null ||
    row.overdue != null ||
    row.sales_ly != null ||
    row.previous_year_sales != null ||
    (row.metrics && typeof row.metrics === "object")
  );
}

function listHasDetailKpis(raw: any): boolean {
  const root =
    raw?.data && typeof raw.data === "object" && !Array.isArray(raw.data)
      ? raw.data
      : raw;
  const list =
    root?.rows ||
    root?.salespersons ||
    root?.salesperson ||
    root?.data ||
    root?.items ||
    [];
  if (!Array.isArray(list) || !list.length) return false;
  // If any row has detail KPIs, treat payload as complete
  return list.some(rowHasDetailKpis);
}

export async function fetchSalespersonPerformance(
  params: SalesPerfParams = {}
): Promise<SalespersonPerformance> {
  const cfg = useAuthStore.getState().mobileConfig;
  const demo = demoDataOnlyWhenNoServer(getDemoSalespersonPerformance);
  if (demo !== undefined) return demo;
  requireBaMethodEnabled(
    "get_salesperson_performance",
    isApiEnabled(cfg, "get_salesperson_performance")
  );

  return withBaDemoFallback(
    "get_salesperson_performance",
    async () => {
      await prepareRequest();

      const call = async (p: SalesPerfParams) => {
        const clean = filterBaParams(p as any, cfg);
        if (__DEV__) {
          console.log("📊 Salesperson request params:", clean);
        }
        const response = await http.get<any>(
          ERP_ANALYSIS.salesperson.getPerformance,
          clean
        );
        return unwrapFrappeMessage(response);
      };

      // Prefer explicit dates. Some BA builds only return gp/collection/AR
      // for short periods (e.g. MTD) when `period=ytd` is set — retry with
      // from_date/to_date only if detail KPIs are missing.
      let unwrapped = await call(params);
      const wantsLongRange =
        params.period === "ytd" ||
        params.period === "qtd" ||
        params.period === "previous_year" ||
        params.period === "previous_month";

      if (
        wantsLongRange &&
        params.from_date &&
        params.to_date &&
        !listHasDetailKpis(unwrapped)
      ) {
        if (__DEV__) {
          console.log(
            "⚠️ Salesperson detail KPIs missing for period=",
            params.period,
            "— retrying with date range only"
          );
        }
        const { period: _omit, ...datesOnly } = params;
        const retry = await call(datesOnly);
        if (listHasDetailKpis(retry)) {
          unwrapped = retry;
        }
      }

      if (__DEV__) {
        const root =
          unwrapped && typeof unwrapped === "object" ? unwrapped : {};
        console.log("📊 Salesperson performance keys:", Object.keys(root), {
          period: params.period,
          from: params.from_date,
          to: params.to_date,
        });
      }
      return normalizeSalespersonPerformance(unwrapped);
    },
    getDemoSalespersonPerformance
  );
}

function listFromMessage(raw: unknown, response?: any): any[] {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(response?.message)) return response.message;
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    for (const k of ["data", "rows", "invoices", "items", "values"]) {
      if (Array.isArray(o[k])) return o[k] as any[];
    }
  }
  return [];
}

function mapInvoiceRows(rows: any[]): InvoicePerfRow[] {
  return rows
    .filter((r) => r && (r.name || r.parent))
    .map((r) => ({
      id: String(r.name || r.parent || ""),
      name: String(r.name || r.parent || "Invoice"),
      posting_date: r.posting_date || undefined,
      sales: Number(
        r.base_grand_total ??
          r.grand_total ??
          r.base_net_total ??
          r.net_total ??
          0
      ),
      gp: null,
      gp_pct: null,
      customer: r.customer_name || r.customer || undefined,
      items: null,
    }));
}

/** Collapse repeated letters so Mohammed ≈ Mohammmed */
function normPersonKey(s: string): string {
  return String(s || "")
    .toLowerCase()
    .replace(/(.)\1+/g, "$1")
    .replace(/[^a-z0-9]/g, "");
}

function personLabelMatches(candidate: string, label: string): boolean {
  const a = String(candidate || "").trim().toLowerCase();
  const b = String(label || "").trim().toLowerCase();
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  return normPersonKey(a) === normPersonKey(b);
}

async function getListSafe(
  doctype: string,
  args: Record<string, unknown>
): Promise<any[]> {
  try {
    const res = await http.get<any>(
      "/api/method/frappe.client.get_list",
      { doctype, ...args },
      { silentError: true }
    );
    return listFromMessage(unwrapFrappeMessage(res), res);
  } catch (e: any) {
    const status = e?.response?.status;
    const msg = String(
      e?.response?.data?.exception ||
        e?.response?.data?._server_messages ||
        e?.message ||
        ""
    );
    // Expected: no parent sales_person; Sales Team child often not readable via client
    if (
      status === 403 ||
      status === 417 ||
      msg.includes("Field not permitted") ||
      msg.includes("PermissionError") ||
      msg.toLowerCase().includes("not permitted")
    ) {
      if (__DEV__) {
        console.log("ℹ️ get_list skipped:", doctype, status || msg.slice(0, 80));
      }
      return [];
    }
    if (__DEV__) {
      console.warn("⚠️ get_list failed:", doctype, e?.message || e);
    }
    return [];
  }
}

/** Resolve Sales Person link names that match the BA ranking label. */
async function resolveSalesPersonNames(label: string): Promise<string[]> {
  const names = new Set<string>();
  const trimmed = String(label || "").trim();
  if (trimmed) names.add(trimmed);

  const rows = await getListSafe("Sales Person", {
    fields: JSON.stringify(["name", "sales_person_name", "employee"]),
    limit_page_length: 500,
  });

  for (const r of rows) {
    const n = String(r?.name || "").trim();
    const sn = String(r?.sales_person_name || "").trim();
    if (n && (personLabelMatches(n, trimmed) || personLabelMatches(sn, trimmed))) {
      names.add(n);
    }
  }

  // If master list was empty/forbidden, still try like on name
  if (names.size <= 1 && trimmed) {
    const liked = await getListSafe("Sales Person", {
      fields: JSON.stringify(["name", "sales_person_name"]),
      filters: JSON.stringify([["name", "like", `%${trimmed.split(/\s+/)[0]}%`]]),
      limit_page_length: 50,
    });
    for (const r of liked) {
      const n = String(r?.name || "").trim();
      const sn = String(r?.sales_person_name || "").trim();
      if (
        n &&
        (personLabelMatches(n, trimmed) || personLabelMatches(sn, trimmed))
      ) {
        names.add(n);
      }
    }
  }

  return [...names];
}

/** Desk-style list — often allows Sales Team child filters when client.get_list does not. */
async function reportviewInvoices(params: {
  person: string;
  company?: string;
  from_date?: string;
  to_date?: string;
  limit: number;
}): Promise<any[]> {
  try {
    const filters: unknown[] = [["Sales Invoice", "docstatus", "=", 1]];
    if (params.company) {
      filters.push(["Sales Invoice", "company", "=", params.company]);
    }
    if (params.from_date) {
      filters.push([
        "Sales Invoice",
        "posting_date",
        ">=",
        params.from_date,
      ]);
    }
    if (params.to_date) {
      filters.push(["Sales Invoice", "posting_date", "<=", params.to_date]);
    }
    filters.push(["Sales Team", "sales_person", "=", params.person]);

    const res = await http.get<any>(
      "/api/method/frappe.desk.reportview.get",
      {
        doctype: "Sales Invoice",
        fields: JSON.stringify([
          "`tabSales Invoice`.`name`",
          "`tabSales Invoice`.`customer`",
          "`tabSales Invoice`.`customer_name`",
          "`tabSales Invoice`.`posting_date`",
          "`tabSales Invoice`.`grand_total`",
          "`tabSales Invoice`.`base_grand_total`",
          "`tabSales Invoice`.`net_total`",
          "`tabSales Invoice`.`base_net_total`",
        ]),
        filters: JSON.stringify(filters),
        order_by: "`tabSales Invoice`.`posting_date` desc",
        start: 0,
        page_length: params.limit,
      },
      { silentError: true }
    );

    const msg = unwrapFrappeMessage(res) || res?.message || res;
    if (!msg) return [];

    // Newer: { keys, values }
    if (Array.isArray(msg.values) && Array.isArray(msg.keys)) {
      const keys = msg.keys.map((k: string) =>
        String(k).replace(/`/g, "").split(".").pop()
      );
      return msg.values.map((vals: any[]) => {
        const row: Record<string, unknown> = {};
        keys.forEach((k: string, i: number) => {
          row[k] = vals[i];
        });
        return row;
      });
    }

    // Older: array of dicts
    if (Array.isArray(msg)) return msg;
    if (Array.isArray(msg.docs)) return msg.docs;
    return [];
  } catch (e: any) {
    if (__DEV__) {
      console.log(
        "ℹ️ reportview invoice query skipped:",
        e?.response?.status || e?.message
      );
    }
    return [];
  }
}

/**
 * Drill-down: invoices for one salesperson in the period.
 * Prefer reportview + Sales Team child filter. Avoid parent `sales_person`
 * (417) and direct Sales Team get_list (often 403 for OAuth roles).
 */
export async function fetchSalespersonInvoices(params: {
  salesperson: string;
  salesperson_id?: string;
  company?: string;
  from_date?: string;
  to_date?: string;
  limit?: number;
}): Promise<InvoicePerfRow[]> {
  const demo = demoDataOnlyWhenNoServer(() => [] as InvoicePerfRow[]);
  if (demo !== undefined) return demo;

  const label = String(params.salesperson || "").trim();
  const altId = String(params.salesperson_id || "").trim();
  if (!label && !altId) return [];

  await prepareRequest();

  const limit = params.limit ?? 100;
  const fields = JSON.stringify([
    "name",
    "customer",
    "customer_name",
    "posting_date",
    "grand_total",
    "base_grand_total",
    "net_total",
    "base_net_total",
    "outstanding_amount",
    "status",
  ]);
  const order_by = "posting_date desc";

  const baseFilters: unknown[] = [["docstatus", "=", 1]];
  if (params.company) baseFilters.push(["company", "=", params.company]);
  if (params.from_date)
    baseFilters.push(["posting_date", ">=", params.from_date]);
  if (params.to_date) baseFilters.push(["posting_date", "<=", params.to_date]);

  const personNames = new Set<string>([
    ...(await resolveSalesPersonNames(label || altId)),
  ]);
  if (altId) {
    for (const n of await resolveSalesPersonNames(altId)) personNames.add(n);
  }
  const resolved = [...personNames];
  if (__DEV__) {
    console.log("📊 Salesperson invoice resolve:", {
      label,
      altId: altId || null,
      personNames: resolved,
    });
  }

  // 1) Desk reportview (best chance with Sales Team child filter)
  for (const person of resolved) {
    const rows = await reportviewInvoices({
      person,
      company: params.company,
      from_date: params.from_date,
      to_date: params.to_date,
      limit,
    });
    if (rows.length) return mapInvoiceRows(rows);
  }

  // 2) client.get_list on Sales Invoice + Sales Team child (no parent field)
  for (const person of resolved) {
    const rows = await getListSafe("Sales Invoice", {
      fields,
      filters: JSON.stringify([
        ...baseFilters,
        ["Sales Team", "sales_person", "=", person],
      ]),
      limit_page_length: limit,
      order_by,
    });
    if (rows.length) return mapInvoiceRows(rows);
  }

  if (__DEV__) {
    console.log("ℹ️ No invoices for salesperson", {
      label,
      personNames: resolved,
      from: params.from_date,
      to: params.to_date,
    });
  }
  return [];
}

function mapItemRows(items: any[]): ItemPerfRow[] {
  return (items || []).map((it: any) => {
    const qty = Number(it.qty) || 0;
    const sales = Number(
      it.base_amount ??
        it.amount ??
        it.base_net_amount ??
        it.net_amount ??
        0
    );
    return {
      id: String(it.item_code || it.name || "item"),
      name: String(it.item_name || it.item_code || "Item"),
      qty,
      sales,
      gp: null,
      gp_pct: null,
      asp: qty > 0 ? sales / qty : null,
    };
  });
}

/** Line items for one Sales Invoice (optional second drill). */
export async function fetchSalesInvoiceItems(
  invoice: string
): Promise<ItemPerfRow[]> {
  const demo = demoDataOnlyWhenNoServer(() => [] as ItemPerfRow[]);
  if (demo !== undefined) return demo;
  const name = String(invoice || "").trim();
  if (!name) return [];

  await prepareRequest();

  const itemFields = [
    "item_code",
    "item_name",
    "qty",
    "amount",
    "base_amount",
    "rate",
    "net_amount",
    "base_net_amount",
    "idx",
  ];

  // 1) Child rows via get_list (avoids full SI read on some sites)
  const listed = await getListSafe("Sales Invoice Item", {
    fields: JSON.stringify(itemFields),
    filters: JSON.stringify([["parent", "=", name]]),
    limit_page_length: 200,
    order_by: "idx asc",
  });
  if (listed.length) return mapItemRows(listed);

  // 2) Desk reportview on child doctype
  try {
    const res = await http.get<any>(
      "/api/method/frappe.desk.reportview.get",
      {
        doctype: "Sales Invoice Item",
        fields: JSON.stringify(itemFields.map((f) => `\`${f}\``)),
        filters: JSON.stringify([
          ["Sales Invoice Item", "parent", "=", name],
        ]),
        order_by: "`idx` asc",
        start: 0,
        page_length: 200,
      },
      { silentError: true }
    );
    const msg = unwrapFrappeMessage(res) || res?.message || res;
    if (msg && Array.isArray(msg.values) && Array.isArray(msg.keys)) {
      const keys = msg.keys.map((k: string) =>
        String(k).replace(/`/g, "").split(".").pop()
      );
      const rows = msg.values.map((vals: any[]) => {
        const row: Record<string, unknown> = {};
        keys.forEach((k: string, i: number) => {
          row[k] = vals[i];
        });
        return row;
      });
      if (rows.length) return mapItemRows(rows);
    }
  } catch {
    /* quiet */
  }

  // 3) Full doc get — often 403 for OAuth roles; keep silent
  try {
    const res = await http.get<any>(
      "/api/method/frappe.client.get",
      { doctype: "Sales Invoice", name },
      { silentError: true }
    );
    const doc = unwrapFrappeMessage(res) || {};
    const items = Array.isArray(doc.items) ? doc.items : [];
    if (items.length) return mapItemRows(items);
  } catch (e: any) {
    if (__DEV__) {
      console.log(
        "ℹ️ Invoice items unavailable:",
        e?.response?.status || e?.message
      );
    }
  }

  return [];
}

async function callProductPerformanceApi(
  clean: Record<string, unknown>
): Promise<unknown> {
  const url = ERP_ANALYSIS.product.getPerformance;
  try {
    return await http.post<any>(url, clean, { silentError: true });
  } catch (postErr) {
    const postStatus = (postErr as { response?: { status?: number } })?.response
      ?.status;
    try {
      return await http.get<any>(url, clean, { silentError: true });
    } catch (getErr) {
      if (postStatus === 405 || postStatus === 404) {
        throw getErr;
      }
      throw postErr;
    }
  }
}

export async function fetchProductPerformance(
  params: ProductPerfParams = {}
): Promise<ProductPerformance> {
  const cfg = useAuthStore.getState().mobileConfig;
  const level = params.level || "division";
  const demo = demoDataOnlyWhenNoServer(() =>
    getDemoProductPerformance(level)
  );
  if (demo !== undefined) return demo;
  requireBaMethodEnabled(
    "get_product_performance",
    isApiEnabled(cfg, "get_product_performance")
  );

  return withBaDemoFallback(
    "get_product_performance",
    async () => {
      await prepareRequest();
      const raw = { ...params, level } as Record<string, unknown>;
      let clean = restoreTerritoryBaParams(
        raw,
        filterBaParams(raw, cfg)
      );
      if (clean.territory && !clean.territories) {
        clean = { ...clean, territories: clean.territory };
      }
      try {
        const response = await callProductPerformanceApi(clean);
        return normalizeProductPerformance(
          unwrapFrappeMessage(response),
          level
        );
      } catch (error) {
        if (
          isMissingBaMethodError(error) ||
          isBaPermissionDeniedError(error)
        ) {
          throw error;
        }
        const status = (error as { response?: { status?: number } })?.response
          ?.status;
        if (status === 400 || status === 403) {
          throw new BaApiUnavailableError("get_product_performance");
        }
        throw error;
      }
    },
    () => getDemoProductPerformance(level)
  );
}
