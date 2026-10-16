/**
 * Load home board — batch first, then fetch missing catalog widgets.
 * Priority KPIs load first; trend/insights/activities defer until batch or KPIs settle.
 */

import { useEffect, useMemo, useState } from "react";
import { type DashboardBoardDataRequest } from "../../api/dashboardBoardData";
import { useDashboardBoardData } from "../../hooks/useDashboardBoardData";
import { useBootstrapStore } from "../../store/bootstrap";
import {
  widgetsForDashboardId,
  type MobileWidgetConfig,
} from "../../types/bootstrap";
import {
  catalogKeysToFetch,
  mergeHomeWidgetDefs,
  partitionMissingHomeKeys,
} from "./homeWidgetCatalog";
import { isBoardWidgetsLoading } from "../shared/boardWidgetLoading";
import {
  buildDashboardScopeKey,
  useScopeSyncedWidgetMap,
} from "../shared/dashboardScopeSync";
import { mergeWidgetFallbackMap } from "../shared/mergeWidgetFallbackMap";
import { useWidgetFallbackQueries } from "../shared/useWidgetFallbackQueries";

const BOARD_ID = "home";
const DEFER_SECONDARY_MS = 1200;

export function useHomeBoardWidgets(
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

  const catalog = useMemo(() => mergeHomeWidgetDefs(widgetDefs), [widgetDefs]);

  const bootstrapKeys = useMemo(
    () => widgetDefs.map((w) => w.key).filter(Boolean),
    [widgetDefs]
  );

  const boardSettled =
    Boolean(boardQuery.usePerWidgetFallback) ||
    (Boolean(boardQuery.data) && !boardQuery.isLoading) ||
    boardQuery.isError;

  const { priority: priorityMissing, deferred: deferredMissing } = useMemo(() => {
    if (!boardSettled) {
      return { priority: [] as string[], deferred: [] as string[] };
    }
    const map = boardQuery.widgets || {};
    const allMissing = catalogKeysToFetch(map, catalog, bootstrapKeys);
    return partitionMissingHomeKeys(allMissing, catalog);
  }, [boardSettled, boardQuery.widgets, catalog, bootstrapKeys]);

  const [allowDeferredFetch, setAllowDeferredFetch] = useState(false);

  useEffect(() => {
    if (!boardSettled) {
      setAllowDeferredFetch(false);
      return;
    }
    const batchCount = Object.keys(boardQuery.widgets || {}).length;
    if (batchCount > 0 && priorityMissing.length === 0) {
      setAllowDeferredFetch(true);
      return;
    }
    const t = setTimeout(() => setAllowDeferredFetch(true), DEFER_SECONDARY_MS);
    return () => clearTimeout(t);
  }, [boardSettled, boardQuery.widgets, priorityMissing.length]);

  const priorityFallback = useWidgetFallbackQueries({
    prefix: "home-widget-fallback-priority",
    missingKeys: priorityMissing,
    params,
    boardSettled,
    boardWidgets: boardQuery.widgets,
  });

  const priorityStillLoading = priorityFallback.anyFallbackLoading;

  const deferredFallback = useWidgetFallbackQueries({
    prefix: "home-widget-fallback-deferred",
    missingKeys: deferredMissing,
    params,
    boardSettled,
    boardWidgets: priorityFallback.widgetMap,
    enabled: allowDeferredFetch && !priorityStillLoading,
  });

  const widgetMap = useMemo(
    () =>
      mergeWidgetFallbackMap(
        deferredFallback.widgetMap,
        deferredMissing,
        deferredFallback.fallbackQueries
      ),
    [deferredFallback.widgetMap, deferredFallback.fallbackQueries, deferredMissing]
  );

  const missingKeys = useMemo(
    () => [...priorityMissing, ...deferredMissing],
    [priorityMissing, deferredMissing]
  );

  const fallbackQueries = useMemo(
    () => [
      ...priorityFallback.fallbackQueries,
      ...deferredFallback.fallbackQueries,
    ],
    [priorityFallback.fallbackQueries, deferredFallback.fallbackQueries]
  );

  const anyPriorityFallbackLoading =
    boardSettled &&
    priorityMissing.length > 0 &&
    priorityStillLoading;

  const anyDeferredFallbackLoading =
    boardSettled &&
    deferredMissing.length > 0 &&
    deferredFallback.anyFallbackLoading;

  const scopeKey = buildDashboardScopeKey(params);
  const fallbackBusy =
    anyPriorityFallbackLoading || anyDeferredFallbackLoading;
  const { displayMap, scopePending } = useScopeSyncedWidgetMap({
    scopeKey,
    widgetMap,
    boardFetching: boardQuery.isFetching,
    fallbackFetching: fallbackBusy,
    boardHasData: Boolean(boardQuery.data),
  });

  const stillFetching =
    scopePending ||
    boardQuery.isFetching ||
    fallbackBusy;

  return {
    widgetDefs,
    widgetMap: displayMap,
    isLoading:
      scopePending ||
      isBoardWidgetsLoading(
        boardQuery.isLoading && !boardQuery.data,
        Boolean(boardQuery.data),
        anyPriorityFallbackLoading,
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
