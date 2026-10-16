/**
 * Group home board widgets into mockup sections.
 */

import type { DashboardWidgetDataResponse } from "../../api/dashboardWidgetData";
import type { MobileWidgetConfig } from "../../types/bootstrap";
import { normalizeWidgetType } from "../../widgets/types";
import { catalogItemMatchesBootstrap } from "../../utils/catalogBootstrapMatch";
import {
  isEmptyWidgetPayload,
  stampWidgetPayload,
} from "../../utils/widgetPayload";
import {
  mergeHomeWidgetDefs,
  resolveCatalogPayload,
  resolveLayoutSlot,
  type HomeCatalogItem,
  type HomeLayoutSlot,
} from "./homeWidgetCatalog";
import {
  dedupeOverviewKpiByLabel,
  dedupeTerritoryKpiEntries,
  filterLegacyTerritoryCardKpis,
  hideTerritoryBreakdownWhenFiltered,
} from "../shared/dedupeWidgetEntries";
import { ALL_TERRITORIES } from "../../utils/dashboardTerritory";
import { applyKpiMetricsToPayload } from "../../utils/salesKpiEnrich";
import {
  blankHomeKpiForScopeMismatch,
  homeKpiLikelyCompanyWideLeak,
  readHomeTerritorySales,
} from "../../utils/homeKpiTerritorySanity";
import { pickWidgetKpiMetrics } from "../../utils/kpiFormat";

export type HomeWidgetEntry = {
  key: string;
  label: string;
  sortOrder: number;
  widgetType: string;
  layout?: HomeLayoutSlot;
  sectionTitle?: string;
  payload: DashboardWidgetDataResponse;
};

function resolveSectionTitle(
  item: HomeCatalogItem | undefined,
  payload: DashboardWidgetDataResponse
): string | undefined {
  const fromMeta = payload.meta?.section_title?.trim();
  if (fromMeta) return fromMeta;
  const fromCfg = String(
    item?.config?.section_title || payload.config?.section_title || ""
  ).trim();
  return fromCfg || undefined;
}

const HOME_KPI_LAYOUTS: HomeLayoutSlot[] = [
  "business_kpi",
  "key_indicator",
  "health",
];

function createEmptyKpiPayload(
  item: HomeCatalogItem
): DashboardWidgetDataResponse {
  return {
    widget_key: item.key,
    widget_type: item.type || "KPI",
    label: item.label || item.key,
    config: item.config,
    rows: [],
    kpis: [],
    meta: { drillable: false, source: "widget_data" },
  };
}

export function buildHomeWidgetEntries(
  widgetDefs: MobileWidgetConfig[],
  widgetMap: Record<string, DashboardWidgetDataResponse | undefined>,
  options?: { selectedTerritory?: string }
): HomeWidgetEntry[] {
  const catalog = mergeHomeWidgetDefs(widgetDefs);
  const bootstrapKeys = widgetDefs.map((w) => w.key).filter(Boolean);
  const consumed = new Set<string>();
  const ordered: HomeWidgetEntry[] = [];

  for (const item of catalog) {
    const widgetTypeHint = normalizeWidgetType(item.type || "KPI");
    const slot = resolveLayoutSlot(item, item.key, widgetTypeHint);
    const hit = resolveCatalogPayload(widgetMap, item, consumed);
    if (!hit) {
      if (consumed.has(item.key.toLowerCase())) continue;
      if (
        slot &&
        HOME_KPI_LAYOUTS.includes(slot) &&
        catalogItemMatchesBootstrap(item, bootstrapKeys)
      ) {
        ordered.push({
          key: item.key,
          label: String(item.label || item.key),
          sortOrder: item.sort_order ?? 999,
          widgetType: widgetTypeHint,
          layout: slot,
          sectionTitle: resolveSectionTitle(item, createEmptyKpiPayload(item)),
          payload: createEmptyKpiPayload(item),
        });
      }
      continue;
    }
    const rawPayload = hit.payload as DashboardWidgetDataResponse;
    if (
      slot &&
      HOME_KPI_LAYOUTS.includes(slot) &&
      isEmptyWidgetPayload(rawPayload) &&
      catalogItemMatchesBootstrap(item, bootstrapKeys)
    ) {
      consumed.add(hit.mapKey.toLowerCase());
      ordered.push({
        key: item.key,
        label: String(item.label || item.key),
        sortOrder: item.sort_order ?? 999,
        widgetType: widgetTypeHint,
        layout: slot,
        sectionTitle: resolveSectionTitle(item, createEmptyKpiPayload(item)),
        payload: createEmptyKpiPayload(item),
      });
      continue;
    }
    const payload =
      HOME_KPI_LAYOUTS.includes(slot || "") ||
      normalizeWidgetType(rawPayload.widget_type || item.type || "") === "KPI"
        ? applyKpiMetricsToPayload(rawPayload)
        : rawPayload;
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
      sectionTitle: resolveSectionTitle(item, payload),
      payload: stampWidgetPayload(
        payload as DashboardWidgetDataResponse,
        item.key,
        String(item.label || payload.label || item.key)
      ),
    });
  }

  for (const [mapKey, payload] of Object.entries(widgetMap)) {
    const norm = mapKey.replace(/__\d+$/i, "").toLowerCase();
    if (consumed.has(norm) || !payload) continue;
    const t = normalizeWidgetType(payload.widget_type || "");
    if (!t || t === "LINK" || t === "HEADER") continue;
    const slot = inferLayoutSlot(mapKey, t);
    if (
      slot === "business_kpi" ||
      slot === "key_indicator" ||
      slot === "health"
    ) {
      continue;
    }
    ordered.push({
      key: mapKey,
      label: String(payload.label || mapKey),
      sortOrder: (payload.config?.sort_order as number) ?? 500,
      widgetType: t,
      layout: inferLayoutSlot(mapKey, t),
      sectionTitle: resolveSectionTitle(undefined, payload),
      payload,
    });
    consumed.add(norm);
  }

  const territoryFilterActive =
    Boolean(options?.selectedTerritory) &&
    options!.selectedTerritory !== ALL_TERRITORIES;
  const territorySales = territoryFilterActive
    ? readHomeTerritorySales(widgetMap)
    : null;

  const scopeChecked = ordered.map((entry) => {
    if (!territorySales || entry.widgetType !== "KPI") return entry;
    const kpi = entry.payload.kpis?.[0];
    const picked = pickWidgetKpiMetrics(
      {
        ...(entry.payload as unknown as Record<string, unknown>),
        label: entry.payload.label,
        config: entry.payload.config,
      },
      (kpi as unknown as Record<string, unknown>) || null,
      entry.key,
      entry.label
    );
    const v = picked?.value ?? kpi?.value;
    if (
      v == null ||
      !Number.isFinite(Number(v)) ||
      !homeKpiLikelyCompanyWideLeak(entry.key, Number(v), territorySales)
    ) {
      return entry;
    }
    return {
      ...entry,
      payload: blankHomeKpiForScopeMismatch(entry.payload),
    };
  });

  const sorted = dedupeOverviewKpiByLabel(
    scopeChecked.sort((a, b) => a.sortOrder - b.sortOrder)
  );
  const withoutLegacy = filterLegacyTerritoryCardKpis(
    sorted,
    /home_total_receivables|total_receivables|receivables_total/,
    /receivables_card/
  );
  const scoped = hideTerritoryBreakdownWhenFiltered(
    withoutLegacy,
    territoryFilterActive
  );
  return dedupeTerritoryKpiEntries(scoped);
}

function inferLayoutSlot(key: string, widgetType: string): HomeLayoutSlot | undefined {
  const k = key.toLowerCase();
  if (widgetType === "KPI") {
    if (/health/.test(k)) return "health";
    if (/margin|ratio|cash|net_profit/.test(k)) return "key_indicator";
    return "business_kpi";
  }
  if (widgetType === "LINE" || /trend/.test(k)) return "trend";
  if (/insight/.test(k)) return "quick_insight";
  if (/activ/.test(k)) return "recent_activity";
  if (widgetType === "LIST") {
    return /activ/.test(k) ? "recent_activity" : "quick_insight";
  }
  return undefined;
}

export type HomeLayout = {
  businessKpis: HomeWidgetEntry[];
  keyIndicators: HomeWidgetEntry[];
  healthGauges: HomeWidgetEntry[];
  trend?: HomeWidgetEntry;
  quickInsights?: HomeWidgetEntry;
  recentActivities?: HomeWidgetEntry;
  otherBlocks: HomeWidgetEntry[];
};

export function partitionHomeLayout(entries: HomeWidgetEntry[]): HomeLayout {
  const layout: HomeLayout = {
    businessKpis: [],
    keyIndicators: [],
    healthGauges: [],
    otherBlocks: [],
  };

  for (const entry of entries) {
    const slot = entry.layout || inferLayoutSlot(entry.key, entry.widgetType);
    switch (slot) {
      case "business_kpi":
        layout.businessKpis.push(entry);
        break;
      case "key_indicator":
        layout.keyIndicators.push(entry);
        break;
      case "health":
        layout.healthGauges.push(entry);
        break;
      case "trend":
        layout.trend = layout.trend || entry;
        break;
      case "quick_insight":
        layout.quickInsights = layout.quickInsights || entry;
        break;
      case "recent_activity":
        layout.recentActivities = layout.recentActivities || entry;
        break;
      default:
        layout.otherBlocks.push(entry);
    }
  }

  return layout;
}

export function buildHomeLayout(
  widgetDefs: MobileWidgetConfig[],
  widgetMap: Record<string, DashboardWidgetDataResponse | undefined>,
  options?: { selectedTerritory?: string }
): HomeLayout {
  return partitionHomeLayout(
    buildHomeWidgetEntries(widgetDefs, widgetMap, options)
  );
}
