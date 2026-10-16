/**
 * Health gauge scores — BA may send 0–100, 0–1 ratio, or `score` field.
 */

import type { DashboardWidgetDataResponse } from "../api/dashboardWidgetData";

export function isHealthWidgetKey(key: string | undefined | null): boolean {
  const k = String(key || "").toLowerCase();
  return /health/.test(k);
}

export function normalizeHealthScoreValue(
  value: number,
  opts?: { format?: string; maxScore?: number }
): number {
  if (!Number.isFinite(value)) return value;
  const maxScore = opts?.maxScore ?? 100;
  const fmt = String(opts?.format || "").toLowerCase();

  // Ratio 0–1 on a 0–100 gauge (e.g. 0.82 → 82)
  if (value > 0 && value <= 1 && maxScore >= 10) {
    return value * maxScore;
  }
  // Explicit percent/ratio format with fractional value
  if (
    (fmt === "percent" ||
      fmt === "pct" ||
      fmt === "percentage" ||
      fmt === "ratio" ||
      fmt === "score") &&
    value > 0 &&
    value <= 1
  ) {
    return value * maxScore;
  }
  return value;
}

function readRawScore(payload: DashboardWidgetDataResponse): number | null {
  const kpi = payload.kpis?.[0];
  const summary = payload.chart?.summary;
  const cfg = payload.config || {};
  const meta = payload.meta || {};
  const metaAny = meta as Record<string, unknown>;

  const candidates = [
    kpi?.value,
    (kpi as { score?: number })?.score,
    summary?.value,
    cfg.score,
    cfg.health_score,
    metaAny.health_score,
    metaAny.score,
  ];

  for (const raw of candidates) {
    if (raw == null) continue;
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export function resolveHealthScore(
  payload: DashboardWidgetDataResponse,
  widgetKey?: string
): { score: number; maxScore: number } | null {
  const raw = readRawScore(payload);
  if (raw == null) return null;

  const kpi = payload.kpis?.[0];
  const maxScore =
    Number(payload.config?.max_value) ||
    Number(payload.config?.max) ||
    Number(payload.config?.max_score) ||
    100;

  const format = String(
    kpi?.format || payload.config?.format || payload.config?.value_format || ""
  );

  let score = normalizeHealthScoreValue(raw, { format, maxScore });

  // If still tiny on a 100-scale gauge, treat as ratio (BA sent 0.82 without format)
  if (
    isHealthWidgetKey(widgetKey || payload.widget_key) &&
    score > 0 &&
    score <= 1 &&
    maxScore >= 10
  ) {
    score = score * maxScore;
  }

  score = Math.min(Math.max(score, 0), maxScore);
  if (!Number.isFinite(score)) return null;
  return { score, maxScore };
}
