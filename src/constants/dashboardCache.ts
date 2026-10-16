/** React Query stale window — show cached numbers, refresh in background after this. */
export const DASHBOARD_BOARD_STALE_MS = 5 * 60_000;
/** Territory-filtered boards/widgets use the same window (disk + RQ snapshot). */
export const DASHBOARD_TERRITORY_STALE_MS = 3 * 60_000;
export const DASHBOARD_WIDGET_STALE_MS = 3 * 60_000;
