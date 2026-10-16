import { useEffect, useMemo, useState } from "react";
import type { DrillFilters } from "../../api/dashboardWidgetData";
import { territoryBoardCacheKey } from "../../utils/dashboardTerritory";
import { widgetPayloadHasNonZeroValue } from "../../utils/widgetPayload";
import type { DashboardWidgetDataResponse } from "../../api/dashboardWidgetData";

export type DashboardWidgetScopeParams = {
  company?: string;
  from_date?: string;
  to_date?: string;
  period?: string;
  show_ly?: boolean;
  filters?: DrillFilters;
  view_all_sales?: 0 | 1 | boolean;
};

/** Stable key for board + per-widget cache (territory, dates, company). */
export function buildDashboardScopeKey(
  params: DashboardWidgetScopeParams
): string {
  return [
    territoryBoardCacheKey(params.filters),
    String(params.company || "").trim(),
    params.from_date || "",
    params.to_date || "",
    params.period || "",
    params.show_ly !== false ? 1 : 0,
    params.view_all_sales ? 1 : 0,
  ].join("|");
}

/**
 * After territory/date changes, hide prior-scope widget numbers until the board
 * batch (+ optional fallbacks) finish for the new scope — avoids mixed cards.
 */
function widgetMapHasUseful(
  widgetMap: Record<string, DashboardWidgetDataResponse | undefined> | undefined
): boolean {
  if (!widgetMap) return false;
  return Object.values(widgetMap).some((w) => widgetPayloadHasNonZeroValue(w));
}

export function useScopeSyncedWidgetMap<
  T extends Record<string, DashboardWidgetDataResponse | undefined>,
>(opts: {
  scopeKey: string;
  widgetMap: T;
  boardFetching: boolean;
  fallbackFetching: boolean;
  boardHasData: boolean;
}): { displayMap: T; scopePending: boolean } {
  const [syncedScope, setSyncedScope] = useState(opts.scopeKey);

  const mapUseful = widgetMapHasUseful(opts.widgetMap);
  const scopeChanged = syncedScope !== opts.scopeKey;
  /** Block UI only when scope changed and we have no cached batch for this scope yet. */
  const scopePending = scopeChanged && !(opts.boardHasData && mapUseful);

  useEffect(() => {
    if (syncedScope === opts.scopeKey) return;
    const ready =
      !opts.boardFetching &&
      !opts.fallbackFetching &&
      opts.boardHasData;
    if (ready) {
      setSyncedScope(opts.scopeKey);
    }
  }, [
    syncedScope,
    opts.scopeKey,
    opts.boardFetching,
    opts.fallbackFetching,
    opts.boardHasData,
  ]);

  const displayMap = useMemo(() => {
    if (!scopeChanged) return opts.widgetMap;
    if (opts.boardHasData && mapUseful) return opts.widgetMap;
    return {} as T;
  }, [scopeChanged, mapUseful, opts.boardHasData, opts.widgetMap]);

  return { displayMap, scopePending };
}
