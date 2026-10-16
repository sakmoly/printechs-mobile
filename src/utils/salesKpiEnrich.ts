import type { DashboardWidgetDataResponse } from "../api/dashboardWidgetData";

import {

  pickWidgetKpiMetrics,

  normalizeWidgetKey,

} from "./kpiFormat";



function finite(n: unknown): number | null {

  if (n == null || !Number.isFinite(Number(n))) return null;

  return Number(n);

}



function catalogKeyNorm(catalogKey: string | undefined, payload: DashboardWidgetDataResponse): string {

  return normalizeWidgetKey(catalogKey || payload.widget_key || "");

}



function payloadForPick(payload: DashboardWidgetDataResponse): Record<string, unknown> {

  return {

    ...(payload as unknown as Record<string, unknown>),

    label: payload.label,

    title: payload.label,

    config: payload.config,

  };

}



function kpiRowRecord(payload: DashboardWidgetDataResponse): Record<string, unknown> | null {

  const kpi = payload.kpis?.[0];

  return (kpi as unknown as Record<string, unknown>) || null;

}



function pickPayloadMetrics(

  payload: DashboardWidgetDataResponse,

  catalogKey?: string

) {

  return pickWidgetKpiMetrics(

    payloadForPick(payload),

    kpiRowRecord(payload),

    catalogKey || payload.widget_key,

    payload.label || payload.kpis?.[0]?.label

  );

}



/** Merge pickWidgetKpiMetrics into kpis[0] so cards see BA root fields (e.g. cogs). */

export function applyKpiMetricsToPayload(

  payload: DashboardWidgetDataResponse,

  catalogKey?: string

): DashboardWidgetDataResponse {

  const picked = pickPayloadMetrics(payload, catalogKey);

  if (!picked) return payload;

  const kpis = [...(payload.kpis || [])];

  const base = kpis[0] || {

    key: String(catalogKey || payload.widget_key || ""),

    label: String(payload.label || payload.widget_key || "KPI"),

    value: 0,

    format: "currency" as const,

  };

  kpis[0] = {

    ...base,

    value: picked.value,

    previous: picked.previous ?? base.previous,

    change_pct: picked.changePct ?? base.change_pct,

  };

  return { ...payload, kpis, widget_key: catalogKey || payload.widget_key };

}



function metricFromPayload(

  payload: DashboardWidgetDataResponse | undefined,

  catalogKey?: string

): number | null {

  if (!payload) return null;

  const enriched = applyKpiMetricsToPayload(payload, catalogKey);

  return finite(pickPayloadMetrics(enriched, catalogKey)?.value ?? enriched.kpis?.[0]?.value);

}



function normalizeMarginPercent(raw: number | null): number | null {

  if (raw == null || !Number.isFinite(raw)) return null;

  let n = Number(raw);

  if (n > 0 && n <= 1) n *= 100;

  if (n < 0 || n > 100) return null;

  return n;

}



type BoardAmounts = {

  sales: number | null;

  gp: number | null;

  marginPct: number | null;

  salesLy: number | null;

};



function readBoardAmounts(

  widgetMap: Record<string, DashboardWidgetDataResponse | undefined>

): BoardAmounts {

  let sales: number | null = null;

  let gp: number | null = null;

  let marginPct: number | null = null;

  let salesLy: number | null = null;



  for (const [mapKey, w] of Object.entries(widgetMap)) {

    if (!w) continue;

    const k = normalizeWidgetKey(mapKey);

    if (

      !sales &&

      (/sales_total_kpi|sales_dash_net_ytd_kpi|net_sales_kpi/.test(k) ||

        k.includes("total_sales"))

    ) {

      sales = metricFromPayload(w, mapKey);

      const enriched = applyKpiMetricsToPayload(w, mapKey);

      salesLy = finite(pickPayloadMetrics(enriched, mapKey)?.previous);

    }

    if (

      !gp &&

      (/sales_gp_kpi|gross_profit_kpi|sales_gross_profit_kpi/.test(k) ||

        (k.includes("gross_profit") && !/margin/.test(k)))

    ) {

      gp = metricFromPayload(w, mapKey);

    }

    if (!marginPct && (/sales_gp_margin_kpi|gp_margin_kpi/.test(k) || /gp_margin|margin_kpi/.test(k))) {

      marginPct = normalizeMarginPercent(metricFromPayload(w, mapKey));

    }

  }



  return { sales, gp, marginPct, salesLy };

}



function setKpiValue(

  payload: DashboardWidgetDataResponse,

  value: number,

  previous?: number | null,

  meta?: Record<string, unknown>

): DashboardWidgetDataResponse {

  const kpis = [...(payload.kpis || [])];

  const base = kpis[0] || {

    key: String(payload.widget_key || ""),

    label: String(payload.label || payload.widget_key || "KPI"),

    value: 0,

    format: "currency" as const,

  };

  const prev =
    previous !== undefined ? previous : base.previous ?? null;
  kpis[0] = {
    ...base,
    value,
    previous: prev ?? undefined,
    change_pct:
      prev != null && Number.isFinite(Number(prev))
        ? base.change_pct
        : undefined,
  };

  return {

    ...payload,

    kpis,

    meta: { ...(payload.meta || {}), ...(meta || {}) },

  };

}



function blankKpiPayload(

  payload: DashboardWidgetDataResponse,

  meta?: Record<string, unknown>

): DashboardWidgetDataResponse {

  return {

    ...payload,

    kpis: [],

    meta: { ...(payload.meta || {}), ...(meta || {}), drillable: false },

  };

}



/**

 * Fallback when BA omits COGS or sends 0 while sales &gt; 0.

 * Prefer server root `cogs` / `value`. Derive sales − GP when GP is territory-aligned;

 * else sales × (1 − margin%) when GP is company-wide but margin matches sales scale.

 */

export function enrichSalesCogsFromBoard(

  payload: DashboardWidgetDataResponse,

  widgetMap: Record<string, DashboardWidgetDataResponse | undefined>,

  catalogKey?: string

): DashboardWidgetDataResponse {

  const key = catalogKeyNorm(catalogKey, payload);

  if (!/cogs|cost_of_goods/.test(key)) return payload;



  let next = payload;

  const { sales, gp, marginPct, salesLy } = readBoardAmounts(widgetMap);

  const pickedCogs = pickPayloadMetrics(next, catalogKey);

  let existing = finite(pickedCogs?.value ?? next.kpis?.[0]?.value);

  if (
    existing != null &&
    existing > 0 &&
    sales != null &&
    sales > 0 &&
    existing > sales * 1.02
  ) {
    existing = null;
  }

  if (existing != null && existing > 0) return next;

  if (sales == null || sales <= 0) {

    if (existing === 0) return blankKpiPayload(next, { cogs_unavailable: true });

    return next;

  }



  if (gp != null && gp > 0 && gp <= sales * 1.01) {

    const cogs = sales - gp;

    if (cogs >= 0) {

      return setKpiValue(next, cogs, pickedCogs?.previous ?? undefined, {

        cogs_derived: true,

        derived_from: "sales_minus_gp",

      });

    }

  }



  if (marginPct != null) {

    const gpFromMargin = sales * (marginPct / 100);

    if (gpFromMargin <= sales * 1.01) {

      const cogs = sales - gpFromMargin;

      if (cogs >= 0) {

        return setKpiValue(next, cogs, undefined, {

          cogs_derived: true,

          derived_from: "sales_minus_margin",

        });

      }

    }

  }



  if (existing === 0 || existing == null) {

    return blankKpiPayload(next, { cogs_unavailable: true });

  }

  return next;

}



/** Hide or replace company-wide GP when territory sales are much lower. */

export function enrichSalesGpFromBoard(

  payload: DashboardWidgetDataResponse,

  widgetMap: Record<string, DashboardWidgetDataResponse | undefined>,

  catalogKey?: string

): DashboardWidgetDataResponse {

  const key = catalogKeyNorm(catalogKey, payload);

  if (!/sales_gp_kpi|gross_profit_kpi|sales_gross_profit/.test(key) || /margin/.test(key)) {

    return payload;

  }



  const picked = pickPayloadMetrics(payload, catalogKey);

  const gp = finite(picked?.value ?? payload.kpis?.[0]?.value);

  if (gp == null || gp <= 0) return payload;



  const { sales, marginPct } = readBoardAmounts(widgetMap);

  if (sales == null || sales <= 0 || gp <= sales * 1.02) return payload;



  if (marginPct != null) {

    const gpFromMargin = sales * (marginPct / 100);

    if (gpFromMargin > 0 && gpFromMargin <= sales * 1.01) {

      return setKpiValue(payload, gpFromMargin, picked?.previous ?? undefined, {

        gp_derived: true,

        derived_from: "sales_times_margin",

      });

    }

  }



  return blankKpiPayload(payload, { territory_scope_mismatch: true });

}



export function payloadHasDisplayableKpi(

  payload: DashboardWidgetDataResponse,

  catalogKey?: string

): boolean {

  const key = catalogKeyNorm(catalogKey, payload);

  const enriched = applyKpiMetricsToPayload(payload, catalogKey);

  const v = finite(pickPayloadMetrics(enriched, catalogKey)?.value ?? enriched.kpis?.[0]?.value);

  if (v == null || !Number.isFinite(v)) return false;

  if (/cogs|cost_of_goods/.test(key) && v === 0) return false;

  return true;

}


