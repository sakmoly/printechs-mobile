/**
 * Safe local module registry.
 * Server may send module key / label / enabled / sort_order —
 * never execute remote React paths or arbitrary URLs as routes.
 */

import type { ComponentProps } from "react";
import { Ionicons } from "@expo/vector-icons";

type IconName = ComponentProps<typeof Ionicons>["name"];

export type ModuleRegistryEntry = {
  /** Expo Router path */
  route: string;
  icon: IconName;
  color: string;
  /** Default label if BA omits one */
  defaultLabel: string;
  defaultSubtitle?: string;
  /** More hub section grouping */
  section: "sales" | "finance" | "operations" | "insights" | "tools";
  /** Hub feature id for Access Profile (menuAccess.HUB_ACCESS) */
  hubFeatureId: string;
  /** Maps to MobileConfig.modules / PHASE2 gates when relevant */
  configModule?: string;
  phase2?: "catalogue" | "push";
  /** false = BA may enable but app build lacks the screen yet */
  shipped?: boolean;
  /** System / tab-only — do not list on More hub */
  hideFromHub?: boolean;
};

/**
 * Known business modules the binary ships with.
 * Unknown server keys are ignored (or flagged "App update required").
 */
export const moduleRegistry: Record<string, ModuleRegistryEntry> = {
  home: {
    route: "/(tabs)",
    icon: "home",
    color: "#667eea",
    defaultLabel: "Home",
    defaultSubtitle: "Executive dashboard",
    section: "insights",
    hubFeatureId: "dashboard",
    configModule: "executive",
    hideFromHub: true,
  },
  approvals: {
    route: "/(tabs)/approvals",
    icon: "checkmark-circle",
    color: "#6366f1",
    defaultLabel: "Approvals",
    defaultSubtitle: "Inbox",
    section: "tools",
    hubFeatureId: "approvals",
    configModule: "approvals",
    hideFromHub: true,
  },
  settings: {
    route: "/(tabs)/settings",
    icon: "settings",
    color: "#64748b",
    defaultLabel: "Settings",
    defaultSubtitle: "Account & server",
    section: "tools",
    hubFeatureId: "settings",
    configModule: "settings",
    hideFromHub: true,
  },
  sales: {
    route: "/sales-dashboard",
    icon: "trending-up",
    color: "#667eea",
    defaultLabel: "Sales",
    defaultSubtitle: "YTD performance",
    section: "sales",
    hubFeatureId: "sales",
    configModule: "sales",
  },
  salesperson: {
    route: "/salesperson-performance",
    icon: "people",
    color: "#8b5cf6",
    defaultLabel: "Salespersons",
    defaultSubtitle: "Ranking & drill-down",
    section: "sales",
    hubFeatureId: "salesperson",
    configModule: "salesperson",
  },
  product_performance: {
    route: "/product-performance",
    icon: "cube",
    color: "#a855f7",
    defaultLabel: "Products",
    defaultSubtitle: "Division → brand → item",
    section: "sales",
    hubFeatureId: "product",
    configModule: "product_performance",
  },
  product: {
    route: "/product-performance",
    icon: "cube",
    color: "#a855f7",
    defaultLabel: "Products",
    defaultSubtitle: "Division → brand → item",
    section: "sales",
    hubFeatureId: "product",
    configModule: "product_performance",
  },
  customer_360: {
    route: "/customer-360",
    icon: "person-circle",
    color: "#06b6d4",
    defaultLabel: "Customer 360",
    defaultSubtitle: "Profile & activity",
    section: "sales",
    hubFeatureId: "customer360",
    configModule: "customer_360",
  },
  sales_orders: {
    route: "/sales-order-dashboard",
    icon: "clipboard",
    color: "#7c3aed",
    defaultLabel: "Sales Orders",
    defaultSubtitle: "Order book",
    section: "sales",
    hubFeatureId: "salesOrders",
    configModule: "sales_orders",
  },
  profitability: {
    route: "/profitability-dashboard",
    icon: "pie-chart",
    color: "#059669",
    defaultLabel: "Profitability",
    defaultSubtitle: "GP & margins",
    section: "sales",
    hubFeatureId: "profitability",
    configModule: "profitability",
  },
  receivables: {
    route: "/receivables-dashboard",
    icon: "wallet",
    color: "#0ea5e9",
    defaultLabel: "Receivables",
    defaultSubtitle: "Aging & DSO",
    section: "finance",
    hubFeatureId: "receivables",
    configModule: "receivables",
  },
  collection: {
    route: "/collection-dashboard",
    icon: "cash",
    color: "#0284c7",
    defaultLabel: "Collection",
    defaultSubtitle: "Actuals & attention",
    section: "finance",
    hubFeatureId: "collection",
    configModule: "collection",
  },
  payables: {
    route: "/payables-dashboard",
    icon: "card",
    color: "#ef4444",
    defaultLabel: "Payables",
    defaultSubtitle: "AP & payment plan",
    section: "finance",
    hubFeatureId: "payables",
    configModule: "payables",
  },
  inventory: {
    route: "/inventory-dashboard",
    icon: "layers",
    color: "#10b981",
    defaultLabel: "Inventory",
    defaultSubtitle: "Stock & hierarchy",
    section: "operations",
    hubFeatureId: "inventory",
    configModule: "inventory",
  },
  inventory_health: {
    route: "/inventory-health",
    icon: "fitness",
    color: "#059669",
    defaultLabel: "Inv. Health",
    defaultSubtitle: "Cover & dead stock",
    section: "operations",
    hubFeatureId: "inventoryHealth",
    configModule: "inventory_health",
  },
  purchase: {
    route: "/purchase-performance-dashboard",
    icon: "cart",
    color: "#f97316",
    defaultLabel: "Purchase",
    defaultSubtitle: "PO performance",
    section: "operations",
    hubFeatureId: "purchase",
    configModule: "purchase",
  },
  exceptions: {
    route: "/exceptions-dashboard",
    icon: "warning",
    color: "#ea580c",
    defaultLabel: "Exceptions",
    defaultSubtitle: "Management alerts",
    section: "insights",
    hubFeatureId: "exceptions",
    configModule: "exceptions",
  },
  analytics: {
    route: "/generic-analysis",
    icon: "analytics",
    color: "#4f46e5",
    defaultLabel: "Analysis",
    defaultSubtitle: "By brand, season, territory…",
    section: "insights",
    hubFeatureId: "analytics",
    configModule: "analytics",
  },
  generic_analysis: {
    route: "/generic-analysis",
    icon: "analytics",
    color: "#4f46e5",
    defaultLabel: "Analysis",
    defaultSubtitle: "By brand, season, territory…",
    section: "insights",
    hubFeatureId: "analytics",
    configModule: "analytics",
  },
  approval_analytics: {
    route: "/approval-analytics",
    icon: "stats-chart",
    color: "#6366f1",
    defaultLabel: "Approval stats",
    defaultSubtitle: "Cycle time & SLA",
    section: "insights",
    hubFeatureId: "approvalAnalytics",
    configModule: "approval_analytics",
  },
  employees: {
    route: "/(tabs)/employees",
    icon: "people-outline",
    color: "#64748b",
    defaultLabel: "Employees",
    defaultSubtitle: "Directory",
    section: "tools",
    hubFeatureId: "employees",
  },
  catalogue: {
    route: "/(tabs)/ecatalogue",
    icon: "book",
    color: "#78716c",
    defaultLabel: "E-Catalogue",
    defaultSubtitle: "Product catalogues",
    section: "tools",
    hubFeatureId: "catalogue",
    configModule: "catalogue",
    phase2: "catalogue",
  },
  /** Future industries — registered so BA can enable without a crash; screens may land later */
  fashion: {
    route: "/fashion-dashboard",
    icon: "color-palette",
    color: "#db2777",
    defaultLabel: "Fashion",
    defaultSubtitle: "Season & sell-through",
    section: "sales",
    hubFeatureId: "fashion",
    configModule: "fashion",
    shipped: false,
  },
  retail: {
    route: "/retail-dashboard",
    icon: "storefront",
    color: "#0d9488",
    defaultLabel: "Retail",
    defaultSubtitle: "Store analytics",
    section: "operations",
    hubFeatureId: "retail",
    configModule: "retail",
    shipped: false,
  },
  executive: {
    route: "/(tabs)",
    icon: "speedometer",
    color: "#4f46e5",
    defaultLabel: "Executive",
    defaultSubtitle: "Home dashboard",
    section: "insights",
    hubFeatureId: "dashboard",
    configModule: "executive",
  },
};

/** Resolve registry entry by module key or route_key */
export function resolveModuleEntry(
  key: string
): ModuleRegistryEntry | undefined {
  if (!key) return undefined;
  if (moduleRegistry[key]) return moduleRegistry[key];
  // route_key may match hubFeatureId or configModule
  const found = Object.values(moduleRegistry).find(
    (e) => e.hubFeatureId === key || e.configModule === key
  );
  return found;
}

export function isKnownModuleKey(key: string): boolean {
  return Boolean(resolveModuleEntry(key));
}

/** Unknown BA module: safe to ignore (never navigate via server path) */
export function describeUnknownModule(key: string): {
  known: boolean;
  shipped: boolean;
  updateRequired: boolean;
} {
  const entry = resolveModuleEntry(key);
  if (!entry) {
    return { known: false, shipped: false, updateRequired: true };
  }
  const shipped = entry.shipped !== false;
  return {
    known: true,
    shipped,
    updateRequired: !shipped,
  };
}
