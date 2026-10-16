/**
 * Canonical sales_overview widgets — mockup layout + backend aliases.
 */

import type { MobileWidgetConfig } from "../../types/bootstrap";
import { catalogItemMatchesBootstrap } from "../../utils/catalogBootstrapMatch";
import { catalogKeysToFetchWithContent } from "../../utils/catalogKeysToFetch";

export type SalesLayoutSlot =
  | "overview_kpi"
  | "trend"
  | "sales_by"
  | "summary_donut"
  | "attention";

export type SalesCatalogItem = {
  key: string;
  aliases?: string[];
  label?: string;
  type?: string;
  sort_order: number;
  config?: Record<string, unknown>;
  layout?: SalesLayoutSlot;
  salesByTab?: string;
};

export const SALES_WIDGET_CATALOG: SalesCatalogItem[] = [
  {
    key: "sales_total_kpi",
    aliases: [
      "sales_dash_net_ytd_kpi",
      "net_sales_kpi",
      "sales_net_kpi",
      "sales_ytd_kpi",
    ],
    label: "Total Sales (SAR)",
    type: "KPI",
    sort_order: 10,
    layout: "overview_kpi",
  },
  {
    key: "sales_orders_kpi",
    aliases: [
      "total_orders_kpi",
      "sales_invoice_count_kpi",
      "total_invoices_kpi",
      "sales_dash_orders_kpi",
    ],
    label: "Open Sales Orders",
    type: "KPI",
    sort_order: 20,
    layout: "overview_kpi",
    config: {
      format: "integer",
      drill_widget_key: "sales_open_orders_list",
    },
  },
  {
    key: "sales_gp_kpi",
    aliases: [
      "gross_profit_kpi",
      "sales_gross_profit_kpi",
      "sales_dash_gp_kpi",
    ],
    label: "Gross Profit (SAR)",
    type: "KPI",
    sort_order: 30,
    layout: "overview_kpi",
  },
  {
    key: "sales_cogs_kpi",
    aliases: [
      "cogs_kpi",
      "cost_of_goods_sold_kpi",
      "sales_cost_of_goods_kpi",
      "cogs",
      "sales_dash_cogs_kpi",
    ],
    label: "COGS (Cost of Goods Sold)",
    type: "KPI",
    sort_order: 35,
    layout: "overview_kpi",
  },
  {
    key: "sales_gp_margin_kpi",
    aliases: [
      "gross_profit_margin_kpi",
      "gp_margin_kpi",
      "sales_dash_gp_margin_kpi",
      "sales_dash_margin_kpi",
    ],
    label: "Gross Profit Margin",
    type: "KPI",
    sort_order: 40,
    layout: "overview_kpi",
    config: { format: "percent" },
  },
  {
    key: "sales_active_customers_kpi",
    aliases: [
      "active_customers_kpi",
      "customer_count_kpi",
      "sales_dash_active_customers_kpi",
    ],
    label: "Active Customers",
    type: "KPI",
    sort_order: 50,
    layout: "overview_kpi",
    config: { format: "integer" },
  },
  {
    key: "sales_returns_kpi",
    aliases: [
      "returns_kpi",
      "sales_return_kpi",
      "sales_dash_returns_kpi",
      "sales_return_amount_kpi",
    ],
    label: "Returns (SAR)",
    type: "KPI",
    sort_order: 60,
    layout: "overview_kpi",
    config: { increase_is_bad: true },
  },
  {
    key: "sales_trend_line",
    aliases: ["sales_overview_trend", "sales_mtd_trend", "sales_trend_chart"],
    label: "Sales Trend (SAR)",
    type: "LINE",
    sort_order: 70,
    layout: "trend",
  },
  {
    key: "sales_by_territory",
    aliases: ["sales_dash_territory", "territory_ranking", "sales_territory_ranking"],
    label: "Territory",
    type: "RANKING",
    sort_order: 80,
    layout: "sales_by",
    salesByTab: "Territory",
  },
  {
    key: "sales_by_division",
    aliases: ["sales_division_ranking", "division_ranking"],
    label: "Division",
    type: "RANKING",
    sort_order: 81,
    layout: "sales_by",
    salesByTab: "Division",
  },
  {
    key: "sales_by_salesperson",
    aliases: ["top_salespersons", "salesperson_ranking"],
    label: "Salesperson",
    type: "RANKING",
    sort_order: 82,
    layout: "sales_by",
    salesByTab: "Salesperson",
  },
  {
    key: "sales_management_attention",
    aliases: ["sales_attention", "management_attention", "sales_attention_cards"],
    label: "Management Attention",
    type: "LIST",
    sort_order: 100,
    layout: "attention",
  },
];

/** Sales Summary donuts hidden — division/product breakdown lives under Sales By tabs. */
const HIDDEN_SALES_WIDGET_KEYS = new Set([
  "sales_by_customer_group",
  "customer_group_ranking",
  "sales_customer_group",
  "sales_donut_customer_group",
  "sales_by_customer_group_pie",
  "customer_group_donut",
  "sales_by_channel",
  "channel_ranking",
  "sales_channel_ranking",
  "sales_by_channel_pie",
  "sales_donut_division",
  "division_donut",
  "sales_division_donut",
  "sales_dash_by_group",
  "sales_donut_product_group",
  "product_group_donut",
  "sales_by_group",
  "sales_donut_channel",
  "channel_donut",
]);

export function isHiddenSalesWidget(key: string | undefined | null): boolean {
  const k = String(key || "")
    .replace(/__\d+$/i, "")
    .trim()
    .toLowerCase();
  return HIDDEN_SALES_WIDGET_KEYS.has(k);
}

export function mergeSalesWidgetDefs(
  bootstrapWidgets: MobileWidgetConfig[]
): SalesCatalogItem[] {
  const byKey = new Map<string, SalesCatalogItem>();
  for (const c of SALES_WIDGET_CATALOG) {
    byKey.set(c.key.toLowerCase(), { ...c });
  }
  for (const w of bootstrapWidgets) {
    const k = String(w.key || "").toLowerCase();
    if (!k) continue;
    const catalogMatch = SALES_WIDGET_CATALOG.find(
      (c) =>
        c.key.toLowerCase() === k ||
        (c.aliases || []).some((a) => a.toLowerCase() === k)
    );
    const storeKey = catalogMatch ? catalogMatch.key.toLowerCase() : k;
    const existing = byKey.get(storeKey);
    const layout =
      (w.config?.layout as SalesLayoutSlot | undefined) || existing?.layout;
    byKey.set(storeKey, {
      key: catalogMatch?.key || existing?.key || w.key,
      aliases: existing?.aliases,
      label: w.label || existing?.label,
      type: w.type || existing?.type,
      sort_order: w.sort_order ?? existing?.sort_order ?? 999,
      layout,
      salesByTab: existing?.salesByTab,
      config: { ...(existing?.config || {}), ...(w.config || {}) },
    });
    if (/salesperson|territory|customer_group|channel|division/.test(k)) {
      const item = byKey.get(storeKey)!;
      if (!item.layout && /ranking|table|bar/.test(String(w.type || ""))) {
        item.layout = "sales_by";
      }
      if (/territory/.test(k) && !/division/.test(k) && !item.salesByTab) {
        item.salesByTab = "Territory";
      }
      if (/customer/.test(k) && !item.salesByTab) item.salesByTab = "Customer Group";
      if (/channel/.test(k) && !item.salesByTab) item.salesByTab = "Channel";
      if (/salesperson|sales_person/.test(k) && !item.salesByTab) {
        item.salesByTab = "Salesperson";
      }
      if (/sales_by_division|division_ranking/.test(k) && !/donut/.test(k)) {
        item.layout = "sales_by";
        item.salesByTab = "Division";
      }
      if (/sales_donut_division|division_donut/.test(k)) {
        item.layout = "summary_donut";
      }
    }
    if (/donut|pie/.test(String(w.type || "")) && !layout) {
      const item = byKey.get(storeKey)!;
      if (/sales_by_division/.test(k) && !/donut/.test(k)) {
        item.layout = "sales_by";
        item.salesByTab = item.salesByTab || "Division";
      } else {
        item.layout = "summary_donut";
      }
    }
  }
  return [...byKey.values()]
    .filter((item) => !isHiddenSalesWidget(item.key))
    .sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999));
}

export function resolveCatalogPayload(
  widgetMap: Record<string, unknown>,
  item: SalesCatalogItem,
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
  catalog: SalesCatalogItem[],
  bootstrapKeys?: string[]
): string[] {
  const consumed = new Set<string>();
  return catalogKeysToFetchWithContent(
    widgetMap,
    catalog,
    consumed,
    resolveCatalogPayload,
    bootstrapKeys,
    salesCatalogItemShouldFetch
  );
}

/** KPIs follow bootstrap; Sales By / trend / donuts always load from catalog. */
export function salesCatalogItemShouldFetch(
  item: SalesCatalogItem,
  bootstrapKeys?: string[]
): boolean {
  if (item.layout && item.layout !== "overview_kpi") return true;
  return catalogItemMatchesBootstrap(item, bootstrapKeys);
}

function inferLayout(key: string, widgetType: string): SalesLayoutSlot | undefined {
  const k = key.toLowerCase().replace(/__\d+$/i, "");
  if (/^sales_by_division$/.test(k)) return "sales_by";
  if (/sales_donut_division|division_donut/.test(k)) return "summary_donut";
  if (widgetType === "KPI") return "overview_kpi";
  if (widgetType === "LINE" || /trend/.test(k)) return "trend";
  if (widgetType === "LIST" || /attention/.test(k)) return "attention";
  if (widgetType === "DONUT" || widgetType === "PIE" || /donut|by_group|territory/.test(k)) {
    if (/salesperson|ranking|territory_rank|customer_group_rank|channel_rank/.test(k)) {
      return "sales_by";
    }
    if (/ranking|table/.test(widgetType) || /by_salesperson|by_territory|by_channel/.test(k)) {
      return "sales_by";
    }
    return "summary_donut";
  }
  if (widgetType === "RANKING" || widgetType === "TABLE" || /by_/.test(k)) {
    return "sales_by";
  }
  return undefined;
}

export function resolveLayoutSlot(
  item: SalesCatalogItem,
  key: string,
  widgetType: string
): SalesLayoutSlot | undefined {
  return item.layout || inferLayout(key, widgetType);
}
