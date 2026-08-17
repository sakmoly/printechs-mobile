/**
 * Resolve LY summary for widget UI from API chart.summary, KPIs, or rows.
 * Desk "Show LY Comparison" is authoritative — never invent LY UI when off.
 */

import type {
  ChartLySummary,
  LyDisplayMeta,
} from "../api/dashboardWidgetData";
import type { WidgetData } from "./types";

function truthyFlag(v: unknown): boolean {
  return v === true || v === 1 || v === "1" || v === "true" || v === "True";
}

function falsyFlag(v: unknown): boolean {
  return (
    v === false ||
    v === 0 ||
    v === "0" ||
    v === "false" ||
    v === "False"
  );
}

function trendFromPct(
  changePct: number | null | undefined
): "up" | "down" | "flat" {
  if (changePct == null || !Number.isFinite(changePct)) return "flat";
  if (changePct > 0.5) return "up";
  if (changePct < -0.5) return "down";
  return "flat";
}

function displayForTrend(
  trend: string,
  lyMeta?: LyDisplayMeta | null,
  override?: ChartLySummary["display"]
): NonNullable<ChartLySummary["display"]> {
  const color =
    override?.color ||
    (trend === "up"
      ? override?.positive_color || "#16a34a"
      : trend === "down"
        ? override?.negative_color || "#dc2626"
        : "#64748b");
  const icon =
    override?.icon ||
    (trend === "up"
      ? lyMeta?.positive_icon || "arrow-up"
      : trend === "down"
        ? lyMeta?.negative_icon || "arrow-down"
        : lyMeta?.flat_icon || "minus");
  return {
    show_value: override?.show_value !== false,
    show_percentage: override?.show_percentage !== false,
    positive_color: override?.positive_color || "#16a34a",
    negative_color: override?.negative_color || "#dc2626",
    icon,
    color,
  };
}

function buildSummary(
  value: number,
  valueLy: number | null | undefined,
  changePct: number | null | undefined,
  lyMeta?: LyDisplayMeta | null,
  existingDisplay?: ChartLySummary["display"]
): ChartLySummary {
  let pct = changePct;
  if (
    (pct == null || !Number.isFinite(pct)) &&
    valueLy != null &&
    valueLy !== 0
  ) {
    pct = ((value - valueLy) / Math.abs(valueLy)) * 100;
  }
  const trend = trendFromPct(pct);
  return {
    value,
    value_ly: valueLy ?? null,
    change_pct: pct ?? null,
    trend,
    display: displayForTrend(trend, lyMeta, existingDisplay),
  };
}

function deskAllowsLy(data: WidgetData): boolean {
  const cfg = data.config || {};
  // Explicit Desk off always wins
  if (falsyFlag(cfg.show_ly) || falsyFlag(cfg.show_ly_comparison)) {
    return false;
  }
  const hasLyData = Boolean(
    data.chart_summary?.value_ly != null ||
      data.kpis?.some((k) => k.previous != null) ||
      data.rows?.some((r) => r.previous != null)
  );
  return Boolean(
    truthyFlag(cfg.show_ly) ||
      truthyFlag(cfg.show_ly_comparison) ||
      truthyFlag(data.show_ly) ||
      hasLyData ||
      cfg.compare === "ly" ||
      (cfg.chart &&
        typeof cfg.chart === "object" &&
        (cfg.chart as any).compare === "ly")
  );
}

function humanizeMetric(metric?: string | null): string | undefined {
  if (!metric) return undefined;
  return String(metric)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function resolveMetricLabel(data: WidgetData, fallback?: string): string {
  const preferred = String(data.preferred_label || "").trim();
  if (preferred && !/^(total(\s+sales)?|net\s+sales|sales)$/i.test(preferred)) {
    return preferred;
  }
  const fromMetric = humanizeMetric(data.chart_metric);
  if (fromMetric && !/^Net Sales$/i.test(fromMetric)) return fromMetric;
  if (fromMetric) return fromMetric;
  return fallback || preferred || "KPI";
}

/**
 * Returns summary + whether LY UI should show.
 * Prefers BA chart.summary.display; falls back to KPI/rows previous.
 * Only when Desk Show LY Comparison is enabled (or API show_ly).
 */
export function resolveWidgetLy(data: WidgetData): {
  showLy: boolean;
  summary: ChartLySummary | null;
  metricLabel?: string;
} {
  if (!deskAllowsLy(data)) {
    return { showLy: false, summary: null };
  }

  if (data.chart_summary && data.chart_summary.value_ly != null) {
    const s = data.chart_summary;
    const trend = String(s.trend || trendFromPct(s.change_pct));
    return {
      showLy: true,
      summary: {
        ...s,
        display: displayForTrend(trend, data.ly_display, s.display),
      },
      metricLabel: resolveMetricLabel(data),
    };
  }

  if (data.chart_summary) {
    return {
      showLy: true,
      summary: data.chart_summary,
      metricLabel: resolveMetricLabel(data),
    };
  }

  const kpi =
    data.kpis?.find((k) => k.previous != null) ||
    data.kpis?.find((k) => k.key === "total" || /sales/i.test(k.label)) ||
    data.kpis?.[0];

  if (kpi && kpi.previous != null) {
    return {
      showLy: true,
      summary: buildSummary(
        Number(kpi.value) || 0,
        Number(kpi.previous),
        kpi.change_pct,
        data.ly_display
      ),
      metricLabel: resolveMetricLabel(data, kpi.label),
    };
  }

  // Infer LY from YoY % when absolute previous is missing (common on live KPIs)
  if (kpi && kpi.change_pct != null && Number.isFinite(Number(kpi.value))) {
    const value = Number(kpi.value) || 0;
    const factor = 1 + Number(kpi.change_pct) / 100;
    if (Math.abs(factor) >= 1e-9) {
      const valueLy = value / factor;
      if (Number.isFinite(valueLy)) {
        return {
          showLy: true,
          summary: buildSummary(
            value,
            valueLy,
            kpi.change_pct,
            data.ly_display
          ),
          metricLabel: resolveMetricLabel(data, kpi.label),
        };
      }
    }
  }

  const rows = data.rows || [];
  const withLy = rows.filter((r) => r.previous != null);
  if (withLy.length) {
    const value = rows.reduce((s, r) => s + (Number(r.value) || 0), 0);
    const valueLy = withLy.reduce((s, r) => s + (Number(r.previous) || 0), 0);
    return {
      showLy: true,
      summary: buildSummary(value, valueLy, null, data.ly_display),
      metricLabel: resolveMetricLabel(data),
    };
  }

  return { showLy: true, summary: null };
}
