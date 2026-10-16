/**
 * Brand drill scope — prefer server flags from get_sales_by_division_drill.
 */

import type { AnalysisRow } from "../api/genericAnalysisTypes";
import type { SalesByDivisionDrillResponse } from "../api/salesByDivisionDrillApi";

/** ~9.35M division-wide Hitachi reference (legacy heuristic only). */
export const DIVISION_WIDE_HITACHI_REFERENCE = 8_500_000;

export function serverAcceptsBrandDrill(
  payload: SalesByDivisionDrillResponse
): boolean {
  if (payload.accept_response === true) return true;
  if (String(payload.drill_scope_status || "").toLowerCase() === "scoped") {
    return true;
  }
  return false;
}

export function serverRejectsBrandDrill(
  payload: SalesByDivisionDrillResponse
): boolean {
  if (payload.is_division_wide_brand_mix === true) return true;
  if (payload.scope_check?.matches_division_wide_hitachi === true) {
    return true;
  }
  return false;
}

/** Widget fallback when the drill API sends no scope flags. */
export function brandDrillLooksDivisionWideLegacy(rows: AnalysisRow[]): boolean {
  if (!rows.length) return false;
  const top = Math.max(...rows.map((r) => Number(r.value) || 0));
  if (top >= 9_000_000) return true;
  for (const r of rows) {
    if (!/hitachi/i.test(String(r.label || ""))) continue;
    if ((Number(r.value) || 0) >= DIVISION_WIDE_HITACHI_REFERENCE) return true;
  }
  return false;
}

/**
 * Reject brand drill only when server says so, or legacy ~9.35M division-wide pattern.
 * Do not reject ~6M Hitachi under a sub_group when server marks scoped/accept_response.
 */
export function shouldRejectBrandDrillPayload(
  payload: SalesByDivisionDrillResponse,
  rows: AnalysisRow[],
  options?: { legacyHeuristic?: boolean }
): boolean {
  if (serverAcceptsBrandDrill(payload)) return false;
  if (serverRejectsBrandDrill(payload)) return true;
  if (options?.legacyHeuristic === false) return false;
  return brandDrillLooksDivisionWideLegacy(rows);
}
