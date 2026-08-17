import { useQuery } from "@tanstack/react-query";
import {
  fetchProfitabilityDashboard,
  type ProfitabilityParams,
} from "../api/profitability";

export function useProfitabilityDashboard(
  params: ProfitabilityParams = {},
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ["profitability-dashboard", params],
    queryFn: () => fetchProfitabilityDashboard(params),
    staleTime: 60_000,
    retry: 1,
    enabled: options?.enabled !== false,
  });
}
