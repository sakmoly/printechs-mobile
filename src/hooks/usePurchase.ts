import { useQuery } from "@tanstack/react-query";
import {
  fetchPurchaseDashboard,
  type PurchaseParams,
} from "../api/purchase";

export function usePurchaseDashboard(
  params: PurchaseParams = {},
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ["purchase-dashboard", params],
    queryFn: () => fetchPurchaseDashboard(params),
    staleTime: 60_000,
    retry: 1,
    enabled: options?.enabled !== false,
  });
}
