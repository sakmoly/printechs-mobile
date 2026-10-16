/**
 * Group sales_overview widgets into mockup sections.
 */

import type { DashboardWidgetDataResponse } from "../../api/dashboardWidgetData";
import type { MobileWidgetConfig } from "../../types/bootstrap";
import { normalizeWidgetType } from "../../widgets/types";
import { catalogItemMatchesBootstrap } from "../../utils/catalogBootstrapMatch";
import {
  dedupeOverviewKpiByLabel,
  dedupeSummaryDonutByLabel,
} from "../shared/dedupeWidgetEntries";
import {
  applyKpiMetricsToPayload,
  enrichSalesCogsFromBoard,
  enrichSalesGpFromBoard,
  payloadHasDisplayableKpi,
} from "../../utils/salesKpiEnrich";
import { catalogKeysToFetchWithContent } from "../../utils/catalogKeysToFetch";
import {
  isEmptyWidgetPayload,
  stampWidgetPayload,
} from "../../utils/widgetPayload";
import {
  mergeSalesWidgetDefs,
  isHiddenSalesWidget,
  resolveCatalogPayload,
  resolveLayoutSlot,
  type SalesCatalogItem,
  type SalesLayoutSlot,
} from "./salesWidgetCatalog";

export type SalesWidgetEntry = {
  key: string;
  label: string;
  sortOrder: number;
  widgetType: string;
  layout?: SalesLayoutSlot;
  salesByTab?: string;
  payload: DashboardWidgetDataResponse;
};

function createEmptyKpiPayload(
  item: SalesCatalogItem
): DashboardWidgetDataResponse {
  return {
    widget_key: item.key,
    widget_type: "KPI",
    label: item.label || item.key,
    config: item.config,
    rows: [],
    kpis: [],
    meta: { drillable: false, source: "widget_data" },
  };
}

function createEmptySectionPayload(
  item: SalesCatalogItem,
  widgetType: string
): DashboardWidgetDataResponse {
  return {
    widget_key: item.key,
    widget_type: widgetType,
    label: item.label || item.key,
    config: item.config,
    rows: [],
    kpis: [],
    meta: { drillable: false, source: "widget_data" },
  };
}

export function buildSalesWidgetEntries(
  widgetDefs: MobileWidgetConfig[],
  widgetMap: Record<string, DashboardWidgetDataResponse | undefined>
): SalesWidgetEntry[] {
  const catalog = mergeSalesWidgetDefs(widgetDefs);
  const bootstrapKeys = widgetDefs.map((w) => w.key).filter(Boolean);
  const consumed = new Set<string>();
  const ordered: SalesWidgetEntry[] = [];

  for (const item of catalog) {
    if (isHiddenSalesWidget(item.key)) continue;
    const widgetTypeHint = normalizeWidgetType(item.type || "KPI");
    const slot = resolveLayoutSlot(item, item.key, widgetTypeHint);
    const hit = resolveCatalogPayload(widgetMap, item, consumed);
    if (!hit) {
      if (consumed.has(item.key.toLowerCase())) continue;
      const shouldPlaceholder =
        slot === "overview_kpi"
          ? catalogItemMatchesBootstrap(item, bootstrapKeys)
          : slot === "sales_by" ||
            slot === "trend" ||
            slot === "summary_donut" ||
            slot === "attention";
      if (shouldPlaceholder) {
        ordered.push({
          key: item.key,
          label: String(item.label || item.key),
          sortOrder: item.sort_order ?? 999,
          widgetType: normalizeWidgetType(item.type || "KPI"),
          layout: slot,
          salesByTab: item.salesByTab,
          payload:
            slot === "overview_kpi"
              ? createEmptyKpiPayload(item)
              : createEmptySectionPayload(item, item.type || "KPI"),
        });
      }
      continue;
    }
    let rawPayload = hit.payload as DashboardWidgetDataResponse;
    if (slot === "overview_kpi") {
      rawPayload = applyKpiMetricsToPayload(rawPayload, item.key);
      rawPayload = enrichSalesCogsFromBoard(
        rawPayload,
        widgetMap as Record<string, DashboardWidgetDataResponse | undefined>,
        item.key
      );
      rawPayload = enrichSalesGpFromBoard(
        rawPayload,
        widgetMap as Record<string, DashboardWidgetDataResponse | undefined>,
        item.key
      );
    }
    if (
      slot === "overview_kpi" &&
      !payloadHasDisplayableKpi(rawPayload, item.key) &&
      isEmptyWidgetPayload(rawPayload) &&
      catalogItemMatchesBootstrap(item, bootstrapKeys)
    ) {
      consumed.add(hit.mapKey.toLowerCase());
      ordered.push({
        key: item.key,
        label: String(item.label || item.key),
        sortOrder: item.sort_order ?? 999,
        widgetType: "KPI",
        layout: slot,
        salesByTab: item.salesByTab,
        payload: createEmptyKpiPayload(item),
      });
      continue;
    }
    const payload = rawPayload;
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
      salesByTab: item.salesByTab,
      payload: stampWidgetPayload(
        payload as DashboardWidgetDataResponse,
        item.key,
        String(item.label || payload.label || item.key)
      ),
    });
  }

  for (const [mapKey, payload] of Object.entries(widgetMap)) {
    const norm = mapKey.replace(/__\d+$/i, "").toLowerCase();
    if (consumed.has(norm) || !payload || isHiddenSalesWidget(mapKey)) continue;
    const t = normalizeWidgetType(payload.widget_type || "");
    if (!t || t === "LINK" || t === "HEADER") continue;
    const slot = inferLayoutSlot(mapKey, t);
    // Overview KPIs only via catalog — avoids duplicate COGS / extra bootstrap keys
    if (slot === "overview_kpi") continue;
    ordered.push({
      key: mapKey,
      label: String(payload.label || mapKey),
      sortOrder: (payload.config?.sort_order as number) ?? 500,
      widgetType: t,
      layout: slot,
      payload: stampWidgetPayload(payload, mapKey, String(payload.label || mapKey)),
    });
    consumed.add(norm);
  }

  return dedupeOverviewKpiByLabel(
    ordered.sort((a, b) => a.sortOrder - b.sortOrder)
  );
}

function inferLayoutSlot(key: string, widgetType: string): SalesLayoutSlot | undefined {
  const k = key.toLowerCase().replace(/__\d+$/i, "");
  if (/^sales_by_division$/.test(k)) return "sales_by";
  if (/sales_donut_division|division_donut/.test(k)) return "summary_donut";
  if (widgetType === "KPI") return "overview_kpi";
  if (widgetType === "LINE" || /trend/.test(k)) return "trend";
  if (widgetType === "LIST" || /attention/.test(k)) return "attention";
  if (
    widgetType === "DONUT" ||
    widgetType === "PIE" ||
    /donut|by_group/.test(k)
  ) {
    if (/ranking|salesperson|by_territory_rank/.test(k)) return "sales_by";
    return "summary_donut";
  }
  if (widgetType === "RANKING" || widgetType === "TABLE" || /by_/.test(k)) {
    return "sales_by";
  }
  return undefined;
}

export type SalesLayout = {
  overviewKpis: SalesWidgetEntry[];
  trend?: SalesWidgetEntry;
  salesBy: SalesWidgetEntry[];
  summaryDonuts: SalesWidgetEntry[];
  attention?: SalesWidgetEntry;
  otherBlocks: SalesWidgetEntry[];
};

const SALES_BY_ORDER = ["territory", "division", "salesperson"];

function salesByRank(entry: SalesWidgetEntry): number {
  const k = entry.key.toLowerCase();
  const tab = String(entry.salesByTab || entry.label || "").toLowerCase();
  for (let i = 0; i < SALES_BY_ORDER.length; i++) {
    if (k.includes(SALES_BY_ORDER[i]) || tab.includes(SALES_BY_ORDER[i])) {
      return i;
    }
  }
  return 50;
}

export function partitionSalesLayout(entries: SalesWidgetEntry[]): SalesLayout {
  const layout: SalesLayout = {
    overviewKpis: [],
    salesBy: [],
    summaryDonuts: [],
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
      case "sales_by":
        layout.salesBy.push(entry);
        break;
      case "summary_donut":
        layout.summaryDonuts.push(entry);
        break;
      case "attention":
        layout.attention = layout.attention || entry;
        break;
      default:
        layout.otherBlocks.push(entry);
    }
  }

  layout.salesBy.sort((a, b) => salesByRank(a) - salesByRank(b));
  layout.summaryDonuts = dedupeSummaryDonutByLabel(layout.summaryDonuts);
  return layout;
}

export function buildSalesLayout(
  widgetDefs: MobileWidgetConfig[],
  widgetMap: Record<string, DashboardWidgetDataResponse | undefined>
): SalesLayout {
  return partitionSalesLayout(buildSalesWidgetEntries(widgetDefs, widgetMap));
}
