/**
 * Safe local module registry — system / tools only.
 * Business dashboards come from Desk bootstrap (dashboard / board_tabs / report_list).
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
 * Built-in app surfaces (tabs, CRM helper, analysis drill).
 * Unknown Desk module keys open as Access Profile boards (see resolveHubItems).
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
  vat: {
    route: "/dashboard-board/vat_overview",
    icon: "receipt-outline",
    color: "#0d9488",
    defaultLabel: "VAT Report",
    defaultSubtitle: "Output, input & not submitted",
    section: "finance",
    hubFeatureId: "vat",
    configModule: "vat",
  },
  vat_overview: {
    route: "/dashboard-board/vat_overview",
    icon: "receipt-outline",
    color: "#0d9488",
    defaultLabel: "VAT Report",
    defaultSubtitle: "ZATCA-aligned filing view",
    section: "finance",
    hubFeatureId: "vat",
    configModule: "vat",
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
    // Backend boards are not in the local registry — treat as known/shipped
    return { known: true, shipped: true, updateRequired: false };
  }
  const shipped = entry.shipped !== false;
  return {
    known: true,
    shipped,
    updateRequired: !shipped,
  };
}
