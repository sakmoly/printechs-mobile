import { http } from "./http";
import { isDemoMode } from "./demoMode";
import { ERP_ANALYSIS, PHASE2_FEATURES } from "./endpoints";
import { logger } from "../utils/logger";

export type MobileModules = {
  sales: boolean;
  receivables: boolean;
  inventory: boolean;
  approvals: boolean;
  catalogue: boolean;
  push: boolean;
  settings: boolean;
  /** Phase 3 — Executive home 2.0 */
  executive: boolean;
  customer_360: boolean;
  collection: boolean;
  sales_orders: boolean;
  payables: boolean;
  purchase: boolean;
  inventory_health: boolean;
  profitability: boolean;
  exceptions: boolean;
  analytics: boolean;
  approval_analytics: boolean;
  salesperson: boolean;
  product_performance: boolean;
};

/** Org dimensions that vary by ERPNext client site (logical keys — open via string) */
export type MobileDimension =
  | "company"
  | "territory"
  | "warehouse"
  | "brand"
  | "division"
  | "department"
  | "cost_center"
  | "branch"
  | (string & {});

export type MobileDimensions = Record<string, boolean>;

/**
 * Optional BA method flags. Missing keys = enabled (deny only when false).
 * Lets sites turn off endpoints they have not implemented yet.
 */
export type MobileApiFlags = Record<string, boolean>;

export type MobileWidget = {
  id: string;
  type: "kpi" | "chart" | "table" | "expandable";
  title?: string;
  api?: string;
  props?: Record<string, unknown>;
};

export type MobileDashboard = {
  id: string;
  title: string;
  module: keyof MobileModules | string;
  widgets: MobileWidget[];
};

export type MobileConfig = {
  app: string;
  version: string;
  modules: MobileModules;
  /** Site-specific org fields. false = do not send/filter/show that dimension */
  dimensions: MobileDimensions;
  /** Optional per-method switches (method short name or dotted path) */
  apis: MobileApiFlags;
  dashboards: MobileDashboard[];
};

export const DEFAULT_DIMENSIONS: MobileDimensions = {
  company: true,
  territory: true,
  warehouse: true,
  brand: true,
  // Often Printechs-specific — still default on for parity; sites set false
  division: true,
  department: true,
  cost_center: false,
  branch: true,
};

export const DEFAULT_MOBILE_CONFIG: MobileConfig = {
  app: "erp_analysis",
  version: "1.0.0",
  modules: {
    sales: true,
    receivables: true,
    inventory: true,
    approvals: true,
    catalogue: false,
    push: false,
    settings: true,
    // Phase 3 — enable when site APIs are live (defaults on for ready backends)
    executive: true,
    customer_360: true,
    collection: true,
    sales_orders: true,
    payables: true,
    purchase: true,
    inventory_health: true,
    profitability: true,
    exceptions: true,
    analytics: true,
    approval_analytics: true,
    salesperson: true,
    product_performance: true,
  },
  dimensions: { ...DEFAULT_DIMENSIONS },
  apis: {},
  dashboards: [
    {
      id: "home",
      title: "Dashboard",
      module: "sales",
      widgets: [
        { id: "sales_card", type: "expandable", title: "Sales Performance" },
        { id: "receivables_card", type: "expandable", title: "Receivables" },
        { id: "inventory_card", type: "expandable", title: "Inventory" },
      ],
    },
  ],
};

function applyPhase2Gates(config: MobileConfig): MobileConfig {
  return {
    ...config,
    modules: {
      ...config.modules,
      catalogue: Boolean(config.modules.catalogue) && PHASE2_FEATURES.catalogue,
      push: Boolean(config.modules.push) && PHASE2_FEATURES.push,
      settings: config.modules.settings !== false,
    },
    dimensions: {
      ...DEFAULT_DIMENSIONS,
      ...config.dimensions,
    },
    apis: { ...(config.apis || {}) },
  };
}

export function isModuleEnabled(
  config: MobileConfig | null | undefined,
  module: keyof MobileModules
): boolean {
  const resolved = applyPhase2Gates(config ?? DEFAULT_MOBILE_CONFIG);
  return resolved.modules[module] !== false;
}

/**
 * Dimension visibility: only explicit `false` disables.
 * Missing keys default to DEFAULT_DIMENSIONS (or true if unknown logical key
 * until bootstrap lists it — Phase F prefers bootstrap dimensionMap).
 * Physical ERPNext names (custom_*) are never enabled.
 */
export function isDimensionEnabled(
  config: MobileConfig | null | undefined,
  dimension: MobileDimension | string
): boolean {
  if (/^custom_/i.test(dimension) || /^(source_field|sourceField)/i.test(dimension)) {
    return false;
  }
  const resolved = applyPhase2Gates(config ?? DEFAULT_MOBILE_CONFIG);
  const value = resolved.dimensions?.[dimension];
  if (value === false) return false;
  if (value === true) return true;
  return DEFAULT_DIMENSIONS[dimension] !== false;
}

/**
 * API method enabled unless explicitly false in config.apis.
 * Accepts short name (`get_inventory_trends`) or dotted path.
 */
export function isApiEnabled(
  config: MobileConfig | null | undefined,
  methodKey: string
): boolean {
  const resolved = applyPhase2Gates(config ?? DEFAULT_MOBILE_CONFIG);
  const apis = resolved.apis || {};
  if (apis[methodKey] === false) return false;
  const short = methodKey.includes(".")
    ? methodKey.split(".").pop()!
    : methodKey;
  if (apis[short] === false) return false;
  return true;
}

function normalizeConfig(payload: Partial<MobileConfig>): MobileConfig {
  return applyPhase2Gates({
    ...DEFAULT_MOBILE_CONFIG,
    ...payload,
    modules: {
      ...DEFAULT_MOBILE_CONFIG.modules,
      ...(payload.modules || {}),
    },
    dimensions: {
      ...DEFAULT_DIMENSIONS,
      ...(payload.dimensions || {}),
    },
    apis: {
      ...(payload.apis || {}),
    },
    dashboards: payload.dashboards?.length
      ? payload.dashboards
      : DEFAULT_MOBILE_CONFIG.dashboards,
  });
}

/**
 * Fetch server-driven mobile config. Demo returns local defaults.
 */
export async function fetchMobileConfig(): Promise<MobileConfig> {
  if (isDemoMode()) {
    return applyPhase2Gates(DEFAULT_MOBILE_CONFIG);
  }

  try {
    const response = await http.get<{ message?: MobileConfig } | MobileConfig>(
      ERP_ANALYSIS.config.getMobileConfig
    );
    const payload =
      response && typeof response === "object" && "message" in response
        ? (response.message as MobileConfig)
        : (response as MobileConfig);

    if (!payload?.modules) {
      return applyPhase2Gates(DEFAULT_MOBILE_CONFIG);
    }

    return normalizeConfig(payload);
  } catch (error) {
    logger.warn("get_mobile_config failed, using defaults:", error);
    return applyPhase2Gates(DEFAULT_MOBILE_CONFIG);
  }
}

/**
 * Health/capability check after saving a real server URL.
 * Verifies erp_analysis is installed and reachable.
 */
export async function checkErpAnalysisHealth(baseUrl: string): Promise<{
  ok: boolean;
  message: string;
  version?: string;
}> {
  const { resolveServerBaseUrl } = await import("./serverUrl");
  const trimmed = resolveServerBaseUrl(baseUrl) || baseUrl.replace(/\/$/, "");
  try {
    const axios = (await import("axios")).default;
    const response = await axios.get(`${trimmed}${ERP_ANALYSIS.config.health}`, {
      timeout: 15000,
      headers: {
        Accept: "application/json",
      },
    });
    const message = response.data?.message ?? response.data;
    const ok =
      message?.ok === true ||
      message?.status === "ok" ||
      response.status === 200;
    return {
      ok: Boolean(ok),
      message:
        typeof message?.message === "string"
          ? message.message
          : ok
            ? "erp_analysis is available"
            : "erp_analysis health check failed",
      version: message?.version,
    };
  } catch (error: any) {
    const status = error?.response?.status;
    if (status === 404 || status === 417) {
      return {
        ok: false,
        message:
          "erp_analysis is not installed or health API is missing on this site. Install the erp_analysis app, then try again.",
      };
    }
    const msg = String(error?.message || "").toLowerCase();
    if (
      !error?.response &&
      (msg.includes("network") ||
        msg.includes("ssl") ||
        msg.includes("certificate") ||
        msg.includes("trust") ||
        error?.code === "ERR_NETWORK")
    ) {
      return {
        ok: false,
        message:
          `Cannot reach ${trimmed} (network/SSL). For Printechs live use https://printechs.com (erp.printechs.com is remapped automatically).`,
      };
    }
    return {
      ok: false,
      message:
        error?.message ||
        "Could not reach server. Check the URL and network connection.",
    };
  }
}
