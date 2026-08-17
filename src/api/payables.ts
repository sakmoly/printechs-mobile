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
  getDemoPayablesDashboard,
  getDemoPaymentPlanning,
  normalizePayablesDashboard,
  normalizePaymentPlanning,
  type PayablesDashboard,
  type PaymentPlanning,
} from "./payablesTypes";

export type PayablesParams = {
  company?: string;
  from_date?: string;
  to_date?: string;
  period?: string;
  supplier?: string;
  limit?: number;
};

async function prepare() {
  const serverUrl = useAuthStore.getState().serverConfig.serverUrl;
  http.setBaseUrl(serverUrl);
  const token = await oauthApi.getValidToken();
  if (!token) throw new Error("No valid access token available");
  return useAuthStore.getState();
}

export async function fetchPayablesDashboard(
  params: PayablesParams = {}
): Promise<PayablesDashboard> {
  const state = useAuthStore.getState();
  const cfg = state.mobileConfig;
  const demo = demoDataOnlyWhenNoServer(getDemoPayablesDashboard);
  if (demo !== undefined) return demo;
  requireBaMethodEnabled(
    "get_payables_dashboard",
    isApiEnabled(cfg, "get_payables_dashboard")
  );

  return withBaDemoFallback(
    "get_payables_dashboard",
    async () => {
      await prepare();
      const company =
        params.company ||
        resolveCompanyName(
          state.permissions.scope?.company,
          state.user?.company
        );
      const response = await http.get<any>(
        ERP_ANALYSIS.payables.getDashboard,
        filterBaParams({ ...params, company }, cfg)
      );
      return normalizePayablesDashboard(unwrapFrappeMessage(response));
    },
    getDemoPayablesDashboard
  );
}

export async function fetchPaymentPlanning(
  params: PayablesParams = {}
): Promise<PaymentPlanning> {
  const state = useAuthStore.getState();
  const cfg = state.mobileConfig;
  const demo = demoDataOnlyWhenNoServer(getDemoPaymentPlanning);
  if (demo !== undefined) return demo;
  requireBaMethodEnabled(
    "get_payment_planning",
    isApiEnabled(cfg, "get_payment_planning")
  );

  return withBaDemoFallback(
    "get_payment_planning",
    async () => {
      await prepare();
      const company =
        params.company ||
        resolveCompanyName(
          state.permissions.scope?.company,
          state.user?.company
        );
      const response = await http.get<any>(
        ERP_ANALYSIS.payables.getPaymentPlanning,
        filterBaParams({ ...params, company, limit: params.limit ?? 50 }, cfg)
      );
      return normalizePaymentPlanning(unwrapFrappeMessage(response));
    },
    getDemoPaymentPlanning
  );
}
