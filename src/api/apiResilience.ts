/**
 * Multi-client BA resilience helpers.
 *
 * Sites differ (Division / Department / Territory / Brand / Warehouse).
 * Never assume Printechs-only fields or params exist — filter outbound
 * params from mobileConfig / bootstrap dimensions and soft-parse inbound payloads.
 *
 * Phase F: only logical dimension keys; strip custom_* / source_field.
 */

import { z } from "zod";
import {
  DEFAULT_MOBILE_CONFIG,
  isDimensionEnabled,
  type MobileConfig,
  type MobileDimension,
} from "./mobileConfig";
import {
  BaApiUnavailableError,
  isMissingBaMethodError,
} from "./baErrors";
import { shouldUseMockData } from "./mock";
import {
  isForbiddenPhysicalParam,
  LOGICAL_DIMENSION_PARAM_KEYS,
} from "../dimensions/logicalKeys";
import { getActiveDimensionMap } from "../dimensions/resolve";

export { isMissingBaMethodError, BaApiUnavailableError } from "./baErrors";

/** Params that are never org-dimension filters */
const ALWAYS_ALLOWED_PARAMS = new Set([
  "company",
  "limit",
  "offset",
  "months",
  "level",
  "search",
  "status",
  "priority",
  "doctype",
  "name",
  "action",
  "comment",
  "reason",
  "customer",
  "customer_name",
  "email",
  "user",
  "q",
  "search",
  "from_date",
  "to_date",
  "report_date",
  "party_csv",
  "old_days",
  "sort",
  "low_stock_threshold",
  "catalogue_id",
  "expo_token",
  "platform",
  "channel",
  "identifier",
  "otp",
  "client_id",
  "category",
  "item_group",
  "item_code",
  "period",
  "salesperson",
  "Authorization",
  "dimension", // get_dimension_values logical key
  "widget_key",
  "filters",
  "drill_depth",
  "metric",
  "show_ly",
  "view_all_sales",
]);

/** Query/body keys tied to optional org dimensions (logical keys only) */
const DIMENSION_PARAM_KEYS: Record<string, string[]> = {
  ...LOGICAL_DIMENSION_PARAM_KEYS,
};

export function getActiveMobileConfig(
  config?: MobileConfig | null
): MobileConfig {
  return config ?? DEFAULT_MOBILE_CONFIG;
}

/**
 * Drop empty values, disabled dimensions, and physical ERPNext field names.
 * Prevents `unexpected keyword argument` and multi-tenant field leaks.
 */
export function filterBaParams<T extends Record<string, unknown>>(
  params: T | undefined | null,
  config?: MobileConfig | null
): Record<string, unknown> {
  if (!params || typeof params !== "object") return {};

  const cfg = getActiveMobileConfig(config);
  const disabledKeys = new Set<string>();

  // Prefer live bootstrap dimension map when available
  let dimMap: Record<string, boolean> = {};
  try {
    dimMap = getActiveDimensionMap();
  } catch {
    dimMap = {};
  }

  const dimKeys = new Set([
    ...Object.keys(DIMENSION_PARAM_KEYS),
    ...Object.keys(dimMap),
  ]);

  for (const dim of dimKeys) {
    const enabledFromMap =
      Object.keys(dimMap).length > 0
        ? dimMap[dim] !== false &&
          (Object.prototype.hasOwnProperty.call(dimMap, dim)
            ? dimMap[dim] === true
            : true)
        : isDimensionEnabled(cfg, dim as MobileDimension);

    // If bootstrap explicitly lists dimensions and omits this key → disable
    const explicitlyOmitted =
      Object.keys(dimMap).length > 0 &&
      !Object.prototype.hasOwnProperty.call(dimMap, dim) &&
      Object.prototype.hasOwnProperty.call(DIMENSION_PARAM_KEYS, dim);

    const enabled = explicitlyOmitted ? false : enabledFromMap;

    if (!enabled) {
      const keys = DIMENSION_PARAM_KEYS[dim] || [dim];
      keys.forEach((k) => disabledKeys.add(k));
    }
  }

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;

    // Phase F — never forward physical ERPNext field names
    if (isForbiddenPhysicalParam(key)) {
      if (__DEV__) {
        console.warn(
          `[filterBaParams] Stripped physical/forbidden param "${key}"`
        );
      }
      continue;
    }

    // Never drop always-allowed keys (e.g. company, from_date) even if a
    // dimension flag is off — BA methods still need the company scope.
    if (disabledKeys.has(key) && !ALWAYS_ALLOWED_PARAMS.has(key)) continue;
    out[key] = value;
  }
  return out;
}

/**
 * Keep only explicitly allowed keys (plus always-allowed).
 * Use when an endpoint has a known tight signature.
 */
export function pickBaParams(
  params: Record<string, unknown> | undefined | null,
  allowed: string[],
  config?: MobileConfig | null
): Record<string, unknown> {
  const filtered = filterBaParams(params, config);
  const allow = new Set([...ALWAYS_ALLOWED_PARAMS, ...allowed]);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(filtered)) {
    if (allow.has(key)) out[key] = value;
  }
  return out;
}

/** Re-apply territory scope when Desk disabled the territory dimension but APIs still accept it. */
export function restoreTerritoryBaParams(
  raw: Record<string, unknown> | undefined | null,
  cleaned: Record<string, unknown>
): Record<string, unknown> {
  const source = raw || {};
  const out = { ...cleaned };
  if (
    source.territory != null &&
    source.territory !== "" &&
    out.territory == null
  ) {
    out.territory = source.territory;
  }
  if (
    source.territories != null &&
    source.territories !== "" &&
    out.territories == null
  ) {
    out.territories = source.territories;
  }
  return out;
}

/** Deep clone via JSON — avoids non-plain axios/RN values breaking render/state. */
export function plainJsonClone<T>(value: T): T {
  if (value == null) return value;
  if (typeof value !== "object") return value;
  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch {
    return value;
  }
}

/** Zod parse that never throws — returns null on failure. */
export function softParse<T>(
  schema: z.ZodType<T>,
  data: unknown,
  label: string
): T | null {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  console.warn(`⚠️ Soft-parse failed (${label}):`, result.error.issues?.[0]);
  return null;
}

/**
 * Soft-parse with partial recovery: coerce common missing arrays/objects
 * then re-parse; finally return raw data if still invalid (UI must tolerate).
 */
export function softParseOrRaw<T>(
  schema: z.ZodType<T>,
  data: unknown,
  label: string,
  coerce?: (raw: any) => any
): T | any {
  const parsed = softParse(schema, data, label);
  if (parsed) return parsed;

  if (data && typeof data === "object" && coerce) {
    try {
      const coerced = coerce(data);
      const again = softParse(schema, coerced, `${label}:coerced`);
      if (again) return again;
      return coerced;
    } catch {
      /* fall through */
    }
  }

  console.warn(`⚠️ Using raw payload for ${label} (schema mismatch)`);
  return data;
}

/** Normalize empty/missing dimension arrays so charts can hide cleanly. */
export function emptyIfDisabled<T>(
  items: T[] | null | undefined,
  config: MobileConfig | null | undefined,
  dimension: MobileDimension | string
): T[] {
  if (!isDimensionEnabled(config, dimension as MobileDimension)) return [];
  return Array.isArray(items) ? items : [];
}

export function asNumber(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function asString(value: unknown, fallback = ""): string {
  if (value == null) return fallback;
  return String(value);
}

/**
 * Frappe often returns `{ message: payload }` or `{ message: { message: payload } }`.
 * Walk nested `message` keys until we hit the real BA object.
 */
export function unwrapFrappeMessage(response: unknown): any {
  let cur: any = response;
  for (let i = 0; i < 4; i++) {
    if (
      cur &&
      typeof cur === "object" &&
      "message" in cur &&
      cur.message != null &&
      typeof cur.message === "object" &&
      !Array.isArray(cur.message)
    ) {
      cur = cur.message;
      continue;
    }
    break;
  }
  if (
    cur &&
    typeof cur === "object" &&
    cur.data &&
    typeof cur.data === "object" &&
    !Array.isArray(cur.data) &&
    (cur.data.meta ||
      cur.data.sales ||
      cur.data.rows ||
      cur.data.kpis ||
      cur.data.receivables)
  ) {
    return cur.data;
  }
  return cur;
}

/** Prefer ERPNext Company from access scope over login stub names */
export function resolveCompanyName(
  scopeCompany?: string | null,
  userCompany?: string | null,
  bootstrapCompany?: string | null
): string | undefined {
  const scope = (scopeCompany || "").trim();
  if (scope) return scope;
  const bootstrap = (bootstrapCompany || "").trim();
  if (bootstrap) return bootstrap;
  const user = (userCompany || "").trim();
  if (user) return user;
  return undefined;
}

const missingMethodLogged = new Set<string>();
/** Session cache — once a BA method 417s, skip live calls until app restart. */
const missingBaMethods = new Set<string>();

export function markBaMethodMissing(methodLabel: string) {
  missingBaMethods.add(methodLabel);
}

export function isBaMethodKnownMissing(methodLabel: string): boolean {
  return missingBaMethods.has(methodLabel);
}

/**
 * Demo figures ONLY when no server URL is configured (App Store / offline demo).
 * On a live server URL, never invent sample KPIs — throw BaApiUnavailableError instead.
 */
export function demoDataOnlyWhenNoServer<T>(demo: () => T): T | undefined {
  if (shouldUseMockData()) return demo();
  return undefined;
}

export function requireBaMethodEnabled(
  methodLabel: string,
  enabled: boolean
): void {
  if (!enabled) {
    throw new BaApiUnavailableError(methodLabel);
  }
}

/**
 * Call live BA method.
 * - No server configured → `demo()`
 * - Live server + missing/disabled method → throw (no fake figures)
 */
export async function withBaDemoFallback<T>(
  methodLabel: string,
  live: () => Promise<T>,
  demo: () => T | Promise<T>
): Promise<T> {
  if (shouldUseMockData()) {
    return demo();
  }
  if (missingBaMethods.has(methodLabel)) {
    throw new BaApiUnavailableError(methodLabel);
  }
  try {
    return await live();
  } catch (error) {
    if (isMissingBaMethodError(error)) {
      missingBaMethods.add(methodLabel);
      if (!missingMethodLogged.has(methodLabel)) {
        missingMethodLogged.add(methodLabel);
        console.log(
          `ℹ️ ${methodLabel} not on this site — showing unavailable (no sample data).`
        );
      }
      throw new BaApiUnavailableError(methodLabel);
    }
    throw error;
  }
}
