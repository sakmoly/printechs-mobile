/**
 * Phase 3K — Approval Analytics.
 */

export type BaMeta = {
  currency: string;
  company: string;
  from_date?: string;
  to_date?: string;
  generated_at?: string;
};

export type ApprovalAnalyticsKpis = {
  pending_count?: number | null;
  approved_count?: number | null;
  rejected_count?: number | null;
  avg_cycle_hours?: number | null;
  median_cycle_hours?: number | null;
  overdue_pending?: number | null;
  sla_breach_pct?: number | null;
};

export type DoctypeApprovalRow = {
  id: string;
  name: string;
  pending?: number | null;
  approved?: number | null;
  rejected?: number | null;
  avg_cycle_hours?: number | null;
};

export type ApproverRow = {
  id: string;
  name: string;
  pending?: number | null;
  approved?: number | null;
  avg_cycle_hours?: number | null;
};

export type AgingBucket = {
  label: string;
  count: number;
};

export type ApprovalAnalytics = {
  meta: BaMeta;
  kpis: ApprovalAnalyticsKpis;
  by_doctype?: DoctypeApprovalRow[] | null;
  by_approver?: ApproverRow[] | null;
  aging?: AgingBucket[] | null;
  charts?: {
    months?: string[];
    approved?: number[];
    rejected?: number[];
    pending?: number[];
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

export function normalizeApprovalAnalytics(raw: any): ApprovalAnalytics {
  const root = rootOf(raw);
  const meta = root.meta || {};
  const kpis = root.kpis || root.summary || {};
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
      pending_count: num(kpis.pending_count ?? kpis.pending, null),
      approved_count: num(kpis.approved_count ?? kpis.approved, null),
      rejected_count: num(kpis.rejected_count ?? kpis.rejected, null),
      avg_cycle_hours: num(
        kpis.avg_cycle_hours ?? kpis.average_cycle_hours ?? kpis.avg_hours,
        null
      ),
      median_cycle_hours: num(kpis.median_cycle_hours, null),
      overdue_pending: num(kpis.overdue_pending ?? kpis.sla_breach_count, null),
      sla_breach_pct: num(kpis.sla_breach_pct, null),
    },
    by_doctype: Array.isArray(root.by_doctype || root.doctypes)
      ? (root.by_doctype || root.doctypes).map((r: any) => ({
          id: str(r.id || r.doctype || r.name),
          name: str(r.name || r.doctype || r.label, "DocType"),
          pending: num(r.pending, null),
          approved: num(r.approved, null),
          rejected: num(r.rejected, null),
          avg_cycle_hours: num(r.avg_cycle_hours ?? r.avg_hours, null),
        }))
      : null,
    by_approver: Array.isArray(root.by_approver || root.approvers)
      ? (root.by_approver || root.approvers).map((r: any) => ({
          id: str(r.id || r.user || r.name),
          name: str(r.name || r.full_name || r.user, "Approver"),
          pending: num(r.pending, null),
          approved: num(r.approved, null),
          avg_cycle_hours: num(r.avg_cycle_hours ?? r.avg_hours, null),
        }))
      : null,
    aging: Array.isArray(root.aging || root.buckets)
      ? (root.aging || root.buckets).map((b: any) => ({
          label: str(b.label || b.bucket || b.name, "Bucket"),
          count: num(b.count ?? b.value, 0) || 0,
        }))
      : null,
    charts: root.charts
      ? {
          months: Array.isArray(charts.months) ? charts.months : charts.labels,
          approved: Array.isArray(charts.approved) ? charts.approved : undefined,
          rejected: Array.isArray(charts.rejected) ? charts.rejected : undefined,
          pending: Array.isArray(charts.pending) ? charts.pending : undefined,
        }
      : null,
  };
}

export function getDemoApprovalAnalytics(): ApprovalAnalytics {
  return {
    meta: {
      currency: "SAR",
      company: "Demo Company",
      from_date: `${new Date().getFullYear()}-01-01`,
      to_date: new Date().toISOString().slice(0, 10),
    },
    kpis: {
      pending_count: 18,
      approved_count: 246,
      rejected_count: 12,
      avg_cycle_hours: 28,
      median_cycle_hours: 18,
      overdue_pending: 5,
      sla_breach_pct: 11.2,
    },
    by_doctype: [
      {
        id: "Sales Invoice",
        name: "Sales Invoice",
        pending: 8,
        approved: 120,
        rejected: 4,
        avg_cycle_hours: 22,
      },
      {
        id: "Purchase Order",
        name: "Purchase Order",
        pending: 5,
        approved: 64,
        rejected: 3,
        avg_cycle_hours: 30,
      },
      {
        id: "Payment Entry",
        name: "Payment Entry",
        pending: 3,
        approved: 42,
        rejected: 2,
        avg_cycle_hours: 16,
      },
      {
        id: "Stock Entry",
        name: "Stock Entry",
        pending: 2,
        approved: 20,
        rejected: 3,
        avg_cycle_hours: 40,
      },
    ],
    by_approver: [
      {
        id: "mgr1",
        name: "Finance Manager",
        pending: 7,
        approved: 98,
        avg_cycle_hours: 20,
      },
      {
        id: "mgr2",
        name: "Sales Manager",
        pending: 6,
        approved: 86,
        avg_cycle_hours: 26,
      },
      {
        id: "mgr3",
        name: "Purchase Manager",
        pending: 5,
        approved: 62,
        avg_cycle_hours: 34,
      },
    ],
    aging: [
      { label: "0–1d", count: 6 },
      { label: "2–3d", count: 5 },
      { label: "4–7d", count: 4 },
      { label: "7d+", count: 3 },
    ],
    charts: {
      months: ["Mar", "Apr", "May", "Jun", "Jul", "Aug"],
      approved: [38, 42, 40, 45, 44, 37],
      rejected: [2, 3, 1, 2, 2, 2],
      pending: [12, 14, 11, 15, 16, 18],
    },
  };
}
