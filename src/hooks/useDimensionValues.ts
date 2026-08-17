/**
 * React Query hook for logical dimension values (Phase G).
 * Never requests physical ERPNext field names.
 */

import { useQuery } from "@tanstack/react-query";
import {
  getDimensionValues,
  type DimensionValue,
  type GetDimensionValuesParams,
} from "../api/dimensions";
import { assertLogicalDimensionKey } from "../dimensions/logicalKeys";

export function useDimensionValues(
  params: GetDimensionValuesParams,
  options?: { enabled?: boolean; staticFallback?: DimensionValue[] }
) {
  const logicalOk = assertLogicalDimensionKey(params.dimension);
  const enabled =
    options?.enabled !== false && logicalOk && Boolean(params.dimension);

  return useQuery({
    queryKey: [
      "dimension-values",
      params.dimension,
      params.search || "",
      params.limit ?? 50,
      params.company || "",
    ],
    queryFn: async () => {
      const rows = await getDimensionValues(params);
      if (rows.length) return rows;
      return options?.staticFallback || [];
    },
    staleTime: 5 * 60_000,
    retry: 0,
    enabled,
    placeholderData: options?.staticFallback,
  });
}
