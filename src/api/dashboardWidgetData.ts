/**
 * Profile dashboard widget data (v2).
 * Prefers erp_analysis.api.get_dashboard_widget_data; falls back to generic analysis.
 */

import { http } from "./http";
import { useAuthStore } from "../store/auth";
import { oauthApi } from "./oauth";
import { ERP_ANALYSIS } from "./endpoints";
import { isApiEnabled } from "./mobileConfig";
import {
  pickBaParams,
  plainJsonClone,
  restoreTerritoryBaParams,
  isMissingBaMethodError,
  resolveCompanyName,
  markBaMethodMissing,
  isBaMethodKnownMissing,
} from "./apiResilience";
import {
  extractFrappeErrorMessage,
  isBaPermissionDeniedError,
} from "./baErrors";
import { assertLogicalDimensionKey } from "../dimensions/logicalKeys";
import { logger } from "../utils/logger";
import { fetchGenericAnalysis } from "./genericAnalysis";
import type { AnalysisKpi, AnalysisRow } from "./genericAnalysisTypes";
import { shouldUseMockData } from "./mock";
import { isNetworkOrTlsError } from "./serverUrl";
import { baTerritoryRequestParams } from "../utils/dashboardTerritory";
import {
  inferKpiFormat,
  isSalesTotalWidget,
  isSalesTotalLyWidget,
  normalizeWidgetKey,
  pickWidgetKpiMetrics,
  readFlatKpiFields,
  resolveAnalysisKpiFormat,
  sanitizeKpiDisplayValue,
} from "../utils/kpiFormat";
import {
  isHealthWidgetKey,
  normalizeHealthScoreValue,
} from "../utils/healthScore";
import {
  getActiveSessionUserKey,
  readCachedWidget,
  writeCachedWidget,
  widgetPayloadLooksUseful,
} from "./sessionCache";

function widgetCacheScope(req: DashboardWidgetDataRequest, company: string) {
  return {
    widget_key: req.widget_key,
    company,
    from_date: req.from_date,
    to_date: req.to_date,
    period: req.period,
    territory: req.filters?.territory?.[0],
    show_ly: req.show_ly !== false,
  };
}

function deliverWidgetResponse(
  req: DashboardWidgetDataRequest,
  company: string | undefined,
  payload: DashboardWidgetDataResponse
): DashboardWidgetDataResponse {
  const companyKey = String(company || req.company || "").trim();
  const userKey = getActiveSessionUserKey();
  const isDrill = Number(req.drill_depth ?? 0) > 0;
  if (
    userKey &&
    companyKey &&
    !isDrill &&
    widgetPayloadLooksUseful(payload)
  ) {
    void writeCachedWidget({
      userKey,
      ...widgetCacheScope(req, companyKey),
      data: payload,
    });
  }
  return plainJsonClone(payload);
}

async function readCachedWidgetFallback(
  req: DashboardWidgetDataRequest,
  company: string | undefined
): Promise<DashboardWidgetDataResponse | null> {
  if (Number(req.drill_depth ?? 0) > 0) return null;
  const companyKey = String(company || req.company || "").trim();
  const userKey = getActiveSessionUserKey();
  if (!userKey || !companyKey) return null;
  const hit = await readCachedWidget({
    userKey,
    ...widgetCacheScope(req, companyKey),
  });
  return hit?.data ?? null;
}

export type DrillFilters = Record<string, string[]>;

export type ChartSeriesPoint = {
  label: string;
  value: number;
  /** Last-year / comparison value when BA sends dual series */
  value_ly?: number | null;
  change_pct?: number | null;
  trend?: "up" | "down" | "flat" | string | null;
  dimension_value?: string;
};

export type ChartLyDisplay = {
  show_value?: boolean;
  show_percentage?: boolean;
  positive_color?: string;
  negative_color?: string;
  icon?: string;
  color?: string;
};

export type ChartLySummary = {
  value: number;
  value_ly?: number | null;
  change_pct?: number | null;
  trend?: "up" | "down" | "flat" | string | null;
  display?: ChartLyDisplay;
};

export type LyDisplayMeta = {
  positive_icon?: string;
  negative_icon?: string;
  flat_icon?: string;
};

export type DrillStackEntry = {
  dimension: string;
  label: string;
  value: string;
};

export type WidgetChartMeta = {
  drill_path?: string[] | null;
  drill_depth?: number | null;
  next_dimension?: string | null;
  /** Current breakdown level (e.g. sub_group at table depth when chart is empty) */
  dimension?: string | null;
  drillable?: boolean;
  render_hint?: string;
  currency?: string;
  source?: "widget_data" | "generic" | "empty";
  ly_display?: LyDisplayMeta | null;
  /** Desk / batch layout hints */
  section_title?: string | null;
  row_group?: string | null;
  kpi_id?: string | null;
  chart_key?: string | null;
  compare?: string | null;
  receivables_bucket_list_mode?:
    | "drill"
    | "api_bucket"
    | "api_bucket_trusted"
    | "client";
};

export type DashboardWidgetDataRequest = {
  widget_key: string;
  company?: string;
  from_date?: string;
  to_date?: string;
  period?: string;
  limit?: number;
  dimension?: string;
  filters?: DrillFilters;
  drill_depth?: number;
  /** JSON string: [{ dimension, value, label? }] — division drill on Sales By. */
  drill_crumbs?: string;
  metric?: string;
  /** Forward Desk Show LY Comparison to BA */
  show_ly?: boolean;
  /** All Territories + allow_view_all_sales */
  view_all_sales?: 0 | 1 | boolean;
};

export type DashboardWidgetDataResponse = {
  widget_key: string;
  widget_type?: string;
  label?: string;
  currency?: string;
  /** Desk Show LY Comparison — when true, render summary + LY series */
  show_ly?: boolean;
  /** Desk / API config — may include chart_colors, colors.current/ly, drill_path */
  config?: Record<string, unknown>;
  chart?: {
    series: ChartSeriesPoint[];
    metric?: string;
    dimension?: string;
    filters?: DrillFilters;
    compare?: string;
    summary?: ChartLySummary | null;
  };
  /** BA table payload (TABLE / RANKING) */
  table?: {
    columns?: {
      key: string;
      label: string;
      format?: string;
      width?: number;
      flex?: number;
      width_pct?: number;
      min_width?: number;
      max_width?: number;
      align?: string;
    }[];
    rows: AnalysisRow[];
    /** Level of rows when render_hint is table / drill depth > 0 */
    dimension?: string;
    total?: number | null;
    currency_display?: {
      show_symbol?: boolean;
      currency?: string;
    } | null;
  };
  /** LINK navigation target */
  action?: Record<string, unknown>;
  rows: AnalysisRow[];
  kpis: AnalysisKpi[];
  meta: WidgetChartMeta;
};

const METHOD = "get_dashboard_widget_data";

/** Normalize BA dimension aliases for drill filters (Printechs item group → sub_group). */
export function normalizeDrillDimensionKey(raw: string | null | undefined): string {
  const d = String(raw || "")
    .trim()
    .toLowerCase();
  if (!d) return "";
  if (d === "item_group" || d === "group") return "sub_group";
  return d;
}

/**
 * Active breakdown dimension on a widget response.
 * BA: at table depth, prefer meta.dimension / table.dimension when chart.dimension is empty.
 */
export function resolveWidgetResponseDimension(
  payload: DashboardWidgetDataResponse | null | undefined
): string | undefined {
  if (!payload) return undefined;
  const metaDim = normalizeDrillDimensionKey(payload.meta?.dimension ?? undefined);
  if (metaDim) return metaDim;
  const tableDim = normalizeDrillDimensionKey(payload.table?.dimension);
  if (tableDim) return tableDim;
  const chartDim = normalizeDrillDimensionKey(payload.chart?.dimension);
  if (chartDim) return chartDim;
  return undefined;
}

/** One legacy LY dashboard call per company+period (not per widget). */
const lyDashboardInflight = new Map<string, Promise<unknown>>();

/** When BA sends YoY % but omits LY absolute, recover previous = value / (1 + pct/100). */
export function inferPreviousFromChange(
  value: number | null | undefined,
  changePct: number | null | undefined
): number | null {
  if (value == null || !Number.isFinite(Number(value))) return null;
  if (changePct == null || !Number.isFinite(Number(changePct))) return null;
  const factor = 1 + Number(changePct) / 100;
  if (Math.abs(factor) < 1e-9) return null;
  const prev = Number(value) / factor;
  return Number.isFinite(prev) ? prev : null;
}

function hasLyAbsolute(payload: DashboardWidgetDataResponse): boolean {
  if (payload.chart?.summary?.value_ly != null) return true;
  if (payload.kpis?.some((k) => k.previous != null)) return true;
  if (payload.rows?.some((r) => r.previous != null)) return true;
  if (payload.chart?.series?.some((p) => p.value_ly != null)) return true;
  return false;
}

/**
 * Unwrap Frappe `{ message }` but do NOT drill into nested `data` —
 * KPI widgets put kpis in `data` while `chart.summary` / `show_ly` stay siblings.
 * Drilling into `data` is why Sales1 (KPI) lost LY while Sales Performance (PIE) kept it.
 */
function unwrapWidgetMessage(response: unknown): any {
  let cur: any = response;
  for (let i = 0; i < 4; i++) {
    if (
      cur &&
      typeof cur === "object" &&
      cur.message != null &&
      typeof cur.message === "object" &&
      !Array.isArray(cur.message)
    ) {
      cur = cur.message;
      continue;
    }
    break;
  }
  if (!cur || typeof cur !== "object") return cur;

  // Merge nested data into root so we keep chart/show_ly AND kpis/rows
  if (cur.data && typeof cur.data === "object" && !Array.isArray(cur.data)) {
    const { data, ...rest } = cur;
    const dataChart =
      data.chart && typeof data.chart === "object" ? data.chart : {};
    const restChart =
      rest.chart && typeof rest.chart === "object" ? rest.chart : {};
    // Deep-merge chart so summary on one level + series on another are both kept
    const chart = {
      ...dataChart,
      ...restChart,
      series:
        (Array.isArray(restChart.series) && restChart.series.length
          ? restChart.series
          : null) ||
        (Array.isArray(dataChart.series) && dataChart.series.length
          ? dataChart.series
          : null) ||
        restChart.series ||
        dataChart.series,
      summary: restChart.summary ?? dataChart.summary,
      dimension: restChart.dimension ?? dataChart.dimension,
      compare: restChart.compare ?? dataChart.compare,
      metric: restChart.metric ?? dataChart.metric,
    };
    return {
      ...data,
      ...rest,
      chart: Object.keys(chart).length ? chart : rest.chart ?? data.chart,
      summary: rest.summary ?? data.summary,
      show_ly: rest.show_ly ?? data.show_ly,
      meta: rest.meta ?? data.meta,
      config: { ...(data.config || {}), ...(rest.config || {}) },
      kpis: rest.kpis ?? data.kpis,
      rows:
        (Array.isArray(rest.rows) && rest.rows.length
          ? rest.rows
          : null) ||
        (Array.isArray(data.rows) && data.rows.length ? data.rows : null) ||
        rest.rows ||
        data.rows,
      series: rest.series ?? data.series,
    };
  }
  return cur;
}

function seriesToRows(series: ChartSeriesPoint[]): AnalysisRow[] {
  return series.map((p, i) => ({
    id: String(p.dimension_value || p.label || `p-${i}`),
    label: String(p.label || p.dimension_value || `Item ${i + 1}`),
    value: Number(p.value) || 0,
    previous:
      p.value_ly != null && Number.isFinite(Number(p.value_ly))
        ? Number(p.value_ly)
        : null,
    change_pct:
      p.change_pct != null && Number.isFinite(Number(p.change_pct))
        ? Number(p.change_pct)
        : null,
    meta: p.trend ? { trend: p.trend } : undefined,
  }));
}

function parseLySummary(raw: any): ChartLySummary | null {
  if (!raw || typeof raw !== "object") return null;
  const displayIn = raw.display && typeof raw.display === "object" ? raw.display : {};
  const value = Number(raw.value) || 0;
  const changePct = raw.change_pct != null ? Number(raw.change_pct) : null;
  let valueLy =
    raw.value_ly != null
      ? Number(raw.value_ly)
      : raw.previous != null
        ? Number(raw.previous)
        : raw.previous_year_value != null
          ? Number(raw.previous_year_value)
          : null;
  if (valueLy == null) {
    valueLy = inferPreviousFromChange(value, changePct);
  }
  return {
    value,
    value_ly: valueLy,
    change_pct: changePct,
    trend: raw.trend != null ? String(raw.trend) : null,
    display: {
      show_value: displayIn.show_value !== false,
      show_percentage: displayIn.show_percentage !== false,
      positive_color: displayIn.positive_color
        ? String(displayIn.positive_color)
        : "#16a34a",
      negative_color: displayIn.negative_color
        ? String(displayIn.negative_color)
        : "#dc2626",
      icon: displayIn.icon ? String(displayIn.icon) : undefined,
      color: displayIn.color ? String(displayIn.color) : undefined,
    },
  };
}

function coerceRows(raw: unknown): AnalysisRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r: any, i: number) => {
      if (r == null) return null;
      if (typeof r !== "object") {
        return { id: String(r), label: String(r), value: 0 };
      }
      const label = String(
        r.label ||
          r.name ||
          r.salesperson_name ||
          r.salesperson ||
          r.sales_person ||
          r.dimension ||
          r.dimension_label ||
          r.territory ||
          r.customer ||
          r.warehouse ||
          r.brand ||
          r.id ||
          `Row ${i + 1}`
      );
      const value = Number(
        r.value ??
          r.metric ??
          r.count ??
          r.total_sales ??
          r.sales ??
          r.amount ??
          r.outstanding ??
          r.stock_value ??
          r.net_sales ??
          0
      );
      const rowMeta: Record<string, unknown> = {};
      if (r.severity != null) rowMeta.severity = String(r.severity);
      if (r.key != null) rowMeta.itemKey = String(r.key);
      if (r.days != null && Number.isFinite(Number(r.days))) {
        rowMeta.days = Number(r.days);
      }
      if (r.days_overdue != null && Number.isFinite(Number(r.days_overdue))) {
        rowMeta.days_overdue = Number(r.days_overdue);
      }
      if (r.days_until_due != null && Number.isFinite(Number(r.days_until_due))) {
        rowMeta.days_until_due = Number(r.days_until_due);
      }
      if (r.rank != null && Number.isFinite(Number(r.rank))) {
        rowMeta.rank = Number(r.rank);
      }
      if (r.drill_filter != null && typeof r.drill_filter === "object") {
        rowMeta.drill_filter = r.drill_filter;
      }
      if (r.sub_group != null && String(r.sub_group).trim()) {
        rowMeta.sub_group = String(r.sub_group).trim();
      }
      if (r.item_group != null && String(r.item_group).trim()) {
        const ig = String(r.item_group).trim();
        if (ig !== rowMeta.sub_group) rowMeta.item_group = ig;
      }
      if (
        !rowMeta.sub_group &&
        rowMeta.drill_filter &&
        typeof rowMeta.drill_filter === "object"
      ) {
        const sg = (rowMeta.drill_filter as { sub_group?: unknown }).sub_group;
        if (Array.isArray(sg) && sg[0] != null) {
          rowMeta.sub_group = String(sg[0]).trim();
        }
      }
      if (r.dimension_value != null && String(r.dimension_value).trim()) {
        rowMeta.dimension_value = String(r.dimension_value).trim();
      }
      const openSoPassThrough = [
        "sales_order",
        "customer_name",
        "customer",
        "delivery_date",
        "schedule_date",
        "expected_delivery_date",
        "pending_delivery_value",
        "pending_amount",
        "item_code",
        "item_name",
        "pending_qty",
        "delivered_qty",
        "qty",
        "rate",
        "uom",
        "warehouse",
        "delivery_status",
        "per_delivered",
      ] as const;
      for (const key of openSoPassThrough) {
        if (r[key] != null && r[key] !== "") {
          rowMeta[key] = r[key];
        }
      }
      if (r.meta && typeof r.meta === "object") {
        Object.assign(rowMeta, r.meta as Record<string, unknown>);
      }
      const gpPctRaw =
        r.gp_pct ??
        r.margin_pct ??
        r.margin_percentage ??
        r.gross_profit_percent ??
        r.gp_margin ??
        r.gp_margin_pct;
      if (gpPctRaw != null && Number.isFinite(Number(gpPctRaw))) {
        const pct = Number(gpPctRaw);
        if (pct > -95 && pct < 95) rowMeta.gp_pct = pct;
      } else if (
        r.gp != null &&
        Number.isFinite(Number(r.gp)) &&
        Number.isFinite(value) &&
        value > 0
      ) {
        const pct = (Number(r.gp) / value) * 100;
        if (pct > -95 && pct < 95) rowMeta.gp_pct = pct;
      }
      return {
        id: String(
          r.dimension_value ||
            r.dimension ||
            r.key ||
            r.id ||
            r.name ||
            label ||
            `r-${i}`
        ),
        label,
        value: Number.isFinite(value) ? value : 0,
        meta: Object.keys(rowMeta).length ? rowMeta : undefined,
        previous:
          r.previous != null
            ? Number(r.previous)
            : r.metric_ly != null
              ? Number(r.metric_ly)
              : r.value_ly != null
                ? Number(r.value_ly)
                : r.sales_ly != null
                  ? Number(r.sales_ly)
                  : r.net_sales_ly != null
                    ? Number(r.net_sales_ly)
                    : null,
        change_pct:
          r.change_pct != null
            ? Number(r.change_pct)
            : r.growth_pct != null
              ? Number(r.growth_pct)
              : null,
        secondary:
          r.secondary != null
            ? Number(r.secondary)
            : r.gp != null
              ? Number(r.gp)
              : null,
      } as AnalysisRow;
    })
    .filter((r): r is AnalysisRow => r != null);
}

function legacyDataToRows(data: any): AnalysisRow[] {
  if (!data || typeof data !== "object") return [];
  if (Array.isArray(data)) return coerceRows(data);
  for (const c of [
    data.rows,
    data.items,
    data.series,
    data.by_salesperson,
    data.salespersons,
    data.sales_person,
    data.territory,
    data.by_territory,
    data.customers,
    data.warehouses,
    data.brands,
    data.list,
  ]) {
    const rows = coerceRows(c);
    if (rows.length) return rows;
  }
  return [];
}

function isTableLikeWidgetType(raw: unknown): boolean {
  const t = String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
  return (
    t === "TABLE" ||
    t === "RANKING" ||
    t === "LIST" ||
    t === "MATRIX" ||
    t === "CARD" ||
    t === "DATATABLE" ||
    t === "DATA_TABLE" ||
    t === "DATA_GRID" ||
    t === "GRID" ||
    t === "DATA_CARD"
  );
}

function isChartLikeWidgetType(raw: unknown): boolean {
  const t = String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
  return (
    t === "PIE" ||
    t === "DONUT" ||
    t === "BAR" ||
    t === "LINE" ||
    t === "CHART" ||
    t === "BAR_CHART" ||
    t === "LINE_CHART"
  );
}

function parseTableColumns(
  raw: unknown
):
  | {
      key: string;
      label: string;
      format?: string;
      width?: number;
      flex?: number;
      width_pct?: number;
      min_width?: number;
      max_width?: number;
      align?: string;
    }[]
  | undefined {
  if (!Array.isArray(raw) || !raw.length) return undefined;
  return raw
    .map((c: any, i: number) => {
      if (c == null) return null;
      if (typeof c === "string") {
        return { key: c, label: c };
      }
      const key = String(c.key || c.field || c.id || c.name || `col_${i}`);
      const label = String(c.label || c.title || c.name || key);
      const format =
        c.format != null
          ? String(c.format)
          : c.type != null
            ? String(c.type)
            : undefined;
      const num = (v: unknown) => {
        if (v == null || v === "") return undefined;
        const n = Number(v);
        return Number.isFinite(n) ? n : undefined;
      };
      const alignRaw = c.align ?? c.alignment ?? c.text_align;
      // Desk sometimes sends min_width: 2 by mistake — ignore tiny floors
      const minW = num(c.min_width ?? c.minWidth);
      return {
        key,
        label,
        format,
        width: num(c.width ?? c.col_width),
        flex: num(c.flex ?? c.flex_grow),
        width_pct: num(c.width_pct ?? c.pct ?? c.percent),
        min_width: minW != null && minW >= 16 ? minW : undefined,
        max_width: num(c.max_width ?? c.maxWidth),
        align: alignRaw != null ? String(alignRaw) : undefined,
      };
    })
    .filter(Boolean) as {
    key: string;
    label: string;
    format?: string;
    width?: number;
    flex?: number;
    width_pct?: number;
    min_width?: number;
    max_width?: number;
    align?: string;
  }[];
}

/** Resolve columns from data payload and/or Desk widget config. */
export function resolveTableColumns(
  ...sources: unknown[]
): ReturnType<typeof parseTableColumns> {
  const tryParse = (c: unknown) => {
    if (!c) return undefined;
    if (typeof c === "string" && c.trim().startsWith("[")) {
      try {
        return parseTableColumns(JSON.parse(c));
      } catch {
        return undefined;
      }
    }
    if (Array.isArray(c)) return parseTableColumns(c);
    // Recover `{0: {key,label,...}, 1: {...}}` from bad object-spread of array
    if (c && typeof c === "object" && !Array.isArray(c)) {
      const o = c as Record<string, unknown>;
      const keys = Object.keys(o);
      if (
        keys.length &&
        keys.every((k) => /^\d+$/.test(k)) &&
        keys.some((k) => {
          const v = o[k];
          return v && typeof v === "object" && (v as any).key != null;
        })
      ) {
        return parseTableColumns(
          keys.sort((a, b) => Number(a) - Number(b)).map((k) => o[k])
        );
      }
    }
    return parseTableColumns(c);
  };

  for (const src of sources) {
    if (!src) continue;
    if (typeof src === "string" && src.trim().startsWith("[")) {
      const parsed = tryParse(src);
      if (parsed?.length) return parsed;
      continue;
    }
    if (Array.isArray(src)) {
      const parsed = tryParse(src);
      if (parsed?.length) return parsed;
      continue;
    }
    if (typeof src === "object") {
      const o = src as Record<string, unknown>;
      // Whole object might itself be a numeric-keyed columns map
      const asCols = tryParse(o);
      if (
        asCols?.length &&
        Object.keys(o).every((k) => /^\d+$/.test(k))
      ) {
        return asCols;
      }
      const candidates = [
        o.columns,
        o.table_columns,
        (o.table as any)?.columns,
        (o.config as any)?.columns,
        (o.config as any)?.table_columns,
        (o.config as any)?.table?.columns,
      ];
      for (const c of candidates) {
        const parsed = tryParse(c);
        if (parsed?.length) return parsed;
      }
    }
  }
  return undefined;
}

const COLUMN_KEY_ALIASES: Record<string, string[]> = {
  territory: ["territory", "dimension", "label", "name"],
  dimension: ["dimension", "territory", "label", "name"],
  net_sales: ["net_sales", "metric", "value", "amount"],
  metric: ["metric", "net_sales", "value", "amount"],
  net_sales_ly: ["net_sales_ly", "metric_ly", "value_ly"],
  metric_ly: ["metric_ly", "net_sales_ly", "value_ly"],
  change_pct: ["change_pct", "growth_pct", "pct"],
  gp_pct: [
    "gp_pct",
    "margin_pct",
    "margin_percentage",
    "gross_profit_percent",
    "gp_margin",
  ],
};

function columnKeysMatch(a: string, b: string): boolean {
  const aa = String(a || "").toLowerCase();
  const bb = String(b || "").toLowerCase();
  if (aa === bb) return true;
  const aliasesA = COLUMN_KEY_ALIASES[aa] || [aa];
  const aliasesB = COLUMN_KEY_ALIASES[bb] || [bb];
  return aliasesA.some((x) => aliasesB.includes(x));
}

type TableCol = NonNullable<ReturnType<typeof parseTableColumns>>[number];

/**
 * API columns define structure; Desk/config columns overlay layout
 * (flex / width / min_width / align / format / label).
 */
export function mergeTableColumnLayout(
  structure: TableCol[] | undefined,
  layout: TableCol[] | undefined
): TableCol[] | undefined {
  if (!structure?.length && !layout?.length) return undefined;
  if (!structure?.length) return layout;
  if (!layout?.length) return structure;
  return structure.map((col) => {
    const overlay = layout.find((l) => columnKeysMatch(l.key, col.key));
    if (!overlay) return col;
    return {
      ...col,
      label: overlay.label || col.label,
      format: overlay.format || col.format,
      flex: overlay.flex ?? col.flex,
      width: overlay.width ?? col.width,
      width_pct: overlay.width_pct ?? col.width_pct,
      min_width: overlay.min_width ?? col.min_width,
      max_width: overlay.max_width ?? col.max_width,
      align: overlay.align || col.align,
    };
  });
}

function coerceTableRows(
  raw: unknown,
  columns?: { key: string; label: string; format?: string }[]
): AnalysisRow[] {
  const base = coerceRows(raw);
  if (!Array.isArray(raw)) return base;
  // Preserve original cells for multi-column TABLE rendering
  return raw.map((r: any, i: number) => {
    const coerced = base[i] || {
      id: `r-${i}`,
      label: `Row ${i + 1}`,
      value: 0,
    };
    if (r == null || typeof r !== "object") return coerced;
    const cells: Record<string, unknown> = { ...r };
    if (columns?.length) {
      for (const col of columns) {
        if (cells[col.key] === undefined && r[col.key] !== undefined) {
          cells[col.key] = r[col.key];
        }
      }
    }
    return {
      ...coerced,
      meta: { ...(coerced.meta || {}), cells },
    };
  });
}

/** Normalize single-widget or batch-entry payload into the shared widget shape. */
export function normalizeDashboardWidgetPayload(
  raw: any,
  req: DashboardWidgetDataRequest
): DashboardWidgetDataResponse {
  let root = raw?.message ?? raw ?? {};
  // Batch KPI shape: { kpi: { value, value_ly, ... } }
  if (root.kpi && typeof root.kpi === "object" && !Array.isArray(root.kpis)) {
    const kpiHints: Record<string, unknown> = {};
    if (root.kpi.subtitle != null) kpiHints.subtitle = root.kpi.subtitle;
    if (root.kpi.kpi_id != null) kpiHints.kpi_id = root.kpi.kpi_id;
    if (root.kpi.format != null) kpiHints.format = root.kpi.format;
    root = {
      ...root,
      kpis: Array.isArray(root.kpis) ? root.kpis : [root.kpi],
      value: root.value ?? root.kpi.value,
      value_ly: root.value_ly ?? root.kpi.value_ly,
      change_pct: root.change_pct ?? root.kpi.change_pct,
      config: {
        ...(typeof root.config === "object" && root.config ? root.config : {}),
        ...kpiHints,
      },
    };
  }
  // Batch LINK shape: { action: { module_key | dashboard_id | ... } }
  if (root.action && typeof root.action === "object") {
    root = {
      ...root,
      config: {
        ...(typeof root.config === "object" && root.config ? root.config : {}),
        ...root.action,
        action: root.action,
      },
    };
  }

  const resolvedWidgetType = String(
    root.widget_type || root.type || ""
  ).trim();
  const tableLike = isTableLikeWidgetType(resolvedWidgetType);
  const chartLike = isChartLikeWidgetType(resolvedWidgetType);

  const tableIn =
    root.table && typeof root.table === "object" ? root.table : null;
  const tableColumns = resolveTableColumns(
    tableIn?.columns,
    root.columns,
    root.config,
    root
  );
  const tableRowsFromBlock = tableIn
    ? coerceTableRows(tableIn.rows ?? tableIn.data, tableColumns)
    : [];
  const tableTotal =
    tableIn?.total != null
      ? Number(tableIn.total)
      : tableIn?.count != null
        ? Number(tableIn.count)
        : null;
  const tableCurrencyDisplay =
    tableIn?.currency_display && typeof tableIn.currency_display === "object"
      ? {
          show_symbol: Boolean(tableIn.currency_display.show_symbol),
          currency:
            tableIn.currency_display.currency != null
              ? String(tableIn.currency_display.currency)
              : undefined,
        }
      : null;

  const chart = root.chart || root.Chart;
  // BA may put series under chart, root, or nested data
  const seriesRaw = Array.isArray(chart?.series)
    ? chart.series
    : Array.isArray(root.series)
      ? root.series
      : Array.isArray(root.data?.series)
        ? root.data.series
        : Array.isArray(root.data?.chart?.series)
          ? root.data.chart.series
          : Array.isArray(root.points)
            ? root.points
            : [];
  const series: ChartSeriesPoint[] = seriesRaw.map((p: any, i: number) => ({
    label: String(p?.label || p?.name || p?.dimension_value || `Point ${i + 1}`),
    value: Number(p?.value ?? p?.amount ?? p?.total_sales ?? 0) || 0,
    value_ly:
      p?.value_ly != null
        ? Number(p.value_ly)
        : p?.sales_ly != null
          ? Number(p.sales_ly)
          : p?.previous != null
            ? Number(p.previous)
            : null,
    change_pct: p?.change_pct != null ? Number(p.change_pct) : null,
    trend: p?.trend != null ? String(p.trend) : null,
    dimension_value:
      p?.dimension_value != null
        ? String(p.dimension_value)
        : p?.id != null
          ? String(p.id)
          : undefined,
  }));

  // Prefer data path by widget_type:
  // TABLE → table.rows; PIE/BAR/LINE → chart.series; else best available
  let rows: AnalysisRow[] = [];
  if (tableLike && tableRowsFromBlock.length) {
    rows = tableRowsFromBlock;
  } else if (chartLike && series.length) {
    rows = seriesToRows(series);
  } else if (tableRowsFromBlock.length) {
    rows = tableRowsFromBlock;
  } else if (series.length) {
    rows = seriesToRows(series);
  } else {
    rows = coerceRows(root.rows);
    if (!rows.length) rows = legacyDataToRows(root.data);
  }

  const metaIn = root.meta || {};

  const table =
    tableIn || tableRowsFromBlock.length || (tableLike && rows.length)
      ? {
          columns: tableColumns,
          rows: tableRowsFromBlock.length ? tableRowsFromBlock : rows,
          total: tableTotal,
          currency_display: tableCurrencyDisplay,
          dimension: normalizeDrillDimensionKey(
            String(
              tableIn?.dimension ??
                metaIn.dimension ??
                chart?.dimension ??
                root.dimension ??
                ""
            )
          ) || undefined,
        }
      : undefined;
  let summary = parseLySummary(chart?.summary || root.summary);
  const seriesHasLy = series.some(
    (p) => p.value_ly != null && Number.isFinite(Number(p.value_ly))
  );

  // Synthesize summary from series when BA omitted chart.summary
  if (!summary && seriesHasLy) {
    const value = series.reduce((s, p) => s + (Number(p.value) || 0), 0);
    const valueLy = series.reduce(
      (s, p) => s + (Number(p.value_ly) || 0),
      0
    );
    const changePct =
      valueLy !== 0 ? ((value - valueLy) / Math.abs(valueLy)) * 100 : null;
    summary = parseLySummary({
      value,
      value_ly: valueLy,
      change_pct: changePct,
      trend:
        changePct == null
          ? "flat"
          : changePct > 0.5
            ? "up"
            : changePct < -0.5
              ? "down"
              : "flat",
      display: {
        show_value: true,
        show_percentage: changePct != null,
        positive_color: "#16a34a",
        negative_color: "#dc2626",
        color:
          changePct == null
            ? "#64748b"
            : changePct > 0.5
              ? "#16a34a"
              : changePct < -0.5
                ? "#dc2626"
                : "#64748b",
        icon:
          changePct == null
            ? "minus"
            : changePct > 0.5
              ? "arrow-up"
              : changePct < -0.5
                ? "arrow-down"
                : "minus",
      },
    });
  }

  // If summary missing but root has LY fields (KPI-only responses)
  if (!summary && (root.value_ly != null || root.show_ly)) {
    const kpiVal =
      Number(root.value ?? root.net_sales ?? 0) ||
      0;
    summary = parseLySummary({
      value: kpiVal,
      value_ly: root.value_ly,
      change_pct: root.change_pct,
      trend: root.trend,
      display: root.display,
    });
  }

  let config: Record<string, unknown> | undefined;
  if (root.config && typeof root.config === "object") {
    config = { ...root.config };
  }
  if (typeof root.config_json === "string" && root.config_json.trim()) {
    try {
      const parsed = JSON.parse(root.config_json);
      if (parsed && typeof parsed === "object") {
        config = { ...(config || {}), ...parsed };
      }
    } catch {
      /* ignore */
    }
  }
  if (metaIn.config && typeof metaIn.config === "object") {
    config = { ...(config || {}), ...(metaIn.config as object) };
  }

  const widgetKeyForFlat = normalizeWidgetKey(root.widget_key || req.widget_key);

  const kpis: AnalysisKpi[] = Array.isArray(root.kpis)
    ? root.kpis.map((k: any, i: number) => {
        const metricLabel = String(k.label || k.title || k.key || "KPI");
        const picked = pickWidgetKpiMetrics(root, k, widgetKeyForFlat, metricLabel);
        const value = picked?.value ?? (Number(k.value) || 0);
        const changePct =
          picked?.changePct ??
          (k.change_pct != null
            ? Number(k.change_pct)
            : k.change_percentage != null
              ? Number(k.change_percentage)
              : null);
        let previous =
          picked?.previous ??
          (k.previous != null
            ? Number(k.previous)
            : k.value_ly != null
              ? Number(k.value_ly)
              : k.sales_ly != null
                ? Number(k.sales_ly)
                : k.previous_year_value != null
                  ? Number(k.previous_year_value)
                  : null);
        if (previous == null) {
          previous = inferPreviousFromChange(value, changePct);
        }
        const fmtRaw = String(k.format || "currency").toLowerCase();
        const format =
          fmtRaw === "percent" || fmtRaw === "pct" || fmtRaw === "percentage"
            ? "percent"
            : fmtRaw === "integer" || fmtRaw === "number"
              ? "number"
              : "currency";
        const resolvedFormat = resolveAnalysisKpiFormat(widgetKeyForFlat, {
          label: metricLabel,
          kpiFormat: format !== "currency" ? format : undefined,
          configFormat: String(k.format || config?.format || ""),
        });
        return {
          key: String(k.kpi_id || k.key || k.id || `kpi_${i}`),
          label: metricLabel,
          value,
          previous,
          change_pct: changePct,
          format: resolvedFormat,
        };
      })
    : [];

  // Flat KPI payload: { value, value_ly, change_pct, display }
  const flatFields = readFlatKpiFields(root, widgetKeyForFlat);
  if (!kpis.length && flatFields) {
    const { value, previous, changePct } = flatFields;
    const metricLabel = String(
      root.label ||
        root.title ||
        chart?.metric ||
        req.metric ||
        "KPI"
    )
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c: string) => c.toUpperCase());
    kpis.push({
      key: String(chart?.metric || req.metric || "total"),
      label: metricLabel,
      value,
      previous,
      change_pct: changePct,
      format: resolveAnalysisKpiFormat(widgetKeyForFlat, {
        label: metricLabel,
        configFormat: String(root.config?.format || config?.format || ""),
      }),
    });
  } else if (flatFields && kpis.length) {
    const idx = 0;
    const fmt = inferKpiFormat(widgetKeyForFlat, {
      label: kpis[idx].label,
      configFormat: String(config?.format || ""),
    });
    const sanitized = sanitizeKpiDisplayValue(
      widgetKeyForFlat,
      kpis[idx].label,
      kpis[idx].value,
      fmt
    );
    if (sanitized == null) {
      kpis[idx] = {
        ...kpis[idx],
        value: flatFields.value,
        previous: flatFields.previous ?? kpis[idx].previous,
        change_pct: flatFields.changePct ?? kpis[idx].change_pct,
      };
    }
  }

  const widgetKeyHint = normalizeWidgetKey(root.widget_key || req.widget_key);

  if (!kpis.length && summary && isSalesTotalWidget(widgetKeyHint)) {
    const metricLabel = String(chart?.metric || req.metric || "KPI")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c: string) => c.toUpperCase());
    kpis.push({
      key: String(chart?.metric || "total"),
      label: metricLabel,
      value: summary.value,
      previous: summary.value_ly ?? null,
      change_pct: summary.change_pct ?? null,
      format: resolveAnalysisKpiFormat(widgetKeyHint, { label: metricLabel }),
    });
  } else if (summary && isSalesTotalWidget(widgetKeyHint)) {
    const idx = kpis.findIndex(
      (k) =>
        k.key === "total" ||
        k.key === chart?.metric ||
        k.key === req.metric
    );
    if (idx >= 0) {
      kpis[idx] = {
        ...kpis[idx],
        value: summary.value,
        previous: summary.value_ly ?? kpis[idx].previous,
        change_pct: summary.change_pct ?? kpis[idx].change_pct,
      };
    } else {
      kpis.unshift({
        key: String(chart?.metric || "total"),
        label: "Total Sales",
        value: summary.value,
        previous: summary.value_ly ?? null,
        change_pct: summary.change_pct ?? null,
        format: "currency",
      });
    }
  } else if (!kpis.length && rows.length) {
    kpis.push({
      key: "total",
      label: "Total",
      value: rows.reduce((s, r) => s + r.value, 0),
      format: "currency",
    });
  }

  if (
    isHealthWidgetKey(widgetKeyHint) &&
    !kpis.length &&
    root.score != null &&
    Number.isFinite(Number(root.score))
  ) {
    kpis.push({
      key: "health_score",
      label: String(root.label || root.title || "Health"),
      value: Number(root.score),
      previous:
        root.value_ly != null
          ? Number(root.value_ly)
          : root.previous != null
            ? Number(root.previous)
            : null,
      change_pct:
        root.change_pct != null ? Number(root.change_pct) : null,
      format: "number",
    });
  }

  if (isHealthWidgetKey(widgetKeyHint)) {
    const healthMax =
      Number(config?.max_value) ||
      Number(config?.max) ||
      Number(config?.max_score) ||
      100;
    for (let i = 0; i < kpis.length; i++) {
      const k = kpis[i];
      kpis[i] = {
        ...k,
        value: normalizeHealthScoreValue(k.value, {
          format: k.format,
          maxScore: healthMax,
        }),
        format: "number",
      };
      if (k.previous != null && Number.isFinite(Number(k.previous))) {
        kpis[i].previous = normalizeHealthScoreValue(Number(k.previous), {
          format: k.format,
          maxScore: healthMax,
        });
      }
    }
    if (summary?.value != null) {
      summary = {
        ...summary,
        value: normalizeHealthScoreValue(summary.value, { maxScore: healthMax }),
        value_ly:
          summary.value_ly != null
            ? normalizeHealthScoreValue(Number(summary.value_ly), {
                maxScore: healthMax,
              })
            : summary.value_ly,
      };
    }
  }

  // Prefer live LY from BA (Desk checkbox). Don't strip just because
  // bootstrap omitted show_ly — that was hiding Sales Performance LY.
  const apiHasLy =
    root.show_ly === true ||
    root.show_ly === 1 ||
    root.show_ly === "1" ||
    root.show_ly === "true" ||
    chart?.compare === "ly" ||
    seriesHasLy ||
    Boolean(summary && summary.value_ly != null) ||
    kpis.some((k) => k.previous != null) ||
    rows.some((r) => r.previous != null);

  const showLyFinal = Boolean(req.show_ly || apiHasLy);

  if (showLyFinal && !summary) {
    const kpiWithLy = kpis.find((k) => k.previous != null);
    if (kpiWithLy) {
      summary = parseLySummary({
        value: kpiWithLy.value,
        value_ly: kpiWithLy.previous,
        change_pct: kpiWithLy.change_pct,
      });
    }
  }

  const widgetKeyFinal = normalizeWidgetKey(root.widget_key || req.widget_key);
  for (let i = 0; i < kpis.length; i += 1) {
    const k = kpis[i];
    const fmt = inferKpiFormat(widgetKeyFinal, {
      label: k.label,
      kpiFormat: k.format,
      configFormat: String(config?.format || ""),
    });
    const resolvedFormat = resolveAnalysisKpiFormat(widgetKeyFinal, {
      label: k.label,
      kpiFormat: fmt,
      configFormat: String(config?.format || ""),
    });
    let value = sanitizeKpiDisplayValue(widgetKeyFinal, k.label, k.value, fmt);
    let previous = sanitizeKpiDisplayValue(
      widgetKeyFinal,
      k.label,
      k.previous,
      fmt
    );
    if (value == null) {
      const retry = pickWidgetKpiMetrics(
        root,
        null,
        widgetKeyFinal,
        k.label
      );
      if (retry) {
        value = retry.value;
        previous = retry.previous;
      }
    }
    kpis[i] = {
      ...k,
      format: resolvedFormat,
      value: value != null && Number.isFinite(value) ? value : Number.NaN,
      previous:
        previous != null && Number.isFinite(previous) ? previous : undefined,
      change_pct:
        value != null && Number.isFinite(value) ? k.change_pct : undefined,
    };
  }

  const dimension =
    normalizeDrillDimensionKey(
      String(
        metaIn.dimension ??
          table?.dimension ??
          chart?.dimension ??
          req.dimension ??
          ""
      )
    ) || undefined;
  const drillable =
    metaIn.drillable === true ||
    (metaIn.next_dimension != null && String(metaIn.next_dimension).length > 0);

  const lyDisplay =
    metaIn.ly_display && typeof metaIn.ly_display === "object"
      ? {
          positive_icon: metaIn.ly_display.positive_icon
            ? String(metaIn.ly_display.positive_icon)
            : "arrow-up",
          negative_icon: metaIn.ly_display.negative_icon
            ? String(metaIn.ly_display.negative_icon)
            : "arrow-down",
          flat_icon: metaIn.ly_display.flat_icon
            ? String(metaIn.ly_display.flat_icon)
            : "minus",
        }
      : null;

  return {
    widget_key: String(root.widget_key || req.widget_key),
    widget_type: resolvedWidgetType || root.widget_type || root.type,
    label: root.label || root.title,
    currency: root.currency || metaIn.currency || "SAR",
    show_ly: showLyFinal,
    config,
    action:
      root.action && typeof root.action === "object"
        ? (root.action as Record<string, unknown>)
        : undefined,
    // Keep chart + table when both exist (drill_views may switch renderer by depth).
    chart:
      chart || series.length || summary
        ? {
            series,
            metric: chart?.metric || req.metric,
            dimension,
            filters: chart?.filters || req.filters || {},
            compare: chart?.compare || (showLyFinal ? "ly" : undefined),
            summary,
          }
        : undefined,
    table,
    rows,
    kpis,
    meta: {
      drill_path: metaIn.drill_path ?? null,
      drill_depth: metaIn.drill_depth ?? req.drill_depth ?? null,
      next_dimension: metaIn.next_dimension
        ? String(metaIn.next_dimension)
        : null,
      dimension: dimension ?? null,
      drillable,
      render_hint: metaIn.render_hint,
      currency: root.currency || metaIn.currency || "SAR",
      source: "widget_data",
      ly_display: lyDisplay,
      section_title:
        metaIn.section_title != null
          ? String(metaIn.section_title)
          : config?.section_title != null
            ? String(config.section_title)
            : null,
      row_group:
        metaIn.row_group != null
          ? String(metaIn.row_group)
          : config?.row_group != null
            ? String(config.row_group)
            : null,
      kpi_id:
        metaIn.kpi_id != null
          ? String(metaIn.kpi_id)
          : root.kpi?.kpi_id != null
            ? String(root.kpi.kpi_id)
            : null,
      chart_key:
        metaIn.chart_key != null
          ? String(metaIn.chart_key)
          : config?.chart_key != null
            ? String(config.chart_key)
            : null,
      compare:
        metaIn.compare != null
          ? String(metaIn.compare)
          : chart?.compare != null
            ? String(chart.compare)
            : null,
    },
  };
}

function emptyWidget(
  req: DashboardWidgetDataRequest
): DashboardWidgetDataResponse {
  return {
    widget_key: req.widget_key,
    currency: "SAR",
    rows: [],
    kpis: [],
    meta: { drillable: false, source: "empty", currency: "SAR" },
  };
}

function demoWidget(
  req: DashboardWidgetDataRequest
): DashboardWidgetDataResponse {
  const rows: AnalysisRow[] = [
    { id: "Riyadh", label: "Riyadh", value: 820000, change_pct: 6.2 },
    { id: "Jeddah", label: "Jeddah", value: 610000, change_pct: -1.4 },
    { id: "Dammam", label: "Dammam", value: 390000, change_pct: 3.1 },
  ];
  return {
    widget_key: req.widget_key,
    currency: "SAR",
    chart: {
      series: rows.map((r) => ({
        label: r.label,
        value: r.value,
        dimension_value: r.id,
      })),
      metric: req.metric || "net_sales",
      dimension: req.dimension || "territory",
      filters: req.filters || {},
    },
    rows,
    kpis: [
      {
        key: "total",
        label: "Total",
        value: rows.reduce((s, r) => s + r.value, 0),
        format: "currency",
      },
    ],
    meta: { drillable: false, source: "widget_data", currency: "SAR" },
  };
}

async function enrichLyFromDashboard(
  payload: DashboardWidgetDataResponse,
  req: DashboardWidgetDataRequest
): Promise<DashboardWidgetDataResponse> {
  if (!req.show_ly || hasLyAbsolute(payload)) return payload;

  const widgetKey = normalizeWidgetKey(req.widget_key || payload.widget_key);
  if (!isSalesTotalLyWidget(widgetKey)) {
    return payload;
  }

  try {
    const { optimizedApis } = await import("./optimized-apis");
    const lyKey = `${req.company || ""}|${req.from_date || ""}|${req.to_date || ""}|${req.period || ""}`;
    let dashPromise = lyDashboardInflight.get(lyKey);
    if (!dashPromise) {
      dashPromise = optimizedApis
        .getDashboardData({
          company: req.company,
          from_date: req.from_date,
          to_date: req.to_date,
        })
        .finally(() => {
          lyDashboardInflight.delete(lyKey);
        });
      lyDashboardInflight.set(lyKey, dashPromise);
    }
    const dash = await dashPromise;
    if (!dash || typeof dash !== "object" || Array.isArray(dash)) {
      return payload;
    }
    const dashKpis = Array.isArray((dash as any)?.kpis)
      ? (dash as any).kpis
      : [];

    let value: number | null = null;
    let previous: number | null = null;
    let changePct: number | null = null;

    for (const k of dashKpis) {
      const id = String(k.id || k.key || "");
      const label = String(k.label || k.title || "");
      const period = String(req.period || "").toLowerCase();
      const wantsMtd = period === "mtd" || period === "previous_month";
      const wantsToday = period === "today" || period === "yesterday";
      const idOk = wantsToday
        ? /sales_today|today/i.test(id)
        : wantsMtd
          ? /sales_mtd|mtd/i.test(id)
          : /sales_ytd|ytd|net_sales|total_sales/i.test(id);
      const labelOk = wantsToday
        ? /today/i.test(label)
        : wantsMtd
          ? /mtd|month/i.test(label)
          : /ytd|total sales|net sales/i.test(label);
      if (!idOk && !labelOk) continue;
      value = Number(k.value ?? k.current_value) || null;
      changePct =
        k.change_percentage != null
          ? Number(k.change_percentage)
          : k.change_pct != null
            ? Number(k.change_pct)
            : null;
      previous =
        k.previous_year_value != null
          ? Number(k.previous_year_value)
          : k.value_ly != null
            ? Number(k.value_ly)
            : k.previous != null
              ? Number(k.previous)
              : null;
      if (previous == null) {
        previous = inferPreviousFromChange(value, changePct);
      }
      if (previous != null) break;
    }

    // Prefer widget's own total when present; only borrow LY/change
    const primary =
      payload.kpis?.find((k) => k.key === "total") ||
      payload.kpis?.[0] ||
      null;
    if (primary?.value != null && Number.isFinite(primary.value)) {
      value = Number(primary.value);
      if (previous == null && (changePct != null || primary.change_pct != null)) {
        previous = inferPreviousFromChange(
          value,
          primary.change_pct ?? changePct
        );
      }
      if (changePct == null && primary.change_pct != null) {
        changePct = primary.change_pct;
      }
    }

    if (value == null || previous == null) {
      // Last resort: borrow LY summary from a chart sales widget (e.g. sales_card)
      try {
        const donor = await http.get<unknown>(
          ERP_ANALYSIS.config.getDashboardWidgetData,
          pickBaParams(
            {
              widget_key: "sales_card",
              company: req.company,
              from_date: req.from_date,
              to_date: req.to_date,
              period: req.period,
              limit: 10,
              show_ly: 1,
            },
            [
              "widget_key",
              "company",
              "from_date",
              "to_date",
              "period",
              "limit",
              "show_ly",
            ],
            useAuthStore.getState().mobileConfig
          ),
          { silentError: true }
        );
        const donorPayload = unwrapWidgetMessage(donor);
        const donorSummary = parseLySummary(
          donorPayload?.chart?.summary || donorPayload?.summary
        );
        if (donorSummary?.value_ly != null) {
          const primaryVal =
            payload.kpis?.[0]?.value ??
            donorSummary.value;
          previous = donorSummary.value_ly;
          value = Number(primaryVal) || donorSummary.value;
          changePct = donorSummary.change_pct ?? null;
          console.warn("[widget-ly] borrowed LY from sales_card", {
            key: req.widget_key,
            value,
            previous,
          });
        }
      } catch {
        /* ignore donor failure */
      }
    }

    if (value == null || previous == null) return payload;

    const pct =
      changePct != null
        ? changePct
        : previous !== 0
          ? ((value - previous) / Math.abs(previous)) * 100
          : null;

    const summary = parseLySummary({
      value,
      value_ly: previous,
      change_pct: pct,
      trend:
        pct == null
          ? "flat"
          : pct > 0.5
            ? "up"
            : pct < -0.5
              ? "down"
              : "flat",
      display: {
        show_value: true,
        show_percentage: pct != null,
        positive_color: "#16a34a",
        negative_color: "#dc2626",
        color:
          pct == null
            ? "#64748b"
            : pct > 0.5
              ? "#16a34a"
              : pct < -0.5
                ? "#dc2626"
                : "#64748b",
        icon:
          pct == null
            ? "minus"
            : pct > 0.5
              ? "arrow-up"
              : pct < -0.5
                ? "arrow-down"
                : "minus",
      },
    });

    const kpis = [...(payload.kpis || [])];
    if (kpis.length) {
      kpis[0] = {
        ...kpis[0],
        previous,
        change_pct: pct,
      };
    } else {
      kpis.push({
        key: "total",
        label: "Total Sales",
        value,
        previous,
        change_pct: pct,
        format: "currency",
      });
    }

    console.warn("[widget-ly] enriched from dashboard KPIs", {
      key: req.widget_key,
      value,
      previous,
      changePct: pct,
    });

    return {
      ...payload,
      show_ly: true,
      kpis,
      chart: {
        series: payload.chart?.series || [],
        metric: payload.chart?.metric || req.metric,
        dimension: payload.chart?.dimension || req.dimension,
        filters: payload.chart?.filters || req.filters || {},
        compare: "ly",
        summary,
      },
    };
  } catch (e) {
    logger.warn("LY enrich from dashboard failed", e);
    return payload;
  }
}

function inferDimensionFromWidgetKey(
  widgetKey: string | undefined | null
): string | undefined {
  const k = normalizeWidgetKey(widgetKey);
  if (/salesperson|sales_person|top_salesperson/.test(k)) return "salesperson";
  if (/territory/.test(k)) return "territory";
  if (/customer_group|by_customer/.test(k)) return "customer_group";
  if (/channel/.test(k)) return "channel";
  if (/warehouse/.test(k)) return "warehouse";
  if (/brand/.test(k)) return "brand";
  return undefined;
}

function inferDefaultWidgetLimit(widgetKey: string | undefined | null): number | undefined {
  const k = normalizeWidgetKey(widgetKey);
  if (/ranking|by_|top_|salesperson|territory|channel|customer_group/.test(k)) {
    return 10;
  }
  return undefined;
}

function isSalespersonRankingWidget(widgetKey: string | undefined | null): boolean {
  const k = normalizeWidgetKey(widgetKey);
  return /salesperson|sales_person|top_salesperson/.test(k);
}

async function fromSalespersonPerformanceFallback(
  req: DashboardWidgetDataRequest
): Promise<DashboardWidgetDataResponse | null> {
  try {
    const { fetchSalespersonPerformance } = await import("./salesPerformance");
    const perf = await fetchSalespersonPerformance({
      company: req.company,
      from_date: req.from_date,
      to_date: req.to_date,
      period: req.period,
    });
    const limit = req.limit || inferDefaultWidgetLimit(req.widget_key) || 10;
    const rows: AnalysisRow[] = (perf.rows || [])
      .slice(0, limit)
      .map((r) => ({
        id: r.id,
        label: r.name,
        value: r.sales,
        previous: r.sales_ly,
        change_pct: r.growth_pct,
      }))
      .filter((r) => r.label && Number.isFinite(r.value) && r.value > 0);
    if (!rows.length) return null;
    return {
      widget_key: req.widget_key,
      widget_type: "RANKING",
      label: "Salesperson",
      currency: "SAR",
      show_ly: Boolean(req.show_ly),
      rows,
      chart: {
        series: rows.map((r) => ({
          label: r.label,
          value: r.value,
          value_ly: r.previous,
          change_pct: r.change_pct,
          dimension_value: r.id,
        })),
        metric: "net_sales",
        dimension: "salesperson",
        filters: req.filters || {},
        compare: req.show_ly ? "ly" : undefined,
      },
      kpis: [],
      meta: {
        drillable: false,
        currency: "SAR",
        source: "widget_data",
      },
    };
  } catch (e) {
    logger.warn("salesperson performance fallback failed", e);
    return null;
  }
}

async function fromTopBrandsFallback(
  req: DashboardWidgetDataRequest
): Promise<DashboardWidgetDataResponse> {
  try {
    const { optimizedApis } = await import("./optimized-apis");
    const dash = await optimizedApis.getDashboardData({
      company: req.company,
      from_date: req.from_date,
      to_date: req.to_date,
    });
    const brandsRaw =
      (dash as any)?.sales_dashboard?.top_brands ||
      (dash as any)?.top_brands ||
      [];
    const brands = Array.isArray(brandsRaw) ? brandsRaw : [];
    const rows: AnalysisRow[] = brands
      .map((b: any, i: number) => {
        const label = String(b.brand || b.label || b.name || `Brand ${i + 1}`);
        const value = Number(
          b.total_sales ?? b.value ?? b.sales ?? b.net_sales ?? 0
        );
        if (!label || !Number.isFinite(value) || value <= 0) return null;
        return {
          id: label,
          label,
          value,
          previous: null,
          change_pct: null,
        } as AnalysisRow;
      })
      .filter(Boolean) as AnalysisRow[];

    if (!rows.length) {
      return {
        widget_key: req.widget_key,
        currency: "SAR",
        show_ly: false,
        chart: { series: [] },
        rows: [],
        kpis: [],
        meta: {
          drill_path: null,
          drill_depth: null,
          next_dimension: null,
          drillable: false,
          currency: "SAR",
          source: "empty",
        },
      };
    }

    const total = rows.reduce((s, r) => s + r.value, 0);
    logger.info("Brand widget filled from dashboard top_brands", {
      key: req.widget_key,
      count: rows.length,
    });
    return {
      widget_key: req.widget_key,
      currency: (dash as any)?.currency || "SAR",
      show_ly: false,
      chart: {
        series: rows.map((r) => ({
          label: r.label,
          value: r.value,
          dimension_value: r.id,
        })),
        metric: req.metric || "net_sales",
        dimension: "brand",
        filters: {},
      },
      rows,
      kpis: [
        {
          key: "total",
          label: "Total",
          value: total,
          format: "currency",
        },
      ],
      meta: {
        drill_path: ["brand"],
        drill_depth: null,
        next_dimension: null,
        drillable: false,
        currency: (dash as any)?.currency || "SAR",
        source: "widget_data",
      },
    };
  } catch (e) {
    logger.warn("top_brands fallback failed", e);
    return {
      widget_key: req.widget_key,
      currency: "SAR",
      show_ly: false,
      chart: { series: [] },
      rows: [],
      kpis: [],
      meta: {
        drill_path: null,
        drill_depth: null,
        next_dimension: null,
        drillable: false,
        currency: "SAR",
        source: "empty",
      },
    };
  }
}

async function fromGenericFallback(
  req: DashboardWidgetDataRequest
): Promise<DashboardWidgetDataResponse> {
  const dimension =
    req.dimension ||
    inferDimensionFromWidgetKey(req.widget_key) ||
    "territory";
  if (!assertLogicalDimensionKey(dimension)) return emptyWidget(req);

  const flatFilters: Record<string, string | string[]> = {};
  if (req.filters) {
    for (const [k, v] of Object.entries(req.filters)) {
      if (!assertLogicalDimensionKey(k)) continue;
      if (Array.isArray(v) && v.length === 1) flatFilters[k] = v[0];
      else if (Array.isArray(v) && v.length > 1) flatFilters[k] = v;
    }
  }

  const analysis = await fetchGenericAnalysis({
    company: req.company,
    from_date: req.from_date,
    to_date: req.to_date,
    period: req.period,
    dimension,
    metric: req.metric || "net_sales",
    filters: flatFilters,
    limit: req.limit || 10,
  });

  const rows = analysis.rows || [];
  const kpis = [...(analysis.kpis || [])];
  let summary: ChartLySummary | null = null;

  const rowsWithLy = rows.filter((r) => r.previous != null);
  if (rowsWithLy.length) {
    const value = rows.reduce((s, r) => s + (Number(r.value) || 0), 0);
    const valueLy = rowsWithLy.reduce(
      (s, r) => s + (Number(r.previous) || 0),
      0
    );
    const changePct =
      valueLy !== 0 ? ((value - valueLy) / Math.abs(valueLy)) * 100 : null;
    summary = parseLySummary({
      value,
      value_ly: valueLy,
      change_pct: changePct,
      trend:
        changePct == null
          ? "flat"
          : changePct > 0.5
            ? "up"
            : changePct < -0.5
              ? "down"
              : "flat",
      display: {
        show_value: true,
        show_percentage: changePct != null,
        positive_color: "#16a34a",
        negative_color: "#dc2626",
        color:
          changePct == null
            ? "#64748b"
            : changePct > 0.5
              ? "#16a34a"
              : changePct < -0.5
                ? "#dc2626"
                : "#64748b",
        icon:
          changePct == null
            ? "minus"
            : changePct > 0.5
              ? "arrow-up"
              : changePct < -0.5
                ? "arrow-down"
                : "minus",
      },
    });
    const totalIdx = kpis.findIndex((k) => k.key === "total");
    if (totalIdx >= 0) {
      kpis[totalIdx] = {
        ...kpis[totalIdx],
        previous: valueLy,
        change_pct: changePct,
      };
    }
  } else {
    const kpiWithLy = kpis.find((k) => k.previous != null);
    if (kpiWithLy) {
      summary = parseLySummary({
        value: kpiWithLy.value,
        value_ly: kpiWithLy.previous,
        change_pct: kpiWithLy.change_pct,
      });
    }
  }

  const showLy = Boolean(
    req.show_ly ||
      summary?.value_ly != null ||
      kpis.some((k) => k.previous != null) ||
      rows.some((r) => r.previous != null)
  );

  let outSummary = showLy ? summary : null;
  let outKpis = kpis;
  let outRows = rows;
  if (!showLy) {
    outKpis = kpis.map((k) => ({ ...k, previous: null, change_pct: null }));
    outRows = rows.map((r) => ({ ...r, previous: null, change_pct: null }));
  }

  const payload: DashboardWidgetDataResponse = {
    widget_key: req.widget_key,
    currency: analysis.meta.currency || "SAR",
    show_ly: showLy,
    chart: {
      series: outRows.map((r) => ({
        label: r.label,
        value: r.value,
        value_ly: showLy ? r.previous : null,
        change_pct: showLy ? r.change_pct : null,
        dimension_value: r.id,
      })),
      metric: analysis.meta.metric,
      dimension: analysis.meta.dimension,
      filters: req.filters || {},
      compare: showLy ? "ly" : undefined,
      summary: outSummary,
    },
    rows: outRows,
    kpis: outKpis,
    meta: {
      drill_path: null,
      drill_depth: req.drill_depth ?? null,
      next_dimension: null,
      drillable: false,
      currency: analysis.meta.currency || "SAR",
      source: analysis.meta.source === "empty" ? "empty" : "generic",
    },
  };

  const enriched = await enrichLyFromDashboard(payload, req);
  return deliverWidgetResponse(req, req.company, enriched);
}

/**
 * Load one profile dashboard widget.
 * Prefers POST (BA contract); GET fallback. Passes show_ly when Desk enabled.
 */
export async function fetchDashboardWidgetData(
  req: DashboardWidgetDataRequest
): Promise<DashboardWidgetDataResponse> {
  if (shouldUseMockData()) return demoWidget(req);

  const state = useAuthStore.getState();
  const cfg = state.mobileConfig;
  const serverUrl = state.serverConfig.serverUrl;
  http.setBaseUrl(serverUrl);
  const token = await oauthApi.getValidToken();
  if (!token) throw new Error("No valid access token available");

  const company =
    req.company ||
    resolveCompanyName(state.permissions.scope?.company, state.user?.company);

  if (isBaMethodKnownMissing(METHOD) || !isApiEnabled(cfg, METHOD)) {
    return fromGenericFallback({ ...req, company });
  }

  const territoryFilter = req.filters?.territory?.[0];
  const territoryParams = baTerritoryRequestParams(req.filters);

  const rawParams = {
    widget_key: req.widget_key,
    company,
    from_date: req.from_date,
    to_date: req.to_date,
    period: req.period,
    limit: req.limit ?? inferDefaultWidgetLimit(req.widget_key),
    // Root/list: omit dimension=brand (legacy sii.brand SQL). Drill depth ≥2: send brand.
    dimension: (() => {
      const d = req.dimension ? String(req.dimension).trim() : "";
      const lower = d.toLowerCase();
      if (!d) return undefined;
      if (lower === "brand") {
        return req.drill_depth != null && Number(req.drill_depth) >= 2
          ? d
          : undefined;
      }
      return d;
    })(),
    drill_depth: req.drill_depth,
    filters: req.filters ? JSON.stringify(req.filters) : undefined,
    drill_crumbs: req.drill_crumbs,
    ...territoryParams,
    // Drill: skip LY SQL on server when possible (rows may still include change_pct).
    show_ly:
      req.drill_depth != null && Number(req.drill_depth) > 0
        ? 0
        : 1,
    view_all_sales: req.view_all_sales ? 1 : undefined,
  };

  const paramKeys = [
    "widget_key",
    "company",
    "from_date",
    "to_date",
    "period",
    "limit",
    "dimension",
    "drill_depth",
    "filters",
    "drill_crumbs",
    "territory",
    "territories",
    "show_ly",
    "view_all_sales",
  ] as const;

  const params = restoreTerritoryBaParams(
    rawParams,
    pickBaParams(rawParams, [...paramKeys], cfg)
  );

  const callWidgetApi = async (p: Record<string, unknown>) => {
    try {
      return await http.post<unknown>(
        ERP_ANALYSIS.config.getDashboardWidgetData,
        p,
        { silentError: true }
      );
    } catch (postErr) {
      const st = (postErr as any)?.response?.status;
      // Access Profile 403 — GET hits the same guard
      if (st === 401 || st === 403) {
        throw postErr;
      }
      if (st === 500 || st === 404 || st === 417) {
        // Some sites only expose GET; also retry GET after POST 500
        return await http.get<unknown>(
          ERP_ANALYSIS.config.getDashboardWidgetData,
          p,
          { silentError: true }
        );
      }
      // POST failed for other reasons — try GET once
      try {
        return await http.get<unknown>(
          ERP_ANALYSIS.config.getDashboardWidgetData,
          p,
          { silentError: true }
        );
      } catch {
        throw postErr;
      }
    }
  };

  try {
    let response: unknown = await callWidgetApi(params);
    let payload = unwrapWidgetMessage(response);
    let normalized = normalizeDashboardWidgetPayload(payload, { ...req, company });

    // If BA 500/empty when dimension was sent, retry without dimension.
    // Skip on drill — second call is slow and returns the wrong level (top divisions).
    if (
      !normalized.rows.length &&
      !normalized.chart?.series?.length &&
      rawParams.dimension &&
      !(req.drill_depth != null && Number(req.drill_depth) > 0)
    ) {
      try {
        const retryParams = pickBaParams(
          { ...rawParams, dimension: undefined },
          [...paramKeys],
          cfg
        );
        response = await callWidgetApi(retryParams);
        payload = unwrapWidgetMessage(response);
        const retried = normalizeDashboardWidgetPayload(payload, { ...req, company });
        if (retried.rows.length || retried.chart?.series?.length) {
          normalized = retried;
        }
      } catch {
        /* keep first result */
      }
    }

    const drillDepth = Number(req.drill_depth ?? 0);
    const isDrillRequest = drillDepth > 0;

    if (!isDrillRequest) {
      normalized = await enrichLyFromDashboard(normalized, {
        ...req,
        company,
        show_ly: Boolean(req.show_ly),
      });
    } else if (req.show_ly) {
      normalized = { ...normalized, show_ly: true };
    }

    // Brand pie: if still no slices, use complete-dashboard top_brands
    if (
      !isDrillRequest &&
      !normalized.rows.length &&
      /brand/i.test(String(req.widget_key || req.dimension || ""))
    ) {
      const fromBrands = await fromTopBrandsFallback({ ...req, company });
      if (fromBrands.rows.length) {
        normalized = {
          ...fromBrands,
          show_ly: normalized.show_ly || fromBrands.show_ly,
          chart: {
            ...fromBrands.chart!,
            summary:
              normalized.chart?.summary || fromBrands.chart?.summary,
          },
          kpis: normalized.kpis?.length ? normalized.kpis : fromBrands.kpis,
        };
      }
    }

    // Salesperson ranking: fallback to legacy performance API
    if (
      !isDrillRequest &&
      !normalized.rows.length &&
      !normalized.chart?.series?.length &&
      isSalespersonRankingWidget(req.widget_key)
    ) {
      const fromSp = await fromSalespersonPerformanceFallback({ ...req, company });
      if (fromSp?.rows.length) {
        normalized = {
          ...fromSp,
          show_ly: normalized.show_ly || fromSp.show_ly,
        };
      }
    }

    if (__DEV__ && !isDrillRequest) {
      console.warn("[widget-ly] loaded", {
        key: req.widget_key,
        show_ly: normalized.show_ly,
        hasSummary: Boolean(normalized.chart?.summary),
        summaryLy: normalized.chart?.summary?.value_ly ?? null,
        kpiPrevious: normalized.kpis?.[0]?.previous ?? null,
        kpiChange: normalized.kpis?.[0]?.change_pct ?? null,
        seriesCount: normalized.chart?.series?.length ?? 0,
        rowCount: normalized.rows.length,
        source: normalized.meta.source,
      });
    }

    logger.info("Widget data loaded", {
      key: req.widget_key,
      show_ly: normalized.show_ly,
      hasSummary: Boolean(normalized.chart?.summary),
      summaryLy: normalized.chart?.summary?.value_ly ?? null,
      kpiCount: normalized.kpis.length,
      rowCount: normalized.rows.length,
      seriesCount: normalized.chart?.series?.length ?? 0,
      source: normalized.meta.source,
    });

    if (
      normalized.rows.length ||
      normalized.kpis.length ||
      normalized.chart?.summary ||
      normalized.show_ly
    ) {
      // Ensure Desk show_ly request is reflected even if BA omits the flag
      if (req.show_ly && !normalized.show_ly && normalized.chart?.summary) {
        return deliverWidgetResponse(req, company, {
          ...normalized,
          show_ly: true,
        });
      }
      if (req.show_ly) {
        return deliverWidgetResponse(req, company, {
          ...normalized,
          show_ly: true,
        });
      }
      return deliverWidgetResponse(req, company, normalized);
    }

    logger.info(
      `${METHOD} empty for ${req.widget_key} — generic analysis fallback`
    );
    return fromGenericFallback({ ...req, company });
  } catch (error) {
    if (isMissingBaMethodError(error)) {
      markBaMethodMissing(METHOD);
      logger.info(`${METHOD} not on server — generic analysis fallback`);
      return fromGenericFallback({ ...req, company });
    }
    const status = (error as any)?.response?.status;
    if (status === 403 || isBaPermissionDeniedError(error)) {
      const msg =
        extractFrappeErrorMessage(error) ||
        "This widget is not enabled for your mobile profile";
      logger.warn(`[widget-data] ${req.widget_key}: ${msg}`);
      return emptyWidget(req);
    }

    // 500 with drill filters — never drop division/sub_group filters (wrong level / wrong division).
    if (
      status === 500 &&
      Number(req.drill_depth ?? 0) > 0
    ) {
      throw error;
    }

    // 500 with territory filters — do not retry without filters (same numbers as "All")
    if (
      status === 500 &&
      req.filters &&
      Object.keys(req.filters).length &&
      !req.filters.territory?.length
    ) {
      try {
        logger.warn(
          `${METHOD} 500 with filters — retry without filters for ${req.widget_key}`
        );
        const retryParams = pickBaParams(
          {
            widget_key: req.widget_key,
            company,
            from_date: req.from_date,
            to_date: req.to_date,
            period: req.period,
            limit: req.limit,
            drill_depth: req.drill_depth,
            show_ly: 1,
          },
          [
            "widget_key",
            "company",
            "from_date",
            "to_date",
            "period",
            "limit",
            "drill_depth",
            "show_ly",
          ],
          cfg
        );
        const response = await callWidgetApi(retryParams);
        const normalized = normalizeDashboardWidgetPayload(
          unwrapWidgetMessage(response),
          { ...req, company, filters: undefined }
        );
        if (
          normalized.rows.length ||
          normalized.kpis.length ||
          normalized.chart?.series?.length
        ) {
          return deliverWidgetResponse(req, company, normalized);
        }
      } catch {
        /* fall through */
      }
    }

    // 500 with dimension — retry without dimension (widget_key only; not on drill)
    if (
      status === 500 &&
      req.dimension &&
      Number(req.drill_depth ?? 0) === 0
    ) {
      try {
        logger.warn(
          `${METHOD} 500 with dimension=${req.dimension} — retry without dimension`
        );
        const retryParams = pickBaParams(
          {
            widget_key: req.widget_key,
            company,
            from_date: req.from_date,
            to_date: req.to_date,
            period: req.period,
            limit: req.limit,
            show_ly: 1,
          },
          [
            "widget_key",
            "company",
            "from_date",
            "to_date",
            "period",
            "limit",
            "show_ly",
          ],
          cfg
        );
        const response = await callWidgetApi(retryParams);
        let normalized = normalizeDashboardWidgetPayload(unwrapWidgetMessage(response), {
          ...req,
          company,
        });
        normalized = await enrichLyFromDashboard(normalized, {
          ...req,
          company,
          show_ly: Boolean(req.show_ly),
        });
        if (
          !normalized.rows.length &&
          /brand/i.test(String(req.widget_key || ""))
        ) {
          const fromBrands = await fromTopBrandsFallback({ ...req, company });
          if (fromBrands.rows.length) {
            return deliverWidgetResponse(req, company, {
              ...fromBrands,
              show_ly: true,
              chart: {
                ...fromBrands.chart!,
                summary:
                  normalized.chart?.summary || fromBrands.chart?.summary,
              },
            });
          }
        }
        if (
          normalized.rows.length ||
          normalized.kpis.length ||
          normalized.chart?.summary
        ) {
          return deliverWidgetResponse(req, company, {
            ...normalized,
            show_ly: true,
          });
        }
      } catch {
        /* fall through */
      }
    }

    logger.warn(`${METHOD} failed — generic fallback`, error);
    try {
      if (/brand/i.test(String(req.widget_key || req.dimension || ""))) {
        const fromBrands = await fromTopBrandsFallback({ ...req, company });
        if (fromBrands.rows.length) return fromBrands;
      }
      return await fromGenericFallback({ ...req, company });
    } catch {
      if (status === 500 || isNetworkOrTlsError(error)) {
        const cached = await readCachedWidgetFallback(req, company);
        if (cached) {
          logger.warn(
            `[widget-data] ${req.widget_key}: using cached widget after network error`
          );
          return cached;
        }
        logger.warn(
          `[widget-data] ${req.widget_key}: ${
            status === 500 ? "server 500" : "network error"
          } — returning empty widget`
        );
        return emptyWidget(req);
      }
      throw error;
    }
  }
}

/** Parse drill_path from widget config / config_json */
export function resolveWidgetDrillPath(
  config?: Record<string, unknown> | null
): string[] {
  if (!config) return [];
  const raw = config.drill_path ?? config.drillPath;
  if (Array.isArray(raw)) {
    return raw.map(String).filter((k) => assertLogicalDimensionKey(k));
  }
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map(String).filter((k) => assertLogicalDimensionKey(k));
      }
    } catch {
      return raw
        .split(/[,>]/)
        .map((s) => s.trim())
        .filter((k) => k && assertLogicalDimensionKey(k));
    }
  }
  return [];
}
