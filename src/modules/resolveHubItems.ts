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

/** Legacy module flags → overview board when bootstrap.modules is incomplete. */
const CONFIG_FLAG_BOARDS: {
  flag: string;
  boardKey: string;
  label: string;
  section: string;
  hubFeatureId: string;
}[] = [
  {
    flag: "sales",
    boardKey: "sales_overview",
    label: "Sales Overview",
    section: "sales",
    hubFeatureId: "sales",
  },
  {
    flag: "receivables",
    boardKey: "receivables_overview",
    label: "Receivables",
    section: "finance",
    hubFeatureId: "receivables",
  },
  {
    flag: "inventory",
    boardKey: "inventory_overview",
    label: "Inventory",
    section: "operations",
    hubFeatureId: "inventory",
  },
  {
    flag: "collection",
    boardKey: "collection_overview",
    label: "Collection",
    section: "finance",
    hubFeatureId: "collection",
  },
  {
    flag: "payables",
    boardKey: "payables_overview",
    label: "Payables",
    section: "finance",
    hubFeatureId: "payables",
  },
  {
    flag: "purchase",
    boardKey: "purchase_overview",
    label: "Purchase",
    section: "operations",
    hubFeatureId: "purchase",
  },
  {
    flag: "executive",
    boardKey: "executive_overview",
    label: "Executive",
    section: "insights",
    hubFeatureId: "dashboard",
  },
];

function sectionForBoardKey(key: string): string {
  const k = String(key || "").toLowerCase();
  if (k.startsWith("sales")) return "sales";
  if (k.startsWith("receivable") || k.startsWith("collection")) return "finance";
  if (k.startsWith("inventory") || k.startsWith("purchase")) return "operations";
  if (k.startsWith("payable")) return "finance";
  return SECTION_FALLBACK;
}

function moduleKeysPresent(bootstrap: MobileBootstrap): Set<string> {
  const keys = new Set<string>();
  for (const m of bootstrap.modules) {
    keys.add(String(m.key || "").toLowerCase());
    keys.add(String(m.route_key || m.key || "").toLowerCase());
  }
  return keys;
}

/**
 * Desk sometimes returns widgets/boards without matching modules[] rows
 * (or bootstrap falls back to get_mobile_config). Merge missing dashboard
 * modules so More always lists enabled BA boards.
 */
export function augmentBootstrapModulesForHub(
  bootstrap: MobileBootstrap | null,
  mobileConfig: MobileConfig,
  permissions: MenuPermissionStateLike
): MobileBootstrap | null {
  if (!bootstrap) return null;

  const present = moduleKeysPresent(bootstrap);
  const hasKey = (key: string) => present.has(String(key || "").toLowerCase());

  const extra: MobileModuleConfig[] = [];
  let sort =
    Math.max(0, ...bootstrap.modules.map((m) => m.sort_order ?? 0)) + 10;

  const pushBoard = (
    mod: MobileModuleConfig,
    hubFeatureId?: string
  ) => {
    const key = String(mod.key || "").toLowerCase();
    if (!key || hasKey(key)) return;
    if (HIDE_FROM_HUB_KEYS.has(key)) return;
    if (hubFeatureId && !canAccessHubFeature(permissions, hubFeatureId)) {
      return;
    }
    extra.push(mod);
    present.add(key);
    present.add(String(mod.route_key || mod.key).toLowerCase());
    sort += 10;
  };

  for (const board of bootstrap.dashboards || []) {
    const key = String(board.key || "").trim();
    if (!key) continue;
    pushBoard({
      key,
      route_key: key,
      label: String(board.title || key.replace(/_/g, " ")),
      enabled: true,
      screen_type: "dashboard",
      sort_order: sort,
      section: sectionForBoardKey(key),
      config: { dashboard_id: key },
    });
  }

  for (const spec of CONFIG_FLAG_BOARDS) {
    if (!isModuleEnabled(mobileConfig, spec.flag as keyof import("../api/mobileConfig").MobileModules)) continue;
    if (hasKey(spec.boardKey) || hasKey(spec.flag)) continue;
    pushBoard(
      {
        key: spec.boardKey,
        route_key: spec.boardKey,
        label: spec.label,
        enabled: true,
        screen_type: "dashboard",
        sort_order: sort,
        section: spec.section,
        config: { dashboard_id: spec.boardKey },
      },
      spec.hubFeatureId
    );
  }

  if (!extra.length) return bootstrap;
  return { ...bootstrap, modules: [...bootstrap.modules, ...extra] };
}

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

    // screen_type: module — built-in tools (Customer 360, …) or backend board by key
    if (!entry) {
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

  const mergedBootstrap = augmentBootstrapModulesForHub(
    bootstrap,
    mobileConfig,
    permissions
  );

  const raw =
    supportsDynamicModules(mergedBootstrap) && mergedBootstrap?.modules?.length
      ? resolveDynamicHubItems({
          bootstrap: mergedBootstrap,
          mobileConfig,
          permissions,
          showUpdateRequired,
        })
      : resolveLegacyHubItems({
          bootstrap: mergedBootstrap,
          mobileConfig,
          permissions,
          showUpdateRequired,
        });

  return dedupeHubItems(raw);
}

/**
 * Legacy module key → preferred Access Profile board when both are enabled.
 */
const HUB_KEY_ALIASES: Record<string, string> = {
  sales: "sales_overview",
  receivables: "receivables_overview",
  inventory: "inventory_overview",
  collection: "collection_overview",
  executive: "executive_overview",
  sales_performance: "sales_dash_performance",
  sales_orders: "sales_order_book",
  profitability: "sales_dash_profitability",
  exceptions: "sales_attention",
};

/** Tab / child boards — kept for More family chips (not top-level duplicates of overview). */
const SALES_NESTED_BOARD_KEYS = new Set([
  "sales_trend",
  "sales_trends",
  "sales_dash_performance",
  "sales_customer",
  "sales_product",
  "sales_order_book",
  "sales_dash_profitability",
  "sales_attention",
  "sales_performance",
  "sales_orders",
]);

const HUB_NOISE_KEYS = new Set([
  "push",
  "executive",
  "executive_overview",
]);

function normalizeHubTitle(title: string): string {
  return String(title || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function hubPreferenceScore(item: ResolvedHubItem): number {
  const k = String(item.key || "").toLowerCase();
  let score = 0;
  if (/_overview$/.test(k)) score += 100;
  if (/_dash_/.test(k) || /_order_book$/.test(k)) score += 40;
  if (item.screenType === "dashboard") score += 20;
  if (item.screenType === "report_list") score += 15;
  if (resolveModuleEntry(k)?.route?.startsWith("/customer")) score += 30;
  if (resolveModuleEntry(k)?.route?.includes("generic-analysis")) score += 30;
  return score;
}

/**
 * Desk often ships legacy modules + matching boards.
 * Drop true twins; keep sales child boards for grouped More chips.
 */
export function dedupeHubItems(items: ResolvedHubItem[]): ResolvedHubItem[] {
  const byKey = new Map(
    items.map((i) => [String(i.key || "").toLowerCase(), i] as const)
  );

  let filtered = items.filter((item) => {
    const k = String(item.key || "").toLowerCase();
    if (HUB_NOISE_KEYS.has(k)) return false;

    // Prefer inventory_overview over inventory, etc.
    if (byKey.has(`${k}_overview`)) return false;
    const preferred = HUB_KEY_ALIASES[k];
    if (preferred && byKey.has(preferred)) return false;

    return true;
  });

  // Same visible title → keep the better board/tool (e.g. sales_performance twin)
  const winnerByTitle = new Map<string, ResolvedHubItem>();
  for (const item of filtered) {
    const title = normalizeHubTitle(item.title);
    if (!title) continue;
    const prev = winnerByTitle.get(title);
    if (!prev || hubPreferenceScore(item) > hubPreferenceScore(prev)) {
      winnerByTitle.set(title, item);
    }
  }

  filtered = filtered.filter((item) => {
    const title = normalizeHubTitle(item.title);
    if (!title) return true;
    return winnerByTitle.get(title)?.key === item.key;
  });

  return filtered;
}

/** @deprecated use dedupeHubItems */
export function dedupeOverviewHubItems(
  items: ResolvedHubItem[]
): ResolvedHubItem[] {
  return dedupeHubItems(items);
}

export type MoreMenuFamily = {
  id: string;
  title: string;
  subtitle: string;
  icon: ModuleRegistryEntry["icon"];
  color: string;
  /** Primary board (usually Overview) — header tap */
  primary: ResolvedHubItem;
  /** Quick-select chips (Performance, Trends, SO, …) */
  chips: ResolvedHubItem[];
};

type FamilyMeta = {
  id: string;
  title: string;
  subtitle: string;
  icon: ModuleRegistryEntry["icon"];
  color: string;
  order: number;
};

function familyMetaForKey(key: string): FamilyMeta {
  const k = String(key || "").toLowerCase();
  if (
    k.startsWith("sales") ||
    k === "customer_360" ||
    k === "profitability"
  ) {
    return {
      id: "sales",
      title: "Sales",
      subtitle: "Year-to-Date vs Last Year",
      icon: "trending-up",
      color: "#667eea",
      order: 10,
    };
  }
  if (k.startsWith("receivable")) {
    return {
      id: "receivables",
      title: "Receivables",
      subtitle: "Aging & collections",
      icon: "wallet",
      color: "#0ea5e9",
      order: 20,
    };
  }
  if (k.startsWith("collection")) {
    return {
      id: "collection",
      title: "Collection",
      subtitle: "Cash & attention",
      icon: "cash",
      color: "#0284c7",
      order: 30,
    };
  }
  if (k.startsWith("inventory")) {
    return {
      id: "inventory",
      title: "Inventory",
      subtitle: "Stock & health",
      icon: "layers",
      color: "#10b981",
      order: 40,
    };
  }
  if (k.startsWith("payable")) {
    return {
      id: "payables",
      title: "Payables",
      subtitle: "AP & payment plan",
      icon: "card",
      color: "#ef4444",
      order: 50,
    };
  }
  if (k.startsWith("purchase")) {
    return {
      id: "purchase",
      title: "Purchase",
      subtitle: "PO performance",
      icon: "cart",
      color: "#f97316",
      order: 60,
    };
  }
  if (k.startsWith("exception") || k === "sales_attention") {
    return {
      id: "exceptions",
      title: "Exceptions",
      subtitle: "Management alerts",
      icon: "warning",
      color: "#ea580c",
      order: 70,
    };
  }
  if (k.includes("approval")) {
    return {
      id: "approvals_analytics",
      title: "Approvals",
      subtitle: "Cycle time & SLA",
      icon: "stats-chart",
      color: "#6366f1",
      order: 80,
    };
  }
  return {
    id: "tools",
    title: "Tools",
    subtitle: "Reports & utilities",
    icon: "grid-outline",
    color: "#64748b",
    order: 90,
  };
}

function chipSortRank(key: string): number {
  const k = key.toLowerCase();
  if (/overview/.test(k)) return 1;
  if (/performance/.test(k)) return 2;
  if (/trend/.test(k)) return 3;
  if (/customer/.test(k) && !/360/.test(k)) return 4;
  if (/product/.test(k)) return 5;
  if (/order/.test(k)) return 6;
  if (/profit/.test(k)) return 7;
  if (/attention|exception/.test(k)) return 8;
  if (/360/.test(k)) return 9;
  return 50;
}

/** Short pill label matching Sales Dashboard chrome (Overview / Performance / SO). */
export function shortHubChipLabel(item: ResolvedHubItem): string {
  const k = String(item.key || "").toLowerCase();
  if (/overview/.test(k)) return "Overview";
  if (/performance/.test(k)) return "Performance";
  if (/trend/.test(k)) return "Trends";
  if (/order/.test(k)) return "SO";
  if (/product/.test(k)) return "Products";
  if (/customer/.test(k) && !/360/.test(k)) return "Customers";
  if (/360/.test(k)) return "Cust. 360";
  if (/profit/.test(k)) return "Profit";
  if (/attention/.test(k)) return "Alerts";
  if (/exception/.test(k)) return "Alerts";
  if (/receivable/.test(k)) return "AR";
  if (/collection/.test(k)) return "Collection";
  if (/inventory/.test(k)) return "Stock";
  if (/payable/.test(k)) return "AP";
  if (/purchase/.test(k)) return "Purchase";
  const words = String(item.title || "")
    .trim()
    .split(/\s+/);
  if (words.length <= 2) return item.title;
  return words.slice(0, 2).join(" ");
}

function chipIconFor(item: ResolvedHubItem): ModuleRegistryEntry["icon"] {
  const k = String(item.key || "").toLowerCase();
  if (/overview/.test(k)) return "pie-chart";
  if (/performance/.test(k)) return "bar-chart";
  if (/trend/.test(k)) return "trending-up";
  if (/order/.test(k)) return "clipboard";
  if (/product/.test(k)) return "cube-outline";
  if (/customer|360/.test(k)) return "people-outline";
  if (/profit/.test(k)) return "pie-chart-outline";
  if (/attention|exception/.test(k)) return "warning-outline";
  if (/inventory/.test(k)) return "layers-outline";
  if (/collection/.test(k)) return "cash-outline";
  if (/receivable/.test(k)) return "wallet-outline";
  return item.icon;
}

/**
 * Group More tiles into Sales / Inventory / Collection style family cards
 * with Overview-style chips (Sales Dashboard chrome).
 */
export function groupHubItemsByFamily(
  items: ResolvedHubItem[]
): MoreMenuFamily[] {
  const buckets = new Map<string, { meta: FamilyMeta; items: ResolvedHubItem[] }>();

  for (const item of items) {
    const meta = familyMetaForKey(item.key);
    let bucket = buckets.get(meta.id);
    if (!bucket) {
      bucket = { meta, items: [] };
      buckets.set(meta.id, bucket);
    }
    bucket.items.push(item);
  }

  const families: MoreMenuFamily[] = [];
  for (const { meta, items: members } of buckets.values()) {
    const sorted = [...members].sort(
      (a, b) => chipSortRank(a.key) - chipSortRank(b.key)
    );
    const primary =
      sorted.find((m) => /overview/i.test(m.key)) ||
      sorted.find((m) => !SALES_NESTED_BOARD_KEYS.has(m.key.toLowerCase())) ||
      sorted[0];
    if (!primary) continue;

    // Chips = all members (including primary as first Overview chip)
    const chips = sorted.map((m) => ({
      ...m,
      icon: chipIconFor(m),
    }));

    families.push({
      id: meta.id,
      title: meta.title,
      subtitle: meta.subtitle,
      icon: meta.icon,
      color: meta.color,
      primary,
      chips,
    });
  }

  return families.sort((a, b) => {
    const ao = familyMetaForKey(a.primary.key).order;
    const bo = familyMetaForKey(b.primary.key).order;
    return ao - bo;
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
