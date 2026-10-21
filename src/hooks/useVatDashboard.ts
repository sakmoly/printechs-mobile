import { useQuery } from "@tanstack/react-query";
import { fetchVatDashboard, type VatDashboardParams } from "../api/vat";

export function vatDashboardQueryKey(params: VatDashboardParams) {
  return [
    "vat-dashboard",
    params.company || "",
    params.period || "",
    params.from_date || "",
    params.to_date || "",
    params.territory || "",
  ] as const;
}

export function useVatDashboard(
  params: VatDashboardParams,
  enabled = true
) {
  return useQuery({
    queryKey: vatDashboardQueryKey(params),
    queryFn: () => fetchVatDashboard(params),
    enabled:
      enabled &&
      Boolean(params.company) &&
      Boolean(params.from_date && params.to_date),
    staleTime: 60_000,
  });
}
