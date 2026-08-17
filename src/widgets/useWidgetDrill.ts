/**
 * Drill state for profile dashboard chart widgets.
 * Uses get_dashboard_widget_data when available; otherwise generic analysis
 * + client-side drill_path from widget config.
 */

import { useCallback, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { MobileWidgetConfig } from "../types/bootstrap";
import {
  fetchDashboardWidgetData,
  resolveWidgetDrillPath,
  type DrillFilters,
  type DrillStackEntry,
  type DashboardWidgetDataResponse,
} from "../api/dashboardWidgetData";
import { assertLogicalDimensionKey } from "../dimensions/logicalKeys";
import { normalizeWidgetType } from "./types";

type Options = {
  company?: string;
  from_date?: string;
  to_date?: string;
  period?: string;
  limit?: number;
  enabled?: boolean;
  /**
   * Root payload from get_dashboard_board_data.
   * When set and stack is empty, skip per-widget fetch.
   */
  batchPayload?: DashboardWidgetDataResponse | null;
  /** Board batch still loading — show skeleton at root */
  boardLoading?: boolean;
  /**
   * When true, fetch get_dashboard_widget_data at root (batch missing/failed).
   * When false and no batchPayload, wait for board (or show empty skeleton).
   */
  usePerWidgetFallback?: boolean;
};

function defaultDimension(widget: MobileWidgetConfig): string {
  if (
    widget.dimension_key &&
    assertLogicalDimensionKey(widget.dimension_key)
  ) {
    return widget.dimension_key;
  }
  const cfg = widget.config || {};
  const fromCfg = cfg.dimension_key ?? cfg.dimension;
  if (fromCfg != null && assertLogicalDimensionKey(String(fromCfg))) {
    return String(fromCfg);
  }
  // Infer from widget key: sales_brand → brand, sales_card territory, etc.
  const key = String(widget.key || "").toLowerCase();
  if (/brand/.test(key) && assertLogicalDimensionKey("brand")) return "brand";
  if (/customer/.test(key) && assertLogicalDimensionKey("customer"))
    return "customer";
  if (/warehouse|stock|inventory/.test(key) && assertLogicalDimensionKey("warehouse"))
    return "warehouse";
  if (/territor/.test(key) && assertLogicalDimensionKey("territory"))
    return "territory";

  const drill = resolveWidgetDrillPath(widget.config);
  if (drill[0] && assertLogicalDimensionKey(drill[0])) {
    // Prefer last drill step when key implies it (e.g. brand in drill_path)
    const implied = drill.find((d) => key.includes(d));
    if (implied) return implied;
    return drill[0];
  }

  const t = normalizeWidgetType(widget.type);
  if (
    [
      "EXPANDABLE",
      "PIE",
      "DONUT",
      "BAR",
      "LINE",
      "RANKING",
      "LIST",
      "TABLE",
      "KPI",
      "MATRIX",
    ].includes(t)
  ) {
    return "territory";
  }
  return "territory";
}

/** Stable key so identical drill filters reuse React Query cache. */
function filtersKey(filters: DrillFilters): string {
  const keys = Object.keys(filters).sort();
  const out: Record<string, string[]> = {};
  for (const k of keys) {
    out[k] = [...(filters[k] || [])].map(String).sort();
  }
  return JSON.stringify(out);
}

export function useWidgetDrill(widget: MobileWidgetConfig, options: Options) {
  const [stack, setStack] = useState<DrillStackEntry[]>([]);
  const [filters, setFilters] = useState<DrillFilters>({});
  const [dimensionOverride, setDimensionOverride] = useState<string | null>(
    null
  );

  const configDrillPath = useMemo(
    () => resolveWidgetDrillPath(widget.config),
    [widget.config]
  );

  const rootDimension = defaultDimension(widget);
  const metric = widget.metric_key || "net_sales";
  const activeDimension = dimensionOverride || rootDimension;
  // Always ask BA for LY; server returns it only when Desk checkbox is on.
  // Bootstrap often omits show_ly even when Desk has it checked.
  const showLy =
    widget.config?.show_ly === false ||
    widget.config?.show_ly === 0 ||
    widget.config?.show_ly === "0" ||
    widget.config?.show_ly_comparison === false ||
    widget.config?.show_ly_comparison === 0
      ? false
      : true;

  const limit =
    options.limit ??
    (["TABLE", "LIST", "MATRIX"].includes(normalizeWidgetType(widget.type))
      ? 16
      : normalizeWidgetType(widget.type) === "KPI"
        ? 8
        : 10);

  const fKey = filtersKey(filters);
  const drilled = stack.length > 0;
  const batchAtRoot =
    !drilled && options.batchPayload != null && !options.usePerWidgetFallback;
  const singleEnabled =
    options.enabled !== false &&
    Boolean(widget.key) &&
    (drilled || Boolean(options.usePerWidgetFallback));

  const query = useQuery({
    queryKey: [
      "dashboard-widget-data",
      widget.key,
      activeDimension,
      fKey,
      options.company,
      options.from_date,
      options.to_date,
      options.period,
      limit,
      metric,
      showLy,
    ],
    queryFn: () =>
      fetchDashboardWidgetData({
        widget_key: widget.key,
        company: options.company,
        from_date: options.from_date,
        to_date: options.to_date,
        period: options.period,
        dimension: activeDimension,
        filters,
        drill_depth: stack.length || undefined,
        limit,
        metric,
        show_ly: showLy,
      }),
    // Drill levels stay warm so Back is instant
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    // Keep prior chart visible while the next drill level loads
    placeholderData: keepPreviousData,
    retry: 1,
    enabled: singleEnabled,
  });

  const data = batchAtRoot ? options.batchPayload! : query.data;

  const serverDrillPath = useMemo(() => {
    const raw = data?.meta.drill_path;
    if (Array.isArray(raw) && raw.length) {
      return raw.map(String).filter((k) => assertLogicalDimensionKey(k));
    }
    return configDrillPath;
  }, [data?.meta.drill_path, configDrillPath]);

  const nextDimension = useMemo(() => {
    if (data?.meta.next_dimension) {
      return String(data.meta.next_dimension);
    }
    // Client-side drill when BA returns generic fallback but Desk set drill_path
    if (serverDrillPath.length > stack.length + 1) {
      return serverDrillPath[stack.length + 1];
    }
    if (
      serverDrillPath.length > 0 &&
      serverDrillPath[0] === activeDimension &&
      serverDrillPath.length > stack.length + 1
    ) {
      return serverDrillPath[stack.length + 1];
    }
    const idx = serverDrillPath.indexOf(activeDimension);
    if (idx >= 0 && idx < serverDrillPath.length - 1) {
      return serverDrillPath[idx + 1];
    }
    if (serverDrillPath.length > stack.length) {
      const candidate =
        serverDrillPath[stack.length + 1] ?? serverDrillPath[stack.length];
      if (candidate && candidate !== activeDimension) return candidate;
    }
    return null;
  }, [
    data?.meta.next_dimension,
    serverDrillPath,
    stack.length,
    activeDimension,
  ]);

  const drillable = Boolean(
    data?.meta.drillable ||
      (nextDimension && nextDimension !== activeDimension)
  );

  const onSliceTap = useCallback(
    async (point: { label: string; id?: string; dimension_value?: string }) => {
      if (!drillable || !nextDimension) return;
      if (!assertLogicalDimensionKey(nextDimension)) return;

      const value = String(
        point.dimension_value || point.id || point.label || ""
      ).trim();
      if (!value || value === "_other") return;

      const activeDim = activeDimension;
      const nextFilters: DrillFilters = {
        ...filters,
        [activeDim]: [value],
      };

      setStack((s) => [
        ...s,
        { dimension: activeDim, label: point.label, value },
      ]);
      setFilters(nextFilters);
      setDimensionOverride(nextDimension);
    },
    [drillable, nextDimension, activeDimension, filters]
  );

  const goBack = useCallback(() => {
    if (stack.length === 0) {
      setFilters({});
      setDimensionOverride(null);
      return;
    }
    const newStack = stack.slice(0, -1);
    const newFilters: DrillFilters = {};
    for (const entry of newStack) {
      newFilters[entry.dimension] = [entry.value];
    }
    setStack(newStack);
    setFilters(newFilters);
    if (newStack.length === 0) {
      setDimensionOverride(null);
    } else if (serverDrillPath.length > newStack.length) {
      setDimensionOverride(serverDrillPath[newStack.length]);
    } else {
      setDimensionOverride(rootDimension);
    }
  }, [stack, serverDrillPath, rootDimension]);

  const resetDrill = useCallback(() => {
    setStack([]);
    setFilters({});
    setDimensionOverride(null);
  }, []);

  const hasData = Boolean(
    data?.rows?.length ||
      data?.kpis?.length ||
      data?.chart?.summary ||
      data?.table?.rows?.length ||
      data?.chart?.series?.length
  );

  const waitingForBoard =
    !drilled &&
    !options.usePerWidgetFallback &&
    options.batchPayload == null &&
    Boolean(options.boardLoading);

  return {
    data,
    /** First load only — blank state */
    isLoading:
      waitingForBoard ||
      (query.isLoading && !hasData && !batchAtRoot),
    /** Soft refresh / drill fetch — keep chart, show small spinner */
    isFetching: query.isFetching && hasData && drilled,
    error: batchAtRoot ? null : query.error,
    stack,
    filters,
    activeDimension,
    drillable,
    nextDimension,
    drillPath: serverDrillPath,
    onSliceTap,
    goBack,
    resetDrill,
    refetch: query.refetch,
    metric,
  };
}
