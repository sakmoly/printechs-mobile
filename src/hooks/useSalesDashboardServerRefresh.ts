import { useCallback, useMemo, useState } from "react";
import { Alert } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../store/auth";
import { useBootstrapStore } from "../store/bootstrap";
import { resolveCompanyName } from "../api/apiResilience";
import { canRefreshSalesDashboard } from "../types/bootstrap";
import {
  formatRefreshSalesDashboardSuccess,
  refreshSalesDashboardErrorMessage,
  runManualSalesDataRefresh,
  type RefreshSalesDashboardPeriod,
} from "../api/salesDashboardRefresh";

type Options = {
  /**
   * After server rebuild — e.g. sales screen `refreshBoard()` (get_dashboard_board_data refresh=1).
   * If omitted, hook refetches home + sales_overview boards.
   */
  onBoardReload?: () => Promise<void>;
};

export function useSalesDashboardServerRefresh(options?: Options) {
  const bootstrap = useBootstrapStore((s) => s.bootstrap);
  const permissions = useAuthStore((s) => s.permissions);
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  const canRefresh = canRefreshSalesDashboard(bootstrap);

  const company = useMemo(() => {
    const fromScope = String(permissions.scope?.company || "").trim();
    if (fromScope) return fromScope;
    const fromBootstrap = String(bootstrap?.context?.company || "").trim();
    if (fromBootstrap) return fromBootstrap;
    if (permissions.fetched) {
      return resolveCompanyName(null, user?.company, null);
    }
    return undefined;
  }, [
    permissions.fetched,
    permissions.scope?.company,
    bootstrap?.context?.company,
    user?.company,
  ]);

  const runRefresh = useCallback(
    async (scope: "daily" | "full", period?: RefreshSalesDashboardPeriod) => {
      if (!canRefresh) return;
      if (!company) {
        Alert.alert(
          "Company required",
          "Company context is not loaded yet. Try again in a moment."
        );
        return;
      }

      setBusy(true);
      try {
        const result = await runManualSalesDataRefresh({
          company,
          scope,
          period,
          queryClient,
          onBoardReload: options?.onBoardReload,
        });
        Alert.alert(
          "Sales data updated",
          formatRefreshSalesDashboardSuccess(result)
        );
      } catch (error) {
        Alert.alert("Refresh failed", refreshSalesDashboardErrorMessage(error));
      } finally {
        setBusy(false);
      }
    },
    [canRefresh, company, options?.onBoardReload, queryClient]
  );

  const promptAndRefresh = useCallback(() => {
    if (!canRefresh) return;
    Alert.alert(
      "Refresh sales data",
      "Rebuilds sales KPIs on the server (tabSalesDashBoard), then reloads dashboard widgets. Last 3 months can take several minutes — keep the app open.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Today only",
          onPress: () => void runRefresh("daily"),
        },
        {
          text: "Last 3 months",
          onPress: () => void runRefresh("full", "last_3_months"),
        },
      ]
    );
  }, [canRefresh, runRefresh]);

  return {
    canRefresh,
    busy,
    company,
    promptAndRefresh,
    runRefresh,
  };
}
