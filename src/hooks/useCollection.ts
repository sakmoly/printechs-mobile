import { useQuery } from "@tanstack/react-query";
import {
  fetchCollectionAttention,
  fetchCollectionDashboard,
  type CollectionParams,
} from "../api/collection";

export function useCollectionDashboard(
  params: CollectionParams = {},
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ["collection-dashboard", params],
    queryFn: () => fetchCollectionDashboard(params),
    staleTime: 60_000,
    retry: 1,
    enabled: options?.enabled !== false,
  });
}

export function useCollectionAttention(
  params: CollectionParams = {},
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ["collection-attention", params],
    queryFn: () => fetchCollectionAttention(params),
    staleTime: 60_000,
    retry: 1,
    enabled: options?.enabled !== false,
  });
}
