import { useQuery } from "@tanstack/react-query";
import { fetchCustomer360, searchCustomers } from "../api/customer360";

export function useCustomerSearch(query: string, enabled = true) {
  return useQuery({
    queryKey: ["customer-search", query],
    queryFn: () => searchCustomers(query),
    enabled: enabled && query.trim().length >= 0,
    staleTime: 30_000,
    retry: 1,
  });
}

export function useCustomer360(
  customer: string | undefined,
  params?: { from_date?: string; to_date?: string; company?: string },
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ["customer-360", customer, params],
    queryFn: () =>
      fetchCustomer360({
        customer: customer!,
        ...params,
      }),
    enabled: Boolean(customer) && options?.enabled !== false,
    staleTime: 60_000,
    retry: 1,
  });
}
