import { http } from "./http";
import { useAuthStore } from "../store/auth";
import { oauthApi } from "./oauth";
import { ERP_ANALYSIS } from "./endpoints";
import { filterBaParams, unwrapFrappeMessage } from "./apiResilience";

export type CustomerAdvancePayment = {
  name?: string;
  posting_date?: string;
  unallocated_amount?: number;
  paid_amount?: number;
  reference_no?: string;
};

export type CustomerAdvancesResponse = {
  total_unallocated?: number;
  by_customer?: Array<{
    customer?: string;
    customer_name?: string;
    unallocated?: number;
    total_unallocated?: number;
  }>;
  payments?: CustomerAdvancePayment[];
};

export type CustomerAdvancesParams = {
  company?: string;
  customer?: string;
  limit?: number;
  min_unallocated?: number;
  territory?: string;
  filters?: string;
};

async function prepare() {
  http.setBaseUrl(useAuthStore.getState().serverConfig.serverUrl);
  const token = await oauthApi.getValidToken();
  if (!token) throw new Error("No valid access token available");
  return useAuthStore.getState();
}

export async function fetchCustomerAdvances(
  params: CustomerAdvancesParams
): Promise<CustomerAdvancesResponse> {
  const state = await prepare();
  const cfg = state.mobileConfig;
  const response = await http.post<unknown>(
    ERP_ANALYSIS.collection.getCustomerAdvances,
    filterBaParams(params as Record<string, unknown>, cfg)
  );
  const root = unwrapFrappeMessage(response) as Record<string, unknown>;
  const msg =
    root.message && typeof root.message === "object"
      ? (root.message as Record<string, unknown>)
      : root;
  return {
    total_unallocated: Number(msg.total_unallocated ?? msg.total) || undefined,
    by_customer: Array.isArray(msg.by_customer)
      ? (msg.by_customer as CustomerAdvancesResponse["by_customer"])
      : undefined,
    payments: Array.isArray(msg.payments)
      ? (msg.payments as CustomerAdvancePayment[])
      : undefined,
  };
}
