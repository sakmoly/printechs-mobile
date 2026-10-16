import type { SalesWidgetEntry } from "../screens/sales/buildSalesSections";
import type { AnalysisRow } from "../api/genericAnalysisTypes";
import {
  fetchDashboardWidgetData,
  normalizeDrillDimensionKey,
  resolveWidgetDrillPath,
  resolveWidgetResponseDimension,
  type DashboardWidgetDataResponse,
  type DrillFilters,
} from "../api/dashboardWidgetData";
import {
  fetchSalesByDivisionDrill,
  mapSalesByDivisionDrillRows,
} from "../api/salesByDivisionDrillApi";
import { isBaPermissionDeniedError } from "../api/baErrors";
import { isMissingBaMethodError } from "../api/apiResilience";
import { resolveDrillTerritoryFilters } from "./dashboardTerritory";
import {
  drillSubGroupFilterValueFromMeta,
  parseRawRowSubGroup,
  salesDrillRowMetaFromRaw,
} from "./salesDrillSubGroup";
import {
  brandDrillLooksDivisionWideLegacy,
  shouldRejectBrandDrillPayload,
} from "./salesDrillScope";

const drillMismatchLogKeys = new Set<string>();

/** Dev-only: routine drill requests stay silent; log errors and scope/data mismatches. */
function salesDrillDevLog(
  kind: "error" | "mismatch",
  message: string,
  detail?: Record<string, unknown>
): void {
  if (!__DEV__) return;
  console.warn(`[sales-drill] ${kind}: ${message}`, detail ?? {});
}

function salesDrillDevLogMismatchOnce(
  dedupeKey: string,
  message: string,
  detail?: Record<string, unknown>
): void {
  if (!__DEV__) return;
  if (drillMismatchLogKeys.has(dedupeKey)) return;
  drillMismatchLogKeys.add(dedupeKey);
  salesDrillDevLog("mismatch", message, detail);
}

function frameSubGroupFilter(frame: DivisionDrillFrame | undefined): string {
  return String(frame?.sub_group ?? frame?.item_group ?? "").trim();
}

function isCanonicalBrandSubGroupAttempt(
  stack: DivisionDrillFrame[],
  subGroupOverride?: string
): boolean {
  if (stack.length < 2) return true;
  const canonical = frameSubGroupFilter(stack[1]).toLowerCase();
  if (!canonical) return !subGroupOverride?.trim();
  const attempt = String(subGroupOverride ?? frameSubGroupFilter(stack[1]))
    .trim()
    .toLowerCase();
  return attempt === canonical;
}

export type SalesByDrillScope = {
  company?: string;
  from_date?: string;
  to_date?: string;
  period?: string;
  /** Single territory when user picked one chip; omit when All Territories. */
  territory?: string;
  /** Access Profile view list — used for drill when territory is omitted. */
  viewTerritories?: string[];
  allowViewAllSales?: boolean;
  /** All Territories chip + allow_view_all_sales */
  viewAllSalesRequest?: boolean;
};

export type DivisionDrillFrame = {
  division: string;
  /** Full ERP sub_group for filters (from row.sub_group / dimension_value). */
  sub_group?: string;
  item_group?: string;
  /** Net sales for this item group (depth-1 row) — sanity-check brand scope. */
  group_sales_total?: number;
  title: string;
  /** Filter key from BA meta/table/chart.dimension for this drill step */
  filterDimension?: string;
};

export function isDivisionSalesByEntry(entry: SalesWidgetEntry): boolean {
  const hay = `${entry.key} ${entry.label} ${entry.salesByTab || ""}`.toLowerCase();
  return /division/.test(hay);
}

export function rowsFromWidgetPayload(
  payload: DashboardWidgetDataResponse
): AnalysisRow[] {
  if (payload.table?.rows?.length) return payload.table.rows;
  if (payload.rows?.length) return payload.rows;
  const series = payload.chart?.series || [];
  if (!series.length) return [];
  return series.map((p, i) => {
    const point = p as Record<string, unknown>;
    const meta = salesDrillRowMetaFromRaw(point);
    const subGroup = parseRawRowSubGroup(point);
    const label = String(point.label || `Item ${i + 1}`).trim();
    return {
      id: subGroup || label || `s-${i}`,
      label,
      value: Number(point.value) || 0,
      change_pct: (point.change_pct as number | null | undefined) ?? null,
      meta: Object.keys(meta).length ? meta : undefined,
    };
  });
}

/** Full tabSalesDashBoard sub_group — never the short breadcrumb title alone. */
export function drillSubGroupFilterValue(row: AnalysisRow): string {
  const fromMeta = drillSubGroupFilterValueFromMeta(row.meta);
  if (fromMeta) return fromMeta;
  const id = String(row.id || "").trim();
  const label = String(row.label || "").trim();
  if (id && label && id.toLowerCase() !== label.toLowerCase()) return id;
  return id || label;
}

/** Filter value for drill taps — alias of {@link drillSubGroupFilterValue}. */
export function drillRowFilterValue(row: AnalysisRow): string {
  return drillSubGroupFilterValue(row);
}

function divisionFilterAlternatives(frame: DivisionDrillFrame): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (v: string | undefined) => {
    const t = String(v || "").trim();
    if (!t || seen.has(t.toLowerCase())) return;
    seen.add(t.toLowerCase());
    out.push(t);
  };
  add(frame.division);
  add(frame.title);
  return out;
}

/** Drill APIs often ignore `view_all_sales`; use Access Profile territory list instead. */
function viewTerritoryDrillScope(scope: SalesByDrillScope): SalesByDrillScope {
  return {
    ...scope,
    viewAllSalesRequest: false,
    allowViewAllSales: false,
  };
}

export const DEFAULT_DIVISION_DRILL_PATH = ["division", "sub_group", "brand"];

/** @deprecated Use shouldRejectBrandDrillPayload / brandDrillLooksDivisionWideLegacy */
export function brandDrillLooksUnscoped(rows: AnalysisRow[]): boolean {
  return brandDrillLooksDivisionWideLegacy(rows);
}

/** Collapse duplicate consecutive steps (e.g. sub_group twice) so item group is only drilled once. */
export function normalizeDrillPath(path: string[]): string[] {
  const out: string[] = [];
  for (const raw of path) {
    const d = normalizeDrillDimensionKey(String(raw || "")) || String(raw || "").trim();
    if (!d) continue;
    const prev = out.length ? out[out.length - 1] : "";
    if (prev && prev.toLowerCase() === d.toLowerCase()) continue;
    out.push(d);
  }
  return out.length ? out : [...DEFAULT_DIVISION_DRILL_PATH];
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value == null) return undefined;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return undefined;
    }
    return undefined;
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

export function resolveDivisionDrillPath(entry: SalesWidgetEntry): string[] {
  const meta = asRecord(entry.payload.meta);
  const metaPath = meta?.drill_path;
  if (Array.isArray(metaPath) && metaPath.length) {
    const path = metaPath.map(String).filter(Boolean);
    if (path.length) return normalizeDrillPath(path);
  }
  const fromConfig = resolveWidgetDrillPath(asRecord(entry.payload.config));
  if (fromConfig.length) return normalizeDrillPath(fromConfig);
  return [...DEFAULT_DIVISION_DRILL_PATH];
}

/** True when the user can tap a row to go one level deeper. */
export function canDrillDeeper(
  stackDepth: number,
  drillPath: string[] = DEFAULT_DIVISION_DRILL_PATH
): boolean {
  const path = normalizeDrillPath(drillPath);
  return stackDepth < path.length - 1;
}

/** Dimension param for get_dashboard_widget_data at this stack depth. */
export function drillFetchDimension(
  stackDepth: number,
  drillPath: string[] = DEFAULT_DIVISION_DRILL_PATH
): string {
  const path = normalizeDrillPath(drillPath);
  return path[stackDepth] || path[path.length - 1] || "division";
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Shorter row titles when division (or item group) is already in the breadcrumb.
 * Drill taps still use the raw API label for filters.
 */
export function displaySalesDrillRowLabel(
  raw: string,
  stack: DivisionDrillFrame[]
): string {
  const label = String(raw || "").trim();
  if (!label || stack.length === 0) return label;

  let s = label;
  const stripContextWord = (context: string) => {
    const word = escapeRegExp(context.trim());
    if (!word) return;
    s = s.replace(new RegExp(`(\\s*-\\s*)${word}\\s+`, "i"), "$1");
    s = s.replace(new RegExp(`\\b${word}\\b`, "gi"), "");
  };

  const division = stack[0]?.division;
  if (division) stripContextWord(division);

  if (stack.length >= 2 && stack[1]?.item_group) {
    stripContextWord(stack[1].item_group);
  }

  s = s
    .replace(/\s+/g, " ")
    .replace(/\s*-\s*-\s*/g, " - ")
    .replace(/^\s*-\s*/, "")
    .trim();
  return s || label;
}

/** Prefer ERP code prefix (e.g. "IC - …") for the avatar initials. */
export function drillRowAvatarInitials(raw: string, display: string): string {
  const m = String(raw || "").match(/^([A-Za-z0-9]{2,5})\s*-/);
  if (m) return m[1].toUpperCase();
  const parts = String(display || "")
    .trim()
    .split(/\s+/)
    .filter((p) => p && p !== "-");
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
}

/** One ERP key per step — BA expects sub_group OR item_group, not both. */
function applyDrillDimensionFilter(
  filters: DrillFilters,
  dim: string,
  value: string
) {
  const v = String(value || "").trim();
  if (!v) return;
  const d = normalizeDrillDimensionKey(dim) || "sub_group";
  if (d === "brand") {
    filters.brand = [v];
    return;
  }
  if (d === "item_group") {
    filters.item_group = [v];
    return;
  }
  if (d === "division") {
    filters.division = [v];
    return;
  }
  filters.sub_group = [v];
}

function drillFilters(
  stack: DivisionDrillFrame[],
  drillPath: string[] = DEFAULT_DIVISION_DRILL_PATH,
  divisionOverride?: string,
  subGroupOverride?: string
): DrillFilters | undefined {
  const filters: DrillFilters = {};
  stack.forEach((frame, i) => {
    if (i === 0) {
      const div = String(divisionOverride || frame.division || "").trim();
      if (div) filters.division = [div];
      return;
    }
    const value =
      i === 1 && subGroupOverride
        ? subGroupOverride
        : frameSubGroupFilter(frame);
    // Widget drill (BA): logical key sub_group only — never duplicate item_group.
    if (value) filters.sub_group = [String(value).trim()];
  });
  return Object.keys(filters).length ? filters : undefined;
}

/** BA contract: drill_crumbs alongside filters.division on widget drill. */
export function buildDrillCrumbsJson(stack: DivisionDrillFrame[]): string | undefined {
  if (!stack.length) return undefined;
  const crumbs = stack.map((frame, i) => {
    const dimension =
      i === 0
        ? "division"
        : normalizeDrillDimensionKey(frame.filterDimension) || "sub_group";
    const value =
      i === 0
        ? frame.division
        : frameSubGroupFilter(frame) || String(frame.title || "").trim();
    return {
      dimension,
      value,
      label: frame.title || value,
    };
  });
  return JSON.stringify(crumbs);
}

const drillInflight = new Map<string, Promise<AnalysisRow[]>>();

type DrillOnceOpts = {
  divisionOverride?: string;
  subGroupOverride?: string;
  /** BA request territory / view_all_sales (may differ from UI scope). */
  requestScope?: SalesByDrillScope;
  /** Disk/in-memory drill cache key scope (always UI scope). */
  cacheScope?: SalesByDrillScope;
};

function cacheDrillFetchResult(
  widgetKey: string,
  stack: DivisionDrillFrame[],
  cacheScope: SalesByDrillScope,
  drillPath: string[],
  rows: AnalysisRow[],
  responseDimension?: string,
  nextDimension?: string
): void {
  const cacheKey = salesDrillCacheKey(widgetKey, stack, cacheScope, drillPath);
  if (nextDimension) {
    const nd = normalizeDrillDimensionKey(nextDimension);
    if (nd) drillNextDimensionCache.set(cacheKey, nd);
  } else if (rows.length) {
    drillNextDimensionCache.delete(cacheKey);
  }
  if (rows.length) {
    writeCachedDivisionDrillRows(
      widgetKey,
      stack,
      cacheScope,
      rows,
      drillPath,
      responseDimension
    );
  }
}

async function fetchSalesDashboardDrillOnce(
  widgetKey: string,
  stack: DivisionDrillFrame[],
  scope: SalesByDrillScope,
  drillPath: string[],
  opts?: DrillOnceOpts
): Promise<AnalysisRow[]> {
  const requestScope = opts?.requestScope ?? scope;
  const cacheScope = opts?.cacheScope ?? scope;
  const filters = mergeTerritoryFilters(
    drillFilters(
      stack,
      drillPath,
      opts?.divisionOverride,
      opts?.subGroupOverride
    ),
    requestScope
  );
  const drill_depth = stack.length;
  const payload = await fetchSalesByDivisionDrill({
    company: requestScope.company,
    from_date: requestScope.from_date,
    to_date: requestScope.to_date,
    period: requestScope.period,
    drill_depth,
    filters,
    limit: 10,
    view_all_sales: requestScope.viewAllSalesRequest ? 1 : undefined,
  });
  const source = String(payload.data_source || "").trim();
  if (source && source !== "SalesDashBoard") {
    salesDrillDevLog("mismatch", "unexpected data_source", {
      data_source: source,
      drill_depth,
      filters,
    });
  }
  let rows = mapSalesByDivisionDrillRows(payload);
  if (
    drill_depth >= 2 &&
    shouldRejectBrandDrillPayload(payload, rows, { legacyHeuristic: true })
  ) {
    if (isCanonicalBrandSubGroupAttempt(stack, opts?.subGroupOverride)) {
      const dedupeKey = JSON.stringify({
        filters,
        reject: true,
        division_wide: payload.is_division_wide_brand_mix,
      });
      salesDrillDevLogMismatchOnce(
        dedupeKey,
        "rejected division-wide brand drill (SalesDashBoard)",
        {
          filters,
          sub_group: filters?.sub_group,
          territory: filters?.territory,
          accept_response: payload.accept_response,
          drill_scope_status: payload.drill_scope_status,
          scope_check: payload.scope_check,
          sample: rows.slice(0, 2).map((r) => ({
            label: r.label,
            value: r.value,
          })),
        }
      );
    }
    rows = [];
  }
  const responseDimension =
    payload.meta?.dimension != null
      ? String(payload.meta.dimension)
      : drillFetchDimension(drill_depth, drillPath);
  cacheDrillFetchResult(
    widgetKey,
    stack,
    cacheScope,
    drillPath,
    rows,
    responseDimension,
    payload.meta?.next_dimension != null
      ? String(payload.meta.next_dimension)
      : undefined
  );
  return rows;
}

async function fetchDivisionDrillWidgetOnce(
  widgetKey: string,
  stack: DivisionDrillFrame[],
  scope: SalesByDrillScope,
  drillPath: string[],
  opts?: DrillOnceOpts
): Promise<AnalysisRow[]> {
  const requestScope = opts?.requestScope ?? scope;
  const cacheScope = opts?.cacheScope ?? scope;
  const filters = mergeTerritoryFilters(
    drillFilters(
      stack,
      drillPath,
      opts?.divisionOverride,
      opts?.subGroupOverride
    ),
    requestScope
  );
  const dimension = drillFetchDimension(stack.length, drillPath);
  const drillCrumbs = buildDrillCrumbsJson(stack);
  const payload = await fetchDashboardWidgetData({
    widget_key: widgetKey,
    company: requestScope.company,
    from_date: requestScope.from_date,
    to_date: requestScope.to_date,
    period: requestScope.period,
    filters,
    drill_depth: stack.length,
    dimension,
    drill_crumbs: drillCrumbs,
    limit: 10,
    show_ly: false,
    view_all_sales: requestScope.viewAllSalesRequest ? 1 : undefined,
  });
  let rows = rowsFromWidgetPayload(payload);
  if (
    stack.length >= 2 &&
    brandDrillLooksDivisionWideLegacy(rows)
  ) {
    if (isCanonicalBrandSubGroupAttempt(stack, opts?.subGroupOverride)) {
      salesDrillDevLogMismatchOnce(
        JSON.stringify({ widget: widgetKey, filters }),
        "rejected division-wide brand drill (widget fallback)",
        {
          widget_key: widgetKey,
          drill_depth: stack.length,
          filters,
          sample: rows.slice(0, 2).map((r) => ({
            label: r.label,
            value: r.value,
          })),
        }
      );
    }
    rows = [];
  }
  const responseDimension = resolveWidgetResponseDimension(payload);
  cacheDrillFetchResult(
    widgetKey,
    stack,
    cacheScope,
    drillPath,
    rows,
    responseDimension,
    payload.meta?.next_dimension != null
      ? String(payload.meta.next_dimension)
      : undefined
  );
  return rows;
}

async function fetchDivisionDrillOnce(
  widgetKey: string,
  stack: DivisionDrillFrame[],
  scope: SalesByDrillScope,
  drillPath: string[],
  opts?: DrillOnceOpts
): Promise<AnalysisRow[]> {
  try {
    const rows = await fetchSalesDashboardDrillOnce(
      widgetKey,
      stack,
      scope,
      drillPath,
      opts
    );
    if (rows.length) return rows;
    if (stack.length >= 2) return [];
  } catch (apiErr) {
    if (!isMissingBaMethodError(apiErr)) {
      const msg = apiErr instanceof Error ? apiErr.message : String(apiErr);
      if (!/not on server/i.test(msg)) throw apiErr;
    }
    salesDrillDevLog("error", "get_sales_by_division_drill unavailable — using widget fallback");
  }
  return fetchDivisionDrillWidgetOnce(
    widgetKey,
    stack,
    scope,
    drillPath,
    opts
  );
}

async function fetchItemGroupDrillRows(
  widgetKey: string,
  stack: DivisionDrillFrame[],
  scope: SalesByDrillScope,
  drillPath: string[]
): Promise<AnalysisRow[]> {
  const frame = stack[0];
  if (!frame) return [];

  let rows = await fetchDivisionDrillOnce(widgetKey, stack, scope, drillPath);
  if (rows.length) return rows;

  if (
    frame.title?.trim() &&
    frame.title.trim().toLowerCase() !== frame.division.trim().toLowerCase()
  ) {
    rows = await fetchDivisionDrillOnce(widgetKey, stack, scope, drillPath, {
      divisionOverride: frame.title.trim(),
    });
    if (rows.length) return rows;
  }

  for (const alt of divisionFilterAlternatives(frame)) {
    if (alt.toLowerCase() === frame.division.trim().toLowerCase()) continue;
    rows = await fetchDivisionDrillOnce(widgetKey, stack, scope, drillPath, {
      divisionOverride: alt,
    });
    if (rows.length) return rows;
  }

  const allTerritories =
    !scope.territory?.trim() &&
    (scope.viewAllSalesRequest || scope.allowViewAllSales);
  if (allTerritories && (scope.viewTerritories?.length ?? 0) > 0) {
    const viewScoped = viewTerritoryDrillScope(scope);
    rows = await fetchDivisionDrillOnce(widgetKey, stack, scope, drillPath, {
      requestScope: viewScoped,
    });
    if (rows.length) return rows;

    for (const alt of divisionFilterAlternatives(frame)) {
      if (alt.toLowerCase() === frame.division.trim().toLowerCase()) continue;
      rows = await fetchDivisionDrillOnce(widgetKey, stack, scope, drillPath, {
        divisionOverride: alt,
        requestScope: viewScoped,
      });
      if (rows.length) return rows;
    }
  }

  return [];
}

async function fetchBrandDrillRows(
  widgetKey: string,
  stack: DivisionDrillFrame[],
  scope: SalesByDrillScope,
  drillPath: string[]
): Promise<AnalysisRow[]> {
  const frame = stack[1];
  if (!frame) return [];

  const tried = new Set<string>();
  const trySubGroup = async (subGroup: string): Promise<AnalysisRow[]> => {
    const key = subGroup.trim().toLowerCase();
    if (!key || tried.has(key)) return [];
    tried.add(key);
    const rows = await fetchDivisionDrillOnce(
      widgetKey,
      stack,
      scope,
      drillPath,
      { subGroupOverride: subGroup.trim() }
    );
    if (!rows.length) return [];
    if (brandDrillLooksDivisionWideLegacy(rows)) {
      return [];
    }
    return rows;
  };

  const primary = frameSubGroupFilter(frame);
  if (primary) {
    return trySubGroup(primary);
  }
  return [];
}

export function salesDrillCacheKey(
  widgetKey: string,
  stack: DivisionDrillFrame[],
  scope: SalesByDrillScope,
  drillPath: string[] = DEFAULT_DIVISION_DRILL_PATH
): string {
  return JSON.stringify({
    widgetKey,
    stack,
    drillPath,
    dimension: drillFetchDimension(stack.length, drillPath),
    company: scope.company,
    from_date: scope.from_date,
    to_date: scope.to_date,
    period: scope.period,
    territory: scope.territory || "",
    viewTerritories: (scope.viewTerritories || []).slice().sort().join("|"),
    allowViewAllSales: scope.allowViewAllSales ? 1 : 0,
    viewAllSalesRequest: scope.viewAllSalesRequest ? 1 : 0,
  });
}

const drillRowsCache = new Map<string, AnalysisRow[]>();
/** Response dimension for the list at this stack depth (meta/table/chart.dimension). */
const drillResponseDimensionCache = new Map<string, string>();
const drillNextDimensionCache = new Map<string, string>();

export function readDrillListDimension(
  widgetKey: string,
  stack: DivisionDrillFrame[],
  scope: SalesByDrillScope,
  drillPath: string[] = DEFAULT_DIVISION_DRILL_PATH
): string | undefined {
  const hit = drillResponseDimensionCache.get(
    salesDrillCacheKey(widgetKey, stack, scope, drillPath)
  );
  return hit ? normalizeDrillDimensionKey(hit) || hit : undefined;
}

export function readDrillNextDimension(
  widgetKey: string,
  stack: DivisionDrillFrame[],
  scope: SalesByDrillScope,
  drillPath: string[] = DEFAULT_DIVISION_DRILL_PATH
): string | undefined {
  const hit = drillNextDimensionCache.get(
    salesDrillCacheKey(widgetKey, stack, scope, drillPath)
  );
  return hit ? normalizeDrillDimensionKey(hit) || hit : undefined;
}

/** Whether rows at this stack depth should show a drill chevron. */
export function canDrillSalesByRow(
  stackDepth: number,
  widgetKey: string,
  stack: DivisionDrillFrame[],
  scope: SalesByDrillScope | undefined,
  drillPath: string[] = DEFAULT_DIVISION_DRILL_PATH
): boolean {
  if (!canDrillDeeper(stackDepth, drillPath)) return false;
  if (!scope?.company || !widgetKey) return canDrillDeeper(stackDepth, drillPath);

  const currentDim = drillFetchDimension(stackDepth, drillPath);
  const nextDim = readDrillNextDimension(widgetKey, stack, scope, drillPath);
  if (nextDim) {
    if (nextDim.toLowerCase() === currentDim.toLowerCase()) return false;
    const path = normalizeDrillPath(drillPath);
    const nextIdx = path.findIndex(
      (d) => d.toLowerCase() === nextDim.toLowerCase()
    );
    if (nextIdx >= 0 && nextIdx <= stackDepth) return false;
  }
  return true;
}

export function readCachedDivisionDrillRows(
  widgetKey: string,
  stack: DivisionDrillFrame[],
  scope: SalesByDrillScope,
  drillPath?: string[]
): AnalysisRow[] | undefined {
  const hit = drillRowsCache.get(
    salesDrillCacheKey(widgetKey, stack, scope, drillPath)
  );
  if (!hit?.length) return undefined;
  if (
    stack.length >= 2 &&
    drillFetchDimension(stack.length, drillPath || DEFAULT_DIVISION_DRILL_PATH) ===
      "brand" &&
    brandDrillLooksDivisionWideLegacy(hit)
  ) {
    drillRowsCache.delete(
      salesDrillCacheKey(widgetKey, stack, scope, drillPath)
    );
    return undefined;
  }
  return hit;
}

export function writeCachedDivisionDrillRows(
  widgetKey: string,
  stack: DivisionDrillFrame[],
  scope: SalesByDrillScope,
  rows: AnalysisRow[],
  drillPath?: string[],
  responseDimension?: string
): void {
  const path = drillPath || DEFAULT_DIVISION_DRILL_PATH;
  if (
    stack.length >= 2 &&
    drillFetchDimension(stack.length, path) === "brand" &&
    brandDrillLooksDivisionWideLegacy(rows)
  ) {
    return;
  }
  const key = salesDrillCacheKey(widgetKey, stack, scope, drillPath);
  drillRowsCache.set(key, rows);
  const dim = normalizeDrillDimensionKey(responseDimension);
  if (dim) drillResponseDimensionCache.set(key, dim);
}

export function clearDivisionDrillCache(): void {
  drillRowsCache.clear();
  drillResponseDimensionCache.clear();
  drillNextDimensionCache.clear();
  drillMismatchLogKeys.clear();
}

function mergeTerritoryFilters(
  drill: DrillFilters | undefined,
  scope: SalesByDrillScope
): DrillFilters | undefined {
  const t = resolveDrillTerritoryFilters(
    scope.territory,
    scope.viewTerritories,
    scope.allowViewAllSales
  );
  if (!t?.territory?.length) return drill;
  return { ...(drill || {}), territory: t.territory };
}

export function divisionDrillEmptyMessage(
  stackDepth: number,
  scope?: SalesByDrillScope
): string {
  if (stackDepth >= 2) {
    return "No brands for this item group with the current filters.";
  }
  const allTerritoriesChip =
    !scope?.territory?.trim() &&
    (scope?.allowViewAllSales ||
      (scope?.viewTerritories?.length ?? 0) > 1);
  if (allTerritoriesChip) {
    return "No item groups for this division. Try one territory in the filter bar. If it still fails, BA must enable drill_depth=1 (sub_group) on sales_by_division for All Territories / view_all_sales.";
  }
  return "No item groups for this division with the current filters.";
}

export function formatSalesDrillError(err: unknown): string {
  if (isBaPermissionDeniedError(err)) {
    return "You don’t have permission to load this breakdown. Ask your admin to allow sales drill on your Access Profile.";
  }
  const status = (err as { response?: { status?: number } })?.response?.status;
  if (status === 403) {
    return "Access denied for this drill level. Ask your admin to allow sales division drill on your Access Profile.";
  }
  if (status === 417 || status === 404) {
    return "Sales drill API is not available on this site yet. Contact your BA team.";
  }
  const msg = err instanceof Error ? err.message : String(err || "");
  if (/403|forbidden|permission/i.test(msg)) {
    return "Access denied for this drill level.";
  }
  if (/timeout/i.test(msg)) {
    return "Request timed out. Try again or use a shorter date range.";
  }
  return msg || "Failed to load breakdown";
}

/** Sales By division drill — get_sales_by_division_drill (tabSalesDashBoard); widget fallback only if API missing. */
export async function fetchDivisionDrillRows(
  widgetKey: string,
  stack: DivisionDrillFrame[],
  scope: SalesByDrillScope,
  drillPath: string[] = DEFAULT_DIVISION_DRILL_PATH
): Promise<AnalysisRow[]> {
  const dimension = drillFetchDimension(stack.length, drillPath);

  const cached = readCachedDivisionDrillRows(
    widgetKey,
    stack,
    scope,
    drillPath
  );
  if (cached !== undefined) return cached;

  const inflightKey = salesDrillCacheKey(widgetKey, stack, scope, drillPath);
  const pending = drillInflight.get(inflightKey);
  if (pending) return pending;

  const run = (async (): Promise<AnalysisRow[]> => {
    try {
      const rows =
        stack.length === 1
          ? await fetchItemGroupDrillRows(widgetKey, stack, scope, drillPath)
          : stack.length >= 2 && dimension === "brand"
            ? await fetchBrandDrillRows(widgetKey, stack, scope, drillPath)
            : await fetchDivisionDrillOnce(widgetKey, stack, scope, drillPath);
      return rows;
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response
        ?.status;
      if (status !== 403 && !isBaPermissionDeniedError(err)) {
        salesDrillDevLog("error", "drill fetch failed", {
          depth: stack.length,
          dimension,
          status,
          message: err instanceof Error ? err.message : String(err),
        });
      }
      if (status === 403 || isBaPermissionDeniedError(err)) {
        const e = new Error(
          "Drill-down is not allowed on the server (403). Sales By division drill requires get_sales_by_division_drill or sales_by_division widget drill."
        );
        (e as Error & { cause?: unknown }).cause = err;
        throw e;
      }
      throw err;
    }
  })();

  drillInflight.set(inflightKey, run);
  try {
    return await run;
  } finally {
    drillInflight.delete(inflightKey);
  }
}
