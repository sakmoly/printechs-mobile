import { useQuery } from "@tanstack/react-query";
import { fetchGenericAnalysis } from "../../api/genericAnalysis";
import type { GenericAnalysisRequest } from "../../api/genericAnalysisTypes";

export function useGenericAnalysis(
  params: GenericAnalysisRequest,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ["generic-analysis", params],
    queryFn: () => fetchGenericAnalysis(params),
    staleTime: 60_000,
    retry: 1,
    enabled: options?.enabled !== false && Boolean(params.dimension),
  });
}
