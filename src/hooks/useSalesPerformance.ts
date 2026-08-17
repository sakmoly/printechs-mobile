import { useQuery } from "@tanstack/react-query";
import {
  fetchProductPerformance,
  fetchSalesInvoiceItems,
  fetchSalespersonInvoices,
  fetchSalespersonPerformance,
  type ProductPerfParams,
  type SalesPerfParams,
} from "../api/salesPerformance";

export function useSalespersonPerformance(
  params: SalesPerfParams = {},
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ["salesperson-performance", params],
    queryFn: () => fetchSalespersonPerformance(params),
    staleTime: 60_000,
    retry: 1,
    enabled: options?.enabled !== false,
  });
}

export function useSalespersonInvoices(
  params: {
    salesperson?: string;
    salesperson_id?: string;
    company?: string;
    from_date?: string;
    to_date?: string;
  },
  options?: { enabled?: boolean }
) {
  const sp = params.salesperson?.trim() || "";
  return useQuery({
    queryKey: ["salesperson-invoices", params],
    queryFn: () =>
      fetchSalespersonInvoices({
        salesperson: sp,
        salesperson_id: params.salesperson_id,
        company: params.company,
        from_date: params.from_date,
        to_date: params.to_date,
      }),
    staleTime: 60_000,
    retry: 1,
    enabled: options?.enabled !== false && Boolean(sp),
  });
}

export function useSalesInvoiceItems(
  invoice?: string,
  options?: { enabled?: boolean }
) {
  const name = invoice?.trim() || "";
  return useQuery({
    queryKey: ["sales-invoice-items", name],
    queryFn: () => fetchSalesInvoiceItems(name),
    staleTime: 60_000,
    retry: 1,
    enabled: options?.enabled !== false && Boolean(name),
  });
}

export function useProductPerformance(
  params: ProductPerfParams = {},
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ["product-performance", params],
    queryFn: () => fetchProductPerformance(params),
    staleTime: 60_000,
    retry: 1,
    enabled: options?.enabled !== false,
  });
}
