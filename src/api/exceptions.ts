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
  getDemoExceptionsDashboard,
  normalizeExceptionsDashboard,
  type ExceptionsDashboard,
} from "./exceptionsTypes";

export type ExceptionsParams = {
  company?: string;
  from_date?: string;
  to_date?: string;
  period?: string;
  category?: string;
  severity?: string;
  limit?: number;
};

async function prepare() {
  const serverUrl = useAuthStore.getState().serverConfig.serverUrl;
  http.setBaseUrl(serverUrl);
  const token = await oauthApi.getValidToken();
  if (!token) throw new Error("No valid access token available");
  return useAuthStore.getState();
}

export async function fetchManagementExceptions(
  params: ExceptionsParams = {}
): Promise<ExceptionsDashboard> {
  const state = useAuthStore.getState();
  const cfg = state.mobileConfig;
  const demo = demoDataOnlyWhenNoServer(getDemoExceptionsDashboard);
  if (demo !== undefined) return demo;
  requireBaMethodEnabled(
    "get_management_exceptions",
    isApiEnabled(cfg, "get_management_exceptions")
  );

  return withBaDemoFallback(
    "get_management_exceptions",
    async () => {
      await prepare();
      const company =
        params.company ||
        resolveCompanyName(
          state.permissions.scope?.company,
          state.user?.company
        );
      const response = await http.get<any>(
        ERP_ANALYSIS.exceptions.getManagementExceptions,
        filterBaParams({ ...params, company, limit: params.limit ?? 50 }, cfg)
      );
      return normalizeExceptionsDashboard(unwrapFrappeMessage(response));
    },
    getDemoExceptionsDashboard
  );
}
