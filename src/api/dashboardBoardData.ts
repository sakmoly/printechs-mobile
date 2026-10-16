/**
 * Batch dashboard board data (v1).
 * One call for all widgets on a board — replaces N× get_dashboard_widget_data on Home.
 * Drill-down still uses get_dashboard_widget_data.
 */

import { http } from "./http";
import { useAuthStore } from "../store/auth";
import { oauthApi } from "./oauth";
import { ERP_ANALYSIS } from "./endpoints";
import { isApiEnabled } from "./mobileConfig";
import {
  pickBaParams,
  restoreTerritoryBaParams,
  isMissingBaMethodError,
  resolveCompanyName,
  markBaMethodMissing,
  isBaMethodKnownMissing,
} from "./apiResilience";
import { logger } from "../utils/logger";
import { shouldUseMockData } from "./mock";
import {
  extractFrappeErrorMessage,
  isBaPermissionDeniedError,
} from "./baErrors";
import {
  normalizeDashboardWidgetPayload,
  type DashboardWidgetDataResponse,
  type DrillFilters,
} from "./dashboardWidgetData";
import {
  getActiveSessionUserKey,
  writeCachedBoard,
  readCachedBoard,
  boardPayloadHasWidgets,
  boardPayloadLooksUseful,
} from "./sessionCache";
import { isNetworkOrTlsError } from "./serverUrl";
import { baTerritoryRequestParams } from "../utils/dashboardTerritory";

const METHOD = "get_dashboard_board_data";
/** Batch board queries can be slow on live ERP — allow longer before failing. */
const BOARD_BATCH_TIMEOUT_MS = 90_000;
const BOARD_NETWORK_RETRIES = 2;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type DashboardBoardDataRequest = {
  dashboard_id: string;
  company?: string;
  from_date?: string;
  to_date?: string;
  period?: string;
  /** Logical dimension filters e.g. { territory: ["Jeddah"] } */
  filters?: DrillFilters;
  /** Pull-to-refresh: bypass server cache */
  refresh?: 0 | 1 | boolean;
  /** All Territories + allow_view_all_sales — request company-wide sales (not view_territories only) */
  view_all_sales?: 0 | 1 | boolean;
  /** Forward “Last Year” compare to BA (must apply to every widget in the batch). */
  show_ly?: boolean;
};

export function dashboardBoardQueryKey(
  req: Pick<
    DashboardBoardDataRequest,
    | "dashboard_id"
    | "company"
    | "from_date"
    | "to_date"
    | "period"
    | "filters"
    | "view_all_sales"
    | "show_ly"
  >
) {
  const territory =
    req.filters?.territory?.length === 1
      ? String(req.filters.territory[0])
      : req.filters?.territory?.length
        ? [...req.filters.territory].sort().join(",")
        : "";
  return [
    "dashboard-board-data",
    req.dashboard_id,
    req.company || "",
    req.from_date || "",
    req.to_date || "",
    req.period || "",
    territory,
    req.view_all_sales ? 1 : 0,
    req.show_ly === false ? 0 : 1,
  ] as const;
}

export type DashboardBoardDataResponse = {
  dashboard_id: string;
  widgets: Record<string, DashboardWidgetDataResponse>;
  currency?: string;
  meta?: Record<string, unknown>;
};

/** Resolve widget payload when layout keys may have __n suffixes. */
export function lookupBoardWidget(
  widgets: Record<string, DashboardWidgetDataResponse> | undefined | null,
  widgetKey: string
): DashboardWidgetDataResponse | undefined {
  if (!widgets || !widgetKey) return undefined;
  if (widgets[widgetKey]) return widgets[widgetKey];
  const base = String(widgetKey).replace(/__\d+$/i, "");
  if (base !== widgetKey && widgets[base]) return widgets[base];
  const lower = widgetKey.toLowerCase();
  const baseLower = base.toLowerCase();
  for (const [k, v] of Object.entries(widgets)) {
    const kl = k.toLowerCase();
    if (kl === lower || kl === baseLower || kl.replace(/__\d+$/i, "") === baseLower) {
      return v;
    }
  }
  return undefined;
}

function unwrapBoardMessage(raw: unknown): any {
  const root = (raw as any)?.message ?? raw ?? {};
  if (root.board && typeof root.board === "object") {
    return { ...root, ...root.board };
  }
  return root;
}

function normalizeBoardPayload(
  raw: unknown,
  req: DashboardBoardDataRequest
): DashboardBoardDataResponse {
  const root = unwrapBoardMessage(raw);
  const widgetsRaw =
    (root.widgets && typeof root.widgets === "object" && !Array.isArray(root.widgets)
      ? root.widgets
      : null) ||
    (Array.isArray(root.widgets)
      ? Object.fromEntries(
          root.widgets.map((w: any, i: number) => [
            String(w?.widget_key || w?.key || `widget_${i}`),
            w,
          ])
        )
      : {}) ||
    {};

  const widgets: Record<string, DashboardWidgetDataResponse> = {};
  for (const [key, entry] of Object.entries(widgetsRaw)) {
    try {
      widgets[key] = normalizeDashboardWidgetPayload(entry, {
        widget_key: key,
        company: req.company,
        from_date: req.from_date,
        to_date: req.to_date,
        period: req.period,
        show_ly: req.show_ly !== false,
      });
    } catch (e) {
      if (__DEV__) {
        console.warn("[board-data] failed to normalize widget", key, e);
      }
    }
  }

  return {
    dashboard_id: String(
      root.dashboard_id || root.key || req.dashboard_id || "home"
    ),
    widgets,
    currency: root.currency || root.meta?.currency,
    meta: typeof root.meta === "object" ? root.meta : undefined,
  };
}

/**
 * Fetch all widget payloads for one dashboard board.
 * Throws BaApiUnavailableError / marks missing when method is not installed.
 */
export async function fetchDashboardBoardData(
  req: DashboardBoardDataRequest
): Promise<DashboardBoardDataResponse> {
  if (shouldUseMockData()) {
    return { dashboard_id: req.dashboard_id || "home", widgets: {} };
  }

  const state = useAuthStore.getState();
  const cfg = state.mobileConfig;
  const serverUrl = state.serverConfig.serverUrl;
  http.setBaseUrl(serverUrl);
  const token = await oauthApi.getValidToken();
  if (!token) throw new Error("No valid access token available");

  const company =
    req.company ||
    resolveCompanyName(state.permissions.scope?.company, state.user?.company);

  if (isBaMethodKnownMissing(METHOD) || !isApiEnabled(cfg, METHOD)) {
    const err = new Error(`${METHOD} is not available on this server yet.`);
    (err as any).baMissing = true;
    throw err;
  }

  const territoryFilter = req.filters?.territory?.[0];
  const territoryParams = baTerritoryRequestParams(req.filters);

  const rawParams = {
    dashboard_id: req.dashboard_id || "home",
    company,
    from_date: req.from_date,
    to_date: req.to_date,
    period: req.period,
    refresh: req.refresh ? 1 : undefined,
    filters: req.filters ? JSON.stringify(req.filters) : undefined,
    view_all_sales: req.view_all_sales ? 1 : undefined,
    show_ly: req.show_ly === false ? 0 : req.show_ly ? 1 : undefined,
    ...territoryParams,
  };

  const params = restoreTerritoryBaParams(
    rawParams,
    pickBaParams(
      rawParams,
      [
        "dashboard_id",
        "company",
        "from_date",
        "to_date",
        "period",
        "refresh",
        "filters",
        "territory",
        "territories",
        "view_all_sales",
        "show_ly",
      ],
      cfg
    )
  );

  const callBoardApi = async (
    p: Record<string, unknown>,
    attempt = 0
  ): Promise<unknown> => {
    const reqConfig = {
      timeout: BOARD_BATCH_TIMEOUT_MS,
      // Cache/offline fallback handles failures — avoid red ERROR noise in console
      silentError: true,
    };
    try {
      return await http.post<unknown>(
        ERP_ANALYSIS.config.getDashboardBoardData,
        p,
        reqConfig
      );
    } catch (postErr) {
      const st = (postErr as any)?.response?.status;
      if (st === 401 || st === 403) {
        throw postErr;
      }
      if (
        isNetworkOrTlsError(postErr) &&
        attempt < BOARD_NETWORK_RETRIES
      ) {
        await sleep(750 * (attempt + 1));
        return callBoardApi(p, attempt + 1);
      }
      if (isNetworkOrTlsError(postErr)) {
        try {
          return await http.get<unknown>(
            ERP_ANALYSIS.config.getDashboardBoardData,
            p,
            { silentError: true, timeout: BOARD_BATCH_TIMEOUT_MS }
          );
        } catch {
          throw postErr;
        }
      }
      if (st === 500 || st === 404 || st === 417) {
        return await http.get<unknown>(
          ERP_ANALYSIS.config.getDashboardBoardData,
          p,
          { silentError: true, timeout: BOARD_BATCH_TIMEOUT_MS }
        );
      }
      try {
        return await http.get<unknown>(
          ERP_ANALYSIS.config.getDashboardBoardData,
          p,
          { silentError: true, timeout: BOARD_BATCH_TIMEOUT_MS }
        );
      } catch {
        throw postErr;
      }
    }
  };

  try {
    const response = await callBoardApi(params);
    const normalized = normalizeBoardPayload(response, { ...req, company });
    if (__DEV__) {
      const rawRoot = unwrapBoardMessage(response);
      const rawWidgets = rawRoot?.widgets;
      const rawKeys = Array.isArray(rawWidgets)
        ? rawWidgets.map(
            (w: any, i: number) =>
              String(w?.widget_key || w?.key || `widget_${i}`)
          )
        : rawWidgets && typeof rawWidgets === "object"
          ? Object.keys(rawWidgets)
          : [];
      logger.debug("[board-data]", {
        dashboard_id: normalized.dashboard_id,
        keys: Object.keys(normalized.widgets),
        raw_keys: rawKeys,
        raw_error: rawRoot?.exc_type || rawRoot?.error || rawRoot?._error || null,
        company: company || null,
        period: req.period || null,
        refresh: Boolean(req.refresh),
      });
      if (!rawKeys.length) {
        logger.warn(
          `[board-data] empty widgets for "${req.dashboard_id}" — check Mobile App Profile / data sources on server`
        );
      }
    }
    const userKey = getActiveSessionUserKey();
    if (userKey && Object.keys(normalized.widgets || {}).length > 0) {
      void writeCachedBoard({
        userKey,
        dashboardId: normalized.dashboard_id || req.dashboard_id || "home",
        company,
        from_date: req.from_date,
        to_date: req.to_date,
        period: req.period,
        territory: territoryFilter ? String(territoryFilter) : undefined,
        data: normalized,
      });
    }
    return normalized;
  } catch (error) {
    if (isBaPermissionDeniedError(error)) {
      const msg =
        extractFrappeErrorMessage(error) ||
        "This board is not enabled for your mobile profile";
      logger.warn(`[board-data] ${req.dashboard_id}: ${msg}`);
      return {
        dashboard_id: req.dashboard_id || "home",
        widgets: {},
        meta: { permission_denied: true, error: msg },
      };
    }
    if (isNetworkOrTlsError(error)) {
      const userKey = getActiveSessionUserKey();
      if (userKey && company) {
        const cached = await readCachedBoard({
          userKey,
          dashboardId: req.dashboard_id || "home",
          company,
          from_date: req.from_date,
          to_date: req.to_date,
          period: req.period,
          territory: territoryFilter ? String(territoryFilter) : undefined,
        });
        if (cached && boardPayloadHasWidgets(cached.data)) {
          logger.info(
            `[board-data] ${req.dashboard_id}: offline — using cached board (${Object.keys(cached.data.widgets || {}).length} widgets)`
          );
          return {
            ...cached.data,
            meta: {
              ...(cached.data.meta || {}),
              from_cache: true,
              network_error: true,
            },
          };
        }
      }
      logger.warn(
        `[board-data] ${req.dashboard_id}: network unavailable — no cached board`
      );
      return {
        dashboard_id: req.dashboard_id || "home",
        widgets: {},
        meta: {
          network_error: true,
          error:
            error instanceof Error
              ? error.message
              : "Network error loading dashboard batch",
        },
      };
    }
    if (isMissingBaMethodError(error)) {
      markBaMethodMissing(METHOD);
      logger.info(
        `${METHOD} not on this site — falling back to per-widget fetches.`
      );
    }
    throw error;
  }
}
