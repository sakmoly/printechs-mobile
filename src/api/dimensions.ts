/**
 * Dimension values API — logical key only (Phase F contract + Phase G UI prep).
 * Never send source_field / custom_* to the server.
 */

import { http } from "./http";
import { ERP_ANALYSIS } from "./endpoints";
import { isDemoMode } from "./demoMode";
import { isMissingBaMethodError } from "./baErrors";
import { assertLogicalDimensionKey } from "../dimensions/logicalKeys";
import { logger } from "../utils/logger";
import { useAuthStore } from "../store/auth";

export type DimensionValue = {
  value: string;
  label: string;
};

export type GetDimensionValuesParams = {
  /** Logical key only — e.g. brand, season, territory */
  dimension: string;
  search?: string;
  limit?: number;
  company?: string;
};

/**
 * Fetch allowed values for a logical dimension.
 * Request body/query uses `dimension` (logical), never physical field names.
 */
export async function getDimensionValues(
  params: GetDimensionValuesParams
): Promise<DimensionValue[]> {
  if (!assertLogicalDimensionKey(params.dimension)) {
    logger.warn("getDimensionValues blocked physical field name", params.dimension);
    return [];
  }

  if (isDemoMode()) {
    return [];
  }

  const serverUrl = useAuthStore.getState().serverConfig.serverUrl;
  if (serverUrl) {
    http.setBaseUrl(serverUrl);
  }

  const query = {
    dimension: params.dimension,
    search: params.search || undefined,
    limit: params.limit ?? 50,
    company: params.company || undefined,
  };

  try {
    const response = await http.get<any>(
      ERP_ANALYSIS.config.getDimensionValues,
      query
    );
    const payload =
      response?.message ?? response?.data ?? response;
    const rows = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.values)
        ? payload.values
        : Array.isArray(payload?.rows)
          ? payload.rows
          : [];
    return rows
      .map((r: any) => ({
        value: String(r.value ?? r.name ?? r.id ?? ""),
        label: String(r.label ?? r.name ?? r.value ?? ""),
      }))
      .filter((r: DimensionValue) => r.value);
  } catch (error) {
    if (isMissingBaMethodError(error)) {
      logger.info(
        "get_dimension_values not on server yet — returning empty list"
      );
      return [];
    }
    logger.warn("getDimensionValues failed", error);
    return [];
  }
}
