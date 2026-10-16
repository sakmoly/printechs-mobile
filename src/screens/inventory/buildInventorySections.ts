/**
 * Group inventory_overview widgets into mockup sections.
 */

import type { DashboardWidgetDataResponse } from "../../api/dashboardWidgetData";
import type { MobileWidgetConfig } from "../../types/bootstrap";
import { normalizeWidgetType } from "../../widgets/types";
import {
  mergeInventoryWidgetDefs,
  resolveCatalogPayload,
  resolveLayoutSlot,
  type InventoryCatalogItem,
  type InventoryLayoutSlot,
} from "./inventoryWidgetCatalog";

export type InventoryWidgetEntry = {
  key: string;
  label: string;
  sortOrder: number;
  widgetType: string;
  layout?: InventoryLayoutSlot;
  payload: DashboardWidgetDataResponse;
};

export function buildInventoryWidgetEntries(
  widgetDefs: MobileWidgetConfig[],
  widgetMap: Record<string, DashboardWidgetDataResponse | undefined>
): InventoryWidgetEntry[] {
  const catalog = mergeInventoryWidgetDefs(widgetDefs);
  const consumed = new Set<string>();
  const ordered: InventoryWidgetEntry[] = [];

  for (const item of catalog) {
    const hit = resolveCatalogPayload(widgetMap, item, consumed);
    if (!hit) continue;
    const payload = hit.payload as DashboardWidgetDataResponse;
    consumed.add(hit.mapKey.toLowerCase());
    consumed.add(item.key.toLowerCase());
    for (const a of item.aliases || []) {
      consumed.add(String(a).toLowerCase());
    }

    const t = normalizeWidgetType(payload.widget_type || item.type || "");
    if (t === "LINK" || t === "HEADER") continue;

    ordered.push({
      key: item.key,
      label: String(payload.label || item.label || item.key),
      sortOrder: item.sort_order ?? 999,
      widgetType: t,
      layout: resolveLayoutSlot(item, item.key, t),
      payload,
    });
  }

  for (const [mapKey, payload] of Object.entries(widgetMap)) {
    const norm = mapKey.replace(/__\d+$/i, "").toLowerCase();
    if (consumed.has(norm) || !payload) continue;
    const t = normalizeWidgetType(payload.widget_type || "");
    if (!t || t === "LINK" || t === "HEADER") continue;
    ordered.push({
      key: mapKey,
      label: String(payload.label || mapKey),
      sortOrder: (payload.config?.sort_order as number) ?? 500,
      widgetType: t,
      layout: inferLayoutSlot(mapKey, t),
      payload,
    });
    consumed.add(norm);
  }

  return ordered.sort((a, b) => a.sortOrder - b.sortOrder);
}

function inferLayoutSlot(key: string, widgetType: string): InventoryLayoutSlot | undefined {
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
    return /cover/.test(k) ? "stock_cover" : "warehouse_donut";
  }
  if (widgetType === "RANKING" || widgetType === "TABLE") return "top_items";
  if (widgetType === "LIST") {
    if (/movement/.test(k)) return "movement";
    return "alerts";
  }
  if (widgetType === "BAR" && /aging/.test(k)) return "aging";
  return undefined;
}

export type InventoryLayout = {
  overviewKpis: InventoryWidgetEntry[];
  trend?: InventoryWidgetEntry;
  warehouseDonut?: InventoryWidgetEntry;
  movement?: InventoryWidgetEntry;
  aging?: InventoryWidgetEntry;
  stockCover?: InventoryWidgetEntry;
  health?: InventoryWidgetEntry;
  topItems?: InventoryWidgetEntry;
  alerts?: InventoryWidgetEntry;
  otherBlocks: InventoryWidgetEntry[];
};

export function partitionInventoryLayout(
  entries: InventoryWidgetEntry[]
): InventoryLayout {
  const layout: InventoryLayout = {
    overviewKpis: [],
    otherBlocks: [],
  };

  for (const entry of entries) {
    const slot = entry.layout || inferLayoutSlot(entry.key, entry.widgetType);
    switch (slot) {
      case "overview_kpi":
        layout.overviewKpis.push(entry);
        break;
      case "trend":
        layout.trend = layout.trend || entry;
        break;
      case "warehouse_donut":
        layout.warehouseDonut = layout.warehouseDonut || entry;
        break;
      case "movement":
        layout.movement = layout.movement || entry;
        break;
      case "aging":
        layout.aging = layout.aging || entry;
        break;
      case "stock_cover":
        layout.stockCover = layout.stockCover || entry;
        break;
      case "health":
        layout.health = layout.health || entry;
        break;
      case "top_items":
        layout.topItems = layout.topItems || entry;
        break;
      case "alerts":
        layout.alerts = layout.alerts || entry;
        break;
      default:
        layout.otherBlocks.push(entry);
    }
  }

  return layout;
}

export function buildInventoryLayout(
  widgetDefs: MobileWidgetConfig[],
  widgetMap: Record<string, DashboardWidgetDataResponse | undefined>
): InventoryLayout {
  return partitionInventoryLayout(
    buildInventoryWidgetEntries(widgetDefs, widgetMap)
  );
}
