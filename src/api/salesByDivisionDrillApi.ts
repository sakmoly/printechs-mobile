/**
 * Sales By → Division drill (tabSalesDashBoard).
 * Primary: erp_analysis.api.get_sales_by_division_drill
 * Alias: erp_analysis.sales.get_sales_by_division_drill
 */

import { http } from "./http";
import { useAuthStore } from "../store/auth";
import { oauthApi } from "./oauth";
import { ERP_ANALYSIS } from "./endpoints";
import {
  filterBaParams,
  isMissingBaMethodError,
  markBaMethodMissing,
  isBaMethodKnownMissing,
  restoreTerritoryBaParams,
  unwrapFrappeMessage,
} from "./apiResilience";
import type { DrillFilters } from "./dashboardWidgetData";
import type { AnalysisRow } from "./genericAnalysisTypes";
import { baTerritoryRequestParams } from "../utils/dashboardTerritory";
import {
  parseRawRowSubGroup,
  salesDrillRowMetaFromRaw,
} from "../utils/salesDrillSubGroup";

export const SALES_BY_DIVISION_DRILL_METHOD = "get_sales_by_division_drill";

const API_PATHS = [
  ERP_ANALYSIS.config.getSalesByDivisionDrill,
  ERP_ANALYSIS.sales.getSalesByDivisionDrill,
] as const;

export type SalesByDivisionDrillRequest = {
  company?: string;
  from_date?: string;
  to_date?: string;
  period?: string;
  drill_depth: number;
  filters?: DrillFilters;
  limit?: number;
  view_all_sales?: 0 | 1 | boolean;
};

export type DrillScopeCheck = {
  matches_division_wide_hitachi?: boolean;
  top_brand_net_sales?: number;
  division_wide_hitachi_reference?: number;
};

export type SalesByDivisionDrillResponse = {
  data_source?: string;
  rows?: unknown[];
  /** Server: trust rows — do not apply mobile Hitachi heuristics. */
  accept_response?: boolean;
  drill_scope_status?: string;
  is_division_wide_brand_mix?: boolean;
  scope_check?: DrillScopeCheck;
  meta?: {
    drill_depth?: number;
    dimension?: string;
    next_dimension?: string;
    drillable?: boolean;
    accept_response?: boolean;
    drill_scope_status?: string;
    is_division_wide_brand_mix?: boolean;
    scope_check?: DrillScopeCheck;
  };
};

function asRecord(v: unknown): Record<string, unknown> | undefined {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return undefined;
}

export function mapSalesByDivisionDrillRows(
  payload: SalesByDivisionDrillResponse
): AnalysisRow[] {
  const list = Array.isArray(payload.rows) ? payload.rows : [];
  const source = String(payload.data_source || "").trim();
  return list.map((raw, i) => {
    const r = asRecord(raw) || {};
    const subGroup = parseRawRowSubGroup(r);
    const itemGroup = String(
      r.item_group ?? r.itemGroup ?? r.Item_Group ?? ""
    ).trim();
    const dimensionValue = String(
      r.dimension_value ?? r.dimensionValue ?? r.key ?? subGroup ?? itemGroup ?? ""
    ).trim();
    const label = String(
      r.label ?? r.name ?? dimensionValue ?? `Row ${i + 1}`
    ).trim();
    const value = Number(
      r.total_sales ?? r.metric ?? r.net_sales ?? r.value ?? r.sales ?? 0
    );
    const gpPctRaw =
      r.gp_pct ?? r.gross_profit_percent ?? r.margin_pct ?? r.margin_percentage;
    const gpPct =
      gpPctRaw != null && Number.isFinite(Number(gpPctRaw))
        ? Number(gpPctRaw)
        : undefined;
    const changeRaw = r.change_pct ?? r.growth_pct ?? r.yoy_pct;
    const change_pct =
      changeRaw != null && Number.isFinite(Number(changeRaw))
        ? Number(changeRaw)
        : null;
    const meta = salesDrillRowMetaFromRaw(r);
    if (gpPct != null) meta.gp_pct = gpPct;
    if (source) meta.data_source = source;
    return {
      id: subGroup || dimensionValue || label || `r-${i}`,
      label,
      value: Number.isFinite(value) ? value : 0,
      change_pct,
      meta: Object.keys(meta).length ? meta : undefined,
    };
  });
}

function readScopeCheck(
  root: Record<string, unknown>,
  meta: Record<string, unknown> | undefined
): DrillScopeCheck | undefined {
  const raw =
    asRecord(root.scope_check) ?? asRecord(meta?.scope_check) ?? undefined;
  if (!raw) return undefined;
  return {
    matches_division_wide_hitachi: raw.matches_division_wide_hitachi === true,
    top_brand_net_sales:
      raw.top_brand_net_sales != null
        ? Number(raw.top_brand_net_sales)
        : undefined,
    division_wide_hitachi_reference:
      raw.division_wide_hitachi_reference != null
        ? Number(raw.division_wide_hitachi_reference)
        : undefined,
  };
}

async function postDrill(
  path: string,
  params: Record<string, unknown>
): Promise<SalesByDivisionDrillResponse> {
  const response = await http.post<unknown>(path, params, { silentError: true });
  const msg = unwrapFrappeMessage(response);
  const root = asRecord(msg) || {};
  const meta = asRecord(root.meta);
  const rows = root.rows ?? (root.message as Record<string, unknown>)?.rows;
  const acceptResponse =
    root.accept_response === true || meta?.accept_response === true;
  const drillScopeStatus = String(
    root.drill_scope_status ?? meta?.drill_scope_status ?? ""
  ).trim();
  const divisionWideMix =
    root.is_division_wide_brand_mix === true ||
    meta?.is_division_wide_brand_mix === true;
  const scopeCheck = readScopeCheck(root, meta);
  return {
    data_source: String(root.data_source || root.dataSource || "").trim(),
    rows: Array.isArray(rows) ? rows : [],
    accept_response: acceptResponse,
    drill_scope_status: drillScopeStatus || undefined,
    is_division_wide_brand_mix: divisionWideMix || undefined,
    scope_check: scopeCheck,
    meta,
  };
}

export async function fetchSalesByDivisionDrill(
  req: SalesByDivisionDrillRequest
): Promise<SalesByDivisionDrillResponse> {
  if (isBaMethodKnownMissing(SALES_BY_DIVISION_DRILL_METHOD)) {
    throw new Error(`${SALES_BY_DIVISION_DRILL_METHOD} not on server`);
  }

  const state = useAuthStore.getState();
  const cfg = state.mobileConfig;
  http.setBaseUrl(state.serverConfig.serverUrl);
  const token = await oauthApi.getValidToken();
  if (!token) throw new Error("No valid access token available");

  const territoryParams = baTerritoryRequestParams(req.filters);
  const rawParams: Record<string, unknown> = {
    company: req.company,
    from_date: req.from_date,
    to_date: req.to_date,
    period: req.period,
    drill_depth: req.drill_depth,
    limit: req.limit ?? 10,
    filters: req.filters ? JSON.stringify(req.filters) : undefined,
    ...territoryParams,
    view_all_sales: req.view_all_sales ? 1 : undefined,
  };

  const params = restoreTerritoryBaParams(
    rawParams,
    filterBaParams(rawParams, cfg)
  );

  let lastErr: unknown;
  for (const path of API_PATHS) {
    try {
      return await postDrill(path, params);
    } catch (e) {
      lastErr = e;
      if (isMissingBaMethodError(e)) continue;
      throw e;
    }
  }
  markBaMethodMissing(SALES_BY_DIVISION_DRILL_METHOD);
  throw lastErr instanceof Error
    ? lastErr
    : new Error(`${SALES_BY_DIVISION_DRILL_METHOD} not on server`);
}
