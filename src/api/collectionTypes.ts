/**
 * Phase 3D — Collection Performance + Attention (actuals only, no targets).
 */

export type BaMeta = {
  currency: string;
  company: string;
  from_date?: string;
  to_date?: string;
  generated_at?: string;
};

export type CollectionKpis = {
  today?: number | null;
  mtd?: number | null;
  ytd?: number | null;
  ytd_ly?: number | null;
  growth_pct?: number | null;
  payment_count?: number | null;
  avg_payment?: number | null;
};

export type CollectionRow = {
  id: string;
  name: string;
  collected: number;
  collected_ly?: number | null;
  growth_pct?: number | null;
  outstanding?: number | null;
  overdue?: number | null;
  payment_count?: number | null;
  customers?: CollectionRow[] | null;
};

export type CollectionDashboard = {
  meta: BaMeta;
  kpis: CollectionKpis;
  by_territory?: CollectionRow[] | null;
  by_salesperson?: CollectionRow[] | null;
  by_customer?: CollectionRow[] | null;
  charts?: {
    months?: string[];
    collection?: number[];
    sales?: number[];
  } | null;
};

export type AttentionPriority = "high" | "medium" | "low";

export type AttentionItem = {
  id: string;
  customer_id: string;
  customer: string;
  outstanding: number;
  overdue?: number | null;
  days_overdue?: number | null;
  oldest_invoice?: string | null;
  last_payment?: string | null;
  salesperson?: string | null;
  territory?: string | null;
  priority?: AttentionPriority | null;
  reason?: string | null;
  mobile?: string | null;
  email?: string | null;
};

export type CollectionAttention = {
  meta: BaMeta;
  items: AttentionItem[];
  summary?: {
    count?: number | null;
    overdue_total?: number | null;
    high_priority?: number | null;
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

function normalizeRow(r: any): CollectionRow {
  return {
    id: str(r.id || r.name || r.territory || r.salesperson || r.customer),
    name: str(
      r.name ||
        r.territory ||
        r.salesperson ||
        r.customer_name ||
        r.customer ||
        "—"
    ),
    collected: num(r.collected ?? r.collection ?? r.amount ?? r.value, 0) || 0,
    collected_ly: num(r.collected_ly ?? r.collection_ly ?? r.previous, null),
    growth_pct: num(r.growth_pct ?? r.change_pct, null),
    outstanding: num(r.outstanding ?? r.total_unpaid, null),
    overdue: num(r.overdue ?? r.total_overdue, null),
    payment_count: num(r.payment_count ?? r.payments ?? r.count, null),
    customers: Array.isArray(r.customers)
      ? r.customers.map(normalizeRow)
      : null,
  };
}

export function normalizeCollectionDashboard(raw: any): CollectionDashboard {
  const root = rootOf(raw);
  const meta = root.meta || {};
  const kpis = root.kpis || root.summary || root.collection || {};
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
      today: num(kpis.today ?? kpis.collection_today, null),
      mtd: num(kpis.mtd ?? kpis.collection_mtd, null),
      ytd: num(kpis.ytd ?? kpis.collection_ytd, null),
      ytd_ly: num(kpis.ytd_ly ?? kpis.previous_year_ytd, null),
      growth_pct: num(kpis.growth_pct ?? kpis.change_pct, null),
      payment_count: num(kpis.payment_count ?? kpis.payments, null),
      avg_payment: num(kpis.avg_payment ?? kpis.average_payment, null),
    },
    by_territory: Array.isArray(root.by_territory || root.territories)
      ? (root.by_territory || root.territories).map(normalizeRow)
      : null,
    by_salesperson: Array.isArray(root.by_salesperson || root.salespersons)
      ? (root.by_salesperson || root.salespersons).map(normalizeRow)
      : null,
    by_customer: Array.isArray(root.by_customer || root.customers)
      ? (root.by_customer || root.customers).map(normalizeRow)
      : null,
    charts: root.charts
      ? {
          months: Array.isArray(charts.months) ? charts.months : charts.labels,
          collection: Array.isArray(charts.collection)
            ? charts.collection
            : undefined,
          sales: Array.isArray(charts.sales) ? charts.sales : undefined,
        }
      : null,
  };
}

function normalizePriority(v: unknown): AttentionPriority | null {
  const s = str(v).toLowerCase();
  if (s === "high" || s === "medium" || s === "low") return s;
  return null;
}

export function normalizeCollectionAttention(raw: any): CollectionAttention {
  const root = rootOf(raw);
  const meta = root.meta || {};
  const list =
    root.items || root.attention || root.customers || root.rows || root.data || [];
  const summary = root.summary || {};

  const items: AttentionItem[] = (Array.isArray(list) ? list : []).map(
    (r: any) => ({
      id: str(r.id || r.customer || r.name || r.customer_name),
      customer_id: str(r.customer_id || r.customer || r.id || r.name),
      customer: str(r.customer_name || r.customer || r.name, "Customer"),
      outstanding: num(r.outstanding ?? r.total_unpaid ?? r.amount, 0) || 0,
      overdue: num(r.overdue ?? r.total_overdue, null),
      days_overdue: num(r.days_overdue ?? r.oldest_days ?? r.days, null),
      oldest_invoice: r.oldest_invoice || r.oldest_invoice_date || null,
      last_payment: r.last_payment || r.last_payment_date || null,
      salesperson: r.salesperson || r.sales_person || null,
      territory: r.territory || null,
      priority: normalizePriority(r.priority || r.severity),
      reason: r.reason || r.note || r.message || null,
      mobile: r.mobile || r.mobile_no || r.phone || null,
      email: r.email || r.email_id || null,
    })
  );

  return {
    meta: {
      currency: str(meta.currency || root.currency, "SAR"),
      company: str(meta.company || root.company, ""),
      from_date: meta.from_date || root.from_date,
      to_date: meta.to_date || root.to_date,
      generated_at: meta.generated_at,
    },
    items,
    summary: root.summary
      ? {
          count: num(summary.count ?? items.length, items.length),
          overdue_total: num(summary.overdue_total ?? summary.overdue, null),
          high_priority: num(
            summary.high_priority ??
              items.filter((i) => i.priority === "high").length,
            null
          ),
        }
      : {
          count: items.length,
          overdue_total: items.reduce((s, i) => s + (i.overdue || 0), 0),
          high_priority: items.filter((i) => i.priority === "high").length,
        },
  };
}

export function getDemoCollectionDashboard(): CollectionDashboard {
  return {
    meta: {
      currency: "SAR",
      company: "Demo Company",
      from_date: `${new Date().getFullYear()}-01-01`,
      to_date: new Date().toISOString().slice(0, 10),
    },
    kpis: {
      today: 185000,
      mtd: 2450000,
      ytd: 18200000,
      ytd_ly: 16100000,
      growth_pct: 13.0,
      payment_count: 412,
      avg_payment: 44175,
    },
    by_territory: [
      {
        id: "Dammam",
        name: "Dammam",
        collected: 7200000,
        growth_pct: 11.2,
        outstanding: 3200000,
        overdue: 980000,
        payment_count: 160,
      },
      {
        id: "Riyadh",
        name: "Riyadh",
        collected: 6100000,
        growth_pct: 8.4,
        outstanding: 2800000,
        overdue: 720000,
        payment_count: 140,
      },
      {
        id: "Jeddah",
        name: "Jeddah",
        collected: 4900000,
        growth_pct: 15.1,
        outstanding: 2100000,
        overdue: 540000,
        payment_count: 112,
      },
    ],
    by_salesperson: [
      {
        id: "Ahmed",
        name: "Ahmed Al-Rashid",
        collected: 5200000,
        growth_pct: 9.5,
        outstanding: 1800000,
        overdue: 420000,
        payment_count: 98,
      },
      {
        id: "Sara",
        name: "Sara Khan",
        collected: 4800000,
        growth_pct: 14.2,
        outstanding: 1500000,
        overdue: 310000,
        payment_count: 86,
      },
      {
        id: "Omar",
        name: "Omar Hassan",
        collected: 3900000,
        growth_pct: 6.8,
        outstanding: 2200000,
        overdue: 680000,
        payment_count: 72,
      },
    ],
    by_customer: [
      {
        id: "CUST-ALNOOR",
        name: "Al Noor Trading",
        collected: 980000,
        outstanding: 420000,
        overdue: 180000,
        payment_count: 12,
      },
      {
        id: "CUST-FADECO",
        name: "Fadeco-Arabian Food & Dairy",
        collected: 860000,
        outstanding: 510000,
        overdue: 290000,
        payment_count: 9,
      },
      {
        id: "CUST-RIYADH",
        name: "Riyadh Supplies LLC",
        collected: 720000,
        outstanding: 280000,
        overdue: 95000,
        payment_count: 11,
      },
    ],
    charts: {
      months: ["Mar", "Apr", "May", "Jun", "Jul", "Aug"],
      collection: [2100000, 2250000, 2180000, 2400000, 2320000, 2450000],
      sales: [2400000, 2550000, 2480000, 2700000, 2600000, 2750000],
    },
  };
}

export function getDemoCollectionAttention(): CollectionAttention {
  return {
    meta: {
      currency: "SAR",
      company: "Demo Company",
    },
    items: [
      {
        id: "att-1",
        customer_id: "CUST-FADECO",
        customer: "Fadeco-Arabian Food & Dairy",
        outstanding: 510000,
        overdue: 290000,
        days_overdue: 67,
        oldest_invoice: "2026-05-28",
        last_payment: "2026-06-12",
        salesperson: "Sara Khan",
        territory: "Dammam",
        priority: "high",
        reason: "Overdue > 60 days",
        mobile: "+966501112233",
        email: "accounts@fadeco.example",
      },
      {
        id: "att-2",
        customer_id: "CUST-ALNOOR",
        customer: "Al Noor Trading",
        outstanding: 420000,
        overdue: 180000,
        days_overdue: 42,
        oldest_invoice: "2026-06-22",
        last_payment: "2026-07-01",
        salesperson: "Ahmed Al-Rashid",
        territory: "Dammam",
        priority: "high",
        reason: "Large overdue balance",
        mobile: "+966509998877",
      },
      {
        id: "att-3",
        customer_id: "CUST-RIYADH",
        customer: "Riyadh Supplies LLC",
        outstanding: 280000,
        overdue: 95000,
        days_overdue: 28,
        oldest_invoice: "2026-07-06",
        last_payment: "2026-07-20",
        salesperson: "Omar Hassan",
        territory: "Riyadh",
        priority: "medium",
        reason: "Approaching credit limit",
        email: "ap@riyadhsupplies.example",
      },
      {
        id: "att-4",
        customer_id: "CUST-EAST",
        customer: "Eastern Packaging Co.",
        outstanding: 165000,
        overdue: 45000,
        days_overdue: 18,
        oldest_invoice: "2026-07-16",
        last_payment: "2026-07-28",
        salesperson: "Sara Khan",
        territory: "Dammam",
        priority: "low",
        reason: "Promise-to-pay overdue",
      },
    ],
    summary: {
      count: 4,
      overdue_total: 610000,
      high_priority: 2,
    },
  };
}
