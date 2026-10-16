/**
 * Group receivables board widgets into mockup sections.
 * Uses catalog + batch map (not bootstrap-only) so aliases and partial batches work.
 */

import type { DashboardWidgetDataResponse } from "../../api/dashboardWidgetData";
import type { MobileWidgetConfig } from "../../types/bootstrap";
import { normalizeWidgetType } from "../../widgets/types";
import {
  mergeReceivablesWidgetDefs,
  resolveCatalogPayload,
  type ReceivablesCatalogItem,
} from "./receivablesWidgetCatalog";
import {
  dedupeOverviewKpiByLabel,
  dedupeTerritoryKpiEntries,
} from "../shared/dedupeWidgetEntries";

export type ReceivablesWidgetEntry = {
  key: string;
  label: string;
  sortOrder: number;
  widgetType: string;
  payload: DashboardWidgetDataResponse;
};

export type ReceivablesKpiRow = {
  group: string;
  items: ReceivablesWidgetEntry[];
};

export type ReceivablesSection = {
  title: string;
  kpiRows: ReceivablesKpiRow[];
  blocks: ReceivablesWidgetEntry[];
};

function resolveSectionTitle(
  item: ReceivablesCatalogItem,
  payload: DashboardWidgetDataResponse
): string {
  const fromMeta = payload.meta?.section_title?.trim();
  if (fromMeta) return fromMeta;
  const fromCfg = String(
    item.config?.section_title || payload.config?.section_title || ""
  ).trim();
  if (fromCfg) return fromCfg;
  return "Overview";
}

function resolveRowGroup(
  item: ReceivablesCatalogItem,
  payload: DashboardWidgetDataResponse
): string {
  const fromMeta = payload.meta?.row_group?.trim();
  if (fromMeta) return fromMeta;
  const fromCfg = String(
    item.config?.row_group || payload.config?.row_group || ""
  ).trim();
  if (fromCfg) return fromCfg;
  return "default";
}

export function buildReceivablesSections(
  widgetDefs: MobileWidgetConfig[],
  widgetMap: Record<string, DashboardWidgetDataResponse | undefined>
): ReceivablesSection[] {
  const catalog = mergeReceivablesWidgetDefs(widgetDefs);
  const consumed = new Set<string>();
  const ordered: ReceivablesWidgetEntry[] = [];

  for (const item of catalog) {
    const hit = resolveCatalogPayload(widgetMap, item, consumed);
    if (!hit) continue;
    const payload = hit.payload as DashboardWidgetDataResponse;
    consumed.add(hit.mapKey.toLowerCase());
    consumed.add(item.key.toLowerCase());
    for (const a of item.aliases || []) {
      consumed.add(String(a).toLowerCase());
    }

    const t = normalizeWidgetType(
      payload.widget_type || item.type || ""
    );
    if (t === "LINK" || t === "HEADER") continue;

    ordered.push({
      key: item.key,
      label: String(payload.label || item.label || item.key),
      sortOrder: item.sort_order ?? 999,
      widgetType: t,
      payload,
    });
  }

  // Any extra batch keys not in catalog (forward-compatible)
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
      payload,
    });
    consumed.add(norm);
  }

  ordered.sort((a, b) => a.sortOrder - b.sortOrder);
  const deduped = dedupeOverviewKpiByLabel(
    dedupeTerritoryKpiEntries(ordered)
  );

  const sections: ReceivablesSection[] = [];
  let current: ReceivablesSection | null = null;

  for (const entry of deduped) {
    const catItem =
      catalog.find((c) => c.key === entry.key) ||
      ({
        key: entry.key,
        sort_order: entry.sortOrder,
        config: entry.payload.config,
      } as ReceivablesCatalogItem);
    const title = resolveSectionTitle(catItem, entry.payload);
    if (!current || current.title !== title) {
      current = { title, kpiRows: [], blocks: [] };
      sections.push(current);
    }
    if (entry.widgetType === "KPI") {
      const group = resolveRowGroup(catItem, entry.payload);
      let row = current.kpiRows.find((r) => r.group === group);
      if (!row) {
        row = { group, items: [] };
        current.kpiRows.push(row);
      }
      row.items.push(entry);
    } else {
      current.blocks.push(entry);
    }
  }

  return sections;
}

export type ReceivablesLayout = {
  overviewKpis: ReceivablesWidgetEntry[];
  collectionKpis: ReceivablesWidgetEntry[];
  aging?: ReceivablesWidgetEntry;
  trend?: ReceivablesWidgetEntry;
  ranking?: ReceivablesWidgetEntry;
  customerAdvancesRanking?: ReceivablesWidgetEntry;
  attention?: ReceivablesWidgetEntry;
  otherBlocks: ReceivablesWidgetEntry[];
};

function isCollectionSection(title: string): boolean {
  return /collection/i.test(title);
}

export function partitionReceivablesLayout(
  sections: ReceivablesSection[]
): ReceivablesLayout {
  const layout: ReceivablesLayout = {
    overviewKpis: [],
    collectionKpis: [],
    otherBlocks: [],
  };

  for (const section of sections) {
    const allKpis = section.kpiRows.flatMap((r) => r.items);
    if (isCollectionSection(section.title)) {
      layout.collectionKpis.push(...allKpis);
    } else {
      layout.overviewKpis.push(...allKpis);
    }

    for (const block of section.blocks) {
      const key = block.key.toLowerCase();
      const t = block.widgetType;
      if (t === "BAR" || key.includes("aging")) {
        layout.aging = layout.aging || block;
      } else if (t === "LINE" || key.includes("trend")) {
        layout.trend = layout.trend || block;
      } else if (key.includes("customer_advances")) {
        layout.customerAdvancesRanking =
          layout.customerAdvancesRanking || block;
      } else if (
        t === "RANKING" ||
        t === "TABLE" ||
        key.includes("overdue_customers") ||
        key.includes("ranking")
      ) {
        layout.ranking = layout.ranking || block;
      } else if (t === "LIST" || key.includes("attention")) {
        layout.attention = layout.attention || block;
      } else {
        layout.otherBlocks.push(block);
      }
    }
  }

  return layout;
}
