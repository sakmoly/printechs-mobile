import { http } from "./http";
import { useAuthStore } from "../store/auth";
import { oauthApi } from "./oauth";
import { ERP_ANALYSIS } from "./endpoints";
import { isApiEnabled } from "./mobileConfig";
import { isMissingBaMethodError } from "./baErrors";
import {
  demoDataOnlyWhenNoServer,
  filterBaParams,
  isBaMethodKnownMissing,
  markBaMethodMissing,
  resolveCompanyName,
  unwrapFrappeMessage,
} from "./apiResilience";
import {
  getDemoSalesOrderDashboard,
  normalizeSalesOrderDashboard,
  type OrderBookRow,
  type SalesOrderDashboard,
  type SalesOrderLine,
} from "./salesOrderTypes";

export type SalesOrderParams = {
  company?: string;
  from_date?: string;
  to_date?: string;
  period?: string;
  territory?: string;
  salesperson?: string;
  customer?: string;
  status?: string;
  limit?: number;
};

async function prepare() {
  const serverUrl = useAuthStore.getState().serverConfig.serverUrl;
  http.setBaseUrl(serverUrl);
  const token = await oauthApi.getValidToken();
  if (!token) throw new Error("No valid access token available");
  return useAuthStore.getState();
}

function n(v: unknown): number {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthStartIso(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function yearStartIso(): string {
  const d = new Date();
  return new Date(d.getFullYear(), 0, 1).toISOString().slice(0, 10);
}

function aggregateRows(
  orders: SalesOrderLine[],
  keyOf: (o: SalesOrderLine) => string
): OrderBookRow[] {
  const map = new Map<string, OrderBookRow>();
  for (const o of orders) {
    const id = keyOf(o) || "—";
    const cur = map.get(id) || {
      id,
      name: id,
      open_value: 0,
      open_count: 0,
      pending_delivery: 0,
      pending_billing: 0,
    };
    cur.open_value += n(o.outstanding ?? o.grand_total);
    cur.open_count = (cur.open_count || 0) + 1;
    cur.pending_delivery =
      (cur.pending_delivery || 0) + n(o.pending_delivery);
    cur.pending_billing = (cur.pending_billing || 0) + n(o.pending_billing);
    map.set(id, cur);
  }
  return Array.from(map.values()).sort((a, b) => b.open_value - a.open_value);
}

/**
 * Live order book from ERPNext Sales Order when
 * erp_analysis.sales_orders.get_sales_order_dashboard is not installed.
 */
async function fetchSalesOrderDashboardViaFrappe(
  params: SalesOrderParams
): Promise<SalesOrderDashboard> {
  await prepare();
  const state = useAuthStore.getState();
  const company =
    params.company ||
    resolveCompanyName(
      state.permissions.scope?.company,
      state.user?.company
    );
  const limit = params.limit ?? 100;
  const filters: unknown[] = [
    ["docstatus", "=", 1],
    ["status", "not in", ["Closed", "Completed", "Cancelled"]],
  ];
  if (company) filters.push(["company", "=", company]);
  if (params.customer) filters.push(["customer", "=", params.customer]);
  if (params.territory) filters.push(["territory", "=", params.territory]);
  if (params.from_date) {
    filters.push(["transaction_date", ">=", params.from_date]);
  }
  if (params.to_date) {
    filters.push(["transaction_date", "<=", params.to_date]);
  }

  const listRes = await http.get<any>("/api/method/frappe.client.get_list", {
    doctype: "Sales Order",
    fields: JSON.stringify([
      "name",
      "customer",
      "customer_name",
      "status",
      "transaction_date",
      "delivery_date",
      "grand_total",
      "base_grand_total",
      "per_delivered",
      "per_billed",
      "territory",
      "company",
      "currency",
    ]),
    filters: JSON.stringify(filters),
    order_by: "transaction_date desc",
    limit_page_length: limit,
  });

  const raw = unwrapFrappeMessage(listRes);
  const rows = Array.isArray(raw)
    ? raw
    : Array.isArray(listRes?.message)
      ? listRes.message
      : [];

  const today = todayIso();
  const mtdStart = monthStartIso();
  const ytdStart = yearStartIso();

  // Booked totals — separate submitted SO query by date (not only open)
  const bookedFilters = (from: string, to: string): unknown[] => {
    const f: unknown[] = [
      ["docstatus", "=", 1],
      ["transaction_date", ">=", from],
      ["transaction_date", "<=", to],
    ];
    if (company) f.push(["company", "=", company]);
    return f;
  };

  async function sumBooked(from: string, to: string): Promise<number> {
    try {
      const res = await http.get<any>("/api/method/frappe.client.get_list", {
        doctype: "Sales Order",
        fields: JSON.stringify(["name", "grand_total", "base_grand_total"]),
        filters: JSON.stringify(bookedFilters(from, to)),
        limit_page_length: 500,
      });
      const list = unwrapFrappeMessage(res);
      const arr = Array.isArray(list)
        ? list
        : Array.isArray(res?.message)
          ? res.message
          : [];
      return arr.reduce(
        (s: number, r: any) => s + n(r.base_grand_total ?? r.grand_total),
        0
      );
    } catch {
      return 0;
    }
  }

  const [bookedToday, bookedMtd, bookedYtd] = await Promise.all([
    sumBooked(today, today),
    sumBooked(mtdStart, today),
    sumBooked(ytdStart, today),
  ]);

  const orders: SalesOrderLine[] = rows.map((r: any) => {
    const total = n(r.base_grand_total ?? r.grand_total);
    const perDel = n(r.per_delivered);
    const perBill = n(r.per_billed);
    const delivered = (total * perDel) / 100;
    const billed = (total * perBill) / 100;
    const pendingDelivery = Math.max(0, total - delivered);
    const pendingBilling = Math.max(0, total - billed);
    return {
      id: String(r.name || ""),
      name: String(r.name || ""),
      customer: r.customer_name || r.customer || null,
      customer_id: r.customer || null,
      status: r.status || null,
      transaction_date: r.transaction_date || null,
      delivery_date: r.delivery_date || null,
      grand_total: total,
      outstanding: pendingDelivery,
      delivered,
      billed,
      pending_delivery: pendingDelivery,
      pending_billing: pendingBilling,
      salesperson: null,
      territory: r.territory || null,
    };
  });

  const openValue = orders.reduce((s, o) => s + n(o.outstanding), 0);
  const pendingDelivery = orders.reduce(
    (s, o) => s + n(o.pending_delivery),
    0
  );
  const pendingBilling = orders.reduce((s, o) => s + n(o.pending_billing), 0);
  const avgOrder =
    orders.length > 0
      ? orders.reduce((s, o) => s + n(o.grand_total), 0) / orders.length
      : 0;

  const currency = String(rows[0]?.currency || "SAR");

  return {
    meta: {
      currency,
      company: company || "",
      from_date: params.from_date,
      to_date: params.to_date,
      generated_at: new Date().toISOString(),
    },
    kpis: {
      open_so_value: openValue,
      open_so_count: orders.length,
      pending_delivery: pendingDelivery,
      pending_billing: pendingBilling,
      backorder: null,
      booked_today: bookedToday,
      booked_mtd: bookedMtd,
      booked_ytd: bookedYtd,
      avg_order_value: avgOrder,
    },
    by_customer: aggregateRows(
      orders,
      (o) => String(o.customer || o.customer_id || "—")
    ).slice(0, 25),
    by_salesperson: null,
    by_territory: aggregateRows(
      orders,
      (o) => String(o.territory || "—")
    ).slice(0, 25),
    orders,
    aging: null,
    charts: null,
  };
}

export async function fetchSalesOrderDashboard(
  params: SalesOrderParams = {}
): Promise<SalesOrderDashboard> {
  const state = useAuthStore.getState();
  const cfg = state.mobileConfig;
  const demo = demoDataOnlyWhenNoServer(getDemoSalesOrderDashboard);
  if (demo !== undefined) return demo;

  const tryBa = async () => {
    await prepare();
    const company =
      params.company ||
      resolveCompanyName(
        state.permissions.scope?.company,
        state.user?.company
      );
    const response = await http.get<any>(
      ERP_ANALYSIS.salesOrders.getDashboard,
      filterBaParams({ ...params, company }, cfg)
    );
    return normalizeSalesOrderDashboard(unwrapFrappeMessage(response));
  };

  if (
    isApiEnabled(cfg, "get_sales_order_dashboard") &&
    !isBaMethodKnownMissing("get_sales_order_dashboard")
  ) {
    try {
      return await tryBa();
    } catch (error) {
      if (isMissingBaMethodError(error)) {
        markBaMethodMissing("get_sales_order_dashboard");
        console.log(
          "ℹ️ get_sales_order_dashboard missing — using live Sales Order list"
        );
      } else {
        throw error;
      }
    }
  }

  return fetchSalesOrderDashboardViaFrappe(params);
}
