import { useQuery } from "@tanstack/react-query";
import {
  fetchPayablesDashboard,
  fetchPaymentPlanning,
  type PayablesParams,
} from "../api/payables";

export function usePayablesDashboard(
  params: PayablesParams = {},
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ["payables-dashboard", params],
    queryFn: () => fetchPayablesDashboard(params),
    staleTime: 60_000,
    retry: 1,
    enabled: options?.enabled !== false,
  });
}

export function usePaymentPlanning(
  params: PayablesParams = {},
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ["payment-planning", params],
    queryFn: () => fetchPaymentPlanning(params),
    staleTime: 60_000,
    retry: 1,
    enabled: options?.enabled !== false,
  });
}
