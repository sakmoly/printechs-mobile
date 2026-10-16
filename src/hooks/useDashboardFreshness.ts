import { useMemo } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import type { DashboardWidgetDataResponse } from "../api/dashboardWidgetData";
import {
  formatDashboardFreshnessLabel,
  resolveLatestTimestamp,
} from "../utils/dashboardFreshness";

type BoardFreshnessInput = {
  isFetching: boolean;
  dataUpdatedAt?: number;
  cachedAt?: number | null;
  offline?: boolean;
};

type WidgetQueriesInput = {
  fallbackQueries?: Array<
    Pick<UseQueryResult<DashboardWidgetDataResponse>, "dataUpdatedAt">
  >;
};

export function useDashboardFreshness(
  board: BoardFreshnessInput,
  widgets: WidgetQueriesInput = {}
) {
  const widgetUpdatedAt = useMemo(() => {
    const times = (widgets.fallbackQueries || []).map((q) => q.dataUpdatedAt);
    return resolveLatestTimestamp(...times);
  }, [widgets.fallbackQueries]);

  const updatedAt = useMemo(
    () =>
      resolveLatestTimestamp(
        board.dataUpdatedAt,
        board.cachedAt ?? undefined,
        widgetUpdatedAt ?? undefined
      ),
    [board.dataUpdatedAt, board.cachedAt, widgetUpdatedAt]
  );

  const label = useMemo(
    () =>
      formatDashboardFreshnessLabel({
        updatedAt,
        isFetching: board.isFetching,
        offline: board.offline,
      }),
    [updatedAt, board.isFetching, board.offline]
  );

  return { updatedAt, label, isFetching: board.isFetching };
}
