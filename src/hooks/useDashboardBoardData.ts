/**
 * React Query hook for get_dashboard_board_data (batch Home / board widgets).
 */

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  dashboardBoardQueryKey,
  fetchDashboardBoardData,
  type DashboardBoardDataRequest,
  type DashboardBoardDataResponse,
} from "../api/dashboardBoardData";
import { isBaMethodKnownMissing } from "../api/apiResilience";
import { isMissingBaMethodError } from "../api/baErrors";

const METHOD = "get_dashboard_board_data";

type Options = {
  enabled?: boolean;
  /** Cache window — BA brief suggests 1–3 min */
  staleTimeMs?: number;
};

export function useDashboardBoardData(
  params: DashboardBoardDataRequest,
  options: Options = {}
) {
  const queryClient = useQueryClient();
  const dashboardId = params.dashboard_id || "home";
  const keyParams = {
    dashboard_id: dashboardId,
    company: params.company,
    from_date: params.from_date,
    to_date: params.to_date,
    period: params.period,
  };
  const queryKey = dashboardBoardQueryKey(keyParams);

  const boardMissing = isBaMethodKnownMissing(METHOD);

  const query = useQuery({
    queryKey,
    queryFn: () =>
      fetchDashboardBoardData({
        ...params,
        dashboard_id: dashboardId,
        refresh: false,
      }),
    staleTime: options.staleTimeMs ?? 2 * 60_000,
    gcTime: 10 * 60_000,
    retry: 1,
    enabled:
      options.enabled !== false &&
      Boolean(dashboardId) &&
      !boardMissing,
  });

  const boardFailedMissing =
    boardMissing ||
    (query.isError && isMissingBaMethodError(query.error));

  /** Soft per-widget fallback when batch API is absent or failed as missing. */
  const usePerWidgetFallback = boardFailedMissing || (query.isError && !query.data);

  const refreshBoard = useCallback(async () => {
    if (isBaMethodKnownMissing(METHOD)) {
      return query.data ?? null;
    }
    try {
      const data = await queryClient.fetchQuery({
        queryKey,
        queryFn: () =>
          fetchDashboardBoardData({
            ...params,
            dashboard_id: dashboardId,
            refresh: 1,
          }),
        staleTime: 0,
      });
      return data;
    } catch (e) {
      // Still try a normal refetch if refresh=1 path failed oddly
      await query.refetch();
      throw e;
    }
  }, [queryClient, queryKey, params, dashboardId, query]);

  return {
    data: query.data as DashboardBoardDataResponse | undefined,
    widgets: query.data?.widgets,
    isLoading: query.isLoading && !query.data,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    /** Batch API unavailable → widgets should call get_dashboard_widget_data */
    usePerWidgetFallback,
    /** Batch succeeded (map may still miss individual keys) */
    boardReady: Boolean(query.data) && !boardFailedMissing,
    refreshBoard,
    refetch: query.refetch,
    queryKey,
  };
}
