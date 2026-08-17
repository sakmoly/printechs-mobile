/**
 * Phase 3F — Payables Dashboard + Payment Planning.
 */

export type BaMeta = {
  currency: string;
  company: string;
  from_date?: string;
  to_date?: string;
  generated_at?: string;
};

export type PayablesKpis = {
  total?: number | null;
  overdue?: number | null;
  overdue_pct?: number | null;
  current?: number | null;
  dpo?: number | null;
  invoice_count?: number | null;
  paid_mtd?: number | null;
  paid_ytd?: number | null;
};

export type AgingBucket = {
  label: string;
  value: number;
  count?: number | null;
  pct?: number | null;
};

export type SupplierRow = {
  id: string;
  name: string;
  outstanding: number;
  overdue?: number | null;
  invoice_count?: number | null;
  days_overdue?: number | null;
  avg_days_to_pay?: number | null;
};

export type PayableInvoice = {
  id: string;
  name: string;
  supplier?: string | null;
  supplier_id?: string | null;
  posting_date?: string | null;
  due_date?: string | null;
  grand_total?: number | null;
  outstanding?: number | null;
  overdue_days?: number | null;
  status?: string | null;
};

export type PayablesDashboard = {
  meta: BaMeta;
  kpis: PayablesKpis;
  aging?: AgingBucket[] | null;
  by_supplier?: SupplierRow[] | null;
  overdue_suppliers?: SupplierRow[] | null;
  invoices?: PayableInvoice[] | null;
  charts?: {
    months?: string[];
    invoiced?: number[];
    paid?: number[];
    overdue?: number[];
  } | null;
};

export type PaymentPlanItem = {
  id: string;
  supplier: string;
  supplier_id?: string | null;
  due_date?: string | null;
  amount: number;
  priority?: "high" | "medium" | "low" | null;
  invoice?: string | null;
  notes?: string | null;
};

export type PaymentPlanning = {
  meta: BaMeta;
  summary?: {
    due_this_week?: number | null;
    due_next_week?: number | null;
    due_this_month?: number | null;
    overdue_to_pay?: number | null;
    count?: number | null;
  } | null;
  items: PaymentPlanItem[];
  by_week?: { label: string; amount: number; count?: number | null }[] | null;
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

function normalizeSupplier(r: any): SupplierRow {
  return {
    id: str(r.id || r.supplier || r.name),
    name: str(r.name || r.supplier_name || r.supplier || r.vendor, "Supplier"),
    outstanding:
      num(r.outstanding ?? r.amount ?? r.total ?? r.value, 0) || 0,
    overdue: num(r.overdue ?? r.total_overdue, null),
    invoice_count: num(r.invoice_count ?? r.count, null),
    days_overdue: num(r.days_overdue ?? r.days ?? r.oldest_days, null),
    avg_days_to_pay: num(r.avg_days_to_pay ?? r.average_days_to_pay, null),
  };
}

function normalizeInvoice(r: any): PayableInvoice {
  return {
    id: str(r.id || r.name || r.invoice),
    name: str(r.name || r.invoice || r.id, "PI"),
    supplier: r.supplier_name || r.supplier || r.vendor || null,
    supplier_id: str(r.supplier_id || r.supplier || ""),
    posting_date: r.posting_date || r.bill_date || r.date || null,
    due_date: r.due_date || null,
    grand_total: num(r.grand_total ?? r.total ?? r.amount, null),
    outstanding: num(r.outstanding ?? r.outstanding_amount, null),
    overdue_days: num(r.overdue_days ?? r.days_overdue, null),
    status: r.status || null,
  };
}

export function normalizePayablesDashboard(raw: any): PayablesDashboard {
  const root = rootOf(raw);
  const meta = root.meta || {};
  const kpis = root.kpis || root.summary || root.payables || {};
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
      total: num(kpis.total ?? kpis.total_payable ?? kpis.outstanding, null),
      overdue: num(kpis.overdue ?? kpis.total_overdue, null),
      overdue_pct: num(kpis.overdue_pct ?? kpis.overdue_percentage, null),
      current: num(kpis.current, null),
      dpo: num(kpis.dpo ?? kpis.average_days_to_pay, null),
      invoice_count: num(kpis.invoice_count ?? kpis.count, null),
      paid_mtd: num(kpis.paid_mtd ?? kpis.payments_mtd, null),
      paid_ytd: num(kpis.paid_ytd ?? kpis.payments_ytd, null),
    },
    aging: Array.isArray(root.aging || root.aging_breakdown || root.buckets)
      ? (root.aging || root.aging_breakdown || root.buckets).map((b: any) => ({
          label: str(b.label || b.period || b.bucket || b.name, "Bucket"),
          value: num(b.value ?? b.amount, 0) || 0,
          count: num(b.count ?? b.vendor_count, null),
          pct: num(b.pct ?? b.percentage, null),
        }))
      : null,
    by_supplier: Array.isArray(
      root.by_supplier || root.suppliers || root.top_vendors
    )
      ? (root.by_supplier || root.suppliers || root.top_vendors).map(
          normalizeSupplier
        )
      : null,
    overdue_suppliers: Array.isArray(
      root.overdue_suppliers || root.top_overdue_vendors
    )
      ? (root.overdue_suppliers || root.top_overdue_vendors).map(
          normalizeSupplier
        )
      : null,
    invoices: Array.isArray(root.invoices || root.bills || root.rows)
      ? (root.invoices || root.bills || root.rows).map(normalizeInvoice)
      : null,
    charts: root.charts
      ? {
          months: Array.isArray(charts.months) ? charts.months : charts.labels,
          invoiced: Array.isArray(charts.invoiced) ? charts.invoiced : undefined,
          paid: Array.isArray(charts.paid) ? charts.paid : undefined,
          overdue: Array.isArray(charts.overdue) ? charts.overdue : undefined,
        }
      : null,
  };
}

export function normalizePaymentPlanning(raw: any): PaymentPlanning {
  const root = rootOf(raw);
  const meta = root.meta || {};
  const summary = root.summary || {};
  const list = root.items || root.payments || root.plan || root.rows || [];

  const items: PaymentPlanItem[] = (Array.isArray(list) ? list : []).map(
    (r: any) => {
      const p = str(r.priority || r.urgency).toLowerCase();
      return {
        id: str(r.id || r.invoice || r.name || `${r.supplier}-${r.due_date}`),
        supplier: str(r.supplier_name || r.supplier || r.vendor, "Supplier"),
        supplier_id: str(r.supplier_id || r.supplier || ""),
        due_date: r.due_date || r.payment_date || null,
        amount: num(r.amount ?? r.outstanding ?? r.value, 0) || 0,
        priority:
          p === "high" || p === "medium" || p === "low"
            ? (p as "high" | "medium" | "low")
            : null,
        invoice: r.invoice || r.name || r.purchase_invoice || null,
        notes: r.notes || r.reason || r.comment || null,
      };
    }
  );

  return {
    meta: {
      currency: str(meta.currency || root.currency, "SAR"),
      company: str(meta.company || root.company, ""),
      from_date: meta.from_date || root.from_date,
      to_date: meta.to_date || root.to_date,
      generated_at: meta.generated_at,
    },
    summary: root.summary
      ? {
          due_this_week: num(summary.due_this_week, null),
          due_next_week: num(summary.due_next_week, null),
          due_this_month: num(summary.due_this_month, null),
          overdue_to_pay: num(summary.overdue_to_pay ?? summary.overdue, null),
          count: num(summary.count ?? items.length, items.length),
        }
      : {
          count: items.length,
          due_this_week: null,
          due_next_week: null,
          due_this_month: null,
          overdue_to_pay: null,
        },
    items,
    by_week: Array.isArray(root.by_week || root.weeks)
      ? (root.by_week || root.weeks).map((w: any) => ({
          label: str(w.label || w.week || w.name, "Week"),
          amount: num(w.amount ?? w.value, 0) || 0,
          count: num(w.count, null),
        }))
      : null,
  };
}

export function getDemoPayablesDashboard(): PayablesDashboard {
  return {
    meta: {
      currency: "SAR",
      company: "Demo Company",
      from_date: `${new Date().getFullYear()}-01-01`,
      to_date: new Date().toISOString().slice(0, 10),
    },
    kpis: {
      total: 5678900,
      overdue: 678900,
      overdue_pct: 12.0,
      current: 5000000,
      dpo: 45,
      invoice_count: 186,
      paid_mtd: 2100000,
      paid_ytd: 14800000,
    },
    aging: [
      { label: "0–30d", value: 3500000, count: 95, pct: 61.6 },
      { label: "31–60d", value: 1500000, count: 48, pct: 26.4 },
      { label: "61–90d", value: 500000, count: 28, pct: 8.8 },
      { label: "90d+", value: 178900, count: 15, pct: 3.2 },
    ],
    by_supplier: [
      {
        id: "SUP-ALRASHID",
        name: "Al-Rashid Trading Co",
        outstanding: 450000,
        overdue: 45000,
        invoice_count: 12,
        avg_days_to_pay: 30,
      },
      {
        id: "SUP-TECH",
        name: "Tech Solutions Ltd",
        outstanding: 380000,
        overdue: 0,
        invoice_count: 8,
        avg_days_to_pay: 35,
      },
      {
        id: "SUP-IND",
        name: "Industrial Supplies",
        outstanding: 320000,
        overdue: 98000,
        invoice_count: 15,
        avg_days_to_pay: 42,
      },
    ],
    overdue_suppliers: [
      {
        id: "SUP-ABC",
        name: "ABC Suppliers",
        outstanding: 125000,
        overdue: 125000,
        days_overdue: 45,
        invoice_count: 4,
      },
      {
        id: "SUP-XYZ",
        name: "XYZ Corporation",
        outstanding: 98000,
        overdue: 98000,
        days_overdue: 60,
        invoice_count: 3,
      },
      {
        id: "SUP-GLOBAL",
        name: "Global Materials",
        outstanding: 87000,
        overdue: 87000,
        days_overdue: 75,
        invoice_count: 2,
      },
    ],
    invoices: [
      {
        id: "PINV-2608-001",
        name: "PINV-2608-001",
        supplier: "Al-Rashid Trading Co",
        supplier_id: "SUP-ALRASHID",
        posting_date: "2026-07-20",
        due_date: "2026-08-19",
        grand_total: 125000,
        outstanding: 125000,
        status: "Unpaid",
      },
      {
        id: "PINV-2607-088",
        name: "PINV-2607-088",
        supplier: "ABC Suppliers",
        supplier_id: "SUP-ABC",
        posting_date: "2026-06-15",
        due_date: "2026-07-15",
        grand_total: 85000,
        outstanding: 85000,
        overdue_days: 21,
        status: "Overdue",
      },
      {
        id: "PINV-2607-072",
        name: "PINV-2607-072",
        supplier: "Industrial Supplies",
        supplier_id: "SUP-IND",
        posting_date: "2026-06-01",
        due_date: "2026-07-01",
        grand_total: 98000,
        outstanding: 98000,
        overdue_days: 35,
        status: "Overdue",
      },
    ],
    charts: {
      months: ["Mar", "Apr", "May", "Jun", "Jul", "Aug"],
      invoiced: [5200000, 5500000, 5600000, 5900000, 5800000, 4200000],
      paid: [4800000, 5100000, 5300000, 5400000, 5200000, 2100000],
      overdue: [520000, 580000, 620000, 678900, 650000, 678900],
    },
  };
}

export function getDemoPaymentPlanning(): PaymentPlanning {
  return {
    meta: {
      currency: "SAR",
      company: "Demo Company",
    },
    summary: {
      due_this_week: 420000,
      due_next_week: 380000,
      due_this_month: 1450000,
      overdue_to_pay: 310000,
      count: 8,
    },
    by_week: [
      { label: "This week", amount: 420000, count: 3 },
      { label: "Next week", amount: 380000, count: 2 },
      { label: "Week +2", amount: 290000, count: 2 },
      { label: "Week +3", amount: 360000, count: 1 },
    ],
    items: [
      {
        id: "plan-1",
        supplier: "ABC Suppliers",
        supplier_id: "SUP-ABC",
        due_date: "2026-08-05",
        amount: 125000,
        priority: "high",
        invoice: "PINV-2607-088",
        notes: "Already overdue",
      },
      {
        id: "plan-2",
        supplier: "Industrial Supplies",
        supplier_id: "SUP-IND",
        due_date: "2026-08-06",
        amount: 98000,
        priority: "high",
        invoice: "PINV-2607-072",
        notes: "Critical vendor",
      },
      {
        id: "plan-3",
        supplier: "Al-Rashid Trading Co",
        supplier_id: "SUP-ALRASHID",
        due_date: "2026-08-08",
        amount: 125000,
        priority: "medium",
        invoice: "PINV-2608-001",
      },
      {
        id: "plan-4",
        supplier: "Tech Solutions Ltd",
        supplier_id: "SUP-TECH",
        due_date: "2026-08-12",
        amount: 87000,
        priority: "medium",
        invoice: "PINV-2608-014",
      },
      {
        id: "plan-5",
        supplier: "Office Equipment Corp",
        supplier_id: "SUP-OFFICE",
        due_date: "2026-08-18",
        amount: 65000,
        priority: "low",
        invoice: "PINV-2608-022",
      },
    ],
  };
}
