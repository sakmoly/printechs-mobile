import type { QueryClient } from "@tanstack/react-query";
import { http } from "./http";
import { ERP_ANALYSIS } from "./endpoints";
import { extractFrappeErrorMessage } from "./baErrors";
import { fetchDashboardBoardData } from "./dashboardBoardData";
import { resolvePeriod } from "../utils/period";

/** Server rebuild of tabSalesDashBoard can run many minutes for last_3_months. */
export const REFRESH_SALES_DASHBOARD_TIMEOUT_MS = 600_000;

export type RefreshSalesDashboardResult = {
  ok?: boolean;
  period?: string;
  from_date?: string;
  to_date?: string;
  message?: string;
  duration_seconds?: number;
  api?: string;
};

function unwrapRefreshPayload(data: unknown): RefreshSalesDashboardResult {
  const root = data as Record<string, unknown> | null | undefined;
  const msg = root?.message ?? root;
  if (msg && typeof msg === "object" && !Array.isArray(msg)) {
    return msg as RefreshSalesDashboardResult;
  }
  if (typeof msg === "string" && msg.trim()) {
    return { ok: true, message: msg.trim() };
  }
  return { ok: Boolean(root?.ok) };
}

/** Daily shortcut — replaces only today's rows in tabSalesDashBoard. */
export async function refreshSalesDashboardDaily(
  company?: string
): Promise<RefreshSalesDashboardResult> {
  const body: Record<string, string> = {};
  const co = String(company || "").trim();
  if (co) body.company = co;

  const response = await http.post<unknown>(
    ERP_ANALYSIS.config.refreshSalesDashboardDaily,
    body,
    { timeout: REFRESH_SALES_DASHBOARD_TIMEOUT_MS }
  );
  const result = unwrapRefreshPayload(response);
  if (result.ok === false) {
    throw new Error(result.message || "Sales dashboard refresh failed");
  }
  return result;
}

export type RefreshSalesDashboardPeriod =
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly"
  | "last_3_months"
  | "custom";

export async function refreshSalesDashboard(input: {
  company?: string;
  period?: RefreshSalesDashboardPeriod;
  from_date?: string;
  to_date?: string;
}): Promise<RefreshSalesDashboardResult> {
  const body: Record<string, string> = {};
  const co = String(input.company || "").trim();
  if (co) body.company = co;
  if (input.period) body.period = input.period;
  if (input.from_date) body.from_date = input.from_date;
  if (input.to_date) body.to_date = input.to_date;

  const response = await http.post<unknown>(
    ERP_ANALYSIS.config.refreshSalesDashboard,
    body,
    { timeout: REFRESH_SALES_DASHBOARD_TIMEOUT_MS }
  );
  const result = unwrapRefreshPayload(response);
  if (result.ok === false) {
    throw new Error(result.message || "Sales dashboard refresh failed");
  }
  return result;
}

export function formatRefreshSalesDashboardSuccess(
  result: RefreshSalesDashboardResult
): string {
  const parts: string[] = [];
  if (result.message) parts.push(result.message);
  else if (result.period && result.from_date && result.to_date) {
    parts.push(
      `Sales dashboard updated for ${result.period} (${result.from_date} – ${result.to_date}).`
    );
  } else {
    parts.push("Sales dashboard updated on the server.");
  }
  if (typeof result.duration_seconds === "number") {
    parts.push(`(${result.duration_seconds.toFixed(2)}s)`);
  }
  return parts.join(" ");
}

export function refreshSalesDashboardErrorMessage(error: unknown): string {
  return (
    extractFrappeErrorMessage(error) ||
    (error instanceof Error ? error.message : null) ||
    "Could not refresh sales dashboard."
  );
}

/** Step 4 — invalidate React Query caches that depend on tabSalesDashBoard. */
export async function invalidateKpisAfterSalesRefresh(
  queryClient: QueryClient
): Promise<void> {
  await queryClient.invalidateQueries({
    predicate: (query) => {
      const root = query.queryKey[0];
      return (
        root === "dashboard-board-data" ||
        root === "dashboard-widget-data" ||
        root === "customer-360" ||
        root === "customer-search" ||
        root === "sales-dashboard" ||
        root === "executive-dashboard"
      );
    },
  });
}

/**
 * Step 3 — pull fresh widget batch after server rebuild (refresh: 1).
 * Home + sales boards cover executive KPIs and sales tab.
 */
export async function refetchDashboardBoardsAfterSalesRefresh(
  company: string
): Promise<void> {
  const ytd = resolvePeriod("ytd");
  const boards = ["home", "sales_overview"] as const;

  for (const dashboard_id of boards) {
    try {
      await fetchDashboardBoardData({
        dashboard_id,
        company,
        from_date: ytd.from_date,
        to_date: ytd.to_date,
        period: ytd.preset,
        refresh: 1,
      });
    } catch {
      /* board may be disabled on profile — continue */
    }
  }
}

/**
 * Manual mobile refresh (no bench CLI):
 * 1) refresh_sales_dashboard*
 * 2) wait for { ok: true }
 * 3) get_dashboard_board_data refresh=1
 * 4) invalidate Customer 360 / widget queries
 */
export async function runManualSalesDataRefresh(input: {
  company: string;
  scope: "daily" | "full";
  period?: RefreshSalesDashboardPeriod;
  queryClient: QueryClient;
  onBoardReload?: () => Promise<void>;
}): Promise<RefreshSalesDashboardResult> {
  const result =
    input.scope === "daily"
      ? await refreshSalesDashboardDaily(input.company)
      : await refreshSalesDashboard({
          company: input.company,
          period: input.period ?? "last_3_months",
        });

  if (input.onBoardReload) {
    await input.onBoardReload();
  } else {
    await refetchDashboardBoardsAfterSalesRefresh(input.company);
  }
  await invalidateKpisAfterSalesRefresh(input.queryClient);
  return result;
}
