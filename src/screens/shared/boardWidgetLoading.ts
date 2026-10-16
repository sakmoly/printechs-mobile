import type { DashboardWidgetDataResponse } from "../../api/dashboardWidgetData";
import { widgetPayloadHasNonZeroValue } from "../../utils/widgetPayload";

/**
 * Show cached / batch data immediately; don't block UI on slow per-widget fallbacks.
 * Keeps spinner up while map only has zero/empty shells and fetches are in flight.
 */
export function isBoardWidgetsLoading(
  boardLoading: boolean,
  boardHasData: boolean,
  fallbackLoading: boolean,
  widgetMapSize: number,
  widgetMap?: Record<string, DashboardWidgetDataResponse | undefined>,
  stillFetching?: boolean
): boolean {
  const hasUseful =
    widgetMap &&
    Object.values(widgetMap).some((w) => widgetPayloadHasNonZeroValue(w));
  if (hasUseful) return false;

  const fetching = Boolean(stillFetching || boardLoading || fallbackLoading);
  if (widgetMapSize > 0 && fetching) return true;
  if (widgetMapSize > 0 || boardHasData) return false;
  return boardLoading || fallbackLoading;
}
