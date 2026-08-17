/**
 * Phase 3E — Sales Order / Order Book.
 */

export type BaMeta = {
  currency: string;
  company: string;
  from_date?: string;
  to_date?: string;
  generated_at?: string;
};

export type SalesOrderKpis = {
  open_so_value?: number | null;
  open_so_count?: number | null;
  pending_delivery?: number | null;
  pending_billing?: number | null;
  backorder?: number | null;
  booked_today?: number | null;
  booked_mtd?: number | null;
  booked_ytd?: number | null;
  avg_order_value?: number | null;
};

export type OrderBookRow = {
  id: string;
  name: string;
  open_value: number;
  open_count?: number | null;
  pending_delivery?: number | null;
  pending_billing?: number | null;
  backorder?: number | null;
};

export type SalesOrderLine = {
  id: string;
  name: string;
  customer?: string | null;
  customer_id?: string | null;
  status?: string | null;
  transaction_date?: string | null;
  delivery_date?: string | null;
  grand_total?: number | null;
  outstanding?: number | null;
  delivered?: number | null;
  billed?: number | null;
  pending_delivery?: number | null;
  pending_billing?: number | null;
  salesperson?: string | null;
  territory?: string | null;
};

export type AgingBucket = {
  label: string;
  value: number;
  count?: number | null;
};

export type SalesOrderDashboard = {
  meta: BaMeta;
  kpis: SalesOrderKpis;
  by_customer?: OrderBookRow[] | null;
  by_salesperson?: OrderBookRow[] | null;
  by_territory?: OrderBookRow[] | null;
  orders?: SalesOrderLine[] | null;
  aging?: AgingBucket[] | null;
  charts?: {
    months?: string[];
    booked?: number[];
    delivered?: number[];
  } | null;
};

function num(v: unknown, fallback: number | null = 0): number | null {
  if (v == null || v === "") return fallback;
  if (typeof v === "number") return Number.isFinite(v) ? v : fallback;
  const n = Number(String(v).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : fallback;
}

function str(v: unknown, fallback = ""): string {
  return v == null ? fallback : String(v);
}

function rootOf(raw: any): any {
  if (!raw) return {};
  if (raw.data && typeof raw.data === "object") return raw.data;
  return raw;
}

function normalizeRow(r: any): OrderBookRow {
  return {
    id: str(r.id || r.name || r.customer || r.salesperson || r.territory),
    name: str(
      r.name ||
        r.customer_name ||
        r.customer ||
        r.salesperson ||
        r.territory ||
        "—"
    ),
    open_value:
      num(
        r.open_value ??
          r.open_so_value ??
          r.value ??
          r.amount ??
          r.grand_total,
        0
      ) || 0,
    open_count: num(r.open_count ?? r.open_so_count ?? r.count, null),
    pending_delivery: num(
      r.pending_delivery ?? r.pending_delivery_value,
      null
    ),
    pending_billing: num(r.pending_billing ?? r.pending_billing_value, null),
    backorder: num(r.backorder, null),
  };
}

function normalizeOrder(r: any): SalesOrderLine {
  return {
    id: str(r.id || r.name || r.sales_order),
    name: str(r.name || r.sales_order || r.id, "SO"),
    customer: r.customer_name || r.customer || null,
    customer_id: str(r.customer_id || r.customer || ""),
    status: r.status || r.delivery_status || null,
    transaction_date: r.transaction_date || r.posting_date || r.date || null,
    delivery_date: r.delivery_date || r.schedule_date || null,
    grand_total: num(r.grand_total ?? r.total ?? r.amount, null),
    outstanding: num(r.outstanding ?? r.per_billed_outstanding, null),
    delivered: num(r.delivered ?? r.delivered_qty_amount, null),
    billed: num(r.billed ?? r.billed_amount, null),
    pending_delivery: num(
      r.pending_delivery ?? r.pending_delivery_value,
      null
    ),
    pending_billing: num(r.pending_billing ?? r.pending_billing_value, null),
    salesperson: r.salesperson || r.sales_person || null,
    territory: r.territory || null,
  };
}

export function normalizeSalesOrderDashboard(raw: any): SalesOrderDashboard {
  const root = rootOf(raw);
  const meta = root.meta || {};
  const kpis = root.kpis || root.summary || root.orders || {};
  const charts = root.charts || {};

  return {
    meta: {
      currency: str(meta.currency || root.currency, "SAR"),
      company: str(meta.company || root.company, ""),
      from_date: meta.from_date || root.from_date,
      to_date: meta.to_date || root.to_date,
      generated_at: meta.generated_at,
    },
    kpis: {
      open_so_value: num(
        kpis.open_so_value ?? kpis.open_value ?? kpis.total_open,
        null
      ),
      open_so_count: num(
        kpis.open_so_count ?? kpis.open_count ?? kpis.count,
        null
      ),
      pending_delivery: num(
        kpis.pending_delivery ?? kpis.pending_delivery_value,
        null
      ),
      pending_billing: num(
        kpis.pending_billing ?? kpis.pending_billing_value,
        null
      ),
      backorder: num(kpis.backorder ?? kpis.backorder_value, null),
      booked_today: num(kpis.booked_today ?? kpis.today, null),
      booked_mtd: num(kpis.booked_mtd ?? kpis.mtd, null),
      booked_ytd: num(kpis.booked_ytd ?? kpis.ytd, null),
      avg_order_value: num(kpis.avg_order_value ?? kpis.aov, null),
    },
    by_customer: Array.isArray(root.by_customer || root.customers)
      ? (root.by_customer || root.customers).map(normalizeRow)
      : null,
    by_salesperson: Array.isArray(root.by_salesperson || root.salespersons)
      ? (root.by_salesperson || root.salespersons).map(normalizeRow)
      : null,
    by_territory: Array.isArray(root.by_territory || root.territories)
      ? (root.by_territory || root.territories).map(normalizeRow)
      : null,
    orders: Array.isArray(root.orders || root.open_orders || root.rows)
      ? (root.orders || root.open_orders || root.rows).map(normalizeOrder)
      : null,
    aging: Array.isArray(root.aging || root.buckets)
      ? (root.aging || root.buckets).map((b: any) => ({
          label: str(b.label || b.bucket || b.name, "Bucket"),
          value: num(b.value ?? b.amount ?? b.open_value, 0) || 0,
          count: num(b.count, null),
        }))
      : null,
    charts: root.charts
      ? {
          months: Array.isArray(charts.months) ? charts.months : charts.labels,
          booked: Array.isArray(charts.booked)
            ? charts.booked
            : Array.isArray(charts.orders)
              ? charts.orders
              : undefined,
          delivered: Array.isArray(charts.delivered)
            ? charts.delivered
            : undefined,
        }
      : null,
  };
}

export function getDemoSalesOrderDashboard(): SalesOrderDashboard {
  return {
    meta: {
      currency: "SAR",
      company: "Demo Company",
      from_date: `${new Date().getFullYear()}-01-01`,
      to_date: new Date().toISOString().slice(0, 10),
    },
    kpis: {
      open_so_value: 4200000,
      open_so_count: 86,
      pending_delivery: 1850000,
      pending_billing: 980000,
      backorder: 320000,
      booked_today: 145000,
      booked_mtd: 2100000,
      booked_ytd: 15400000,
      avg_order_value: 48837,
    },
    by_customer: [
      {
        id: "CUST-ALNOOR",
        name: "Al Noor Trading",
        open_value: 620000,
        open_count: 4,
        pending_delivery: 280000,
        pending_billing: 120000,
      },
      {
        id: "CUST-FADECO",
        name: "Fadeco-Arabian Food & Dairy",
        open_value: 540000,
        open_count: 3,
        pending_delivery: 310000,
        backorder: 90000,
      },
      {
        id: "CUST-RIYADH",
        name: "Riyadh Supplies LLC",
        open_value: 410000,
        open_count: 5,
        pending_delivery: 190000,
        pending_billing: 85000,
      },
    ],
    by_salesperson: [
      {
        id: "Ahmed",
        name: "Ahmed Al-Rashid",
        open_value: 1500000,
        open_count: 28,
        pending_delivery: 620000,
      },
      {
        id: "Sara",
        name: "Sara Khan",
        open_value: 1320000,
        open_count: 24,
        pending_delivery: 540000,
        backorder: 120000,
      },
      {
        id: "Omar",
        name: "Omar Hassan",
        open_value: 980000,
        open_count: 18,
        pending_delivery: 410000,
      },
    ],
    by_territory: [
      {
        id: "Dammam",
        name: "Dammam",
        open_value: 1800000,
        open_count: 34,
        pending_delivery: 780000,
      },
      {
        id: "Riyadh",
        name: "Riyadh",
        open_value: 1400000,
        open_count: 28,
        pending_delivery: 620000,
      },
      {
        id: "Jeddah",
        name: "Jeddah",
        open_value: 1000000,
        open_count: 24,
        pending_delivery: 450000,
      },
    ],
    orders: [
      {
        id: "SO-2608-0012",
        name: "SO-2608-0012",
        customer: "Al Noor Trading",
        customer_id: "CUST-ALNOOR",
        status: "To Deliver and Bill",
        transaction_date: "2026-07-28",
        delivery_date: "2026-08-08",
        grand_total: 185000,
        pending_delivery: 185000,
        pending_billing: 185000,
        salesperson: "Ahmed Al-Rashid",
        territory: "Dammam",
      },
      {
        id: "SO-2608-0008",
        name: "SO-2608-0008",
        customer: "Fadeco-Arabian Food & Dairy",
        customer_id: "CUST-FADECO",
        status: "To Deliver",
        transaction_date: "2026-07-22",
        delivery_date: "2026-08-05",
        grand_total: 240000,
        pending_delivery: 120000,
        pending_billing: 0,
        salesperson: "Sara Khan",
        territory: "Dammam",
      },
      {
        id: "SO-2607-0199",
        name: "SO-2607-0199",
        customer: "Riyadh Supplies LLC",
        customer_id: "CUST-RIYADH",
        status: "To Bill",
        transaction_date: "2026-07-10",
        delivery_date: "2026-07-25",
        grand_total: 98000,
        pending_delivery: 0,
        pending_billing: 98000,
        salesperson: "Omar Hassan",
        territory: "Riyadh",
      },
      {
        id: "SO-2607-0180",
        name: "SO-2607-0180",
        customer: "Eastern Packaging Co.",
        customer_id: "CUST-EAST",
        status: "On Hold",
        transaction_date: "2026-07-05",
        delivery_date: "2026-07-20",
        grand_total: 156000,
        pending_delivery: 156000,
        pending_billing: 156000,
        salesperson: "Sara Khan",
        territory: "Dammam",
      },
    ],
    aging: [
      { label: "0–7d", value: 980000, count: 18 },
      { label: "8–15d", value: 1250000, count: 22 },
      { label: "16–30d", value: 1100000, count: 26 },
      { label: "30d+", value: 870000, count: 20 },
    ],
    charts: {
      months: ["Mar", "Apr", "May", "Jun", "Jul", "Aug"],
      booked: [2100000, 2300000, 2450000, 2600000, 2550000, 2100000],
      delivered: [1900000, 2100000, 2200000, 2400000, 2350000, 1800000],
    },
  };
}
