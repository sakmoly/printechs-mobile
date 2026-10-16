/**
 * Canonical receivables_overview widgets — used when bootstrap is empty
 * and to dedupe backend alias keys (total_receivable vs receivables_total_kpi).
 */

import type { MobileWidgetConfig } from "../../types/bootstrap";
import { catalogItemMatchesBootstrap } from "../../utils/catalogBootstrapMatch";
import { catalogKeysToFetchWithContent } from "../../utils/catalogKeysToFetch";

export type ReceivablesCatalogItem = {
  key: string;
  aliases?: string[];
  label?: string;
  type?: string;
  sort_order: number;
  config?: Record<string, unknown>;
};

export const RECEIVABLES_WIDGET_CATALOG: ReceivablesCatalogItem[] = [
  {
    key: "receivables_total_kpi",
    aliases: ["total_receivable"],
    label: "Total Receivable",
    type: "KPI",
    sort_order: 10,
    config: { section_title: "Overview", row_group: "receivables_kpis_r1" },
  },
  {
    key: "receivables_overdue_kpi",
    aliases: ["overdue"],
    label: "Overdue Receivable",
    type: "KPI",
    sort_order: 20,
    config: { section_title: "Overview", row_group: "receivables_kpis_r1" },
  },
  {
    key: "receivables_current_kpi",
    aliases: ["current", "not_yet_due"],
    label: "Current (Not Due)",
    type: "KPI",
    sort_order: 30,
    config: { section_title: "Overview", row_group: "receivables_kpis_r2" },
  },
  {
    key: "receivables_overdue_pct_kpi",
    aliases: ["overdue_pct"],
    label: "Overdue %",
    type: "KPI",
    sort_order: 40,
    config: { section_title: "Overview", row_group: "receivables_kpis_r2" },
  },
  {
    key: "receivables_customer_count_kpi",
    aliases: ["customer_count", "customers_owing"],
    label: "Customers",
    type: "KPI",
    sort_order: 50,
    config: { section_title: "Overview", row_group: "receivables_kpis_r3" },
  },
  {
    key: "receivables_customer_advances_kpi",
    aliases: ["customer_advances_kpi", "customer_advances"],
    label: "Customer Advances",
    type: "KPI",
    sort_order: 55,
    config: {
      section_title: "Overview",
      row_group: "receivables_kpis_r3",
      drill_widget_key: "receivables_customer_advances_ranking",
    },
  },
  {
    key: "receivables_dso_kpi",
    aliases: ["dso"],
    label: "DSO (Days)",
    type: "KPI",
    sort_order: 60,
    config: { section_title: "Overview", row_group: "receivables_kpis_r3" },
  },
  {
    key: "receivables_aging_buckets_bar",
    aliases: [
      "receivables_aging_table",
      "aging",
      "outstanding_amount:aging_bucket",
      "outstanding_amount@aging_bucket",
    ],
    label: "Receivables Aging (SAR)",
    type: "BAR",
    sort_order: 70,
    config: {
      section_title: "Receivables Aging (SAR)",
      chart_key: "receivables_aging_buckets_bar",
      drill_widget_key: "receivables_aging_buckets_bar",
    },
  },
  {
    key: "receivables_overdue_trend",
    aliases: ["overdue_trend"],
    label: "Overdue Trend (SAR)",
    type: "LINE",
    sort_order: 80,
    config: { section_title: "Overdue Trend (SAR)", compare: "ly" },
  },
  {
    key: "receivables_collected_mtd_kpi",
    aliases: ["collected_mtd"],
    label: "Collected MTD",
    type: "KPI",
    sort_order: 90,
    config: {
      section_title: "Collection Summary",
      row_group: "receivables_collection_r1",
    },
  },
  {
    key: "receivables_collected_ytd_kpi",
    aliases: ["collected_ytd"],
    label: "Collected YTD",
    type: "KPI",
    sort_order: 100,
    config: {
      section_title: "Collection Summary",
      row_group: "receivables_collection_r1",
    },
  },
  {
    key: "receivables_collection_efficiency_kpi",
    aliases: ["collection_efficiency"],
    label: "Collection Efficiency",
    type: "KPI",
    sort_order: 110,
    config: {
      section_title: "Collection Summary",
      row_group: "receivables_collection_r2",
    },
  },
  {
    key: "receivables_avg_collection_days_kpi",
    aliases: ["avg_collection_days"],
    label: "Avg. Collection Days",
    type: "KPI",
    sort_order: 120,
    config: {
      section_title: "Collection Summary",
      row_group: "receivables_collection_r2",
    },
  },
  {
    key: "receivables_overdue_customers_table",
    aliases: ["overdue_customers", "top_overdue_customers"],
    label: "Top 5 Overdue Customers",
    type: "RANKING",
    sort_order: 130,
    config: { section_title: "Top 5 Overdue Customers", render_hint: "ranking" },
  },
  {
    key: "receivables_customer_advances_ranking",
    aliases: ["customer_advances_ranking", "customer_advances_customers"],
    label: "Customer Advances",
    type: "RANKING",
    sort_order: 125,
    config: {
      section_title: "Customer Advances",
      render_hint: "ranking",
      legacy_drill_method: "erp_analysis.collection.get_customer_advances",
    },
  },
  {
    key: "receivables_attention",
    aliases: ["attention_required", "attention"],
    label: "Attention Required",
    type: "LIST",
    sort_order: 140,
    config: { section_title: "Attention Required", render_hint: "list" },
  },
];

export function mergeReceivablesWidgetDefs(
  bootstrapWidgets: MobileWidgetConfig[]
): ReceivablesCatalogItem[] {
  const byKey = new Map<string, ReceivablesCatalogItem>();
  for (const c of RECEIVABLES_WIDGET_CATALOG) {
    byKey.set(c.key.toLowerCase(), { ...c });
  }
  for (const w of bootstrapWidgets) {
    const k = String(w.key || "").toLowerCase();
    if (!k) continue;
    const existing = byKey.get(k);
    byKey.set(k, {
      key: w.key,
      aliases: existing?.aliases,
      label: w.label || existing?.label,
      type: w.type || existing?.type,
      sort_order: w.sort_order ?? existing?.sort_order ?? 999,
      config: { ...(existing?.config || {}), ...(w.config || {}) },
    });
  }
  return [...byKey.values()].sort(
    (a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999)
  );
}

export function resolveCatalogPayload(
  widgetMap: Record<string, unknown>,
  item: ReceivablesCatalogItem,
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
        ([mk]) =>
          mk.replace(/__\d+$/i, "").toLowerCase() === k.toLowerCase()
      )?.[1];
    if (direct) {
      return { payload: direct as Record<string, unknown>, mapKey: k };
    }
  }
  return null;
}

export function catalogKeysToFetch(
  widgetMap: Record<string, unknown>,
  catalog: ReceivablesCatalogItem[],
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
