import type { DashboardWidgetDataResponse } from "../../api/dashboardWidgetData";
import { preferWidgetPayload } from "../../utils/widgetPayload";

/**
 * Merge board + fallback widgets.
 * Board batch always wins per key (territory/date scope) — do not keep stale sticky values.
 * Per-widget fallback still uses preferWidgetPayload so a transient empty refetch does not wipe data.
 */
export function mergeWidgetFallbackMap(
  boardWidgets:
    | Record<string, DashboardWidgetDataResponse | undefined>
    | undefined,
  keys: string[],
  queries: Array<{ data?: DashboardWidgetDataResponse }>,
  previousMap?: Record<string, DashboardWidgetDataResponse | undefined>
): Record<string, DashboardWidgetDataResponse> {
  const map: Record<string, DashboardWidgetDataResponse> = {};

  for (const [key, value] of Object.entries(previousMap || {})) {
    if (value) map[key] = value;
  }

  for (const [key, value] of Object.entries(boardWidgets || {})) {
    if (!value) continue;
    map[key] = value;
  }

  keys.forEach((key, i) => {
    const data = queries[i]?.data;
    if (!data) return;
    const picked = preferWidgetPayload(map[key], data);
    if (picked) map[key] = picked;
  });

  return map;
}
