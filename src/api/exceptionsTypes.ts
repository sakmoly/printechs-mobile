/**
 * Phase 3J — Management Exceptions (no target-miss until targets return).
 */

export type BaMeta = {
  currency: string;
  company: string;
  from_date?: string;
  to_date?: string;
  generated_at?: string;
};

export type ExceptionSeverity = "critical" | "high" | "medium" | "low";

export type ExceptionCategory =
  | "receivables"
  | "inventory"
  | "orders"
  | "payables"
  | "sales"
  | "approvals"
  | "other"
  | string;

export type ManagementException = {
  id: string;
  title: string;
  category: ExceptionCategory;
  severity: ExceptionSeverity;
  message?: string | null;
  metric_value?: number | null;
  metric_label?: string | null;
  party?: string | null;
  party_id?: string | null;
  reference?: string | null;
  route?: string | null;
  detected_at?: string | null;
};

export type ExceptionsDashboard = {
  meta: BaMeta;
  summary: {
    total?: number | null;
    critical?: number | null;
    high?: number | null;
    medium?: number | null;
    low?: number | null;
  };
  items: ManagementException[];
  by_category?: { category: string; count: number }[] | null;
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

function normalizeSeverity(v: unknown): ExceptionSeverity {
  const s = str(v).toLowerCase();
  if (s === "critical" || s === "high" || s === "medium" || s === "low") {
    return s;
  }
  if (s === "urgent" || s === "error") return "critical";
  if (s === "warn" || s === "warning") return "medium";
  return "medium";
}

export function normalizeExceptionsDashboard(raw: any): ExceptionsDashboard {
  const root = rootOf(raw);
  const meta = root.meta || {};
  const summary = root.summary || {};
  const list = root.items || root.exceptions || root.alerts || root.rows || [];

  const items: ManagementException[] = (Array.isArray(list) ? list : []).map(
    (r: any, i: number) => ({
      id: str(r.id || r.code || `ex-${i}`),
      title: str(r.title || r.name || r.subject, "Exception"),
      category: str(r.category || r.type || r.module, "other"),
      severity: normalizeSeverity(r.severity || r.priority || r.level),
      message: r.message || r.description || r.detail || null,
      metric_value: num(r.metric_value ?? r.value ?? r.amount, null),
      metric_label: r.metric_label || r.unit || null,
      party: r.party || r.customer || r.supplier || r.item_name || null,
      party_id: str(r.party_id || r.customer || r.supplier || r.item_code || ""),
      reference: r.reference || r.document || r.name || null,
      route: r.route || r.deep_link || null,
      detected_at: r.detected_at || r.as_of || r.date || null,
    })
  );

  const bySev = (sev: ExceptionSeverity) =>
    items.filter((x) => x.severity === sev).length;

  return {
    meta: {
      currency: str(meta.currency || root.currency, "SAR"),
      company: str(meta.company || root.company, ""),
      from_date: meta.from_date || root.from_date,
      to_date: meta.to_date || root.to_date,
      generated_at: meta.generated_at,
    },
    summary: {
      total: num(summary.total ?? items.length, items.length),
      critical: num(summary.critical, bySev("critical")),
      high: num(summary.high, bySev("high")),
      medium: num(summary.medium, bySev("medium")),
      low: num(summary.low, bySev("low")),
    },
    items,
    by_category: Array.isArray(root.by_category)
      ? root.by_category.map((c: any) => ({
          category: str(c.category || c.name, "other"),
          count: num(c.count, 0) || 0,
        }))
      : null,
  };
}

export function getDemoExceptionsDashboard(): ExceptionsDashboard {
  return {
    meta: { currency: "SAR", company: "Demo Company" },
    summary: { total: 7, critical: 2, high: 2, medium: 2, low: 1 },
    by_category: [
      { category: "receivables", count: 2 },
      { category: "inventory", count: 2 },
      { category: "orders", count: 1 },
      { category: "payables", count: 1 },
      { category: "approvals", count: 1 },
    ],
    items: [
      {
        id: "ex-ar-1",
        title: "Large overdue receivable",
        category: "receivables",
        severity: "critical",
        message: "Customer overdue > 60 days with high balance",
        metric_value: 290000,
        party: "Fadeco-Arabian Food & Dairy",
        party_id: "CUST-FADECO",
        route: "/collection-dashboard",
        detected_at: "2026-08-05",
      },
      {
        id: "ex-inv-1",
        title: "Critical stock cover",
        category: "inventory",
        severity: "critical",
        message: "A4 Paper Ream below 5 days cover",
        metric_value: 4,
        metric_label: "days",
        party: "A4 Paper Ream",
        party_id: "ITEM-100",
        route: "/inventory-health",
        detected_at: "2026-08-05",
      },
      {
        id: "ex-ar-2",
        title: "Credit limit near max",
        category: "receivables",
        severity: "high",
        message: "Available credit under 10%",
        metric_value: 420000,
        party: "Al Noor Trading",
        party_id: "CUST-ALNOOR",
        route: "/customer-360",
        detected_at: "2026-08-04",
      },
      {
        id: "ex-so-1",
        title: "SO past delivery date",
        category: "orders",
        severity: "high",
        message: "Open sales order overdue for delivery",
        metric_value: 185000,
        reference: "SO-2608-0012",
        route: "/sales-order-dashboard",
        detected_at: "2026-08-04",
      },
      {
        id: "ex-ap-1",
        title: "Overdue payable",
        category: "payables",
        severity: "medium",
        message: "Supplier bill past due",
        metric_value: 125000,
        party: "ABC Suppliers",
        route: "/payables-dashboard",
        detected_at: "2026-08-03",
      },
      {
        id: "ex-dead-1",
        title: "Dead stock concentration",
        category: "inventory",
        severity: "medium",
        message: "Non-moving stock > 5% of inventory value",
        metric_value: 980000,
        route: "/inventory-health",
        detected_at: "2026-08-02",
      },
      {
        id: "ex-apr-1",
        title: "Approvals backlog",
        category: "approvals",
        severity: "low",
        message: "Pending approvals aging over 3 days",
        metric_value: 12,
        metric_label: "docs",
        route: "/(tabs)/approvals",
        detected_at: "2026-08-05",
      },
    ],
  };
}
