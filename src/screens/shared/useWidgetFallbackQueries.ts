/**
 * Per-widget fallback fetches with disk cache seed + stale-while-revalidate.
 */

import { useEffect, useMemo, useRef } from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import {
  fetchDashboardWidgetData,
  type DashboardWidgetDataResponse,
  type DrillFilters,
} from "../../api/dashboardWidgetData";
import {
  getActiveSessionUserKey,
  peekCachedWidgetSync,
  readCachedWidget,
} from "../../api/sessionCache";
import { mergeWidgetFallbackMap } from "./mergeWidgetFallbackMap";
import { DASHBOARD_WIDGET_STALE_MS } from "../../constants/dashboardCache";
import { territoryBoardCacheKey } from "../../utils/dashboardTerritory";

export type WidgetFallbackScope = {
  company?: string;
  from_date?: string;
  to_date?: string;
  period?: string;
  show_ly?: boolean;
  filters?: DrillFilters;
  view_all_sales?: 0 | 1 | boolean;
};

function widgetCacheScope(
  widget_key: string,
  params: WidgetFallbackScope,
  territoryKey: string
) {
  return {
    widget_key,
    company: params.company,
    from_date: params.from_date,
    to_date: params.to_date,
    period: params.period,
    territory: territoryKey || undefined,
    show_ly: params.show_ly !== false,
  };
}

function buildWidgetFallbackQueryKey(
  prefix: string,
  widget_key: string,
  params: WidgetFallbackScope,
  territoryKey: string
) {
  return [
    prefix,
    widget_key,
    params.company,
    params.from_date,
    params.to_date,
    params.period,
    params.show_ly ? 1 : 0,
    territoryKey,
    params.view_all_sales ? 1 : 0,
  ] as const;
}

export function useWidgetFallbackQueries(opts: {
  prefix: string;
  missingKeys: string[];
  params: WidgetFallbackScope;
  boardSettled: boolean;
  boardWidgets?: Record<string, DashboardWidgetDataResponse | undefined>;
  enabled?: boolean;
}) {
  const queryClient = useQueryClient();
  const userKey = getActiveSessionUserKey();
  const territoryKey = territoryBoardCacheKey(opts.params.filters);
  const scopeKey = [
    territoryKey,
    opts.params.company,
    opts.params.from_date,
    opts.params.to_date,
    opts.params.period,
    opts.params.show_ly !== false ? 1 : 0,
    opts.params.view_all_sales ? 1 : 0,
  ].join("|");
  const enabled =
    Boolean(opts.params.company) &&
    opts.boardSettled &&
    opts.enabled !== false;
  const stickyMapRef = useRef<Record<string, DashboardWidgetDataResponse>>({});
  const scopeKeyRef = useRef(scopeKey);
  if (scopeKeyRef.current !== scopeKey) {
    scopeKeyRef.current = scopeKey;
    stickyMapRef.current = {};
  }

  useEffect(() => {
    if (!enabled || !opts.missingKeys.length || !userKey) return;
    let cancelled = false;
    void (async () => {
      await Promise.all(
        opts.missingKeys.map(async (widget_key) => {
          const cacheOpts = widgetCacheScope(widget_key, opts.params, territoryKey);
          const hit = await readCachedWidget({ userKey, ...cacheOpts });
          if (cancelled || !hit) return;
          const queryKey = buildWidgetFallbackQueryKey(
            opts.prefix,
            widget_key,
            opts.params,
            territoryKey
          );
          const existing = queryClient.getQueryData<DashboardWidgetDataResponse>(
            queryKey
          );
          if (!existing) {
            queryClient.setQueryData(queryKey, hit.data, {
              updatedAt: hit.savedAt,
            });
          }
        })
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [
    enabled,
    opts.missingKeys,
    opts.params,
    opts.prefix,
    queryClient,
    territoryKey,
    userKey,
  ]);

  const fallbackQueries = useQueries({
    queries: opts.missingKeys.map((widget_key) => {
      const cached =
        userKey && enabled
          ? peekCachedWidgetSync({
              userKey,
              ...widgetCacheScope(widget_key, opts.params, territoryKey),
            })
          : null;
      return {
        queryKey: buildWidgetFallbackQueryKey(
          opts.prefix,
          widget_key,
          opts.params,
          territoryKey
        ),
        queryFn: () =>
          fetchDashboardWidgetData({
            widget_key,
            company: opts.params.company,
            from_date: opts.params.from_date,
            to_date: opts.params.to_date,
            period: opts.params.period,
            show_ly: opts.params.show_ly !== false,
            filters: opts.params.filters,
            view_all_sales: opts.params.view_all_sales ? 1 : undefined,
          }),
        enabled,
        staleTime: DASHBOARD_WIDGET_STALE_MS,
        initialData: cached?.data,
        initialDataUpdatedAt: cached?.savedAt,
      };
    }),
  });

  const widgetMap = useMemo(() => {
    const merged = mergeWidgetFallbackMap(
      opts.boardWidgets,
      opts.missingKeys,
      fallbackQueries,
      stickyMapRef.current
    );
    stickyMapRef.current = merged;
    return merged;
  }, [opts.boardWidgets, opts.missingKeys, fallbackQueries]);

  const anyFallbackLoading =
    enabled &&
    opts.missingKeys.length > 0 &&
    fallbackQueries.some((q) => q.isLoading && !q.data);

  return {
    widgetMap,
    fallbackQueries,
    anyFallbackLoading,
  };
}
