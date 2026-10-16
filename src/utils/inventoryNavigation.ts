import { router } from "expo-router";
import { ALL_TERRITORIES } from "./dashboardTerritory";

export type InventoryWidgetDetailScope = {
  widgetKey: string;
  title?: string;
  company?: string;
  from_date?: string;
  to_date?: string;
  period?: string;
  selectedTerritory?: string;
};

export type InventoryStockByBrandScope = {
  company?: string;
  from_date?: string;
  to_date?: string;
  period?: string;
  selectedTerritory?: string;
};

export function openInventoryStockByBrand(
  scope: InventoryStockByBrandScope = {}
): void {
  const territory = String(scope.selectedTerritory || "").trim();
  router.push({
    pathname: "/(tabs)/inventory-stock-by-brand",
    params: {
      company: scope.company || "",
      from_date: scope.from_date || "",
      to_date: scope.to_date || "",
      period: scope.period || "",
      territory:
        territory && territory !== ALL_TERRITORIES ? territory : "",
    },
  });
}

export function openInventoryItemStock(
  scope: InventoryStockByBrandScope = {},
  itemCode?: string
): void {
  const territory = String(scope.selectedTerritory || "").trim();
  router.push({
    pathname: "/(tabs)/inventory-stock-by-brand",
    params: {
      company: scope.company || "",
      from_date: scope.from_date || "",
      to_date: scope.to_date || "",
      period: scope.period || "",
      territory:
        territory && territory !== ALL_TERRITORIES ? territory : "",
      item_code: String(itemCode || "").trim(),
    },
  });
}

export function openInventoryWidgetDetail(
  scope: InventoryWidgetDetailScope
): void {
  const widgetKey = String(scope.widgetKey || "").trim();
  if (!widgetKey) return;
  const territory = String(scope.selectedTerritory || "").trim();
  router.push({
    pathname: "/(tabs)/inventory-widget-detail",
    params: {
      widget_key: widgetKey,
      title: scope.title || "",
      company: scope.company || "",
      from_date: scope.from_date || "",
      to_date: scope.to_date || "",
      period: scope.period || "",
      territory:
        territory && territory !== ALL_TERRITORIES ? territory : "",
    },
  });
}
