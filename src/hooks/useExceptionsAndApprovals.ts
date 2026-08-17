import { useQuery } from "@tanstack/react-query";
import {
  fetchManagementExceptions,
  type ExceptionsParams,
} from "../api/exceptions";
import {
  fetchApprovalAnalytics,
  type ApprovalAnalyticsParams,
} from "../api/approvalAnalytics";

export function useManagementExceptions(
  params: ExceptionsParams = {},
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ["management-exceptions", params],
    queryFn: () => fetchManagementExceptions(params),
    staleTime: 60_000,
    retry: 1,
    enabled: options?.enabled !== false,
  });
}

export function useApprovalAnalytics(
  params: ApprovalAnalyticsParams = {},
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ["approval-analytics", params],
    queryFn: () => fetchApprovalAnalytics(params),
    staleTime: 60_000,
    retry: 1,
    enabled: options?.enabled !== false,
  });
}
