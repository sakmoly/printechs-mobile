import type { DashboardWidgetDataResponse } from "../api/dashboardWidgetData";
import type { AnalysisRow } from "../api/genericAnalysisTypes";
import { OPEN_SALES_ORDERS_LIST_WIDGET } from "./salesNavigation";
import { openAmountFromOpenSoRow } from "./openSalesOrderRows";

export type OpenSalesOrdersKpiDisplay = {
  orderCount: number;
  totalValue: number;
  currency: string;
  source: "drill_list" | "meta" | "kpi";
};

function metaRecord(
  payload: DashboardWidgetDataResponse
): Record<string, unknown> {
  return (payload.meta || {}) as Record<string, unknown>;
}

export function isOpenSalesOrdersKpiWidget(
  widgetKey: string | undefined | null,
  label?: string
): boolean {
  const k = String(widgetKey || "")
    .replace(/__\d+$/i, "")
    .toLowerCase();
  const hay = `${k} ${String(label || "").toLowerCase()}`;
  return (
    /sales_orders_kpi|total_orders_kpi|open_sales_orders/.test(k) ||
    /open sales orders|total orders/.test(hay)
  );
}

function numOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Prefer drill list totals; else batch meta; else KPI integer. */
export function resolveOpenSalesOrdersKpiDisplay(
  payload: DashboardWidgetDataResponse,
  drill?: { rows: AnalysisRow[]; meta?: Record<string, unknown> } | null
): OpenSalesOrdersKpiDisplay | null {
  if (!isOpenSalesOrdersKpiWidget(payload.widget_key, payload.label)) {
    return null;
  }
  const currency =
    String(payload.currency || metaRecord(payload).currency || "SAR") ||
    "SAR";

  if (drill?.rows?.length) {
    const orderCount =
      numOrNull(drill.meta?.open_so_count) ??
      numOrNull(drill.meta?.total_rows) ??
      drill.rows.length;
    const summed = drill.rows.reduce(
      (s, r) => s + openAmountFromOpenSoRow(r),
      0
    );
    const totalValue =
      numOrNull(drill.meta?.open_so_value) ??
      numOrNull(drill.meta?.pending_delivery_value) ??
      (summed > 0 ? summed : null) ??
      0;
    return {
      orderCount: orderCount ?? drill.rows.length,
      totalValue,
      currency,
      source: "drill_list",
    };
  }

  const meta = metaRecord(payload);
  const kpi = payload.kpis?.[0];
  const metaCount =
    numOrNull(meta.open_so_count) ??
    numOrNull(meta.open_count) ??
    numOrNull(meta.total_rows);
  const metaValue =
    numOrNull(meta.open_so_value) ??
    numOrNull(meta.pending_delivery_value) ??
    numOrNull(meta.open_value);

  const kpiCount = numOrNull(kpi?.value);
  const secondKpi = payload.kpis?.[1];
  const secondCount = numOrNull(secondKpi?.value);

  const orderCount =
    metaCount ??
    (kpi?.format === "integer" || payload.config?.format === "integer"
      ? kpiCount
      : secondCount ?? kpiCount) ??
    0;

  const totalValue =
    metaValue ??
    (kpi?.format !== "integer" && payload.config?.format !== "integer"
      ? kpiCount
      : numOrNull(secondKpi?.value)) ??
    0;

  return {
    orderCount,
    totalValue,
    currency,
    source: metaCount != null || metaValue != null ? "meta" : "kpi",
  };
}

export function openSalesOrdersDrillWidgetKey(): string {
  return OPEN_SALES_ORDERS_LIST_WIDGET;
}
