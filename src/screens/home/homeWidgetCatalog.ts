/**
 * Canonical home board widgets — mockup layout + backend aliases.
 */

import type { MobileWidgetConfig } from "../../types/bootstrap";
import { catalogItemMatchesBootstrap } from "../../utils/catalogBootstrapMatch";
import { catalogKeysToFetchWithContent } from "../../utils/catalogKeysToFetch";

export type HomeLayoutSlot =
  | "business_kpi"
  | "key_indicator"
  | "health"
  | "trend"
  | "quick_insight"
  | "recent_activity";

export type HomeCatalogItem = {
  key: string;
  aliases?: string[];
  label?: string;
  type?: string;
  sort_order: number;
  config?: Record<string, unknown>;
  layout?: HomeLayoutSlot;
};

export const HOME_WIDGET_CATALOG: HomeCatalogItem[] = [
  {
    key: "home_total_sales_kpi",
    aliases: ["total_sales_kpi", "sales_ytd_kpi", "sales_mtd_kpi", "net_sales_kpi"],
    label: "Total Sales (SAR)",
    type: "KPI",
    sort_order: 10,
    layout: "business_kpi",
  },
  {
    key: "home_total_receivables_kpi",
    aliases: ["total_receivables_kpi", "receivables_total_kpi"],
    label: "Total Receivables (SAR)",
    type: "KPI",
    sort_order: 20,
    layout: "business_kpi",
  },
  {
    key: "home_total_inventory_kpi",
    aliases: ["total_inventory_kpi", "inventory_value_kpi"],
    label: "Total Inventory Value (SAR)",
    type: "KPI",
    sort_order: 30,
    layout: "business_kpi",
  },
  {
    key: "home_total_purchases_kpi",
    aliases: ["total_purchases_kpi", "purchases_ytd_kpi"],
    label: "Total Purchases (SAR)",
    type: "KPI",
    sort_order: 40,
    layout: "business_kpi",
  },
  {
    key: "home_total_payables_kpi",
    aliases: ["total_payables_kpi", "payables_total_kpi"],
    label: "Total Payables (SAR)",
    type: "KPI",
    sort_order: 50,
    layout: "business_kpi",
  },
  {
    key: "home_gross_profit_kpi",
    aliases: ["gross_profit_kpi", "gp_ytd_kpi"],
    label: "Gross Profit (SAR)",
    type: "KPI",
    sort_order: 60,
    layout: "business_kpi",
  },
  {
    key: "home_gp_margin_kpi",
    aliases: ["gp_margin_kpi", "gross_profit_margin_kpi"],
    label: "GP Margin",
    type: "KPI",
    sort_order: 70,
    layout: "key_indicator",
  },
  {
    key: "home_current_ratio_kpi",
    aliases: ["current_ratio_kpi"],
    label: "Current Ratio",
    type: "KPI",
    sort_order: 80,
    layout: "key_indicator",
  },
  {
    key: "home_operating_cash_flow_kpi",
    aliases: ["operating_cash_flow_kpi", "cash_flow_kpi"],
    label: "Operating Cash Flow",
    type: "KPI",
    sort_order: 90,
    layout: "key_indicator",
  },
  {
    key: "home_net_profit_kpi",
    aliases: ["net_profit_kpi"],
    label: "Net Profit (SAR)",
    type: "KPI",
    sort_order: 100,
    layout: "key_indicator",
  },
  {
    key: "home_sales_health",
    aliases: ["sales_performance_health", "sales_health_score"],
    label: "Sales Performance",
    type: "KPI",
    sort_order: 110,
    layout: "health",
    config: { render_hint: "health", max_value: 100, format: "score" },
  },
  {
    key: "home_receivables_health",
    aliases: ["receivables_health_score"],
    label: "Receivables Health",
    type: "KPI",
    sort_order: 120,
    layout: "health",
    config: { render_hint: "health", max_value: 100, format: "score" },
  },
  {
    key: "home_inventory_health",
    aliases: ["inventory_health_score"],
    label: "Inventory Health",
    type: "KPI",
    sort_order: 130,
    layout: "health",
    config: { render_hint: "health", max_value: 100, format: "score" },
  },
  {
    key: "home_payables_health",
    aliases: ["payables_health_score"],
    label: "Payables Health",
    type: "KPI",
    sort_order: 140,
    layout: "health",
    config: { render_hint: "health", max_value: 100, format: "score" },
  },
  {
    key: "home_trend_overview",
    aliases: ["trend_overview", "home_trend_line", "business_trend"],
    label: "Trend Overview (SAR)",
    type: "LINE",
    sort_order: 150,
    layout: "trend",
  },
  {
    key: "home_quick_insights",
    aliases: ["quick_insights", "home_insights"],
    label: "Quick Insights",
    type: "LIST",
    sort_order: 160,
    layout: "quick_insight",
  },
  {
    key: "home_recent_activities",
    aliases: ["recent_activities", "recent_activity", "activity_feed"],
    label: "Recent Activities",
    type: "LIST",
    sort_order: 170,
    layout: "recent_activity",
  },
];

export function mergeHomeWidgetDefs(
  bootstrapWidgets: MobileWidgetConfig[]
): HomeCatalogItem[] {
  const byKey = new Map<string, HomeCatalogItem>();
  for (const c of HOME_WIDGET_CATALOG) {
    byKey.set(c.key.toLowerCase(), { ...c });
  }
  for (const w of bootstrapWidgets) {
    const k = String(w.key || "").toLowerCase();
    if (!k) continue;
    const existing = byKey.get(k);
    const layout =
      (w.config?.layout as HomeLayoutSlot | undefined) || existing?.layout;
    byKey.set(k, {
      key: w.key,
      aliases: existing?.aliases,
      label: w.label || existing?.label,
      type: w.type || existing?.type,
      sort_order: w.sort_order ?? existing?.sort_order ?? 999,
      layout,
      config: { ...(existing?.config || {}), ...(w.config || {}) },
    });
    if (w.type === "KPI" && !layout) {
      if (/health/.test(k)) byKey.get(k)!.layout = "health";
      else if (/margin|ratio|cash|net_profit/.test(k)) {
        byKey.get(k)!.layout = "key_indicator";
      } else if (!/health/.test(k)) {
        byKey.get(k)!.layout = "business_kpi";
      }
    }
    if (/trend/.test(k)) byKey.get(k)!.layout = "trend";
    if (/insight/.test(k)) byKey.get(k)!.layout = "quick_insight";
    if (/activ/.test(k)) byKey.get(k)!.layout = "recent_activity";
  }
  return [...byKey.values()].sort(
    (a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999)
  );
}

export function resolveCatalogPayload(
  widgetMap: Record<string, unknown>,
  item: HomeCatalogItem,
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

export function isPriorityHomeWidget(item: HomeCatalogItem): boolean {
  const slot = item.layout;
  if (
    slot === "trend" ||
    slot === "quick_insight" ||
    slot === "recent_activity"
  ) {
    return false;
  }
  return true;
}

export function partitionMissingHomeKeys(
  missingKeys: string[],
  catalog: HomeCatalogItem[]
): { priority: string[]; deferred: string[] } {
  const byKey = new Map(catalog.map((c) => [c.key.toLowerCase(), c]));
  const priority: string[] = [];
  const deferred: string[] = [];
  for (const key of missingKeys) {
    const item = byKey.get(key.toLowerCase());
    if (item && !isPriorityHomeWidget(item)) {
      deferred.push(key);
    } else {
      priority.push(key);
    }
  }
  return { priority, deferred };
}

export function catalogKeysToFetch(
  widgetMap: Record<string, unknown>,
  catalog: HomeCatalogItem[],
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

function inferLayout(key: string, widgetType: string): HomeLayoutSlot | undefined {
  const k = key.toLowerCase();
  if (widgetType === "KPI") {
    if (/health/.test(k)) return "health";
    if (/margin|ratio|cash|net_profit|indicator/.test(k)) return "key_indicator";
    return "business_kpi";
  }
  if (widgetType === "LINE" || /trend/.test(k)) return "trend";
  if (/insight/.test(k)) return "quick_insight";
  if (/activ/.test(k)) return "recent_activity";
  if (widgetType === "LIST") {
    if (/activ/.test(k)) return "recent_activity";
    return "quick_insight";
  }
  return undefined;
}

export function resolveLayoutSlot(
  item: HomeCatalogItem,
  key: string,
  widgetType: string
): HomeLayoutSlot | undefined {
  return item.layout || inferLayout(key, widgetType);
}
