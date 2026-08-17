/**
 * Resolve More-hub tiles from bootstrap + local registry + Access Profile.
 * Schema v2 (dynamic_modules): custom screen types appear without registry.
 */

import { PHASE2_FEATURES } from "../api/endpoints";
import { isModuleEnabled, type MobileConfig } from "../api/mobileConfig";
import {
  canAccessHubFeature,
  type MenuPermissionStateLike,
} from "../api/menuAccess";
import type { MobileBootstrap, MobileModuleConfig } from "../types/bootstrap";
import { supportsDynamicModules } from "../types/bootstrap";
import {
  moduleRegistry,
  resolveModuleEntry,
  type ModuleRegistryEntry,
} from "../modules/registry";
import { colorForModuleKey, resolveBootstrapIcon } from "./icons";

export type ModuleScreenType = "module" | "dashboard" | "report_list" | string;

export type ResolvedHubItem = {
  id: string;
  key: string;
  title: string;
  subtitle: string;
  icon: ModuleRegistryEntry["icon"];
  color: string;
  route: string;
  /** Section id (finance, sales_customers, …) */
  section: string;
  /** Section display title from bootstrap or fallback */
  sectionLabel: string;
  hubFeatureId: string;
  screenType: ModuleScreenType;
  config?: Record<string, unknown> | null;
  /** BA enabled an unknown / unshipped module */
  updateRequired?: boolean;
};

const SECTION_FALLBACK = "tools";
const HIDE_FROM_HUB_KEYS = new Set([
  "home",
  "approvals",
  "settings",
]);

function sortModules(mods: MobileModuleConfig[]): MobileModuleConfig[] {
  return [...mods].sort(
    (a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999)
  );
}

function sectionLabelFor(mod: MobileModuleConfig, fallbackSection: string): string {
  if (mod.section_label && String(mod.section_label).trim()) {
    return String(mod.section_label).trim();
  }
  return fallbackSection.replace(/_/g, " ").toUpperCase();
}

function parseBoardTabIds(featureKey: string | null | undefined): string[] {
  const raw = String(featureKey || "").trim();
  if (!raw) return [];
  const lower = raw.toLowerCase();
  const payload = lower.startsWith("board_tabs:")
    ? raw.slice("board_tabs:".length)
    : lower.startsWith("board_tabs=")
      ? raw.slice("board_tabs=".length)
      : "";
  if (!payload.trim()) return [];
  return payload
    .split(/[,|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const DEFAULT_SALES_BOARD_TABS = [
  "sales_overview",
  "sales_performance",
  "sales_trends",
];

/** Resolve tab board ids from Feature Key, with sales_dashboard_* fallback. */
export function resolveBoardTabIds(
  mod:
    | Pick<MobileModuleConfig, "key" | "route_key" | "feature_key">
    | null
    | undefined
): string[] {
  const fromFk = parseBoardTabIds(mod?.feature_key);
  if (fromFk.length) return fromFk;
  const key = String(mod?.key || mod?.route_key || "").toLowerCase();
  if (/sales_dashboard/.test(key)) return [...DEFAULT_SALES_BOARD_TABS];
  return [];
}

export { parseBoardTabIds };

function resolveScreenType(mod: MobileModuleConfig): ModuleScreenType {
  const raw = String(mod.screen_type || "")
    .trim()
    .toLowerCase();
  if (raw === "report_list" || raw === "report-list" || raw === "reports") {
    return "report_list";
  }
  if (raw === "dashboard") return "dashboard";
  // Desk Feature Key board_tabs:… ⇒ widget board (even when screen_type stays "module")
  if (resolveBoardTabIds(mod).length > 0) return "dashboard";
  // Unknown Desk boards (e.g. sales_dashboard_test) — not a shipped module registry key
  const key = String(mod.key || mod.route_key || "").toLowerCase();
  if (
    (raw === "module" || !raw) &&
    /dashboard/.test(key) &&
    !resolveModuleEntry(mod.route_key) &&
    !resolveModuleEntry(mod.key)
  ) {
    return "dashboard";
  }
  return raw || "module";
}

function dashboardRouteFor(mod: MobileModuleConfig): string {
  const tabIds = resolveBoardTabIds(mod);
  // Desk board_tabs → Sales Dashboard chrome (chips + Overview/Performance/Trends)
  if (tabIds.length > 0) {
    return `/board-tabs/${encodeURIComponent(mod.key)}`;
  }
  const id = String(
    mod.config?.dashboard_id ||
      mod.route_key ||
      mod.key ||
      ""
  ).trim();
  return `/dashboard-board/${encodeURIComponent(id || mod.key)}`;
}

function pushBuiltIn(
  items: ResolvedHubItem[],
  mod: MobileModuleConfig,
  entry: ModuleRegistryEntry,
  opts: {
    mobileConfig: MobileConfig;
    permissions: MenuPermissionStateLike;
    showUpdateRequired: boolean;
  }
) {
  if (entry.shipped === false) {
    if (opts.showUpdateRequired) {
      items.push({
        id: entry.hubFeatureId,
        key: mod.key,
        title: mod.label || entry.defaultLabel,
        subtitle: "App update required",
        icon: entry.icon,
        color: entry.color,
        route: "",
        section: mod.section || entry.section,
        sectionLabel: sectionLabelFor(mod, mod.section || entry.section),
        hubFeatureId: entry.hubFeatureId,
        screenType: "module",
        config: mod.config,
        updateRequired: true,
      });
    }
    return;
  }

  if (entry.hideFromHub) return;

  if (entry.phase2 === "catalogue" && !PHASE2_FEATURES.catalogue) return;

  if (
    entry.configModule &&
    !isModuleEnabled(opts.mobileConfig, entry.configModule as any)
  ) {
    return;
  }

  if (!canAccessHubFeature(opts.permissions, entry.hubFeatureId)) {
    return;
  }

  const section = mod.section || entry.section;
  items.push({
    id: entry.hubFeatureId,
    key: mod.key,
    title: mod.label || entry.defaultLabel,
    subtitle: mod.subtitle || entry.defaultSubtitle || "",
    icon: resolveBootstrapIcon(mod.icon_key, entry.icon),
    color: entry.color,
    route: entry.route,
    section,
    sectionLabel: sectionLabelFor(mod, section),
    hubFeatureId: entry.hubFeatureId,
    screenType: "module",
    config: mod.config,
  });
}

/**
 * Schema v2 path: enabled modules from Desk; customs bypass AO.
 */
function resolveDynamicHubItems(opts: {
  bootstrap: MobileBootstrap;
  mobileConfig: MobileConfig;
  permissions: MenuPermissionStateLike;
  showUpdateRequired: boolean;
}): ResolvedHubItem[] {
  const items: ResolvedHubItem[] = [];

  for (const mod of sortModules(opts.bootstrap.modules)) {
    if (mod.enabled === false) continue;
    if (HIDE_FROM_HUB_KEYS.has(mod.key) || HIDE_FROM_HUB_KEYS.has(mod.route_key)) {
      continue;
    }

    const entry =
      resolveModuleEntry(mod.route_key) || resolveModuleEntry(mod.key);
    if (entry?.hideFromHub) continue;

    const screenType = resolveScreenType(mod);
    const section = mod.section || entry?.section || SECTION_FALLBACK;
    const sectionLabel = sectionLabelFor(mod, section);

    if (screenType === "report_list") {
      items.push({
        id: `report-${mod.key}`,
        key: mod.key,
        title: mod.label || mod.key,
        subtitle: mod.subtitle || "",
        icon: resolveBootstrapIcon(mod.icon_key, "stats-chart-outline"),
        color: colorForModuleKey(mod.key),
        route: `/report-list/${encodeURIComponent(mod.key)}`,
        section,
        sectionLabel,
        hubFeatureId: mod.key,
        screenType: "report_list",
        config: mod.config,
      });
      continue;
    }

    if (screenType === "dashboard") {
      items.push({
        id: `dash-${mod.key}`,
        key: mod.key,
        title: mod.label || mod.key,
        subtitle: mod.subtitle || "",
        icon: resolveBootstrapIcon(mod.icon_key, "grid-outline"),
        color: colorForModuleKey(mod.key),
        route: dashboardRouteFor(mod),
        section,
        sectionLabel,
        hubFeatureId: mod.key,
        screenType: "dashboard",
        config: mod.config,
      });
      continue;
    }

    // screen_type: module (default) — registry + AO
    if (!entry) {
      if (opts.showUpdateRequired) {
        items.push({
          id: `unknown-${mod.key}`,
          key: mod.key,
          title: mod.label || mod.key,
          subtitle: "App update required",
          icon: "download-outline",
          color: "#94a3b8",
          route: "",
          section,
          sectionLabel,
          hubFeatureId: mod.key,
          screenType: "module",
          config: mod.config,
          updateRequired: true,
        });
      }
      continue;
    }

    pushBuiltIn(items, mod, entry, opts);
  }

  return items;
}

/**
 * Schema v1 / legacy: registry required for every More tile.
 */
function resolveLegacyHubItems(opts: {
  bootstrap: MobileBootstrap | null;
  mobileConfig: MobileConfig;
  permissions: MenuPermissionStateLike;
  showUpdateRequired: boolean;
}): ResolvedHubItem[] {
  const items: ResolvedHubItem[] = [];

  if (opts.bootstrap?.modules?.length) {
    for (const mod of sortModules(opts.bootstrap.modules)) {
      if (mod.enabled === false) continue;

      const screenType = resolveScreenType(mod);
      // Safety: never drop report_list / dashboard on legacy path
      if (screenType === "report_list") {
        const section = mod.section || SECTION_FALLBACK;
        items.push({
          id: `report-${mod.key}`,
          key: mod.key,
          title: mod.label || mod.key,
          subtitle: mod.subtitle || "",
          icon: resolveBootstrapIcon(mod.icon_key, "stats-chart-outline"),
          color: colorForModuleKey(mod.key),
          route: `/report-list/${encodeURIComponent(mod.key)}`,
          section,
          sectionLabel: sectionLabelFor(mod, section),
          hubFeatureId: mod.key,
          screenType: "report_list",
          config: mod.config,
        });
        continue;
      }

      if (screenType === "dashboard") {
        const section = mod.section || SECTION_FALLBACK;
        items.push({
          id: `dash-${mod.key}`,
          key: mod.key,
          title: mod.label || mod.key,
          subtitle: mod.subtitle || "",
          icon: resolveBootstrapIcon(mod.icon_key, "grid-outline"),
          color: colorForModuleKey(mod.key),
          route: dashboardRouteFor(mod),
          section,
          sectionLabel: sectionLabelFor(mod, section),
          hubFeatureId: mod.key,
          screenType: "dashboard",
          config: mod.config,
        });
        continue;
      }

      const entry =
        resolveModuleEntry(mod.route_key) || resolveModuleEntry(mod.key);

      if (!entry) {
        if (opts.showUpdateRequired) {
          items.push({
            id: `unknown-${mod.key}`,
            key: mod.key,
            title: mod.label || mod.key,
            subtitle: "App update required",
            icon: "download-outline",
            color: "#94a3b8",
            route: "",
            section:
              (mod.section as ModuleRegistryEntry["section"]) || SECTION_FALLBACK,
            sectionLabel: sectionLabelFor(mod, mod.section || SECTION_FALLBACK),
            hubFeatureId: mod.key,
            screenType: "module",
            updateRequired: true,
          });
        }
        continue;
      }

      pushBuiltIn(items, mod, entry, opts);
    }
    return items;
  }

  for (const [key, entry] of Object.entries(moduleRegistry)) {
    if (entry.shipped === false) continue;
    if (entry.hideFromHub) continue;
    if (key === "product") continue;
    if (key === "executive") continue;
    if (entry.phase2 === "catalogue" && !PHASE2_FEATURES.catalogue) continue;
    if (
      entry.configModule &&
      !isModuleEnabled(opts.mobileConfig, entry.configModule as any)
    ) {
      continue;
    }
    if (!canAccessHubFeature(opts.permissions, entry.hubFeatureId)) continue;

    items.push({
      id: entry.hubFeatureId,
      key,
      title: entry.defaultLabel,
      subtitle: entry.defaultSubtitle || "",
      icon: entry.icon,
      color: entry.color,
      route: entry.route,
      section: entry.section,
      sectionLabel: entry.section.replace(/_/g, " ").toUpperCase(),
      hubFeatureId: entry.hubFeatureId,
      screenType: "module",
    });
  }
  return items;
}

/**
 * Build visible hub items.
 */
export function resolveVisibleHubItems(opts: {
  bootstrap: MobileBootstrap | null;
  mobileConfig: MobileConfig;
  permissions: MenuPermissionStateLike;
  showUpdateRequired?: boolean;
}): ResolvedHubItem[] {
  const {
    bootstrap,
    mobileConfig,
    permissions,
    showUpdateRequired = false,
  } = opts;

  if (supportsDynamicModules(bootstrap) && bootstrap?.modules?.length) {
    return resolveDynamicHubItems({
      bootstrap,
      mobileConfig,
      permissions,
      showUpdateRequired,
    });
  }

  return resolveLegacyHubItems({
    bootstrap,
    mobileConfig,
    permissions,
    showUpdateRequired,
  });
}

/** Group hub items preserving bootstrap section order. */
export function groupHubItemsBySection(
  items: ResolvedHubItem[]
): { id: string; label: string; items: ResolvedHubItem[] }[] {
  const sections: { id: string; label: string; items: ResolvedHubItem[] }[] =
    [];
  const index = new Map<string, number>();

  for (const item of items) {
    const id = item.section || SECTION_FALLBACK;
    let i = index.get(id);
    if (i == null) {
      i = sections.length;
      index.set(id, i);
      sections.push({
        id,
        label: item.sectionLabel || id.replace(/_/g, " ").toUpperCase(),
        items: [],
      });
    }
    sections[i].items.push(item);
  }
  return sections;
}
