import { Alert } from "react-native";
import { router } from "expo-router";
import type { AnalysisRow } from "../api/genericAnalysisTypes";
import type { DrillFilters } from "../api/dashboardWidgetData";
import { filtersFromTerritoryParam } from "./receivablesNavigation";

export type SalesWidgetListScope = {
  widgetKey: string;
  title?: string;
  company?: string;
  from_date?: string;
  to_date?: string;
  period?: string;
  selectedTerritory?: string;
  view_all_sales?: 0 | 1;
  drill_depth?: number;
  sales_order?: string;
};

export const OPEN_SALES_ORDERS_LIST_WIDGET = "sales_open_orders_list";

export function salesKpiDrillWidgetKey(kpiWidgetKey: string): string | null {
  const k = String(kpiWidgetKey || "")
    .replace(/__\d+$/i, "")
    .trim()
    .toLowerCase();
  if (
    /sales_orders_kpi|total_orders_kpi|open_sales_orders_kpi|sales_dash_orders_kpi/.test(
      k
    )
  ) {
    return OPEN_SALES_ORDERS_LIST_WIDGET;
  }
  return null;
}

export function isOpenSalesOrdersListWidgetKey(widgetKey: string): boolean {
  const k = String(widgetKey || "")
    .replace(/__\d+$/i, "")
    .trim()
    .toLowerCase();
  return (
    k === OPEN_SALES_ORDERS_LIST_WIDGET ||
    /open_sales_orders_list|open_sales_orders_ranking/.test(k)
  );
}

import {
  salesOrderFromOpenSoRow,
  customerNameFromOpenSoRow,
  openAmountFromOpenSoRow,
} from "./openSalesOrderRows";

export {
  salesOrderFromOpenSoRow as salesOrderFromRow,
  customerNameFromOpenSoRow,
  openAmountFromOpenSoRow,
};

export function openSalesWidgetList(scope: SalesWidgetListScope): void {
  if (!scope.widgetKey?.trim()) return;
  const territory = String(scope.selectedTerritory || "").trim();
  router.push({
    pathname: "/(tabs)/sales-widget-list",
    params: {
      widget_key: scope.widgetKey,
      title: scope.title || "",
      company: scope.company || "",
      from_date: scope.from_date || "",
      to_date: scope.to_date || "",
      period: scope.period || "",
      territory: territory && territory !== "__all__" ? territory : "",
      view_all_sales: scope.view_all_sales ? "1" : "",
      drill_depth: String(scope.drill_depth ?? 1),
      sales_order: scope.sales_order || "",
    },
  });
}

export function openSalesKpiDrill(
  kpiWidgetKey: string,
  title: string,
  listScope: Omit<SalesWidgetListScope, "widgetKey" | "title" | "drill_depth">,
  payloadConfig?: Record<string, unknown> | null
): void {
  const fromConfig = String(
    payloadConfig?.drill_widget_key ||
      payloadConfig?.ranking_widget_key ||
      ""
  ).trim();
  const drillKey =
    fromConfig || salesKpiDrillWidgetKey(kpiWidgetKey) || "";
  if (!drillKey) {
    Alert.alert(
      "Details",
      "This KPI does not have a detail list configured yet."
    );
    return;
  }
  openSalesWidgetList({
    widgetKey: drillKey,
    title: title || "Open Sales Orders",
    drill_depth: 1,
    ...listScope,
  });
}

export function openOpenSalesOrderItemsDrill(
  row: AnalysisRow,
  scope: Omit<SalesWidgetListScope, "widgetKey" | "title" | "drill_depth">
): void {
  const salesOrder = salesOrderFromOpenSoRow(row);
  if (!salesOrder) {
    Alert.alert("Sales Order", "Could not resolve sales order on this row.");
    return;
  }
  const customer = customerNameFromOpenSoRow(row);
  openSalesWidgetList({
    widgetKey: OPEN_SALES_ORDERS_LIST_WIDGET,
    title: customer ? `${salesOrder} · ${customer}` : salesOrder,
    drill_depth: 2,
    sales_order: salesOrder,
    ...scope,
  });
}

export function drillFiltersForOpenSalesOrders(
  territory: string | undefined,
  salesOrder?: string
): DrillFilters | undefined {
  const base = filtersFromTerritoryParam(territory) || {};
  const so = String(salesOrder || "").trim();
  if (!so && !Object.keys(base).length) return undefined;
  if (!so) return base;
  return {
    ...base,
    sales_order: [so],
  };
}
