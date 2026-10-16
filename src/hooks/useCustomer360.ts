import { useQuery } from "@tanstack/react-query";
import { fetchCustomer360, searchCustomers } from "../api/customer360";

export function useCustomerSearch(
  query: string,
  territory: string | undefined,
  enabled = true
) {
  const territoryKey =
    territory && territory !== "__all__" ? territory : "";
  return useQuery({
    queryKey: ["customer-search", query, territoryKey],
    queryFn: () => searchCustomers(query, { territory }),
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
    queryKey: [
      "customer-360",
      customer,
      params?.company,
      params?.from_date,
      params?.to_date,
    ],
    queryFn: () =>
      fetchCustomer360({
        customer: customer!,
        ...params,
      }),
    enabled: Boolean(customer) && options?.enabled !== false,
    staleTime: 60_000,
    retry: 1,
    placeholderData: (previousData, previousQuery) => {
      const prevCustomer = previousQuery?.queryKey?.[1];
      if (prevCustomer === customer) return previousData;
      return undefined;
    },
  });
}
