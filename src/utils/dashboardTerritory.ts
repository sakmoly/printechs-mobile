/**
 * Territory scope for dashboard board / widget API calls.
 */

import type { DrillFilters } from "../api/dashboardWidgetData";
import type { AccessPermissionScope } from "../api/permissions";
import {
  getTerritoryFilterOptions,
  getViewTerritories,
} from "../api/accessScope";

/** User selected all territories — omit filter so BA uses view scope. */
export const ALL_TERRITORIES = "__all__";

export function territoryFilters(
  territory: string | undefined | null
): DrillFilters | undefined {
  const t = String(territory || "").trim();
  if (!t || t === ALL_TERRITORIES) return undefined;
  return { territory: [t] };
}

/**
 * Board + widget fallback territory scope (Sales, Home, Receivables, Inventory).
 *
 * | UI selection      | allow_view_all_sales | Mobile sends                          |
 * | ----------------- | -------------------- | ------------------------------------- |
 * | One territory     | any                  | `filters.territory: [picked]`         |
 * | All Territories   | true                 | omit (company-wide per Access Profile)|
 * | All Territories   | false                | `filters.territory: view_territories` |
 */
export function isAllTerritoriesChip(
  selectedTerritory: string | undefined | null
): boolean {
  const t = String(selectedTerritory || "").trim();
  return !t || t === ALL_TERRITORIES;
}

/**
 * All Territories + Allow View All Sales → company-wide totals (~invoice / full company).
 * Mobile sends `view_all_sales=1` on board/widget APIs (see ERP contract).
 */
export function shouldRequestViewAllSales(
  selectedTerritory: string | undefined | null,
  scope?: AccessPermissionScope | null
): boolean {
  return (
    isAllTerritoriesChip(selectedTerritory) &&
    Boolean(scope?.allow_view_all_sales)
  );
}

export function resolveBoardTerritoryFilters(
  selectedTerritory: string | undefined | null,
  scope?: AccessPermissionScope | null
): DrillFilters | undefined {
  const picked = territoryFilters(selectedTerritory);
  if (picked?.territory?.length) return picked;

  if (scope?.allow_view_all_sales) return undefined;

  const view = getViewTerritories(scope);
  if (view.length) return { territory: view };
  return undefined;
}

/**
 * Widget drill territory scope — must match {@link resolveBoardTerritoryFilters}.
 */
export function resolveDrillTerritoryFilters(
  selectedTerritory: string | undefined | null,
  viewTerritories: string[] | undefined,
  allowViewAllSales?: boolean
): DrillFilters | undefined {
  const picked = territoryFilters(selectedTerritory);
  if (picked?.territory?.length) return picked;

  if (allowViewAllSales) return undefined;

  const view = (viewTerritories || [])
    .map((t) => String(t || "").trim())
    .filter(Boolean);

  if (view.length) return { territory: view };
  return undefined;
}

/** Disk/React Query cache key segment for multi-territory board filters. */
export function territoryBoardCacheKey(
  filters: DrillFilters | undefined
): string {
  const list = (filters?.territory || [])
    .map((t) => String(t || "").trim())
    .filter(Boolean);
  if (!list.length) return "";
  if (list.length === 1) return list[0];
  return list.slice().sort((a, b) => a.localeCompare(b)).join(",");
}

export function territoryFilterKey(territory: string | undefined | null): string {
  const t = String(territory || "").trim();
  if (!t || t === ALL_TERRITORIES) return "";
  return t;
}

/** BA board/widget APIs: JSON filters + legacy single + comma-separated params. */
export function baTerritoryRequestParams(
  filters: DrillFilters | undefined
): { territory?: string; territories?: string } {
  const list = (filters?.territory || [])
    .map((t) => String(t || "").trim())
    .filter(Boolean);
  if (!list.length) return {};
  if (list.length === 1) {
    return { territory: list[0], territories: list[0] };
  }
  return { territories: list.join(",") };
}

/** Case-insensitive match for Customer / list rows. */
export function rowMatchesTerritory(
  rowTerritory: string | undefined | null,
  selectedTerritory: string | undefined | null
): boolean {
  const want = String(selectedTerritory || "").trim();
  if (!want || want === ALL_TERRITORIES) return true;
  const got = String(rowTerritory || "").trim();
  if (!got) return true;
  return got.toLowerCase() === want.toLowerCase();
}

export function filterRowsByTerritory<T extends { territory?: string | null }>(
  rows: T[],
  selectedTerritory: string | undefined | null
): T[] {
  const want = String(selectedTerritory || "").trim();
  if (!want || want === ALL_TERRITORIES) return rows;
  return rows.filter((r) => rowMatchesTerritory(r.territory, want));
}

/** True when `name` matches a dashboard territory chip (e.g. Dammam), not an ERP Customer id. */
export function isKnownTerritoryName(
  name: string | undefined | null,
  scope?: AccessPermissionScope | null
): boolean {
  const t = String(name || "").trim();
  if (!t || t === ALL_TERRITORIES) return false;
  const options = getTerritoryFilterOptions(scope);
  const lower = t.toLowerCase();
  return options.some((o) => String(o || "").trim().toLowerCase() === lower);
}

export function territoryLabel(
  territory: string | undefined | null,
  options: string[]
): string {
  const t = String(territory || "").trim();
  if (!t || t === ALL_TERRITORIES) {
    return options.length === 1 ? options[0] : "All Territories";
  }
  return t.length > 16 ? `${t.slice(0, 14)}…` : t;
}
