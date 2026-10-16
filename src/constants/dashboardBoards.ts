/** Dashboard boards with dedicated mobile screens (batch API keys). */
export const DASHBOARD_BOARD_IDS = [
  "home",
  "sales_overview",
  "receivables_overview",
  "inventory_overview",
] as const;

export type DashboardBoardId = (typeof DASHBOARD_BOARD_IDS)[number];
