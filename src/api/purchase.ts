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
  getDemoPurchaseDashboard,
  normalizePurchaseDashboard,
  type PurchaseDashboard,
} from "./purchaseTypes";

export type PurchaseParams = {
  company?: string;
  from_date?: string;
  to_date?: string;
  period?: string;
  supplier?: string;
  category?: string;
  status?: string;
  limit?: number;
};

async function prepare() {
  const serverUrl = useAuthStore.getState().serverConfig.serverUrl;
  http.setBaseUrl(serverUrl);
  const token = await oauthApi.getValidToken();
  if (!token) throw new Error("No valid access token available");
  return useAuthStore.getState();
}

export async function fetchPurchaseDashboard(
  params: PurchaseParams = {}
): Promise<PurchaseDashboard> {
  const state = useAuthStore.getState();
  const cfg = state.mobileConfig;
  const demo = demoDataOnlyWhenNoServer(getDemoPurchaseDashboard);
  if (demo !== undefined) return demo;
  requireBaMethodEnabled(
    "get_purchase_dashboard",
    isApiEnabled(cfg, "get_purchase_dashboard")
  );

  return withBaDemoFallback(
    "get_purchase_dashboard",
    async () => {
      await prepare();
      const company =
        params.company ||
        resolveCompanyName(
          state.permissions.scope?.company,
          state.user?.company
        );
      const response = await http.get<any>(
        ERP_ANALYSIS.purchase.getDashboard,
        filterBaParams({ ...params, company }, cfg)
      );
      return normalizePurchaseDashboard(unwrapFrappeMessage(response));
    },
    getDemoPurchaseDashboard
  );
}
