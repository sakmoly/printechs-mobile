/**
 * Fetch tenant bootstrap: prefer get_mobile_bootstrap, fall back to get_mobile_config.
 * Fail closed for unknown tenants; known legacy sites get DEFAULT synthesis.
 */

import { http } from "./http";
import { isDemoMode } from "./demoMode";
import { ERP_ANALYSIS } from "./endpoints";
import { isMissingBaMethodError } from "./baErrors";
import {
  DEFAULT_DIMENSIONS,
  DEFAULT_MOBILE_CONFIG,
  fetchMobileConfig,
  type MobileConfig,
  type MobileModules,
} from "./mobileConfig";
import { logger } from "../utils/logger";
import type {
  BusinessType,
  MobileBootstrap,
  MobileDimensionConfig,
  MobileModuleConfig,
} from "../types/bootstrap";
import {
  normalizeDashboardBoards,
  normalizeDashboardWidgets,
} from "../types/bootstrap";
import { moduleRegistry } from "../modules/registry";

const BOOTSTRAP_SCHEMA_VERSION = 1;

/** Default module list for B2B / legacy when BA has not shipped bootstrap yet */
export function buildDefaultModuleList(
  flags: Partial<MobileModules> | Record<string, boolean>
): MobileModuleConfig[] {
  const order = [
    "home",
    "approvals",
    "settings",
    "customer_360",
    "analytics",
    "employees",
    "catalogue",
  ];

  const modules: MobileModuleConfig[] = [];
  let sort = 10;
  for (const key of order) {
    const entry = moduleRegistry[key];
    if (!entry) continue;
    const flagKey = entry.configModule || key;
    const enabled =
      flags[flagKey as keyof typeof flags] !== false &&
      (flags as Record<string, boolean>)[key] !== false;
    // Employees has no config module flag — keep visible by default
    const isEnabled = key === "employees" ? enabled !== false : Boolean(enabled);
    modules.push({
      key,
      label: entry.defaultLabel,
      enabled: isEnabled,
      sort_order: sort,
      icon_key: entry.icon,
      route_key: key,
      section: entry.section,
      subtitle: entry.defaultSubtitle,
    });
    sort += 10;
  }
  return modules;
}

function dimensionsFromFlags(
  dims: MobileConfig["dimensions"]
): MobileDimensionConfig[] {
  return (Object.keys({ ...DEFAULT_DIMENSIONS, ...dims }) as string[])
    .filter((key) => !/^custom_/i.test(key))
    .map((key) => {
      const enabled = dims[key as keyof typeof dims] !== false;
      return {
        key,
        label: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        data_type:
          key === "company" ||
          key === "territory" ||
          key === "brand" ||
          key === "warehouse"
            ? "Link"
            : "Data",
        filterable: enabled,
        groupable: enabled,
        sortable: enabled,
      };
    });
}

/** Synthesize bootstrap from legacy get_mobile_config (or defaults). */
export function bootstrapFromMobileConfig(
  config: MobileConfig,
  source: MobileBootstrap["source"] = "mobile_config"
): MobileBootstrap {
  const dashboards = normalizeDashboardBoards(
    config.dashboards?.map((d, i) => ({
      key: d.id || `board-${i}`,
      title: d.title || d.id,
      widgets: (d.widgets || []).map((w, wi) => ({
        key: w.id || `w-${wi}`,
        label: w.title || w.id,
        type: w.type,
        props: w.props,
        sort_order: (wi + 1) * 10,
      })),
    }))
  );

  return {
    schema_version: BOOTSTRAP_SCHEMA_VERSION,
    api_version: config.version,
    context: {
      business_type: "B2B" as BusinessType,
      profile: "legacy",
    },
    branding: {
      app_title: config.app || "erp_analysis",
    },
    modules: buildDefaultModuleList(config.modules),
    dimensions: dimensionsFromFlags(config.dimensions),
    dashboard: normalizeDashboardWidgets(
      dashboards[0]?.widgets?.length
        ? dashboards[0].widgets
        : (config.dashboards?.[0]?.widgets || []).map((w, i) => ({
            key: w.id || `w-${i}`,
            id: w.id,
            title: w.title,
            type: w.type,
            props: w.props,
            sort_order: (i + 1) * 10,
          }))
    ),
    dashboards,
    module_flags: { ...config.modules } as Record<string, boolean>,
    apis: { ...(config.apis || {}) },
    capabilities: {},
    source,
  };
}

function unwrapMessage<T>(response: unknown): T | null {
  if (!response || typeof response !== "object") return null;
  if ("message" in response) {
    return ((response as { message: T }).message ?? null) as T | null;
  }
  return response as T;
}

function normalizeBootstrap(raw: Partial<MobileBootstrap>): MobileBootstrap | null {
  if (!raw || typeof raw !== "object") return null;

  // Accept modules as array OR legacy boolean map
  let modules: MobileModuleConfig[] = [];
  if (Array.isArray(raw.modules) && raw.modules.length > 0) {
    modules = raw.modules
      .filter((m) => m && typeof m.key === "string")
      .map((m: any, i: number) => {
        let config: Record<string, unknown> | null = null;
        if (m.config && typeof m.config === "object" && !Array.isArray(m.config)) {
          config = { ...m.config };
        } else if (typeof m.config_json === "string" && m.config_json.trim()) {
          try {
            const parsed = JSON.parse(m.config_json);
            if (parsed && typeof parsed === "object") config = parsed;
          } catch {
            /* ignore */
          }
        }
        const enabledRaw = m.enabled;
        const enabled =
          enabledRaw !== false &&
          enabledRaw !== 0 &&
          enabledRaw !== "0" &&
          enabledRaw !== "false";
        return {
          key: String(m.key),
          label: m.label || m.key,
          enabled,
          sort_order:
            typeof m.sort_order === "number" ? m.sort_order : (i + 1) * 10,
          icon_key: m.icon_key ?? null,
          route_key: String(m.route_key || m.key),
          section: m.section,
          section_label: m.section_label ?? null,
          subtitle: m.subtitle ?? null,
          screen_type: m.screen_type || "module",
          feature_key: m.feature_key ?? null,
          config,
        } as MobileModuleConfig;
      });
  } else if (raw.module_flags && typeof raw.module_flags === "object") {
    modules = buildDefaultModuleList(raw.module_flags);
  } else if (
    raw.modules &&
    typeof raw.modules === "object" &&
    !Array.isArray(raw.modules)
  ) {
    // Mis-shaped payload: modules was boolean map
    modules = buildDefaultModuleList(
      raw.modules as unknown as Record<string, boolean>
    );
  }

  if (!modules.length) return null;

  const dimsRaw = raw.dimensions;
  let dimensions: MobileDimensionConfig[] = [];
  if (Array.isArray(dimsRaw) && dimsRaw.length) {
    dimensions = dimsRaw
      .filter((d) => d && typeof d.key === "string")
      .map((d) => ({
        key: d.key,
        label: d.label || d.key,
        data_type: d.data_type,
        filterable: d.filterable !== false,
        groupable: d.groupable !== false,
        sortable: d.sortable,
      }));
  } else if (dimsRaw && typeof dimsRaw === "object" && !Array.isArray(dimsRaw)) {
    dimensions = dimensionsFromFlags(
      dimsRaw as unknown as MobileConfig["dimensions"]
    );
  } else {
    dimensions = dimensionsFromFlags(DEFAULT_DIMENSIONS);
  }

  const context = raw.context || {
    business_type: "B2B" as BusinessType,
  };

  const boards = normalizeDashboardBoards((raw as any).dashboards);
  const flatDashboard = normalizeDashboardWidgets(
    Array.isArray(raw.dashboard)
      ? raw.dashboard
      : boards[0]?.widgets?.length
        ? boards[0].widgets
        : []
  );
  // When only flat dashboard[] is present, still expose a board so Home can
  // synthesize rows from size/section_title.
  const dashboards =
    boards.length > 0
      ? boards
      : flatDashboard.length
        ? [
            {
              key: "primary",
              title: null,
              widgets: flatDashboard,
              widget_rows: null,
            },
          ]
        : [];

  return {
    schema_version: Number(raw.schema_version) || BOOTSTRAP_SCHEMA_VERSION,
    api_version: raw.api_version,
    user: raw.user,
    context: {
      company: context.company,
      profile: context.profile || "default",
      business_type: context.business_type || "B2B",
      default_dashboard: (context as any).default_dashboard ?? null,
    },
    branding: raw.branding,
    modules,
    dimensions,
    dashboard: flatDashboard.length
      ? flatDashboard
      : dashboards[0]?.widgets || [],
    dashboards,
    meta: (raw as any).meta ?? null,
    permissions: raw.permissions,
    capabilities: raw.capabilities || {},
    module_flags: raw.module_flags,
    apis: raw.apis || {},
    source: "bootstrap",
  };
}

/**
 * Project bootstrap modules[] into MobileConfig.modules flags for existing gates.
 */
export function mobileConfigFromBootstrap(
  bootstrap: MobileBootstrap,
  base: MobileConfig = DEFAULT_MOBILE_CONFIG
): MobileConfig {
  const modules = { ...base.modules };
  for (const m of bootstrap.modules) {
    const entry = moduleRegistry[m.key];
    const flagKey = (entry?.configModule || m.key) as keyof MobileModules;
    if (flagKey in modules || entry?.configModule) {
      (modules as Record<string, boolean>)[flagKey] = m.enabled !== false;
    }
  }
  if (bootstrap.module_flags) {
    for (const [k, v] of Object.entries(bootstrap.module_flags)) {
      if (typeof v === "boolean") {
        (modules as Record<string, boolean>)[k] = v;
      }
    }
  }

  const dimensions = { ...base.dimensions };
  for (const d of bootstrap.dimensions) {
    const on = d.filterable !== false || d.groupable !== false;
    (dimensions as Record<string, boolean>)[d.key] = on;
  }

  return {
    ...base,
    version: bootstrap.api_version || base.version,
    modules,
    dimensions,
    apis: { ...base.apis, ...(bootstrap.apis || {}) },
  };
}

export type FetchBootstrapResult = {
  bootstrap: MobileBootstrap;
  /** Also keep MobileConfig in sync for existing isModuleEnabled callers */
  mobileConfig: MobileConfig;
};

/**
 * Prefer get_mobile_bootstrap; on missing method fall back to get_mobile_config.
 */
export async function fetchMobileBootstrap(): Promise<FetchBootstrapResult> {
  if (isDemoMode()) {
    const config = DEFAULT_MOBILE_CONFIG;
    const bootstrap = bootstrapFromMobileConfig(config, "defaults");
    return { bootstrap, mobileConfig: config };
  }

  try {
    const response = await http.get<unknown>(
      ERP_ANALYSIS.config.getMobileBootstrap,
      undefined,
      { silentError: true }
    );
    const payload = unwrapMessage<Partial<MobileBootstrap>>(response);
    const normalized = payload ? normalizeBootstrap(payload) : null;
    if (normalized) {
      const mobileConfig = mobileConfigFromBootstrap(normalized);
      logger.info("Mobile bootstrap loaded", {
        source: "bootstrap",
        schema_version: normalized.schema_version,
        dynamic_modules: Boolean(
          Number(normalized.schema_version) >= 2 ||
            normalized.capabilities?.dynamic_modules
        ),
        business_type: normalized.context.business_type,
        modules: normalized.modules
          .filter((m) => m.enabled)
          .map((m) => `${m.key}:${m.screen_type || "module"}`),
      });
      return { bootstrap: normalized, mobileConfig };
    }
    logger.warn("get_mobile_bootstrap returned empty/invalid payload — falling back");
  } catch (error) {
    if (isMissingBaMethodError(error)) {
      logger.info(
        "get_mobile_bootstrap not on server — using get_mobile_config fallback"
      );
    } else {
      logger.warn("get_mobile_bootstrap failed — using get_mobile_config fallback", error);
    }
  }

  const config = await fetchMobileConfig();
  const bootstrap = bootstrapFromMobileConfig(config, "mobile_config");
  return { bootstrap, mobileConfig: config };
}

export function isModuleEnabledInBootstrap(
  bootstrap: MobileBootstrap | null | undefined,
  key: string
): boolean {
  if (!bootstrap?.modules?.length) return true;
  const hit = bootstrap.modules.find(
    (m) => m.key === key || m.route_key === key
  );
  if (!hit) {
    // Unknown to bootstrap list: do not invent enablement for new keys
    // but legacy screens not listed stay allowed only via mobileConfig path
    return false;
  }
  return hit.enabled !== false;
}

export function isDimensionEnabledInBootstrap(
  bootstrap: MobileBootstrap | null | undefined,
  key: string
): boolean {
  if (!bootstrap?.dimensions?.length) return true;
  const hit = bootstrap.dimensions.find((d) => d.key === key);
  if (!hit) return true;
  return hit.filterable !== false || hit.groupable !== false;
}
