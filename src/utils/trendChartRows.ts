/**
 * Build TY/LY rows for monthly trend line charts (Sales + Receivables).
 */

import type { AnalysisRow } from "../api/genericAnalysisTypes";
import type { DashboardWidgetDataResponse } from "../api/dashboardWidgetData";

export const TREND_TY_COLOR = "#2563eb";
export const TREND_LY_COLOR = "#ef4444";

export const TREND_COMPARE_CHART_COLORS = {
  sliceColors: [TREND_TY_COLOR, TREND_LY_COLOR],
  current: TREND_TY_COLOR,
  ly: TREND_LY_COLOR,
  positive: "#16a34a",
  negative: "#dc2626",
};

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const MONTH_FULL: Record<string, number> = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
};

function parseMonthIndex(label: string): number | null {
  const raw = String(label || "").trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();

  const iso = lower.match(/^(\d{4})-(\d{1,2})/);
  if (iso) {
    const m = Number(iso[2]);
    if (m >= 1 && m <= 12) return m - 1;
  }

  const short = MONTH_SHORT.findIndex(
    (m) => lower === m.toLowerCase() || lower.startsWith(m.toLowerCase())
  );
  if (short >= 0) return short;

  for (const [name, idx] of Object.entries(MONTH_FULL)) {
    if (lower.includes(name)) return idx;
  }

  return null;
}

function monthLabel(idx: number): string {
  return MONTH_SHORT[idx] || `M${idx + 1}`;
}

function normalizeMonthKey(label: string): string {
  const idx = parseMonthIndex(label);
  return idx != null ? monthLabel(idx) : String(label || "").trim();
}

function pointsFromSeriesItem(item: Record<string, unknown>): Array<Record<string, unknown>> {
  if (Array.isArray(item.points)) return item.points as Array<Record<string, unknown>>;
  if (Array.isArray(item.data)) return item.data as Array<Record<string, unknown>>;
  if (Array.isArray(item.values)) return item.values as Array<Record<string, unknown>>;
  return [];
}

function pointValue(p: Record<string, unknown>): number {
  return Number(p.value ?? p.amount ?? p.total_sales ?? p.sales ?? 0) || 0;
}

function numericArray(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((v) => Number(v) || 0);
}

function stringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((v) => String(v ?? "").trim()).filter(Boolean);
}

function rowsFromLabelArrays(payload: DashboardWidgetDataResponse): AnalysisRow[] | null {
  const candidates: Array<Record<string, unknown>> = [];
  const chart = payload.chart as Record<string, unknown> | undefined;
  if (chart) candidates.push(chart);
  const root = payload as unknown as Record<string, unknown>;
  if (root.monthly_trend && typeof root.monthly_trend === "object") {
    candidates.push(root.monthly_trend as Record<string, unknown>);
  }
  const data = root.data;
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    if (d.chart && typeof d.chart === "object") {
      candidates.push(d.chart as Record<string, unknown>);
    }
    if (d.monthly_trend && typeof d.monthly_trend === "object") {
      candidates.push(d.monthly_trend as Record<string, unknown>);
    }
  }

  for (const src of candidates) {
    let labels = stringArray(src.labels);
    if (!labels.length) labels = stringArray(src.months);
    if (!labels.length) labels = stringArray(src.categories);
    const current = numericArray(
      src.current ?? src.values ?? src.this_year ?? src.ty
    );
    const previous = numericArray(
      src.previous ?? src.previous_year ?? src.last_year ?? src.ly ?? src.values_ly
    );

    if (labels.length && current.length) {
      const len = Math.min(labels.length, current.length);
      return Array.from({ length: len }, (_, i) => {
        const label = labels[i] || monthLabel(i);
        const key = normalizeMonthKey(label);
        return {
          id: key,
          label: key,
          value: current[i] ?? 0,
          previous:
            previous.length > i && Number.isFinite(previous[i])
              ? previous[i]
              : null,
        };
      });
    }

    const series = src.series;
    if (Array.isArray(series) && series.length >= 2) {
      const dual = mergeDualYearSeries(series as Array<Record<string, unknown>>);
      if (dual?.length) return dual;
    }

    const seriesOne = Array.isArray(series) ? series[0] : null;
    const seriesPrev = numericArray(
      src.previous ??
        src.previous_year ??
        (seriesOne && typeof seriesOne === "object"
          ? (seriesOne as Record<string, unknown>).previous
          : null)
    );
    if (labels.length && seriesPrev.length) {
      const values = numericArray(
        seriesOne && typeof seriesOne === "object"
          ? (seriesOne as Record<string, unknown>).data ??
              (seriesOne as Record<string, unknown>).values
          : current
      );
      const len = Math.min(labels.length, values.length, seriesPrev.length);
      if (len > 0) {
        return Array.from({ length: len }, (_, i) => {
          const label = labels[i] || monthLabel(i);
          const key = normalizeMonthKey(label);
          return {
            id: key,
            label: key,
            value: values[i] ?? 0,
            previous: Number.isFinite(seriesPrev[i]) ? seriesPrev[i] : null,
          };
        });
      }
    }
  }

  return null;
}

function mergeDualYearSeries(
  series: Array<Record<string, unknown>>,
  chartLabels?: string[]
): AnalysisRow[] | null {
  if (series.length < 2) return null;

  const nameOf = (s: Record<string, unknown>) =>
    String(s.label || s.name || s.key || s.series_key || "").toLowerCase();

  const ty =
    series.find((s) =>
      /this\s*year|current|ty\b|current_year/.test(nameOf(s))
    ) || series[0];
  const ly =
    series.find((s) =>
      /last\s*year|\bly\b|previous|prior/.test(nameOf(s))
    ) || series[1];

  const tyPoints = pointsFromSeriesItem(ty);
  const lyPoints = pointsFromSeriesItem(ly);

  const tyValues = numericArray(ty.values ?? ty.data);
  const lyValues = numericArray(ly.values ?? ly.data);
  const labels =
    stringArray(ty.labels) ||
    stringArray(ly.labels) ||
    chartLabels ||
    [];

  if (!tyPoints.length && tyValues.length && labels.length) {
    const len = Math.min(labels.length, tyValues.length, lyValues.length || tyValues.length);
    return Array.from({ length: len }, (_, i) => {
      const label = labels[i] || monthLabel(i);
      const key = normalizeMonthKey(label);
      return {
        id: key,
        label: key,
        value: tyValues[i] ?? 0,
        previous:
          lyValues.length > i && Number.isFinite(lyValues[i])
            ? lyValues[i]
            : null,
      };
    });
  }

  if (!tyPoints.length) return null;

  const lyByMonth = new Map<string, number>();
  lyPoints.forEach((p, i) => {
    const key = normalizeMonthKey(String(p.label || p.name || p.month || i));
    lyByMonth.set(key, pointValue(p));
  });

  return tyPoints.map((p, i) => {
    const label = String(p.label || p.name || p.month || `Point ${i + 1}`);
    const key = normalizeMonthKey(label);
    const monthIdx = parseMonthIndex(label);
    return {
      id: key,
      label: monthIdx != null ? monthLabel(monthIdx) : label,
      value: pointValue(p),
      previous: lyByMonth.has(key)
        ? lyByMonth.get(key)!
        : lyPoints[i]
          ? pointValue(lyPoints[i])
          : null,
    };
  });
}

function rowsFromChartSeries(payload: DashboardWidgetDataResponse): AnalysisRow[] {
  const chart = payload.chart as Record<string, unknown> | undefined;
  const fromArrays = rowsFromLabelArrays(payload);
  if (fromArrays?.length) return fromArrays;

  const series = (payload.chart?.series || []) as Array<Record<string, unknown>>;
  if (!series.length) return [];

  const chartLabels = stringArray(chart?.labels ?? chart?.months);
  const dual = mergeDualYearSeries(series, chartLabels);
  if (dual?.length) return dual;

  return series.map((p, i) => ({
    id: String(p.dimension_value || p.label || `p-${i}`),
    label: String(p.label || p.name || `Point ${i + 1}`),
    value: pointValue(p),
    previous:
      p.value_ly != null && Number.isFinite(Number(p.value_ly))
        ? Number(p.value_ly)
        : p.sales_ly != null && Number.isFinite(Number(p.sales_ly))
          ? Number(p.sales_ly)
          : p.previous != null && Number.isFinite(Number(p.previous))
            ? Number(p.previous)
            : null,
    change_pct:
      p.change_pct != null && Number.isFinite(Number(p.change_pct))
        ? Number(p.change_pct)
        : null,
  }));
}

function fillCalendarMonths(rows: AnalysisRow[]): AnalysisRow[] {
  const indexed = rows
    .map((r) => ({ row: r, idx: parseMonthIndex(r.label) }))
    .filter((x): x is { row: AnalysisRow; idx: number } => x.idx != null);

  if (indexed.length < 2) return rows;

  indexed.sort((a, b) => a.idx - b.idx);
  const maxIdx = Math.max(...indexed.map((x) => x.idx));
  const byMonth = new Map<number, AnalysisRow>();
  for (const { row, idx } of indexed) {
    byMonth.set(idx, { ...row, label: monthLabel(idx) });
  }

  const filled: AnalysisRow[] = [];
  for (let m = 0; m <= maxIdx; m++) {
    filled.push(
      byMonth.get(m) ?? {
        id: monthLabel(m),
        label: monthLabel(m),
        value: 0,
        previous: 0,
      }
    );
  }
  return filled;
}

export function buildTrendCompareRows(
  payload: DashboardWidgetDataResponse,
  opts?: { fillMonths?: boolean }
): AnalysisRow[] {
  let rows: AnalysisRow[] = [];

  if (payload.rows?.length) {
    rows = payload.rows.map((r) => ({
      ...r,
      label: normalizeMonthKey(r.label) || r.label,
      previous:
        r.previous != null && Number.isFinite(Number(r.previous))
          ? Number(r.previous)
          : null,
    }));
    if (!trendHasLy(rows)) {
      const fromChart = rowsFromChartSeries(payload);
      if (fromChart.length) rows = fromChart;
    }
  } else {
    rows = rowsFromChartSeries(payload);
  }

  if (!trendHasLy(rows) && payload.show_ly) {
    const fromArrays = rowsFromLabelArrays(payload);
    if (fromArrays?.length) rows = fromArrays;
  }

  if (opts?.fillMonths !== false) {
    rows = fillCalendarMonths(rows);
  }

  return rows;
}

export function trendHasLy(rows: AnalysisRow[]): boolean {
  return rows.some(
    (r) => r.previous != null && Number.isFinite(Number(r.previous))
  );
}
