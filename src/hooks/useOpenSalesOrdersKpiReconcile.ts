import { useEffect, useState } from "react";
import { fetchDashboardWidgetData } from "../api/dashboardWidgetData";
import type { AnalysisRow } from "../api/genericAnalysisTypes";
import type { DrillFilters } from "../api/dashboardWidgetData";
import {
  openSalesOrdersDrillWidgetKey,
  type OpenSalesOrdersKpiDisplay,
} from "../utils/openSalesOrdersKpi";
import { openAmountFromOpenSoRow } from "../utils/openSalesOrderRows";

type Scope = {
  company?: string;
  from_date?: string;
  to_date?: string;
  period?: string;
  filters?: DrillFilters;
  view_all_sales?: 0 | 1;
  enabled?: boolean;
};

function rowsFromPayload(raw: {
  table?: { rows?: AnalysisRow[] };
  rows?: AnalysisRow[];
}): AnalysisRow[] {
  if (raw.table?.rows?.length) return raw.table.rows;
  return raw.rows || [];
}

/**
 * Loads open SO drill list (same as KPI tap) so dashboard count/SAR match the list.
 */
export function useOpenSalesOrdersKpiReconcile(scope: Scope): {
  data: OpenSalesOrdersKpiDisplay | null;
  isLoading: boolean;
} {
  const [display, setDisplay] = useState<OpenSalesOrdersKpiDisplay | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);

  const filtersKey = JSON.stringify(scope.filters ?? {});

  useEffect(() => {
    if (!scope.enabled || !scope.company) {
      setDisplay(null);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    const timer = setTimeout(() => {
      if (!cancelled) setIsLoading(false);
    }, 20_000);

    (async () => {
      try {
        const data = await fetchDashboardWidgetData({
          widget_key: openSalesOrdersDrillWidgetKey(),
          company: scope.company,
          from_date: scope.from_date,
          to_date: scope.to_date,
          period: scope.period,
          filters: scope.filters,
          drill_depth: 1,
          limit: 500,
          show_ly: false,
          view_all_sales: scope.view_all_sales,
        });
        if (cancelled) return;
        const rows = rowsFromPayload(data);
        const meta = (data.meta || {}) as Record<string, unknown>;
        const summed = rows.reduce(
          (s, r) => s + openAmountFromOpenSoRow(r),
          0
        );
        const orderCount =
          rows.length ||
          Number(meta.open_so_count ?? meta.total_rows) ||
          0;
        const totalValue =
          (summed > 0 ? summed : 0) ||
          Number(meta.open_so_value ?? meta.pending_delivery_value) ||
          0;
        const currency = String(
          data.currency || meta.currency || "SAR"
        );
        setDisplay({
          orderCount,
          totalValue,
          currency,
          source: "drill_list",
        });
      } catch {
        if (!cancelled) setDisplay(null);
      } finally {
        if (!cancelled) {
          clearTimeout(timer);
          setIsLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      setIsLoading(false);
    };
  }, [
    scope.enabled,
    scope.company,
    scope.from_date,
    scope.to_date,
    scope.period,
    filtersKey,
    scope.view_all_sales,
  ]);

  return { data: display, isLoading };
}
