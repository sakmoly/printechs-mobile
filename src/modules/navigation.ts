/**
 * Phase E — Dynamic navigation resolution.
 * Business screens come from bootstrap ∩ registry ∩ Access Profile.
 * System screens (login, settings, profile) stay fixed in the app.
 */

import { PHASE2_FEATURES } from "../api/endpoints";
import type { MobileConfig } from "../api/mobileConfig";
import {
  canAccessHubFeature,
  type MenuPermissionStateLike,
} from "../api/menuAccess";
import { canAccessMenuObject, type MenuPermissionState } from "../store/auth";
import type { MobileBootstrap } from "../types/bootstrap";
import {
  moduleRegistry,
  resolveModuleEntry,
  type ModuleRegistryEntry,
} from "./registry";
import {
  resolveVisibleHubItems,
  type ResolvedHubItem,
} from "./resolveHubItems";
import { resolveTabVisibility, type TabVisibility } from "./resolveTabs";

export type SystemScreenId =
  | "login"
  | "server_config"
  | "settings"
  | "profile"
  | "about";

/** Fixed system screens — never driven by BA module lists */
export const SYSTEM_SCREENS: Record<
  SystemScreenId,
  { route: string; label: string }
> = {
  login: { route: "/(auth)/login", label: "Login" },
  server_config: { route: "/(auth)/login", label: "Server" },
  settings: { route: "/(tabs)/settings", label: "Settings" },
  profile: { route: "/user-profile", label: "Profile" },
  about: { route: "/(tabs)/settings", label: "About" },
};

export type NavResolution = {
  businessType: string;
  branding: {
    appTitle: string;
    appSubtitle?: string;
    logoUrl?: string;
  };
  /** More-hub / business modules (sorted, gated) */
  modules: ResolvedHubItem[];
  tabs: TabVisibility;
  /** Bootstrap label overrides for known module keys */
  labels: Record<string, string>;
  source: MobileBootstrap["source"] | "none";
};

export function resolveNavigation(opts: {
  bootstrap: MobileBootstrap | null;
  mobileConfig: MobileConfig;
  permissions: MenuPermissionStateLike & Partial<MenuPermissionState>;
  showUpdateRequired?: boolean;
}): NavResolution {
  const { bootstrap, mobileConfig, permissions, showUpdateRequired } = opts;

  const modules = resolveVisibleHubItems({
    bootstrap,
    mobileConfig,
    permissions,
    showUpdateRequired,
  });

  const tabs = resolveTabVisibility(permissions as MenuPermissionState);

  const labels: Record<string, string> = {};
  for (const m of bootstrap?.modules || []) {
    if (m.label) {
      labels[m.key] = m.label;
      if (m.route_key) labels[m.route_key] = m.label;
    }
  }

  const branding = {
    appTitle:
      bootstrap?.branding?.app_title?.trim() ||
      "Workspace",
    appSubtitle: bootstrap?.branding?.app_subtitle,
    logoUrl: bootstrap?.branding?.logo_url,
  };

  return {
    businessType: bootstrap?.context?.business_type || "B2B",
    branding,
    modules,
    tabs,
    labels,
    source: bootstrap?.source || "none",
  };
}

/** Whether a business module key is visible in navigation */
export function isNavModuleVisible(
  nav: NavResolution,
  key: string
): boolean {
  if (nav.modules.some((m) => m.key === key || m.hubFeatureId === key)) {
    return true;
  }
  // Tab-only modules
  if (key === "approvals") return nav.tabs.approvals;
  if (key === "catalogue") return nav.tabs.catalogue;
  if (key === "settings") return nav.tabs.settings;
  if (key === "employees") return nav.tabs.employees;
  if (key === "home" || key === "executive") return nav.tabs.home;
  return false;
}

/** Resolve local route for a module key — never trust server paths */
export function getModuleRoute(key: string): string | null {
  const entry = resolveModuleEntry(key);
  if (!entry || entry.shipped === false) return null;
  return entry.route;
}

export function getModuleLabel(
  nav: NavResolution,
  key: string,
  fallback?: string
): string {
  if (nav.labels[key]) return nav.labels[key];
  const entry = resolveModuleEntry(key);
  return fallback || entry?.defaultLabel || key;
}

/**
 * Home “Explore” strip — top business modules (excludes tab-only / unshipped).
 */
export function resolveHomeShortcuts(
  nav: NavResolution,
  limit = 8
): ResolvedHubItem[] {
  return nav.modules.slice(0, limit);
}

/** Section labels — legacy defaults; schema v2 prefers bootstrap section_label */
export const NAV_SECTION_LABELS: Record<string, string> = {
  sales: "Sales & customers",
  sales_customers: "Sales & customers",
  finance: "Finance",
  operations: "Operations",
  insights: "Insights",
  tools: "Tools",
};

export function isPhase2ModuleAllowed(key: string): boolean {
  const entry = resolveModuleEntry(key);
  if (entry?.phase2 === "catalogue") return PHASE2_FEATURES.catalogue;
  if (entry?.phase2 === "push") return PHASE2_FEATURES.push;
  return true;
}

/** Lookup registry entry safely */
export function getRegistryEntry(key: string): ModuleRegistryEntry | undefined {
  return moduleRegistry[key] || resolveModuleEntry(key);
}
