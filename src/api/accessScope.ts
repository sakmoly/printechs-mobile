/**
 * View vs approve territory scopes from get_my_access.
 *
 * Example (sakeer):
 * - view_territories: Riyadh, Jeddah, Dammam  → Sales / analytics
 * - approve_territories: Dammam               → Approvals inbox only
 * - allow_view_all_sales: true               → omit territories on Sales APIs
 *
 * Mobile never invents broader access than the server sends.
 */

import type { AccessPermissionScope } from "./permissions";
import { ALL_TERRITORIES } from "../utils/dashboardTerritory";

function asTerritoryList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((v) => String(v ?? "").trim())
      .filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function uniquePreserveOrder(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/** ERPNext / BA often send 1/0, "1", true/false for checkboxes. */
export function asTruthyFlag(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (value === false || value === 0 || value == null || value === "") {
    return false;
  }
  const s = String(value).trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "on";
}

/**
 * Normalize raw get_my_access.scope into view / approve territory lists.
 *
 * Fallbacks when BA has not shipped the split yet:
 * - view ← territories[] | territory | branch
 * - approve ← approve_territories[] | branch only (not the full view list)
 */
export function normalizeAccessScope(
  raw:
    | Partial<AccessPermissionScope>
    | Record<string, unknown>
    | null
    | undefined
): AccessPermissionScope {
  const r = (raw || {}) as Record<string, unknown>;
  const branch =
    r.branch != null && String(r.branch).trim()
      ? String(r.branch).trim()
      : null;
  const territory =
    r.territory != null && String(r.territory).trim()
      ? String(r.territory).trim()
      : null;

  const explicitView = asTerritoryList(
    r.view_territories ?? r.viewTerritories ?? r.territories
  );
  const explicitApprove = asTerritoryList(
    r.approve_territories ??
      r.approveTerritories ??
      r.approval_territories ??
      r.approvalTerritories
  );

  const view_territories = uniquePreserveOrder(
    explicitView.length
      ? explicitView
      : territory
        ? [territory]
        : branch
          ? [branch]
          : []
  );

  // Prefer explicit approve list. Else restrict to branch (e.g. Dammam),
  // never silently expand approve rights to the full view list.
  const approve_territories = uniquePreserveOrder(
    explicitApprove.length ? explicitApprove : branch ? [branch] : []
  );

  const allow_view_all_sales = asTruthyFlag(
    r.allow_view_all_sales ??
      r.allowViewAllSales ??
      r.view_all_sales ??
      r.viewAllSales ??
      r.allow_all_sales
  );
  const allow_view_all_stock = asTruthyFlag(
    r.allow_view_all_stock ??
      r.allowViewAllStock ??
      r.view_all_stock ??
      r.viewAllStock
  );
  const allow_all_receivable = asTruthyFlag(
    r.allow_all_receivable ??
      r.allowAllReceivable ??
      r.allow_view_all_receivable ??
      r.view_all_receivable
  );

  return {
    user: r.user != null ? String(r.user) : null,
    company: r.company != null ? String(r.company) : null,
    territory: territory || view_territories[0] || null,
    branch,
    territories: view_territories,
    view_territories,
    approve_territories,
    allow_view_all_sales,
    allow_view_all_stock,
    allow_all_receivable,
  };
}

export function getViewTerritories(
  scope?: AccessPermissionScope | null
): string[] {
  if (!scope) return [];
  if (scope.view_territories?.length) return scope.view_territories;
  if (scope.territories?.length) return scope.territories;
  if (scope.territory) return [scope.territory];
  if (scope.branch) return [scope.branch];
  return [];
}

export function getApproveTerritories(
  scope?: AccessPermissionScope | null
): string[] {
  if (!scope) return [];
  if (scope.approve_territories?.length) return scope.approve_territories;
  if (scope.branch) return [scope.branch];
  return [];
}

/**
 * Territory filter for Sales / GP / executive.
 * When Allow View All Sales is on, return undefined so BA returns company-wide.
 */
export function getSalesTerritoriesParam(
  scope?: AccessPermissionScope | null
): string | undefined {
  if (!scope) return undefined;
  if (scope.allow_view_all_sales) return undefined;
  return territoriesCsv(getViewTerritories(scope));
}

export function territoriesCsv(
  list: string[] | undefined | null
): string | undefined {
  if (!list?.length) return undefined;
  return list.join(",");
}

export function formatTerritoriesLabel(list: string[]): string {
  if (!list.length) return "—";
  if (list.length === 1) return list[0];
  if (list.length === 2) return `${list[0]} · ${list[1]}`;
  return `${list.length} territories`;
}

export function formatSalesScopeLabel(
  scope?: AccessPermissionScope | null
): string {
  if (scope?.allow_view_all_sales) return "all territories";
  return formatTerritoriesLabel(getViewTerritories(scope));
}

/**
 * Territory chips for the home Sales filter.
 * With Allow View All Sales, include common sites so users can drill into
 * Jeddah / Riyadh / Dammam even if View Territories tags are incomplete.
 */
/**
 * Initial territory chip when the user has not chosen one this session.
 * Prefer Access Profile branch, then territory field, then single-site scope.
 */
export function resolveProfileDefaultTerritory(
  scope?: AccessPermissionScope | null,
  options?: string[]
): string {
  const opts = options ?? getTerritoryFilterOptions(scope);
  const pick = (raw: string | null | undefined): string | null => {
    const t = String(raw || "").trim();
    if (!t) return null;
    const hit = opts.find((o) => o.toLowerCase() === t.toLowerCase());
    return hit ?? null;
  };

  const fromBranch = pick(scope?.branch);
  if (fromBranch) return fromBranch;

  const fromTerritory = pick(scope?.territory);
  if (fromTerritory) return fromTerritory;

  if (opts.length === 1) return opts[0];

  return ALL_TERRITORIES;
}

export function getTerritoryFilterOptions(
  scope?: AccessPermissionScope | null
): string[] {
  const view = getViewTerritories(scope);
  if (scope?.allow_view_all_sales) {
    const extras = ["Riyadh", "Jeddah", "Dammam"];
    const merged = [...view];
    for (const t of extras) {
      if (!merged.some((x) => x.toLowerCase() === t.toLowerCase())) {
        merged.push(t);
      }
    }
    return merged;
  }
  return view;
}
