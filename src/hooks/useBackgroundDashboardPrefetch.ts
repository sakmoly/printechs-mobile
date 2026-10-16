/**
 * Warm disk + memory cache for all dashboard boards, then prefetch in background.
 * Runs once per session after bootstrap + company + access scope are known.
 * Prefers profile default branch (YTD) so Home / Sales / Receivables / Inventory paint faster.
 */

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../store/auth";
import { useBootstrapStore } from "../store/bootstrap";
import { resolveCompanyName } from "../api/apiResilience";
import { resolveProfileDefaultTerritory } from "../api/accessScope";
import {
  dashboardBoardQueryKey,
  fetchDashboardBoardData,
  type DashboardBoardDataRequest,
} from "../api/dashboardBoardData";
import {
  getActiveSessionUserKey,
  hydrateAllDashboardBoards,
} from "../api/sessionCache";
import { DASHBOARD_BOARD_IDS } from "../constants/dashboardBoards";
import { DASHBOARD_TERRITORY_STALE_MS } from "../constants/dashboardCache";
import { defaultPeriod } from "../utils/period";
import {
  ALL_TERRITORIES,
  territoryFilterKey,
  territoryFilters,
} from "../utils/dashboardTerritory";
import { logger } from "../utils/logger";

function boardPrefetchParams(
  dashboard_id: string,
  company: string,
  period: ReturnType<typeof defaultPeriod>,
  filters: DashboardBoardDataRequest["filters"]
): DashboardBoardDataRequest {
  return {
    dashboard_id,
    company,
    from_date: period.from_date,
    to_date: period.to_date,
    period: period.preset,
    filters,
    show_ly: true,
  };
}

export function useBackgroundDashboardPrefetch() {
  const queryClient = useQueryClient();
  const permissions = useAuthStore((s) => s.permissions);
  const user = useAuthStore((s) => s.user);
  const bootstrapLoaded = useBootstrapStore((s) => s.loaded);
  const warmedRef = useRef("");

  useEffect(() => {
    if (!bootstrapLoaded || !permissions.fetched) return;

    const company = resolveCompanyName(
      permissions.scope?.company,
      user?.company
    );
    if (!company) return;

    const userKey = getActiveSessionUserKey();
    if (!userKey) return;

    const period = defaultPeriod();
    const defaultTerritory = resolveProfileDefaultTerritory(permissions.scope);
    const territoryKey = territoryFilterKey(defaultTerritory);
    const branchFilters = territoryFilters(defaultTerritory);

    const warmKey = `${userKey}|${company}|${period.preset}|${period.from_date}|${territoryKey || "all"}`;
    if (warmedRef.current === warmKey) return;
    warmedRef.current = warmKey;

    void (async () => {
      await hydrateAllDashboardBoards(userKey, company, period);
      if (territoryKey) {
        await hydrateAllDashboardBoards(
          userKey,
          company,
          period,
          territoryKey
        );
      }

      const boards = DASHBOARD_BOARD_IDS.filter((id) => id !== "home");
      const prefetchFilters =
        defaultTerritory !== ALL_TERRITORIES && branchFilters
          ? branchFilters
          : undefined;

      await Promise.allSettled(
        ["home", ...boards].map(async (dashboard_id) => {
          const params = boardPrefetchParams(
            dashboard_id,
            company,
            period,
            prefetchFilters
          );
          const queryKey = dashboardBoardQueryKey(params);
          if (queryClient.getQueryData(queryKey)) return;

          return queryClient.prefetchQuery({
            queryKey,
            queryFn: () =>
              fetchDashboardBoardData({ ...params, refresh: false }),
            staleTime: DASHBOARD_TERRITORY_STALE_MS,
          });
        })
      );

      logger.debug("[prefetch] dashboard boards cache warmed", {
        boards: DASHBOARD_BOARD_IDS.length,
        company,
        territory: territoryKey || "all",
        period: period.preset,
      });
    })();
  }, [
    bootstrapLoaded,
    permissions.fetched,
    permissions.scope,
    user?.company,
    queryClient,
  ]);
}
