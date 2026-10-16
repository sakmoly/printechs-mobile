/**
 * React Query hook for get_dashboard_board_data (batch Home / board widgets).
 * Seeds from disk/memory cache so Home paints instantly, then revalidates.
 * Requires company — fetches without company return zeros from ERP.
 */

import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  dashboardBoardQueryKey,
  fetchDashboardBoardData,
  type DashboardBoardDataRequest,
  type DashboardBoardDataResponse,
} from "../api/dashboardBoardData";
import { isBaMethodKnownMissing } from "../api/apiResilience";
import { isMissingBaMethodError } from "../api/baErrors";
import { isNetworkOrTlsError } from "../api/serverUrl";
import {
  boardPayloadHasWidgets,
  boardPayloadLooksUseful,
  getActiveSessionUserKey,
  peekCachedBoardSync,
  readCachedBoard,
} from "../api/sessionCache";
import {
  DASHBOARD_BOARD_STALE_MS,
  DASHBOARD_TERRITORY_STALE_MS,
} from "../constants/dashboardCache";
import { territoryBoardCacheKey } from "../utils/dashboardTerritory";

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
  const company = String(params.company || "").trim();
  const territoryCacheKey = territoryBoardCacheKey(params.filters);
  const keyParams = useMemo(
    () => ({
      dashboard_id: dashboardId,
      company,
      from_date: params.from_date,
      to_date: params.to_date,
      period: params.period,
      filters: params.filters,
      view_all_sales: params.view_all_sales,
      show_ly: params.show_ly,
    }),
    [
      dashboardId,
      company,
      params.from_date,
      params.to_date,
      params.period,
      params.filters,
      params.view_all_sales,
      params.show_ly,
    ]
  );
  const queryKey = useMemo(
    () => dashboardBoardQueryKey(keyParams),
    [keyParams]
  );

  const boardMissing = isBaMethodKnownMissing(METHOD);
  const userKey = getActiveSessionUserKey();
  const canUseCache = Boolean(userKey && company);

  const [seed, setSeed] = useState(() => {
    if (!canUseCache || !userKey) return null;
    const hit = peekCachedBoardSync({
      userKey,
      dashboardId,
      company,
      from_date: params.from_date,
      to_date: params.to_date,
      period: params.period,
      territory: territoryCacheKey,
    });
    return hit && boardPayloadHasWidgets(hit.data) ? hit : null;
  });

  useLayoutEffect(() => {
    if (!canUseCache || !userKey) {
      setSeed(null);
      return;
    }
    const syncHit = peekCachedBoardSync({
      userKey,
      dashboardId,
      company,
      from_date: params.from_date,
      to_date: params.to_date,
      period: params.period,
      territory: territoryCacheKey,
    });
    if (syncHit) {
      queryClient.setQueryData(queryKey, syncHit.data, {
        updatedAt: syncHit.savedAt,
      });
      setSeed(syncHit);
      return;
    }
    let cancelled = false;
    void readCachedBoard({
      userKey,
      dashboardId,
      company,
      from_date: params.from_date,
      to_date: params.to_date,
      period: params.period,
      territory: territoryCacheKey,
    }).then((cached) => {
      if (cancelled || !cached || !boardPayloadHasWidgets(cached.data)) return;
      queryClient.setQueryData(queryKey, cached.data, {
        updatedAt: cached.savedAt,
      });
      setSeed(cached);
    });
    return () => {
      cancelled = true;
    };
  }, [
    canUseCache,
    userKey,
    company,
    dashboardId,
    params.from_date,
    params.to_date,
    params.period,
    territoryCacheKey,
    queryClient,
    queryKey,
  ]);

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const result = await fetchDashboardBoardData({
        ...params,
        company,
        dashboard_id: dashboardId,
        refresh: false,
      });
      if (
        boardPayloadHasWidgets(result) &&
        !boardPayloadLooksUseful(result) &&
        userKey &&
        company
      ) {
        const cached = await readCachedBoard({
          userKey,
          dashboardId,
          company,
          from_date: params.from_date,
          to_date: params.to_date,
          period: params.period,
          territory: territoryCacheKey,
        });
        if (cached && boardPayloadLooksUseful(cached.data)) {
          return {
            ...cached.data,
            meta: {
              ...(cached.data.meta || {}),
              from_cache: true,
            },
          };
        }
      }
      if (
        result.meta?.network_error &&
        !boardPayloadHasWidgets(result) &&
        userKey &&
        company
      ) {
        const cached = await readCachedBoard({
          userKey,
          dashboardId,
          company,
          from_date: params.from_date,
          to_date: params.to_date,
          period: params.period,
          territory: territoryCacheKey,
        });
        if (cached && boardPayloadHasWidgets(cached.data)) {
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
      return result;
    },
    initialData: seed?.data,
    initialDataUpdatedAt: seed?.savedAt,
    staleTime:
      options.staleTimeMs ??
      (territoryCacheKey
        ? DASHBOARD_TERRITORY_STALE_MS
        : DASHBOARD_BOARD_STALE_MS),
    gcTime: 24 * 60 * 60_000,
    refetchOnMount: true,
    retry: (count, err) => {
      if ((err as any)?.response?.status === 403) return false;
      if (isNetworkOrTlsError(err)) return count < 2;
      return count < 1;
    },
    // Wait for company — otherwise ERP returns empty/zero widgets
    enabled:
      options.enabled !== false &&
      Boolean(dashboardId) &&
      Boolean(company) &&
      !boardMissing,
  });

  const boardFailedMissing =
    boardMissing ||
    (query.isError && isMissingBaMethodError(query.error));

  const boardPermissionDenied = Boolean(query.data?.meta?.permission_denied);
  const boardNetworkError = Boolean(query.data?.meta?.network_error);
  const boardHasWidgets =
    boardPayloadHasWidgets(query.data) || boardPayloadHasWidgets(seed?.data);
  const boardEmptyBatch =
    Boolean(query.data) &&
    !boardFailedMissing &&
    Object.keys(query.data?.widgets || {}).length === 0;

  /** Fall back to get_dashboard_widget_data when batch is unavailable or empty. */
  const usePerWidgetFallback =
    boardFailedMissing ||
    (query.isError && !boardHasWidgets) ||
    boardPermissionDenied ||
    (boardNetworkError && !boardHasWidgets) ||
    (boardEmptyBatch && !boardNetworkError);

  const refreshBoard = useCallback(async () => {
    if (isBaMethodKnownMissing(METHOD) || !company) {
      return query.data ?? null;
    }
    try {
      const data = await queryClient.fetchQuery({
        queryKey,
        queryFn: () =>
          fetchDashboardBoardData({
            ...params,
            company,
            dashboard_id: dashboardId,
            refresh: 1,
          }),
        staleTime: 0,
      });
      return data;
    } catch (e) {
      await query.refetch();
      throw e;
    }
  }, [queryClient, queryKey, params, dashboardId, company, query]);

  return {
    data: query.data as DashboardBoardDataResponse | undefined,
    widgets: query.data?.widgets,
    isLoading: query.isLoading && !query.data,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    cachedAt: seed?.savedAt ?? null,
    dataUpdatedAt: query.dataUpdatedAt,
    usePerWidgetFallback,
    boardReady: Boolean(query.data) && !boardFailedMissing,
    refreshBoard,
    refetch: query.refetch,
    queryKey,
    isOffline: Boolean(
      query.data?.meta?.from_cache && query.data?.meta?.network_error
    ),
  };
}
