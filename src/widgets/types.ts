/**
 * Phase I — widget metadata from BA (never executable code).
 */

import type { AnalysisKpi, AnalysisRow } from "../api/genericAnalysisTypes";

export type WidgetTypeId =
  | "KPI"
  | "BAR"
  | "LINE"
  | "PIE"
  | "DONUT"
  | "TABLE"
  | "RANKING"
  | "LIST"
  | "MATRIX"
  | "EXPANDABLE"
  | string;

export type WidgetData = {
  currency?: string;
  kpis?: AnalysisKpi[];
  rows?: AnalysisRow[];
  loading?: boolean;
  /** Soft fetch (drill / refresh) — keep content, show small indicator */
  fetching?: boolean;
  error?: string | null;
  /** From get_dashboard_widget_data.config (chart_colors, colors, …) */
  config?: Record<string, unknown>;
  /** Desk Show LY Comparison */
  show_ly?: boolean;
  /** chart.summary from get_dashboard_widget_data */
  chart_summary?: import("../api/dashboardWidgetData").ChartLySummary | null;
  chart_metric?: string;
  ly_display?: import("../api/dashboardWidgetData").LyDisplayMeta | null;
  /** Bootstrap / Desk widget.label — prefer over generic "Total Sales" */
  preferred_label?: string | null;
  /**
   * Payload widget_type (batch/single). Final renderer uses resolveEffectiveWidgetType.
   */
  widget_type?: string | null;
  /** meta.render_hint from get_dashboard_widget_data / board entry */
  render_hint?: string | null;
  /** Current drill depth (0 = root donut, 1 = brand table, …) */
  drill_depth?: number | null;
  /** chart.series from payload (prefer over rows for PIE/DONUT/BAR/LINE) */
  chart?: {
    series?: { label: string; value: number; id?: string; previous?: number | null }[];
    metric?: string;
    summary?: import("../api/dashboardWidgetData").ChartLySummary | null;
  } | null;
  /** BA table block: columns + rows + total + currency_display */
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
    rows?: AnalysisRow[];
    total?: number | null;
    currency_display?: {
      show_symbol?: boolean;
      currency?: string;
    } | null;
  } | null;
  /** LINK action from payload.action */
  action?: Record<string, unknown> | null;
};

export type WidgetDrillPoint = {
  label: string;
  id?: string;
  dimension_value?: string;
};

export type WidgetRenderProps = {
  widgetKey: string;
  label: string;
  type: WidgetTypeId;
  metricKey?: string;
  dimensionKey?: string;
  secondaryDimensionKey?: string;
  config?: Record<string, unknown>;
  data: WidgetData;
  onOpenAnalysis?: (dimension: string, metric?: string) => void;
  /** Chart drill — tap a slice/bar/row */
  onSliceTap?: (point: WidgetDrillPoint) => void;
  drillable?: boolean;
  drillStack?: { dimension: string; label: string; value: string }[];
  onDrillBack?: () => void;
  /** Compact cell in a horizontal widget_rows row */
  compact?: boolean;
};

/** Normalize BA type strings to registry keys */
export function normalizeWidgetType(raw: string | undefined): string {
  if (!raw) return "UNKNOWN";
  // Strip zero-width / punctuation so Desk "LINK" / "link" / "Link " always match
  const t = String(raw)
    .trim()
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .toUpperCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^\w]/g, "");
  const aliases: Record<string, string> = {
    KPI: "KPI",
    CHART: "BAR",
    BAR: "BAR",
    BAR_CHART: "BAR",
    LINE: "LINE",
    LINE_CHART: "LINE",
    PIE: "PIE",
    DONUT: "DONUT",
    TABLE: "TABLE",
    DATATABLE: "TABLE",
    DATA_TABLE: "TABLE",
    DATA_GRID: "TABLE",
    GRID: "TABLE",
    RANKING: "RANKING",
    LIST: "LIST",
    MATRIX: "MATRIX",
    EXPANDABLE: "EXPANDABLE",
    // Desk / legacy — "card" means data table/card, not a pie
    EXPAND: "EXPANDABLE",
    CARD: "TABLE",
    DATA_CARD: "TABLE",
    // Desk section / board headers (title only, no data fetch)
    HEADER: "HEADER",
    SECTION: "HEADER",
    SECTION_HEADER: "HEADER",
    TITLE: "HEADER",
    // Navigation tile to another module / board
    LINK: "LINK",
    SHORTCUT: "LINK",
    NAV: "LINK",
    BUTTON: "LINK",
  };
  return aliases[t] || t;
}
