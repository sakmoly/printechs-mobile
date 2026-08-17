import { http } from "./http";
import { useAuthStore } from "../store/auth";
import { oauthApi } from "./oauth";
import { ERP_ANALYSIS } from "./endpoints";
import { isApiEnabled } from "./mobileConfig";
import {
  demoDataOnlyWhenNoServer,
  filterBaParams,
  requireBaMethodEnabled,
  resolveCompanyName,
  unwrapFrappeMessage,
  withBaDemoFallback,
} from "./apiResilience";
import {
  getDemoApprovalAnalytics,
  normalizeApprovalAnalytics,
  type ApprovalAnalytics,
} from "./approvalAnalyticsTypes";

export type ApprovalAnalyticsParams = {
  company?: string;
  from_date?: string;
  to_date?: string;
  period?: string;
  doctype?: string;
  user?: string;
  limit?: number;
};

async function prepare() {
  const serverUrl = useAuthStore.getState().serverConfig.serverUrl;
  http.setBaseUrl(serverUrl);
  const token = await oauthApi.getValidToken();
  if (!token) throw new Error("No valid access token available");
  return useAuthStore.getState();
}

export async function fetchApprovalAnalytics(
  params: ApprovalAnalyticsParams = {}
): Promise<ApprovalAnalytics> {
  const state = useAuthStore.getState();
  const cfg = state.mobileConfig;
  const demo = demoDataOnlyWhenNoServer(getDemoApprovalAnalytics);
  if (demo !== undefined) return demo;
  requireBaMethodEnabled(
    "get_approval_analytics",
    isApiEnabled(cfg, "get_approval_analytics")
  );

  return withBaDemoFallback(
    "get_approval_analytics",
    async () => {
      await prepare();
      const company =
        params.company ||
        resolveCompanyName(
          state.permissions.scope?.company,
          state.user?.company
        );
      const response = await http.get<any>(
        ERP_ANALYSIS.approvalAnalytics.get,
        filterBaParams({ ...params, company }, cfg)
      );
      return normalizeApprovalAnalytics(unwrapFrappeMessage(response));
    },
    getDemoApprovalAnalytics
  );
}
