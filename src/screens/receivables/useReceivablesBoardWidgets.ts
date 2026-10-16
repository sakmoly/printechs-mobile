/**
 * Load receivables_overview — batch first, then fetch every missing catalog widget.
 */

import { useEffect, useMemo } from "react";
import { type DashboardBoardDataRequest } from "../../api/dashboardBoardData";
import { useDashboardBoardData } from "../../hooks/useDashboardBoardData";
import { useBootstrapStore } from "../../store/bootstrap";
import {
  getActiveSessionUserKey,
  hydrateCachedWidgets,
  readCachedBoard,
} from "../../api/sessionCache";
import { territoryBoardCacheKey } from "../../utils/dashboardTerritory";
import {
  widgetsForDashboardId,
  type MobileWidgetConfig,
} from "../../types/bootstrap";
import {
  catalogKeysToFetch,
  mergeReceivablesWidgetDefs,
} from "./receivablesWidgetCatalog";
import { isBoardWidgetsLoading } from "../shared/boardWidgetLoading";
import {
  buildDashboardScopeKey,
  useScopeSyncedWidgetMap,
} from "../shared/dashboardScopeSync";
import { useWidgetFallbackQueries } from "../shared/useWidgetFallbackQueries";

const BOARD_ID = "receivables_overview";

export function useReceivablesBoardWidgets(
  params: Omit<DashboardBoardDataRequest, "dashboard_id"> & {
    show_ly?: boolean;
  }
) {
  const bootstrap = useBootstrapStore((s) => s.bootstrap);
  const boardQuery = useDashboardBoardData(
    { ...params, dashboard_id: BOARD_ID },
    { enabled: Boolean(params.company) }
  );

  const widgetDefs = useMemo((): MobileWidgetConfig[] => {
    const boards = bootstrap?.dashboards || [];
    const flat = bootstrap?.dashboard || [];
    return widgetsForDashboardId(boards, flat, BOARD_ID);
  }, [bootstrap]);

  const catalog = useMemo(
    () => mergeReceivablesWidgetDefs(widgetDefs),
    [widgetDefs]
  );

  const userKey = getActiveSessionUserKey();
  const catalogKeys = useMemo(() => catalog.map((c) => c.key), [catalog]);

  useEffect(() => {
    if (!params.company || !userKey) return;
    void readCachedBoard({
      userKey,
      dashboardId: BOARD_ID,
      company: params.company,
      from_date: params.from_date,
      to_date: params.to_date,
      period: params.period,
      territory: territoryBoardCacheKey(params.filters),
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
    userKey,
    catalogKeys,
    params.company,
    params.from_date,
    params.to_date,
    params.period,
    params.show_ly,
    params.filters,
  ]);

  const bootstrapKeys = useMemo(
    () => widgetDefs.map((w) => w.key).filter(Boolean),
    [widgetDefs]
  );

  const boardSettled =
    Boolean(boardQuery.usePerWidgetFallback) ||
    (Boolean(boardQuery.data) && !boardQuery.isLoading) ||
    boardQuery.isError;

  const missingKeys = useMemo(() => {
    if (!boardSettled) return [];
    const map = boardQuery.widgets || {};
    return catalogKeysToFetch(map, catalog, bootstrapKeys);
  }, [boardSettled, boardQuery.widgets, catalog, bootstrapKeys]);

  const { widgetMap, fallbackQueries, anyFallbackLoading } =
    useWidgetFallbackQueries({
      prefix: "receivables-widget-fallback",
      missingKeys,
      params,
      boardSettled,
      boardWidgets: boardQuery.widgets,
    });

  const scopeKey = buildDashboardScopeKey(params);
  const { displayMap, scopePending } = useScopeSyncedWidgetMap({
    scopeKey,
    widgetMap,
    boardFetching: boardQuery.isFetching,
    fallbackFetching: anyFallbackLoading,
    boardHasData: Boolean(boardQuery.data),
  });

  const stillFetching =
    scopePending ||
    boardQuery.isFetching ||
    anyFallbackLoading;

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
    refreshBoard: boardQuery.refreshBoard,
    missingKeys,
    cachedAt: boardQuery.cachedAt,
    dataUpdatedAt: boardQuery.dataUpdatedAt,
    fallbackQueries,
    isOffline: boardQuery.isOffline,
  };
}
