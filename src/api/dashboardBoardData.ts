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
  isMissingBaMethodError,
  resolveCompanyName,
  markBaMethodMissing,
  isBaMethodKnownMissing,
} from "./apiResilience";
import { logger } from "../utils/logger";
import { shouldUseMockData } from "./mock";
import {
  normalizeDashboardWidgetPayload,
  type DashboardWidgetDataResponse,
} from "./dashboardWidgetData";

const METHOD = "get_dashboard_board_data";

export type DashboardBoardDataRequest = {
  dashboard_id: string;
  company?: string;
  from_date?: string;
  to_date?: string;
  period?: string;
  /** Pull-to-refresh: bypass server cache */
  refresh?: 0 | 1 | boolean;
};

export type DashboardBoardDataResponse = {
  dashboard_id: string;
  widgets: Record<string, DashboardWidgetDataResponse>;
  currency?: string;
  meta?: Record<string, unknown>;
};

export function dashboardBoardQueryKey(
  req: Pick<
    DashboardBoardDataRequest,
    "dashboard_id" | "company" | "from_date" | "to_date" | "period"
  >
) {
  return [
    "dashboard-board-data",
    req.dashboard_id,
    req.company || "",
    req.from_date || "",
    req.to_date || "",
    req.period || "",
  ] as const;
}

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

  const rawParams = {
    dashboard_id: req.dashboard_id || "home",
    company,
    from_date: req.from_date,
    to_date: req.to_date,
    period: req.period,
    refresh: req.refresh ? 1 : undefined,
  };

  const params = pickBaParams(
    rawParams,
    ["dashboard_id", "company", "from_date", "to_date", "period", "refresh"],
    cfg
  );

  const callBoardApi = async (p: Record<string, unknown>) => {
    try {
      return await http.post<unknown>(ERP_ANALYSIS.config.getDashboardBoardData, p);
    } catch (postErr) {
      const st = (postErr as any)?.response?.status;
      if (st === 500 || st === 404 || st === 417) {
        return await http.get<unknown>(
          ERP_ANALYSIS.config.getDashboardBoardData,
          p,
          { silentError: true }
        );
      }
      try {
        return await http.get<unknown>(
          ERP_ANALYSIS.config.getDashboardBoardData,
          p,
          { silentError: true }
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
      logger.debug("[board-data]", {
        dashboard_id: normalized.dashboard_id,
        keys: Object.keys(normalized.widgets),
        refresh: Boolean(req.refresh),
      });
    }
    return normalized;
  } catch (error) {
    if (isMissingBaMethodError(error)) {
      markBaMethodMissing(METHOD);
      logger.info(
        `${METHOD} not on this site — falling back to per-widget fetches.`
      );
    }
    throw error;
  }
}
