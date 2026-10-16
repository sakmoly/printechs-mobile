import type { ChartSeriesPoint } from "../api/dashboardWidgetData";
import type { DashboardWidgetDataResponse } from "../api/dashboardWidgetData";
import type { DrillFilters } from "../api/dashboardWidgetData";
import type { AnalysisRow } from "../api/genericAnalysisTypes";

const DEFAULT_DRILL_PATH = ["aging_bucket", "brand", "item"];

/** Chronological order for stock aging bucket labels. */
export function agingSortKey(label: string): number {
  const s = String(label || "").toLowerCase().trim();
  if (!s) return 9999;
  if (/current|^0\s*-\s*30|0-30/.test(s)) return 10;
  if (/31\s*-\s*60/.test(s)) return 31;
  if (/61\s*-\s*90/.test(s)) return 61;
  if (/91\s*-\s*180/.test(s)) return 91;
  if (/181\s*-\s*365/.test(s)) return 181;
  if (/over\s*365|>\s*365|365\s*\+/.test(s)) return 400;
  const range = s.match(/(\d+)\s*-\s*(\d+)/);
  if (range) return parseInt(range[1], 10);
  return 500;
}

export function sortAgingSeries<T extends { label: string }>(series: T[]): T[] {
  return [...series].sort(
    (a, b) => agingSortKey(a.label) - agingSortKey(b.label)
  );
}

export function looksLikeAgingBucketLabel(label: string): boolean {
  const s = String(label || "").toLowerCase();
  if (!s) return false;
  if (/\d+\s*-\s*\d+\s*day|over\s*\d+\s*day|0-30|31-60|61-90|91-180|181-365/.test(s)) {
    return true;
  }
  return agingSortKey(label) < 450;
}

export function resolveInventoryAgingDrillPath(
  payload: DashboardWidgetDataResponse | null | undefined
): string[] {
  if (!payload) return [...DEFAULT_DRILL_PATH];
  const fromMeta = payload.meta?.drill_path;
  if (Array.isArray(fromMeta) && fromMeta.length) {
    return fromMeta.map(String);
  }
  const cfg = payload.config as Record<string, unknown> | undefined;
  const fromCfg = cfg?.drill_path ?? cfg?.drillPath;
  if (Array.isArray(fromCfg) && fromCfg.length) {
    return fromCfg.map(String);
  }
  const chartDim = payload.chart?.dimension;
  if (chartDim) {
    return [String(chartDim), "brand", "item"];
  }
  return [...DEFAULT_DRILL_PATH];
}

export function mergeTerritoryIntoFilters(
  territory: string | undefined,
  drill: DrillFilters = {}
): DrillFilters {
  const out: DrillFilters = { ...drill };
  const t = String(territory || "").trim();
  if (t && t !== "__all__") {
    out.territory = [t];
  }
  return out;
}

export function bucketPointValue(point: ChartSeriesPoint): string {
  return String(
    point.dimension_value || point.label || ""
  ).trim();
}

export function rowDrillValue(row: AnalysisRow): string {
  const cells = row.meta?.cells as Record<string, unknown> | undefined;
  return String(
    row.id ||
      cells?.brand ||
      cells?.item_code ||
      cells?.item ||
      row.meta?.brand ||
      row.meta?.item_code ||
      row.label ||
      ""
  ).trim();
}

export function sortDrillRows(
  rows: AnalysisRow[],
  level: "brand" | "item" | "other"
): AnalysisRow[] {
  const copy = [...rows];
  if (level === "brand") {
    copy.sort((a, b) =>
      String(a.label || "").localeCompare(String(b.label || ""))
    );
    return copy;
  }
  if (level === "item") {
    copy.sort(
      (a, b) => (Number(b.value) || 0) - (Number(a.value) || 0)
    );
    return copy;
  }
  return copy;
}

export function filterNonBucketRows(rows: AnalysisRow[]): AnalysisRow[] {
  return rows.filter((r) => !looksLikeAgingBucketLabel(String(r.label || "")));
}
