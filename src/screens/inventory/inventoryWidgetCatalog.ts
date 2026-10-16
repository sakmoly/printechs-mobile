/**
 * Canonical inventory_overview widgets — mockup layout + backend aliases.
 */

import type { MobileWidgetConfig } from "../../types/bootstrap";
import { catalogItemMatchesBootstrap } from "../../utils/catalogBootstrapMatch";
import { catalogKeysToFetchWithContent } from "../../utils/catalogKeysToFetch";

export type InventoryLayoutSlot =
  | "overview_kpi"
  | "trend"
  | "warehouse_donut"
  | "movement"
  | "aging"
  | "stock_cover"
  | "health"
  | "top_items"
  | "alerts";

export type InventoryCatalogItem = {
  key: string;
  aliases?: string[];
  label?: string;
  type?: string;
  sort_order: number;
  config?: Record<string, unknown>;
  layout?: InventoryLayoutSlot;
};

export const INVENTORY_WIDGET_CATALOG: InventoryCatalogItem[] = [
  {
    key: "inventory_total_value_kpi",
    aliases: ["total_inventory_value_kpi", "inventory_value_kpi", "stock_value_kpi"],
    label: "Total Inventory Value",
    type: "KPI",
    sort_order: 10,
    layout: "overview_kpi",
  },
  {
    key: "inventory_stock_qty_kpi",
    aliases: ["total_stock_quantity_kpi", "stock_quantity_kpi", "sku_qty_kpi"],
    label: "Total Stock Quantity",
    type: "KPI",
    sort_order: 20,
    layout: "overview_kpi",
    config: { format: "integer" },
  },
  {
    key: "inventory_available_value_kpi",
    aliases: ["available_stock_value_kpi", "available_value_kpi"],
    label: "Available Stock Value",
    type: "KPI",
    sort_order: 30,
    layout: "overview_kpi",
  },
  {
    key: "inventory_reserved_value_kpi",
    aliases: ["reserved_stock_value_kpi", "reserved_value_kpi"],
    label: "Reserved Stock Value",
    type: "KPI",
    sort_order: 40,
    layout: "overview_kpi",
  },
  {
    key: "inventory_turnover_kpi",
    aliases: ["inventory_turnover_ytd_kpi", "turnover_kpi", "stock_turnover_kpi"],
    label: "Inventory Turnover (YTD)",
    type: "KPI",
    sort_order: 50,
    layout: "overview_kpi",
    config: { format: "ratio" },
  },
  {
    key: "inventory_days_kpi",
    aliases: ["days_of_inventory_kpi", "inventory_doi_kpi", "days_in_inventory_kpi"],
    label: "Days of Inventory",
    type: "KPI",
    sort_order: 60,
    layout: "overview_kpi",
    config: { format: "days", increase_is_bad: true },
  },
  {
    key: "inventory_value_trend",
    aliases: [
      "inventory_trend_line",
      "inventory_overview_trend",
      "stock_value_trend",
      "inventory_mtd_trend",
    ],
    label: "Inventory Value Trend (SAR)",
    type: "LINE",
    sort_order: 70,
    layout: "trend",
  },
  {
    key: "inventory_by_warehouse",
    aliases: [
      "inventory_warehouse_donut",
      "stock_by_warehouse",
      "inventory_value_by_warehouse",
    ],
    label: "Inventory Value by Warehouse",
    type: "DONUT",
    sort_order: 80,
    layout: "warehouse_donut",
  },
  {
    key: "inventory_movement_insights",
    aliases: ["movement_insights", "stock_movement", "inventory_movement"],
    label: "Movement Insights",
    type: "LIST",
    sort_order: 90,
    layout: "movement",
  },
  {
    key: "inventory_aging_bar",
    aliases: ["inventory_aging", "stock_aging", "inventory_aging_buckets"],
    label: "Inventory Aging (By Value)",
    type: "BAR",
    sort_order: 100,
    layout: "aging",
  },
  {
    key: "inventory_stock_cover",
    aliases: ["stock_cover", "stock_cover_donut", "inventory_cover"],
    label: "Stock Cover (By Value)",
    type: "DONUT",
    sort_order: 110,
    layout: "stock_cover",
  },
  {
    key: "inventory_health",
    aliases: ["inventory_health_score", "inventory_health_gauge"],
    label: "Inventory Health",
    type: "KPI",
    sort_order: 120,
    layout: "health",
  },
  {
    key: "inventory_top_items",
    aliases: [
      "top_items_by_value",
      "inventory_top_items_table",
      "top_inventory_items",
    ],
    label: "Top 5 Items by Inventory Value",
    type: "RANKING",
    sort_order: 130,
    layout: "top_items",
  },
  {
    key: "inventory_alerts",
    aliases: ["inventory_alert_list", "stock_alerts", "inventory_attention"],
    label: "Inventory Alerts",
    type: "LIST",
    sort_order: 140,
    layout: "alerts",
  },
];

export function mergeInventoryWidgetDefs(
  bootstrapWidgets: MobileWidgetConfig[]
): InventoryCatalogItem[] {
  const byKey = new Map<string, InventoryCatalogItem>();
  for (const c of INVENTORY_WIDGET_CATALOG) {
    byKey.set(c.key.toLowerCase(), { ...c });
  }
  for (const w of bootstrapWidgets) {
    const k = String(w.key || "").toLowerCase();
    if (!k) continue;
    const existing = byKey.get(k);
    const layout =
      (w.config?.layout as InventoryLayoutSlot | undefined) || existing?.layout;
    byKey.set(k, {
      key: w.key,
      aliases: existing?.aliases,
      label: w.label || existing?.label,
      type: w.type || existing?.type,
      sort_order: w.sort_order ?? existing?.sort_order ?? 999,
      layout,
      config: { ...(existing?.config || {}), ...(w.config || {}) },
    });
    if (/warehouse|donut|pie/.test(k) && !layout) {
      byKey.get(k)!.layout = /cover/.test(k) ? "stock_cover" : "warehouse_donut";
    }
    if (/movement/.test(k)) byKey.get(k)!.layout = "movement";
    if (/aging/.test(k)) byKey.get(k)!.layout = "aging";
    if (/health/.test(k)) byKey.get(k)!.layout = "health";
    if (/alert|attention/.test(k)) byKey.get(k)!.layout = "alerts";
    if (/top.*item|item.*rank/.test(k)) byKey.get(k)!.layout = "top_items";
    if (/trend/.test(k)) byKey.get(k)!.layout = "trend";
  }
  return [...byKey.values()].sort(
    (a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999)
  );
}

export function resolveCatalogPayload(
  widgetMap: Record<string, unknown>,
  item: InventoryCatalogItem,
  consumed: Set<string>
): { payload: Record<string, unknown>; mapKey: string } | null {
  const candidates = [item.key, ...(item.aliases || [])];
  for (const raw of candidates) {
    const k = String(raw || "").trim();
    if (!k || consumed.has(k.toLowerCase())) continue;
    const direct =
      (widgetMap as Record<string, unknown>)[k] ||
      (widgetMap as Record<string, unknown>)[k.toLowerCase()] ||
      Object.entries(widgetMap).find(
        ([mk]) => mk.replace(/__\d+$/i, "").toLowerCase() === k.toLowerCase()
      )?.[1];
    if (direct) {
      return { payload: direct as Record<string, unknown>, mapKey: k };
    }
  }
  return null;
}

export function catalogKeysToFetch(
  widgetMap: Record<string, unknown>,
  catalog: InventoryCatalogItem[],
  bootstrapKeys?: string[]
): string[] {
  const consumed = new Set<string>();
  return catalogKeysToFetchWithContent(
    widgetMap,
    catalog,
    consumed,
    resolveCatalogPayload,
    bootstrapKeys,
    catalogItemMatchesBootstrap
  );
}

function inferLayout(key: string, widgetType: string): InventoryLayoutSlot | undefined {
  const k = key.toLowerCase();
  if (widgetType === "KPI") {
    if (/health/.test(k)) return "health";
    return "overview_kpi";
  }
  if (widgetType === "LINE" || /trend/.test(k)) return "trend";
  if (/movement/.test(k)) return "movement";
  if (/aging/.test(k)) return "aging";
  if (/cover/.test(k)) return "stock_cover";
  if (/alert|attention/.test(k)) return "alerts";
  if (/top.*item|item.*rank/.test(k)) return "top_items";
  if (widgetType === "DONUT" || widgetType === "PIE") {
    if (/cover/.test(k)) return "stock_cover";
    if (/warehouse/.test(k)) return "warehouse_donut";
    return "warehouse_donut";
  }
  if (widgetType === "RANKING" || widgetType === "TABLE") return "top_items";
  if (widgetType === "LIST") return "alerts";
  return undefined;
}

export function resolveLayoutSlot(
  item: InventoryCatalogItem,
  key: string,
  widgetType: string
): InventoryLayoutSlot | undefined {
  return item.layout || inferLayout(key, widgetType);
}
