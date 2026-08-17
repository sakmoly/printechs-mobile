/**
 * Phase 3G — Purchase Performance.
 */

export type BaMeta = {
  currency: string;
  company: string;
  from_date?: string;
  to_date?: string;
  generated_at?: string;
};

export type PurchaseKpis = {
  today?: number | null;
  mtd?: number | null;
  ytd?: number | null;
  ytd_ly?: number | null;
  growth_pct?: number | null;
  open_po_value?: number | null;
  open_po_count?: number | null;
  pending_receipt?: number | null;
  pending_billing?: number | null;
  supplier_count?: number | null;
  avg_order_value?: number | null;
  avg_lead_time?: number | null;
};

export type PurchaseRow = {
  id: string;
  name: string;
  amount: number;
  amount_ly?: number | null;
  growth_pct?: number | null;
  po_count?: number | null;
  avg_order_value?: number | null;
  avg_lead_time?: number | null;
  open_po_value?: number | null;
};

export type PurchaseOrderLine = {
  id: string;
  name: string;
  supplier?: string | null;
  supplier_id?: string | null;
  status?: string | null;
  transaction_date?: string | null;
  schedule_date?: string | null;
  grand_total?: number | null;
  outstanding?: number | null;
  pending_receipt?: number | null;
  pending_billing?: number | null;
};

export type StatusBucket = {
  label: string;
  count?: number | null;
  amount: number;
};

export type PurchaseDashboard = {
  meta: BaMeta;
  kpis: PurchaseKpis;
  by_supplier?: PurchaseRow[] | null;
  by_category?: PurchaseRow[] | null;
  by_status?: StatusBucket[] | null;
  orders?: PurchaseOrderLine[] | null;
  charts?: {
    months?: string[];
    purchased?: number[];
    received?: number[];
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

function normalizeRow(r: any): PurchaseRow {
  return {
    id: str(r.id || r.name || r.supplier || r.category || r.item_group),
    name: str(
      r.name ||
        r.supplier_name ||
        r.supplier ||
        r.category ||
        r.item_group ||
        "—"
    ),
    amount:
      num(
        r.amount ?? r.purchases ?? r.value ?? r.purchase_amount ?? r.total,
        0
      ) || 0,
    amount_ly: num(r.amount_ly ?? r.purchases_ly ?? r.previous, null),
    growth_pct: num(r.growth_pct ?? r.change_pct, null),
    po_count: num(r.po_count ?? r.count ?? r.order_count, null),
    avg_order_value: num(r.avg_order_value ?? r.aov, null),
    avg_lead_time: num(r.avg_lead_time ?? r.lead_time, null),
    open_po_value: num(r.open_po_value ?? r.open_value, null),
  };
}

function normalizeOrder(r: any): PurchaseOrderLine {
  return {
    id: str(r.id || r.name || r.purchase_order),
    name: str(r.name || r.purchase_order || r.id, "PO"),
    supplier: r.supplier_name || r.supplier || r.vendor || null,
    supplier_id: str(r.supplier_id || r.supplier || ""),
    status: r.status || null,
    transaction_date: r.transaction_date || r.posting_date || r.date || null,
    schedule_date: r.schedule_date || r.expected_delivery_date || null,
    grand_total: num(r.grand_total ?? r.total ?? r.amount, null),
    outstanding: num(r.outstanding, null),
    pending_receipt: num(
      r.pending_receipt ?? r.pending_receipt_value,
      null
    ),
    pending_billing: num(
      r.pending_billing ?? r.pending_billing_value,
      null
    ),
  };
}

export function normalizePurchaseDashboard(raw: any): PurchaseDashboard {
  const root = rootOf(raw);
  const meta = root.meta || {};
  const kpis = root.kpis || root.summary || root.purchase || {};
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
      today: num(kpis.today ?? kpis.purchase_today, null),
      mtd: num(kpis.mtd ?? kpis.purchase_mtd, null),
      ytd: num(kpis.ytd ?? kpis.purchase_ytd, null),
      ytd_ly: num(kpis.ytd_ly ?? kpis.previous_year_ytd, null),
      growth_pct: num(kpis.growth_pct ?? kpis.change_pct, null),
      open_po_value: num(kpis.open_po_value ?? kpis.open_value, null),
      open_po_count: num(kpis.open_po_count ?? kpis.open_count, null),
      pending_receipt: num(
        kpis.pending_receipt ?? kpis.pending_receipt_value,
        null
      ),
      pending_billing: num(
        kpis.pending_billing ?? kpis.pending_billing_value,
        null
      ),
      supplier_count: num(kpis.supplier_count ?? kpis.vendor_count, null),
      avg_order_value: num(kpis.avg_order_value ?? kpis.aov, null),
      avg_lead_time: num(kpis.avg_lead_time ?? kpis.lead_time, null),
    },
    by_supplier: Array.isArray(
      root.by_supplier || root.suppliers || root.top_vendors
    )
      ? (root.by_supplier || root.suppliers || root.top_vendors).map(
          normalizeRow
        )
      : null,
    by_category: Array.isArray(
      root.by_category || root.categories || root.item_groups
    )
      ? (root.by_category || root.categories || root.item_groups).map(
          normalizeRow
        )
      : null,
    by_status: Array.isArray(root.by_status || root.status_breakdown)
      ? (root.by_status || root.status_breakdown).map((b: any) => ({
          label: str(b.label || b.status || b.name, "Status"),
          count: num(b.count, null),
          amount: num(b.amount ?? b.value, 0) || 0,
        }))
      : null,
    orders: Array.isArray(root.orders || root.open_orders || root.rows)
      ? (root.orders || root.open_orders || root.rows).map(normalizeOrder)
      : null,
    charts: root.charts
      ? {
          months: Array.isArray(charts.months) ? charts.months : charts.labels,
          purchased: Array.isArray(charts.purchased)
            ? charts.purchased
            : Array.isArray(charts.purchase)
              ? charts.purchase
              : undefined,
          received: Array.isArray(charts.received) ? charts.received : undefined,
        }
      : null,
  };
}

export function getDemoPurchaseDashboard(): PurchaseDashboard {
  return {
    meta: {
      currency: "SAR",
      company: "Demo Company",
      from_date: `${new Date().getFullYear()}-01-01`,
      to_date: new Date().toISOString().slice(0, 10),
    },
    kpis: {
      today: 85000,
      mtd: 1890000,
      ytd: 22500000,
      ytd_ly: 19800000,
      growth_pct: 13.6,
      open_po_value: 3200000,
      open_po_count: 86,
      pending_receipt: 1850000,
      pending_billing: 780000,
      supplier_count: 45,
      avg_order_value: 6750,
      avg_lead_time: 16,
    },
    by_supplier: [
      {
        id: "SUP-ABC",
        name: "ABC Suppliers",
        amount: 2850000,
        growth_pct: 11.2,
        po_count: 35,
        avg_order_value: 8143,
        avg_lead_time: 12,
        open_po_value: 420000,
      },
      {
        id: "SUP-XYZ",
        name: "XYZ Manufacturing",
        amount: 2450000,
        growth_pct: 8.4,
        po_count: 28,
        avg_order_value: 8750,
        avg_lead_time: 18,
        open_po_value: 380000,
      },
      {
        id: "SUP-GLOBAL",
        name: "Global Materials Co",
        amount: 2200000,
        growth_pct: 15.1,
        po_count: 32,
        avg_order_value: 6875,
        avg_lead_time: 14,
        open_po_value: 290000,
      },
    ],
    by_category: [
      {
        id: "Raw Materials",
        name: "Raw Materials",
        amount: 8500000,
        po_count: 125,
        avg_lead_time: 14,
      },
      {
        id: "Equipment",
        name: "Equipment",
        amount: 6500000,
        po_count: 48,
        avg_lead_time: 28,
      },
      {
        id: "Office Supplies",
        name: "Office Supplies",
        amount: 3900000,
        po_count: 90,
        avg_lead_time: 7,
      },
    ],
    by_status: [
      { label: "Draft", count: 25, amount: 150000 },
      { label: "To Receive", count: 120, amount: 1050000 },
      { label: "To Bill", count: 45, amount: 450000 },
      { label: "Completed", count: 90, amount: 240000 },
    ],
    orders: [
      {
        id: "PO-2608-0042",
        name: "PO-2608-0042",
        supplier: "ABC Suppliers",
        supplier_id: "SUP-ABC",
        status: "To Receive",
        transaction_date: "2026-07-28",
        schedule_date: "2026-08-10",
        grand_total: 185000,
        pending_receipt: 185000,
      },
      {
        id: "PO-2608-0038",
        name: "PO-2608-0038",
        supplier: "XYZ Manufacturing",
        supplier_id: "SUP-XYZ",
        status: "To Bill",
        transaction_date: "2026-07-22",
        schedule_date: "2026-08-01",
        grand_total: 96000,
        pending_billing: 96000,
        pending_receipt: 0,
      },
      {
        id: "PO-2607-0190",
        name: "PO-2607-0190",
        supplier: "Global Materials Co",
        supplier_id: "SUP-GLOBAL",
        status: "To Receive and Bill",
        transaction_date: "2026-07-15",
        schedule_date: "2026-08-05",
        grand_total: 142000,
        pending_receipt: 72000,
        pending_billing: 142000,
      },
    ],
    charts: {
      months: ["Mar", "Apr", "May", "Jun", "Jul", "Aug"],
      purchased: [2800000, 3100000, 2950000, 3300000, 3200000, 1890000],
      received: [2600000, 2900000, 2800000, 3100000, 3000000, 1600000],
    },
  };
}
