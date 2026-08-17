import { useQuery } from "@tanstack/react-query";
import {
  fetchSalesOrderDashboard,
  type SalesOrderParams,
} from "../api/salesOrders";

export function useSalesOrderDashboard(
  params: SalesOrderParams = {},
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ["sales-order-dashboard", params],
    queryFn: () => fetchSalesOrderDashboard(params),
    staleTime: 60_000,
    retry: 1,
    enabled: options?.enabled !== false,
  });
}
