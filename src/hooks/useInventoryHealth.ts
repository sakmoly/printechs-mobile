import { useQuery } from "@tanstack/react-query";
import {
  fetchDeadStock,
  fetchInventoryHealth,
  fetchStockCover,
  type InventoryHealthParams,
} from "../api/inventoryHealth";

export function useInventoryHealth(
  params: InventoryHealthParams = {},
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ["inventory-health", params],
    queryFn: () => fetchInventoryHealth(params),
    staleTime: 60_000,
    retry: 1,
    enabled: options?.enabled !== false,
  });
}

export function useStockCover(
  params: InventoryHealthParams = {},
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ["stock-cover", params],
    queryFn: () => fetchStockCover(params),
    staleTime: 60_000,
    retry: 1,
    enabled: options?.enabled !== false,
  });
}

export function useDeadStock(
  params: InventoryHealthParams = {},
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ["dead-stock", params],
    queryFn: () => fetchDeadStock(params),
    staleTime: 60_000,
    retry: 1,
    enabled: options?.enabled !== false,
  });
}
