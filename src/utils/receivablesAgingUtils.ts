import type { ChartSeriesPoint } from "../api/dashboardWidgetData";
import type { DashboardWidgetDataResponse } from "../api/dashboardWidgetData";
import type { DrillFilters } from "../api/dashboardWidgetData";
import type { AnalysisRow } from "../api/genericAnalysisTypes";
import {
  fetchDashboardWidgetData,
  type DrillStackEntry,
} from "../api/dashboardWidgetData";
import { bucketPointValue } from "./inventoryAgingUtils";
import { rowOutstanding } from "./receivablesRankingRows";
import { rowIsTerritoryAggregate } from "./receivablesNavigation";
import { useAuthStore } from "../store/auth";
import type { AccessPermissionScope } from "../api/permissions";
import { getTerritoryFilterOptions } from "../api/accessScope";

export const RECEIVABLES_AGING_BAR_WIDGET = "receivables_aging_buckets_bar";

const DEFAULT_AGING_DRILL_PATH = ["aging_bucket", "customer"];

export function isReceivablesAgingBarWidgetKey(widgetKey: string): boolean {
  const k = String(widgetKey || "").toLowerCase();
  return (
    /receivables_aging|aging_buckets|receivables_aging_table/.test(k) ||
    k === "aging" ||
    /outstanding_amount.*aging_bucket/.test(k)
  );
}

/** Widget used when tapping an aging bucket (drill on aging bar, not overdue-only table). */
export function resolveReceivablesAgingDrillWidgetKey(
  payload: DashboardWidgetDataResponse | null | undefined
): string {
  if (payload?.widget_key && isReceivablesAgingBarWidgetKey(payload.widget_key)) {
    return String(payload.widget_key);
  }
  const cfg = (payload?.config || {}) as Record<string, unknown>;
  const fromCfg = String(cfg.drill_widget_key || cfg.list_widget_key || "").trim();
  if (fromCfg && isReceivablesAgingBarWidgetKey(fromCfg)) return fromCfg;
  return RECEIVABLES_AGING_BAR_WIDGET;
}

export function resolveReceivablesAgingDrillPath(
  payload: DashboardWidgetDataResponse | null | undefined
): string[] {
  const fromMeta = payload?.meta?.drill_path;
  if (Array.isArray(fromMeta) && fromMeta.length) {
    return fromMeta.map(String);
  }
  const cfg = (payload?.config || {}) as Record<string, unknown>;
  const fromCfg = cfg.drill_path ?? cfg.drillPath;
  if (Array.isArray(fromCfg) && fromCfg.length) {
    return fromCfg.map(String);
  }
  const chartDim = payload?.chart?.dimension;
  if (chartDim) {
    return [String(chartDim), "customer"];
  }
  return [...DEFAULT_AGING_DRILL_PATH];
}

export function resolveReceivablesAgingCustomerDimension(
  payload: DashboardWidgetDataResponse | null | undefined
): string {
  const path = resolveReceivablesAgingDrillPath(payload);
  for (const step of path) {
    if (/customer|party|debtor|customer_name/i.test(String(step))) {
      return String(step);
    }
  }
  return "customer";
}

export function agingBucketFromRow(row: AnalysisRow): string {
  const cells = row.meta?.cells as Record<string, unknown> | undefined;
  return String(
    cells?.aging_bucket ??
      cells?.bucket ??
      row.meta?.aging_bucket ??
      row.meta?.bucket ??
      ""
  ).trim();
}

function normalizeBucketToken(s: string): string {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/days?/g, "")
    .replace(/[^a-z0-9+\->]/g, "");
}

/** Match API filter value or chart label to a customer row's aging bucket. */
export function rowMatchesAgingBucket(
  row: AnalysisRow,
  bucketValue: string,
  bucketLabel?: string
): boolean {
  const rowBucket = agingBucketFromRow(row);
  const targets = [bucketValue, bucketLabel].filter(Boolean).map(String);
  if (!targets.length) return true;
  if (!rowBucket) {
    const inferred = inferBucketFromDays(row, bucketLabel || bucketValue);
    if (inferred) return true;
    if (/current|not.?due|not.?yet/i.test(bucketLabel || bucketValue)) {
      return inferCurrentBucketRow(row);
    }
    return false;
  }
  const rowNorm = normalizeBucketToken(rowBucket);
  return targets.some((t) => {
    const norm = normalizeBucketToken(t);
    if (!norm) return false;
    if (rowNorm === norm) return true;
    if (rowNorm.includes(norm) || norm.includes(rowNorm)) return true;
    if (bucketLabelMatchesRow(rowBucket, t)) return true;
    return rowBucket.toLowerCase() === t.toLowerCase();
  });
}

function pickNum(...values: unknown[]): number | null {
  for (const v of values) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function inferCurrentBucketRow(row: AnalysisRow): boolean {
  const cells = row.meta?.cells as Record<string, unknown> | undefined;
  const status = String(cells?.status ?? row.meta?.status ?? "").toLowerCase();
  if (/not.?due|current|not.?yet/.test(status)) return true;
  const untilDue = pickNum(
    cells?.days_until_due,
    cells?.due_in_days,
    cells?.days_to_due
  );
  if (untilDue != null && untilDue > 0) return true;
  const overdue = pickNum(
    cells?.days_overdue,
    cells?.overdue_days,
    row.meta?.days_overdue
  );
  if (overdue != null && overdue > 0) return false;
  const days = pickNum(cells?.days, row.meta?.days);
  if (days != null && days < 0) return true;
  return false;
}

function rowDaysForBucket(row: AnalysisRow): number | null {
  const cells = row.meta?.cells as Record<string, unknown> | undefined;
  for (const v of [
    cells?.days_overdue,
    cells?.overdue_days,
    row.meta?.days_overdue,
    cells?.days,
    row.meta?.days,
  ]) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function inferBucketFromDays(row: AnalysisRow, bucketLabel: string): boolean {
  const days = rowDaysForBucket(row);
  if (days == null) return false;
  const b = bucketLabel.toLowerCase();
  if (/current|not.?due|not.?yet/.test(b)) return days <= 0;
  if (/0.?30|1.?30/.test(b) && !/31|61|91/.test(b)) {
    return days >= 0 && days <= 30;
  }
  if (/31.?60/.test(b)) return days >= 31 && days <= 60;
  if (/61.?90/.test(b)) return days >= 61 && days <= 90;
  if (/over\s*120|>\s*120|120\s*\+/.test(b)) return days >= 121;
  if (/91|90\+|>90|over.?90/.test(b)) return days >= 91;
  return false;
}

function bucketLabelMatchesRow(
  rowBucket: string,
  bucketLabel: string
): boolean {
  const rowNorm = normalizeBucketToken(rowBucket);
  const targetNorm = normalizeBucketToken(bucketLabel);
  if (!rowNorm || !targetNorm) return false;
  if (rowNorm === targetNorm) return true;
  if (/120|over120/.test(targetNorm) && /120|over120|91/.test(rowNorm)) {
    return true;
  }
  return rowNorm.includes(targetNorm) || targetNorm.includes(rowNorm);
}

export function receivablesBucketDrillValue(point: ChartSeriesPoint): {
  label: string;
  value: string;
} {
  const label = String(point.label || "").trim();
  const value = bucketPointValue(point) || label;
  return { label: label || value, value };
}

function rowsFromPayload(payload: DashboardWidgetDataResponse): AnalysisRow[] {
  if (payload.table?.rows?.length) return payload.table.rows;
  return payload.rows || [];
}

/** Customers in one aging bucket (includes Current / not-yet-due). */
export function filterAgingBucketCustomerRows(
  rows: AnalysisRow[],
  scope?: AccessPermissionScope | null
): AnalysisRow[] {
  const permScope =
    scope ?? useAuthStore.getState().permissions?.scope ?? null;
  return rows.filter(
    (row) =>
      rowOutstanding(row) >= 0.01 &&
      !rowIsTerritoryAggregate(row, permScope)
  );
}

const CUSTOMER_DRILL_DIMENSION_FALLBACKS = [
  "customer",
  "party",
  "customer_name",
  "debtor",
];

function agingBucketCrumb(
  bucketValue: string,
  bucketLabel?: string
): DrillStackEntry {
  return {
    dimension: "aging_bucket",
    value: bucketValue,
    label: bucketLabel || bucketValue,
  };
}

function territoryCrumb(territory: string): DrillStackEntry {
  return {
    dimension: "territory",
    value: territory,
    label: territory,
  };
}

async function tryAgingCustomerDrill(
  base: {
    widgetKey: string;
    company?: string;
    from_date?: string;
    to_date?: string;
    period?: string;
    filters: DrillFilters;
    limit: number;
  },
  drill: {
    drill_depth: number;
    dimension: string;
    drill_crumbs?: DrillStackEntry[];
  }
): Promise<{ payload: DashboardWidgetDataResponse; rows: AnalysisRow[] }> {
  const payload = await fetchDashboardWidgetData({
    widget_key: base.widgetKey,
    company: base.company,
    from_date: base.from_date,
    to_date: base.to_date,
    period: base.period,
    filters: base.filters,
    drill_depth: drill.drill_depth,
    dimension: drill.dimension,
    drill_crumbs: drill.drill_crumbs?.length
      ? JSON.stringify(drill.drill_crumbs)
      : undefined,
    limit: base.limit,
    show_ly: false,
  });
  const rows = filterAgingBucketCustomerRows(rowsFromPayload(payload));
  return { payload, rows };
}

/**
 * Load customer-level rows for one aging bucket via widget drill (depth 1).
 */
async function runAgingDrillForBucket(
  opts: {
    company?: string;
    from_date?: string;
    to_date?: string;
    period?: string;
    filters?: DrillFilters;
    bucketValue: string;
    bucketLabel?: string;
    limit?: number;
  },
  agingWidgetKey: string,
  bucketFilterValue: string
): Promise<DashboardWidgetDataResponse | null> {
  const territoryOnly = receivablesTerritoryOnlyFilters(opts.filters);
  const bucketFilters: DrillFilters = {
    ...(territoryOnly || {}),
    aging_bucket: [bucketFilterValue],
  };
  const limit = opts.limit ?? 200;
  const base = {
    widgetKey: agingWidgetKey,
    company: opts.company,
    from_date: opts.from_date,
    to_date: opts.to_date,
    period: opts.period,
    filters: bucketFilters,
    limit,
  };

  const bucketCrumb = agingBucketCrumb(
    bucketFilterValue,
    opts.bucketLabel || bucketFilterValue
  );
  const territoryFilter = String(opts.filters?.territory?.[0] || "").trim();
  const customerDims = [...new Set([...CUSTOMER_DRILL_DIMENSION_FALLBACKS])];

  const attempts: Array<{
    drill_depth: number;
    dimension: string;
    drill_crumbs?: DrillStackEntry[];
  }> = [];

  for (const dimension of customerDims) {
    attempts.push({ drill_depth: 1, dimension });
  }
  for (const dimension of customerDims) {
    attempts.push({
      drill_depth: 2,
      dimension,
      drill_crumbs: [bucketCrumb],
    });
  }
  if (territoryFilter) {
    for (const dimension of customerDims) {
      attempts.push({
        drill_depth: 3,
        dimension,
        drill_crumbs: [bucketCrumb, territoryCrumb(territoryFilter)],
      });
    }
  }

  for (const attempt of attempts) {
    const { payload, rows } = await tryAgingCustomerDrill(base, attempt);
    if (rows.length) {
      return tagBucketListPayload(payload, "drill");
    }
  }

  const bucketLabel = opts.bucketLabel || opts.bucketValue;
  if (!isCurrentAgingBucketLabel(bucketLabel)) {
    const overdue = await fetchDashboardWidgetData({
      widget_key: "receivables_overdue_customers_table",
      company: opts.company,
      from_date: opts.from_date,
      to_date: opts.to_date,
      period: opts.period,
      filters: bucketFilters,
      limit,
      show_ly: false,
    });
    const overdueRows = filterAgingBucketCustomerRows(rowsFromPayload(overdue));
    if (overdueRows.length) {
      return tagBucketListPayload(overdue, "api_bucket");
    }
  }

  return null;
}

export type ReceivablesBucketListMode =
  | "drill"
  | "api_bucket"
  | "api_bucket_trusted"
  | "client";

export function receivablesBucketListMode(
  payload: DashboardWidgetDataResponse | null | undefined
): ReceivablesBucketListMode | undefined {
  const mode = payload?.meta?.receivables_bucket_list_mode;
  if (
    mode === "drill" ||
    mode === "api_bucket" ||
    mode === "api_bucket_trusted" ||
    mode === "client"
  ) {
    return mode;
  }
  return undefined;
}

function tagBucketListPayload(
  payload: DashboardWidgetDataResponse,
  mode: ReceivablesBucketListMode
): DashboardWidgetDataResponse {
  return {
    ...payload,
    meta: {
      ...payload.meta,
      receivables_bucket_list_mode: mode,
    },
  };
}

function sumRowAmounts(rows: AnalysisRow[]): number {
  return rows.reduce((s, r) => s + rowOutstanding(r), 0);
}

function scoreBucketCandidate(
  rows: AnalysisRow[],
  cardTotal?: number
): number {
  if (!rows.length) return Number.POSITIVE_INFINITY;
  if (cardTotal == null || cardTotal <= 0) return -rows.length;
  return Math.abs(sumRowAmounts(rows) - cardTotal);
}

export async function fetchReceivablesAgingBucketCustomers(opts: {
  agingWidgetKey?: string;
  company?: string;
  from_date?: string;
  to_date?: string;
  period?: string;
  filters?: DrillFilters;
  bucketValue: string;
  bucketLabel?: string;
  bucketCardTotal?: number;
  limit?: number;
}): Promise<DashboardWidgetDataResponse> {
  const preferredAgingKey =
    opts.agingWidgetKey && isReceivablesAgingBarWidgetKey(opts.agingWidgetKey)
      ? opts.agingWidgetKey
      : RECEIVABLES_AGING_BAR_WIDGET;

  const bucketLabel = opts.bucketLabel || opts.bucketValue;
  const territoryFilters = receivablesTerritoryOnlyFilters(opts.filters);
  const limit = opts.limit ?? 200;
  const cardTotal = opts.bucketCardTotal;

  type Candidate = {
    payload: DashboardWidgetDataResponse;
    rows: AnalysisRow[];
    mode: ReceivablesBucketListMode;
  };
  const candidates: Candidate[] = [];

  const widgetKeys = [
    ...new Set([preferredAgingKey, ...AGING_WIDGET_KEYS]),
  ];
  const bucketValues = agingBucketFilterCandidates(
    bucketLabel,
    opts.bucketValue
  );
  const territoryFilter = String(territoryFilters?.territory?.[0] || "").trim();

  for (const agingKey of widgetKeys) {
    for (const bucketFilterValue of bucketValues) {
      const drilled = await runAgingDrillForBucket(
        { ...opts, filters: territoryFilters },
        agingKey,
        bucketFilterValue
      );
      if (!drilled) continue;
      const raw = filterAgingBucketCustomerRows(rowsFromPayload(drilled));
      const rows = filterRowsForBucketDisplay(raw, bucketLabel, cardTotal);
      if (rows.length) {
        const baseMode = receivablesBucketListMode(drilled) || "drill";
        const mode = resolveBucketListMode(baseMode, raw, rows, bucketLabel);
        candidates.push({
          payload: finalizeBucketListPayload(drilled, rows, mode),
          rows,
          mode,
        });
      }
    }
  }

  if (!isCurrentAgingBucketLabel(bucketLabel)) {
    for (const bucketFilterValue of bucketValues) {
      const bucketFilters: DrillFilters = {
        ...(territoryFilters || {}),
        aging_bucket: [bucketFilterValue],
      };
      try {
        const overdue = await fetchDashboardWidgetData({
          widget_key: "receivables_overdue_customers_table",
          company: opts.company,
          from_date: opts.from_date,
          to_date: opts.to_date,
          period: opts.period,
          filters: bucketFilters,
          limit,
          show_ly: false,
        });
        const raw = filterAgingBucketCustomerRows(rowsFromPayload(overdue));
        const rows = filterRowsForBucketDisplay(raw, bucketLabel, cardTotal);
        if (rows.length) {
          const mode = resolveBucketListMode("api_bucket", raw, rows, bucketLabel);
          candidates.push({
            payload: finalizeBucketListPayload(overdue, rows, mode),
            rows,
            mode,
          });
        }
      } catch {
        /* next */
      }
    }
  }

  for (const bucketFilterValue of bucketValues) {
    const generic = await fetchGenericAnalysisBucketFallback({
      company: opts.company,
      from_date: opts.from_date,
      to_date: opts.to_date,
      period: opts.period,
      filters: opts.filters,
      bucketValue: bucketFilterValue,
      limit,
    });
    if (!generic) continue;
    const raw = filterAgingBucketCustomerRows(rowsFromPayload(generic));
    const rows = filterRowsForBucketDisplay(raw, bucketLabel, cardTotal);
    if (rows.length) {
      const mode = resolveBucketListMode("drill", raw, rows, bucketLabel);
      candidates.push({
        payload: finalizeBucketListPayload(generic, rows, mode),
        rows,
        mode,
      });
    }
  }

  const scoped = await fetchScopedReceivablesCustomerRows({
    company: opts.company,
    from_date: opts.from_date,
    to_date: opts.to_date,
    period: opts.period,
    filters: territoryFilters,
    limit,
  });
  const clientBucketRows = filterRowsForBucketDisplay(
    scoped,
    bucketLabel,
    cardTotal
  );
  if (clientBucketRows.length) {
    const mode = resolveBucketListMode("client", scoped, clientBucketRows, bucketLabel);
    candidates.push({
      payload: shellCustomerListPayload(
        preferredAgingKey,
        clientBucketRows,
        "SAR",
        mode
      ),
      rows: clientBucketRows,
      mode,
    });
  }

  if (candidates.length) {
    const modeRank: Record<ReceivablesBucketListMode, number> = {
      drill: 0,
      api_bucket: 1,
      api_bucket_trusted: 2,
      client: 3,
    };
    candidates.sort((a, b) => {
      const scoreA = scoreBucketCandidate(a.rows, cardTotal);
      const scoreB = scoreBucketCandidate(b.rows, cardTotal);
      if (scoreA !== scoreB) return scoreA - scoreB;
      return modeRank[a.mode] - modeRank[b.mode];
    });
    return candidates[0].payload;
  }

  if (isCurrentAgingBucketLabel(bucketLabel)) {
    const territoriesToLoad = territoryFilter
      ? [territoryFilter]
      : getTerritoryFilterOptions(
          useAuthStore.getState().permissions?.scope ?? null
        );
    const merged: AnalysisRow[] = [];
    let currency = "SAR";
    for (const territory of territoriesToLoad) {
      const territoryFallback = await fetchTerritoryReceivablesBucketFallback({
        company: opts.company,
        territory,
        bucketLabel,
        limit,
      });
      if (!territoryFallback) continue;
      currency = territoryFallback.currency || currency;
      merged.push(...filterAgingBucketCustomerRows(rowsFromPayload(territoryFallback)));
    }
    if (merged.length) {
      const byCustomer = new Map<string, AnalysisRow>();
      for (const row of merged) {
        const key = String(row.id || row.label || "").trim();
        if (!key) continue;
        const prev = byCustomer.get(key);
        if (!prev || rowOutstanding(row) > rowOutstanding(prev)) {
          byCustomer.set(key, row);
        }
      }
      const rows = [...byCustomer.values()].sort(
        (a, b) => rowOutstanding(b) - rowOutstanding(a)
      );
      if (rows.length) {
        return shellCustomerListPayload(preferredAgingKey, rows, currency);
      }
    }
  }

  return shellCustomerListPayload(preferredAgingKey, [], "SAR");
}

export function isCurrentAgingBucketLabel(label: string): boolean {
  return /current|not.?due|not.?yet/i.test(String(label || ""));
}

export function isOver120AgingBucketLabel(label: string): boolean {
  return /over\s*120|>\s*120|120\s*\+/.test(String(label || "").toLowerCase());
}

function rowHasAgingMapAmount(row: AnalysisRow, bucketLabel: string): boolean {
  const cells = (row.meta?.cells || {}) as Record<string, unknown>;
  const raw: Record<string, unknown> = {
    aging_buckets: cells.aging_buckets ?? row.meta?.aging_buckets,
    aging: cells.aging ?? row.meta?.aging,
  };
  return customerAmountInAgingBucket(raw, bucketLabel) >= 0.01;
}

/** Whether this customer belongs in the selected aging bucket (strict for tracking). */
export function rowQualifiesForAgingBucket(
  row: AnalysisRow,
  bucketLabel: string
): boolean {
  const label = bucketLabel.trim() || "Current";
  if (isCurrentAgingBucketLabel(label)) {
    return (
      rowMatchesAgingBucketDays(row, label) ||
      rowHasAgingMapAmount(row, label)
    );
  }
  if (isOver120AgingBucketLabel(label)) {
    const days = rowDaysOverdue(row);
    if (days != null) return days >= 121;
    return rowHasAgingMapAmount(row, label);
  }
  if (rowMatchesAgingBucketDays(row, label)) return true;
  return rowHasAgingMapAmount(row, label);
}

/** API bucket keys to try when the first filter value returns no customer rows. */
export function agingBucketFilterCandidates(
  bucketLabel: string,
  bucketValue: string
): string[] {
  const out = new Set<string>();
  for (const s of [bucketValue, bucketLabel]) {
    const t = String(s || "").trim();
    if (t) out.add(t);
  }
  const combined = `${bucketLabel} ${bucketValue}`.toLowerCase();
  if (isCurrentAgingBucketLabel(combined)) {
    [
      "Current",
      "current",
      "Not Due",
      "not_due",
      "not_yet_due",
      "Not Yet Due",
    ].forEach((v) => out.add(v));
  }
  if (/over\s*120|>\s*120|120\s*\+/.test(combined)) {
    ["Over 120 Days", "Over 120", "over_120", "120+", ">120"].forEach((v) =>
      out.add(v)
    );
  }
  if (/61.?90/.test(combined)) {
    ["61-90 Days", "61-90", "61_90"].forEach((v) => out.add(v));
  }
  return [...out];
}

const AGING_WIDGET_KEYS = [
  RECEIVABLES_AGING_BAR_WIDGET,
  "receivables_aging_table",
];

function shellCustomerListPayload(
  widgetKey: string,
  rows: AnalysisRow[],
  currency = "SAR",
  mode: ReceivablesBucketListMode = "client"
): DashboardWidgetDataResponse {
  return {
    widget_key: widgetKey,
    currency,
    rows,
    table: { rows },
    kpis: [],
    meta: {
      currency,
      source: "widget_data",
      receivables_bucket_list_mode: mode,
    },
  };
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function agingMapAmount(
  aging: Record<string, unknown>,
  bucketLabel: string
): number | null {
  const target = normalizeBucketToken(bucketLabel);
  for (const [k, v] of Object.entries(aging)) {
    if (normalizeBucketToken(k) === target) return num(v);
    if (bucketLabelMatchesRow(k, bucketLabel)) return num(v);
  }
  return null;
}

/** Amount in this aging bucket for one customer row (territory API / AR split). */
export function customerAmountInAgingBucket(
  raw: Record<string, unknown>,
  bucketLabel: string
): number {
  const agingRaw = raw.aging_buckets ?? raw.aging ?? raw.buckets;
  if (agingRaw && typeof agingRaw === "object" && !Array.isArray(agingRaw)) {
    const fromMap = agingMapAmount(agingRaw as Record<string, unknown>, bucketLabel);
    if (fromMap != null && fromMap > 0) return fromMap;
  }
  const outstanding = num(raw.outstanding ?? raw.outstanding_amount ?? raw.amount);
  const overdue = num(raw.overdue ?? raw.overdue_amount);
  if (isCurrentAgingBucketLabel(bucketLabel)) {
    return Math.max(0, outstanding - overdue);
  }
  return 0;
}

function rowOverdueAmount(row: AnalysisRow): number {
  const cells = (row.meta?.cells || {}) as Record<string, unknown>;
  const overdue = num(cells.overdue ?? row.meta?.overdue);
  if (overdue > 0) return overdue;
  return rowOutstanding(row);
}

function rowDaysOverdue(row: AnalysisRow): number | null {
  const cells = (row.meta?.cells || {}) as Record<string, unknown>;
  for (const v of [
    cells.days_overdue,
    cells.overdue_days,
    cells.days_past_due,
    cells.max_days_overdue,
    row.meta?.days_overdue,
    row.meta?.overdue_days,
    cells.days,
    row.meta?.days,
  ]) {
    const days = num(v);
    if (Number.isFinite(days) && days > 0) return days;
  }
  return null;
}

/** True when this customer's overdue age belongs in the bucket (before amount). */
export function rowMatchesAgingBucketDays(
  row: AnalysisRow,
  bucketLabel: string
): boolean {
  const b = bucketLabel.toLowerCase();
  if (isCurrentAgingBucketLabel(b)) {
    const outstanding = num(
      (row.meta?.cells as Record<string, unknown> | undefined)?.outstanding ??
        row.meta?.outstanding ??
        row.value
    );
    const overdue = num(
      (row.meta?.cells as Record<string, unknown> | undefined)?.overdue ??
        row.meta?.overdue
    );
    return Math.max(0, outstanding - overdue) >= 0.01;
  }
  const days = rowDaysOverdue(row);
  if (days == null) return false;
  if (/over\s*120|>\s*120|120\s*\+/.test(b)) return days >= 121;
  if (/91|90\+|>90/.test(b) && !/120/.test(b)) {
    return days >= 91 && days <= 120;
  }
  if (/61.?90/.test(b)) return days >= 61 && days <= 90;
  if (/31.?60/.test(b)) return days >= 31 && days <= 60;
  if (/1.?30|0.?30/.test(b) && !/31|61|91|120/.test(b)) {
    return days >= 1 && days <= 30;
  }
  return false;
}

function extractTerritoryReceivablesList(
  res: Record<string, unknown>
): unknown[] {
  if (Array.isArray(res.customers)) return res.customers;
  if (Array.isArray(res.rows)) return res.rows;
  if (Array.isArray(res.data)) return res.data;
  const msg = res.message;
  if (msg && typeof msg === "object") {
    const m = msg as Record<string, unknown>;
    if (Array.isArray(m.customers)) return m.customers;
    if (Array.isArray(m.rows)) return m.rows;
  }
  return [];
}

/** All customers with AR in a territory (not pre-sliced by bucket). */
function territoryReceivablesAllToRows(
  list: unknown[],
  territory?: string
): AnalysisRow[] {
  const rows: AnalysisRow[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const c = item as Record<string, unknown>;
    const outstanding = num(
      c.outstanding ?? c.outstanding_amount ?? c.amount ?? c.balance
    );
    if (outstanding < 0.01) continue;
    const id = String(
      c.customer_id ?? c.customer ?? c.party ?? c.name ?? c.id ?? ""
    ).trim();
    const label = String(
      c.customer_name ?? c.customer ?? c.party_name ?? c.name ?? id
    ).trim();
    if (!label) continue;
    const overdue = num(c.overdue ?? c.overdue_amount);
    rows.push({
      id: id || label,
      label,
      value: outstanding,
      meta: {
        customer: id || label,
        customer_id: id || label,
        territory: territory ?? c.territory ?? c.territory_name,
        outstanding,
        overdue,
        days_overdue: c.days_overdue ?? c.overdue_days,
        aging_buckets: c.aging_buckets ?? c.aging,
        cells: {
          outstanding,
          overdue,
          days_overdue: c.days_overdue ?? c.overdue_days,
          aging_buckets: c.aging_buckets ?? c.aging,
          territory: territory ?? c.territory,
        },
      },
    });
  }
  return filterAgingBucketCustomerRows(rows);
}

function dedupeCustomerRows(rows: AnalysisRow[]): AnalysisRow[] {
  const byCustomer = new Map<string, AnalysisRow>();
  for (const row of rows) {
    const key = String(row.id || row.label || "").trim();
    if (!key) continue;
    const prev = byCustomer.get(key);
    if (!prev || rowOutstanding(row) > rowOutstanding(prev)) {
      byCustomer.set(key, row);
    }
  }
  return [...byCustomer.values()];
}

export function resolveTerritoriesForReceivablesList(
  filters?: DrillFilters
): string[] {
  const fromFilters = (filters?.territory || [])
    .map((t) => String(t || "").trim())
    .filter(Boolean);
  if (fromFilters.length) return fromFilters;
  return getTerritoryFilterOptions(
    useAuthStore.getState().permissions?.scope ?? null
  );
}

/** Strip aging bucket from API filters — bucket is applied on the client. */
export function receivablesTerritoryOnlyFilters(
  filters?: DrillFilters
): DrillFilters | undefined {
  if (!filters) return undefined;
  const { aging_bucket: _drop, bucket: _b, ...rest } = filters as Record<
    string,
    string[] | undefined
  >;
  return Object.keys(rest).length ? (rest as DrillFilters) : undefined;
}

export function rowAmountInAgingBucket(
  row: AnalysisRow,
  bucketLabel: string
): number {
  const cells = (row.meta?.cells || {}) as Record<string, unknown>;
  const raw: Record<string, unknown> = {
    ...cells,
    outstanding:
      cells.outstanding ?? row.meta?.outstanding ?? row.value,
    overdue: cells.overdue ?? row.meta?.overdue,
    aging_buckets: cells.aging_buckets ?? row.meta?.aging_buckets,
    aging: cells.aging ?? row.meta?.aging,
  };
  let amt = customerAmountInAgingBucket(raw, bucketLabel);
  if (amt >= 0.01) return amt;

  const b = bucketLabel.toLowerCase();
  if (isCurrentAgingBucketLabel(b)) {
    const outstanding = num(
      cells.outstanding ?? row.meta?.outstanding ?? row.value
    );
    const overdue = num(cells.overdue ?? row.meta?.overdue);
    return Math.max(0, outstanding - overdue);
  }

  if (!rowMatchesAgingBucketDays(row, bucketLabel)) return 0;
  return rowOverdueAmount(row);
}

export function filterRowsToAgingBucket(
  rows: AnalysisRow[],
  bucketLabel: string
): AnalysisRow[] {
  const label = bucketLabel.trim() || "Current";
  const out: AnalysisRow[] = [];
  for (const row of rows) {
    if (!rowQualifiesForAgingBucket(row, label)) continue;
    const amt = rowAmountInAgingBucket(row, label);
    if (amt < 0.01) continue;
    out.push({
      ...row,
      value: amt,
      meta: {
        ...row.meta,
        aging_bucket: label,
        cells: {
          ...((row.meta?.cells as Record<string, unknown>) || {}),
          aging_bucket: label,
        },
      },
    });
  }
  return out.sort((a, b) => rowOutstanding(b) - rowOutstanding(a));
}

export function filterRowsToSelectedBucket(
  rows: AnalysisRow[],
  bucketLabel: string,
  _mode?: ReceivablesBucketListMode
): AnalysisRow[] {
  return filterRowsToAgingBucket(rows, bucketLabel);
}

/**
 * Server-scoped bucket list (aging_bucket on API) — use row overdue/value when
 * days_overdue is missing so the list can align with the dashboard bucket total.
 */
export function filterRowsTrustingBucketApi(
  rows: AnalysisRow[],
  bucketLabel: string
): AnalysisRow[] {
  const label = bucketLabel.trim() || "Current";
  const customers = filterAgingBucketCustomerRows(rows);
  if (isCurrentAgingBucketLabel(label)) {
    return filterRowsToAgingBucket(customers, label);
  }

  const out: AnalysisRow[] = [];
  for (const row of customers) {
    let amt = rowAmountInAgingBucket(row, label);
    if (amt < 0.01 && rowQualifiesForAgingBucket(row, label)) {
      amt = rowOverdueAmount(row);
    }
    if (amt < 0.01) {
      amt = rowOverdueAmount(row);
    }
    if (amt < 0.01) continue;
    out.push({
      ...row,
      value: amt,
      meta: {
        ...row.meta,
        aging_bucket: label,
        cells: {
          ...((row.meta?.cells as Record<string, unknown>) || {}),
          aging_bucket: label,
        },
      },
    });
  }
  return out.sort((a, b) => rowOutstanding(b) - rowOutstanding(a));
}

/** Pick strict (days/map) vs API-trusted rows — prefer match to dashboard card total. */
export function filterRowsForBucketDisplay(
  rows: AnalysisRow[],
  bucketLabel: string,
  cardTotal?: number
): AnalysisRow[] {
  const label = bucketLabel.trim() || "Current";
  const strict = filterRowsToAgingBucket(rows, label);
  if (isCurrentAgingBucketLabel(label)) {
    return strict;
  }

  const trusted = filterRowsTrustingBucketApi(rows, label);
  if (!trusted.length) return strict;
  if (!strict.length) return trusted;

  if (cardTotal == null || cardTotal <= 0) {
    return strict.length >= trusted.length ? strict : trusted;
  }

  const strictGap = Math.abs(sumRowAmounts(strict) - cardTotal);
  const trustedGap = Math.abs(sumRowAmounts(trusted) - cardTotal);
  return trustedGap <= strictGap ? trusted : strict;
}

function resolveBucketListMode(
  base: ReceivablesBucketListMode,
  raw: AnalysisRow[],
  displayRows: AnalysisRow[],
  bucketLabel: string
): ReceivablesBucketListMode {
  if (isCurrentAgingBucketLabel(bucketLabel)) return base;
  const strict = filterRowsToAgingBucket(
    filterAgingBucketCustomerRows(raw),
    bucketLabel
  );
  if (
    displayRows.length !== strict.length ||
    Math.abs(sumRowAmounts(displayRows) - sumRowAmounts(strict)) > 1
  ) {
    return "api_bucket_trusted";
  }
  return base;
}

function finalizeBucketListPayload(
  base: DashboardWidgetDataResponse,
  rows: AnalysisRow[],
  mode: ReceivablesBucketListMode
): DashboardWidgetDataResponse {
  return tagBucketListPayload(
    {
      ...base,
      rows,
      table: { ...(base.table || {}), rows },
    },
    mode
  );
}

async function fetchTerritoryReceivablesRaw(opts: {
  company?: string;
  territory: string;
  limit: number;
}): Promise<Record<string, unknown> | null> {
  try {
    const { optimizedApis } = await import("../api/optimized-apis");
    const res = (await optimizedApis.getTerritoryReceivables({
      company: opts.company,
      territory: opts.territory,
      limit: opts.limit,
      sort: "amount_desc",
    })) as Record<string, unknown>;
    if (extractTerritoryReceivablesList(res).length) return res;
  } catch {
    /* try legacy method path */
  }
  try {
    const { http } = await import("../api/http");
    const { oauthApi } = await import("../api/oauth");
    const serverUrl = useAuthStore.getState().serverConfig.serverUrl;
    http.setBaseUrl(serverUrl);
    const token = await oauthApi.getValidToken();
    if (!token) return null;
    const response = await http.get<Record<string, unknown>>(
      "/api/method/printechs_utility.receivables.get_territory_receivables",
      {
        company: opts.company,
        territory: opts.territory,
        limit: opts.limit,
        offset: 0,
        sort: "amount_desc",
      },
      { silentError: true }
    );
    const body = (response.message ?? response) as Record<string, unknown>;
    if (extractTerritoryReceivablesList(body).length) return body;
  } catch {
    return null;
  }
  return null;
}

async function fetchScopedReceivablesCustomerRows(opts: {
  company?: string;
  from_date?: string;
  to_date?: string;
  period?: string;
  filters?: DrillFilters;
  limit?: number;
}): Promise<AnalysisRow[]> {
  const territoryFilters = receivablesTerritoryOnlyFilters(opts.filters);
  const territories = resolveTerritoriesForReceivablesList(territoryFilters);
  const limit = opts.limit ?? 300;
  let merged: AnalysisRow[] = [];

  for (const territory of territories) {
    const res = await fetchTerritoryReceivablesRaw({
      company: opts.company,
      territory,
      limit,
    });
    if (!res) continue;
    merged.push(
      ...territoryReceivablesAllToRows(
        extractTerritoryReceivablesList(res),
        territory
      )
    );
  }

  merged = dedupeCustomerRows(merged);
  if (merged.length) return merged;

  try {
    const overdue = await fetchDashboardWidgetData({
      widget_key: "receivables_overdue_customers_table",
      company: opts.company,
      from_date: opts.from_date,
      to_date: opts.to_date,
      period: opts.period,
      filters: territoryFilters,
      limit,
      show_ly: false,
    });
    return dedupeCustomerRows(
      filterAgingBucketCustomerRows(rowsFromPayload(overdue))
    );
  } catch {
    return [];
  }
}

async function fetchTerritoryReceivablesBucketFallback(opts: {
  company?: string;
  territory: string;
  bucketLabel: string;
  limit?: number;
}): Promise<DashboardWidgetDataResponse | null> {
  const res = await fetchTerritoryReceivablesRaw({
    company: opts.company,
    territory: opts.territory,
    limit: opts.limit ?? 300,
  });
  if (!res) return null;
  const list = extractTerritoryReceivablesList(res);
  const rows = filterRowsToAgingBucket(
    territoryReceivablesAllToRows(list, opts.territory),
    opts.bucketLabel
  );
  if (!rows.length) return null;
  const currency = String(res.currency || "SAR");
  return shellCustomerListPayload(
    RECEIVABLES_AGING_BAR_WIDGET,
    rows,
    currency
  );
}

async function fetchGenericAnalysisBucketFallback(opts: {
  company?: string;
  from_date?: string;
  to_date?: string;
  period?: string;
  filters?: DrillFilters;
  bucketValue: string;
  limit?: number;
}): Promise<DashboardWidgetDataResponse | null> {
  try {
    const { fetchGenericAnalysis } = await import("../api/genericAnalysis");
    const territory = opts.filters?.territory?.[0];
    const ga = await fetchGenericAnalysis({
      company: opts.company,
      from_date: opts.from_date,
      to_date: opts.to_date,
      period: opts.period,
      dimension: "customer",
      metric: "outstanding_amount",
      filters: {
        ...(territory ? { territory } : {}),
        aging_bucket: opts.bucketValue,
      },
      limit: opts.limit ?? 200,
    });
    const rows = filterAgingBucketCustomerRows(ga.rows || []);
    if (!rows.length) return null;
    return shellCustomerListPayload(
      RECEIVABLES_AGING_BAR_WIDGET,
      rows,
      ga.meta?.currency || "SAR"
    );
  } catch {
    return null;
  }
}
