import type { DashboardWidgetDataResponse } from "../api/dashboardWidgetData";
import { normalizeWidgetKey, pickWidgetKpiMetrics } from "./kpiFormat";

function readKpiValue(payload: DashboardWidgetDataResponse): number | null {
  const kpi = payload.kpis?.[0];
  const picked = pickWidgetKpiMetrics(
    {
      ...(payload as unknown as Record<string, unknown>),
      label: payload.label,
      title: payload.label,
      config: payload.config,
    },
    (kpi as unknown as Record<string, unknown>) || null,
    payload.widget_key,
    payload.label || kpi?.label
  );
  const v = picked?.value ?? kpi?.value;
  if (v == null || !Number.isFinite(Number(v))) return null;
  return Number(v);
}

export function readHomeTerritorySales(
  widgetMap: Record<string, DashboardWidgetDataResponse | undefined>
): number | null {
  for (const [key, payload] of Object.entries(widgetMap)) {
    const k = normalizeWidgetKey(key);
    if (!/home_total_sales|total_sales_kpi|sales_ytd/.test(k) || !payload) continue;
    const v = readKpiValue(payload);
    if (v != null && v > 0) return v;
  }
  return null;
}

/**
 * Home KPIs still on company-wide BA helpers show totals >> territory sales (e.g. GP 7.15M vs sales 1.72M).
 * Hide until server applies the same filters.territory as home_total_sales_kpi.
 */
export function homeKpiLikelyCompanyWideLeak(
  widgetKey: string,
  value: number,
  territorySales: number
): boolean {
  if (territorySales <= 0 || value <= 0) return false;
  const k = normalizeWidgetKey(widgetKey);
  if (/home_gross_profit|gross_profit_kpi|gp_ytd/.test(k)) {
    return value > territorySales * 1.02;
  }
  if (/home_total_purchases|total_purchases/.test(k)) {
    return value > territorySales * 3;
  }
  return false;
}

export function blankHomeKpiForScopeMismatch(
  payload: DashboardWidgetDataResponse
): DashboardWidgetDataResponse {
  return {
    ...payload,
    kpis: [],
    rows: [],
    meta: {
      ...(payload.meta || {}),
      territory_scope_mismatch: true,
      drillable: false,
    },
  };
}
