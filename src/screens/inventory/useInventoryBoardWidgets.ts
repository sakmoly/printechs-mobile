/**
 * Load inventory_overview — batch first, then fetch every missing catalog widget.
 */

import { useCallback, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { type DashboardBoardDataRequest } from "../../api/dashboardBoardData";
import { useDashboardBoardData } from "../../hooks/useDashboardBoardData";
import { useBootstrapStore } from "../../store/bootstrap";
import {
  DASHBOARD_BOARD_STALE_MS,
  DASHBOARD_TERRITORY_STALE_MS,
} from "../../constants/dashboardCache";
import {
  ALL_TERRITORIES,
  territoryFilterKey,
} from "../../utils/dashboardTerritory";
import {
  applyInventoryTerritoryScope,
  stripCompanyWideTurnoverDays,
  fetchInventoryTerritoryRollup,
} from "./inventoryTerritoryScope";
import {
  inventoryRollupCacheKey,
  invalidateInventoryRollupCache,
  peekInventoryRollupCache,
  writeInventoryRollupCache,
} from "./inventoryRollupCache";
import {
  widgetsForDashboardId,
  type MobileWidgetConfig,
} from "../../types/bootstrap";
import {
  catalogKeysToFetch,
  mergeInventoryWidgetDefs,
} from "./inventoryWidgetCatalog";
import { isBoardWidgetsLoading } from "../shared/boardWidgetLoading";
import {
  buildDashboardScopeKey,
  useScopeSyncedWidgetMap,
} from "../shared/dashboardScopeSync";
import { useWidgetFallbackQueries } from "../shared/useWidgetFallbackQueries";
import {
  getActiveSessionUserKey,
  hydrateCachedWidgets,
  readCachedBoard,
} from "../../api/sessionCache";
import { territoryBoardCacheKey } from "../../utils/dashboardTerritory";

const BOARD_ID = "inventory_overview";

export function useInventoryBoardWidgets(
  params: Omit<DashboardBoardDataRequest, "dashboard_id"> & {
    show_ly?: boolean;
  }
) {
  const bootstrap = useBootstrapStore((s) => s.bootstrap);

  const territoryKey = territoryFilterKey(
    params.filters?.territory?.[0] || ""
  );
  const territoryScoped = Boolean(
    territoryKey && territoryKey !== ALL_TERRITORIES
  );

  /** Territory KPIs use hierarchy rollup — do not refetch the full board on branch change. */
  const boardParams = useMemo(() => {
    if (!territoryScoped) return params;
    const { filters: _filters, ...rest } = params;
    return { ...rest, filters: undefined };
  }, [params, territoryScoped]);

  const boardQuery = useDashboardBoardData(
    { ...boardParams, dashboard_id: BOARD_ID },
    {
      enabled: Boolean(params.company),
      staleTimeMs: DASHBOARD_BOARD_STALE_MS,
    }
  );

  const widgetDefs = useMemo((): MobileWidgetConfig[] => {
    const boards = bootstrap?.dashboards || [];
    const flat = bootstrap?.dashboard || [];
    return widgetsForDashboardId(boards, flat, BOARD_ID);
  }, [bootstrap]);

  const catalog = useMemo(
    () => mergeInventoryWidgetDefs(widgetDefs),
    [widgetDefs]
  );

  const bootstrapKeys = useMemo(
    () => widgetDefs.map((w) => w.key).filter(Boolean),
    [widgetDefs]
  );

  const userKey = getActiveSessionUserKey();
  const catalogKeys = useMemo(() => catalog.map((c) => c.key), [catalog]);

  useEffect(() => {
    if (!params.company || !userKey) return;
    const territory = territoryBoardCacheKey(boardParams.filters);
    void readCachedBoard({
      userKey,
      dashboardId: BOARD_ID,
      company: params.company,
      from_date: params.from_date,
      to_date: params.to_date,
      period: params.period,
      territory,
    });
    if (!catalogKeys.length) return;
    void hydrateCachedWidgets(userKey, catalogKeys, {
      company: params.company,
      from_date: params.from_date,
      to_date: params.to_date,
      period: params.period,
      show_ly: params.show_ly !== false,
      territory: String(params.filters?.territory?.[0] || ""),
    });
  }, [
    params.company,
    params.from_date,
    params.to_date,
    params.period,
    params.show_ly,
    params.filters,
    boardParams.filters,
    userKey,
    catalogKeys,
  ]);

  const boardSettled =
    Boolean(boardQuery.usePerWidgetFallback) ||
    (Boolean(boardQuery.data) && !boardQuery.isLoading) ||
    boardQuery.isError;

  const missingKeys = useMemo(() => {
    if (!boardSettled) return [];
    const map = boardQuery.widgets || {};
    return catalogKeysToFetch(map, catalog, bootstrapKeys);
  }, [boardSettled, boardQuery.widgets, catalog, bootstrapKeys]);

  const fallbackParams = useMemo(() => {
    if (!territoryScoped) return params;
    const { filters: _filters, ...rest } = params;
    return { ...rest, filters: undefined };
  }, [params, territoryScoped]);

  const { widgetMap, fallbackQueries, anyFallbackLoading } =
    useWidgetFallbackQueries({
      prefix: "inventory-widget-fallback",
      missingKeys,
      params: fallbackParams,
      boardSettled,
      boardWidgets: boardQuery.widgets,
    });

  const rollupCacheKey = useMemo(
    () =>
      inventoryRollupCacheKey({
        company: params.company,
        territory: territoryKey,
        from_date: params.from_date,
        to_date: params.to_date,
        period: params.period,
      }),
    [
      params.company,
      territoryKey,
      params.from_date,
      params.to_date,
      params.period,
    ]
  );

  const territoryRollupQuery = useQuery({
    queryKey: ["inventory-territory-rollup", rollupCacheKey],
    queryFn: async () => {
      const data = await fetchInventoryTerritoryRollup({
        company: params.company,
        territory: territoryKey,
        from_date: params.from_date,
        to_date: params.to_date,
        period: params.period,
        fast: true,
      });
      if (data) writeInventoryRollupCache(rollupCacheKey, data);
      return data;
    },
    enabled: Boolean(params.company) && territoryScoped,
    staleTime: DASHBOARD_TERRITORY_STALE_MS,
    gcTime: 30 * 60_000,
    retry: 1,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
    initialData: () => peekInventoryRollupCache(rollupCacheKey),
  });

  const widgetMapScoped = useMemo(() => {
    if (!territoryScoped) return widgetMap;
    if (!territoryRollupQuery.data) {
      return stripCompanyWideTurnoverDays(widgetMap);
    }
    return applyInventoryTerritoryScope(widgetMap, territoryRollupQuery.data);
  }, [territoryScoped, territoryRollupQuery.data, widgetMap]);

  const refreshBoard = useCallback(async () => {
    if (territoryScoped) {
      invalidateInventoryRollupCache(rollupCacheKey);
    }
    const tasks: Promise<unknown>[] = [boardQuery.refreshBoard()];
    if (territoryScoped) {
      tasks.push(territoryRollupQuery.refetch({ throwOnError: false }));
    }
    const [board] = await Promise.all(tasks);
    return board as Awaited<ReturnType<typeof boardQuery.refreshBoard>>;
  }, [boardQuery, territoryScoped, territoryRollupQuery, rollupCacheKey]);

  const scopeKey = buildDashboardScopeKey(params);
  const { displayMap, scopePending } = useScopeSyncedWidgetMap({
    scopeKey,
    widgetMap: widgetMapScoped,
    boardFetching: boardQuery.isFetching,
    fallbackFetching: anyFallbackLoading,
    boardHasData: Boolean(boardQuery.data),
  });

  const stillFetching =
    scopePending ||
    boardQuery.isFetching ||
    anyFallbackLoading ||
    (territoryScoped && territoryRollupQuery.isFetching);

  return {
    widgetDefs,
    widgetMap: displayMap,
    isLoading:
      scopePending ||
      isBoardWidgetsLoading(
        boardQuery.isLoading && !boardQuery.data,
        Boolean(boardQuery.data),
        anyFallbackLoading,
        Object.keys(displayMap).length,
        displayMap,
        stillFetching
      ),
    isFetching: stillFetching,
    refreshBoard,
    territoryScoped,
    territoryRollup: territoryRollupQuery.data ?? null,
    missingKeys,
    cachedAt: boardQuery.cachedAt,
    dataUpdatedAt: boardQuery.dataUpdatedAt,
    fallbackQueries,
    isOffline: boardQuery.isOffline,
  };
}
