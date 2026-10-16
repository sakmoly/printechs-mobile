import type { DashboardWidgetDataResponse } from "../api/dashboardWidgetData";

function kpiValueIsPresent(value: unknown): boolean {
  if (value == null || !Number.isFinite(Number(value))) return false;
  // ERP often returns 0 when company/filters are wrong — treat as empty shell.
  return Number(value) !== 0;
}

/** True when payload has at least one non-zero metric. */
export function widgetPayloadHasNonZeroValue(
  payload: DashboardWidgetDataResponse | null | undefined
): boolean {
  if (!payload || payload.meta?.source === "empty") return false;
  if ((payload.kpis || []).some((k) => kpiValueIsPresent(k?.value))) return true;
  if ((payload.rows || []).some((r) => kpiValueIsPresent(r?.value))) return true;
  if ((payload.chart?.series || []).some((p) => kpiValueIsPresent(p?.value))) {
    return true;
  }
  if (kpiValueIsPresent(payload.chart?.summary?.value)) return true;
  return false;
}

/** True when the widget has no renderable values. */
export function isEmptyWidgetPayload(
  payload: DashboardWidgetDataResponse | null | undefined
): boolean {
  if (!payload) return true;
  if (payload.meta?.source === "empty") return true;
  const hasKpiValue = (payload.kpis || []).some((k) =>
    kpiValueIsPresent(k?.value)
  );
  if (hasKpiValue) return false;
  const hasRows = (payload.rows || []).some(
    (r) => r?.value != null && Number.isFinite(Number(r.value)) && Number(r.value) !== 0
  );
  if (hasRows) return false;
  const hasSeries = (payload.chart?.series || []).some(
    (p) => p?.value != null && Number.isFinite(Number(p.value)) && Number(p.value) !== 0
  );
  if (hasSeries) return false;
  const hasTable = (payload.table?.rows || []).length > 0;
  if (hasTable) return false;
  if (kpiValueIsPresent(payload.chart?.summary?.value)) {
    return false;
  }
  return true;
}

/** Higher = richer payload — used to avoid empty refetch wiping good cache. */
export function widgetPayloadScore(
  payload: DashboardWidgetDataResponse | null | undefined
): number {
  if (!payload || payload.meta?.source === "empty") return 0;
  let score = 1;
  for (const k of payload.kpis || []) {
    const v = Number(k?.value);
    if (k?.value != null && Number.isFinite(v)) {
      score += v !== 0 ? 15 : 1;
    }
    if (k?.previous != null && Number.isFinite(Number(k.previous))) score += 2;
  }
  if ((payload.chart?.series || []).length) score += 5;
  if (payload.chart?.summary?.value != null) score += 3;
  if ((payload.rows || []).length) score += 4;
  if ((payload.table?.rows || []).length) score += 4;
  return score;
}

export function preferWidgetPayload(
  existing: DashboardWidgetDataResponse | null | undefined,
  incoming: DashboardWidgetDataResponse | null | undefined
): DashboardWidgetDataResponse | undefined {
  if (!incoming) return existing || undefined;
  if (!existing) return incoming;
  const existingUseful = widgetPayloadHasNonZeroValue(existing);
  const incomingUseful = widgetPayloadHasNonZeroValue(incoming);
  if (existingUseful && !incomingUseful) return existing;
  if (!existingUseful && incomingUseful) return incoming;
  return widgetPayloadScore(incoming) >= widgetPayloadScore(existing)
    ? incoming
    : existing;
}

export function stampWidgetPayload(
  payload: DashboardWidgetDataResponse,
  widgetKey: string,
  label?: string
): DashboardWidgetDataResponse {
  return {
    ...payload,
    widget_key: widgetKey,
    label: label || payload.label || widgetKey,
  };
}
