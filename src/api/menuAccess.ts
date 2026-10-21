/**
 * Map More-hub / screens to Access Profile AO codes + label fallbacks.
 * Desk may not have a dedicated Menu row for every mobile screen; when an API
 * Access Object exists (e.g. "Customer 360"), we honor its can_view too.
 */

import type { AccessObjectPermission } from "./permissions";
import { asTruthyFlag } from "./accessScope";

export type MenuPermissionStateLike = {
  fetched: boolean;
  menus: Record<string, boolean>;
  raw: AccessObjectPermission[];
};

export type HubAccessSpec = {
  /** Primary menu AO (e.g. Sales Performance card). */
  menuKey?: string;
  /** Extra AO codes that must all be true when present in the access map. */
  extraKeys?: string[];
  /** Match Access Object labels / keys from get_my_access (deny if feature AO is false). */
  labelPatterns?: RegExp[];
};

/** Known mobile features → Access Profile rules */
export const HUB_ACCESS: Record<string, HubAccessSpec> = {
  sales: { menuKey: "AO-00026" },
  salesperson: {
    menuKey: "AO-00026",
    labelPatterns: [/salesperson/i, /sales\s*person/i],
  },
  product: {
    menuKey: "AO-00026",
    labelPatterns: [/product\s*performance/i, /get_product_performance/i],
  },
  customer360: {
    menuKey: "AO-00026",
    labelPatterns: [
      /customer\s*360/i,
      /get_customer_360/i,
      /search_customers/i,
    ],
  },
  salesOrders: {
    menuKey: "AO-00026",
    labelPatterns: [/sales\s*order/i, /get_sales_order/i],
  },
  profitability: {
    menuKey: "AO-00026",
    labelPatterns: [/profitability/i, /get_profitability/i],
  },
  receivables: { menuKey: "AO-00027" },
  collection: {
    menuKey: "AO-00027",
    extraKeys: ["AO-00040"],
    labelPatterns: [/collection\s*dashboard/i, /collection\s*attention/i],
  },
  payables: { menuKey: "AO-00029" },
  inventory: { menuKey: "AO-00028" },
  inventoryHealth: {
    menuKey: "AO-00028",
    labelPatterns: [/inventory\s*health/i, /stock\s*cover/i, /dead\s*stock/i],
  },
  purchase: { menuKey: "AO-00030" },
  exceptions: {
    menuKey: "AO-00022",
    labelPatterns: [/exception/i, /management\s*exception/i],
  },
  analytics: {
    menuKey: "AO-00026",
    labelPatterns: [/generic\s*analysis/i, /get_generic_analysis/i],
  },
  approvalAnalytics: {
    menuKey: "AO-00054",
    extraKeys: ["AO-00101"],
    labelPatterns: [/approval\s*analytics/i],
  },
  employees: { menuKey: "AO-00024" },
  catalogue: { menuKey: "AO-00031" },
  approvals: { menuKey: "AO-00023" },
  settings: { menuKey: "AO-00025" },
  dashboard: { menuKey: "AO-00022" },
  /** Desk AO: erp_analysis.tax.get_vat_dashboard */
  vat: {
    labelPatterns: [
      /erp_analysis\.tax\.get_vat_dashboard/i,
      /erp_analysis\.tax\.get_vat_summary/i,
      /get_vat_dashboard/i,
      /get_vat_summary/i,
      /vat\s*dashboard/i,
      /vat\s*report/i,
    ],
  },
};

const VAT_API_OBJECT_KEYS = [
  "erp_analysis.tax.get_vat_dashboard",
  "erp_analysis.tax.get_vat_summary",
  "get_vat_dashboard",
  "get_vat_summary",
] as const;

/**
 * True when Access Profile grants the VAT dashboard API (or no VAT AO is listed yet).
 */
export function hasVatDashboardAccess(
  permissions: MenuPermissionStateLike
): boolean {
  if (!permissions.fetched) return true;

  for (const k of VAT_API_OBJECT_KEYS) {
    if (Object.prototype.hasOwnProperty.call(permissions.menus, k)) {
      return permissions.menus[k] === true;
    }
  }

  const spec = HUB_ACCESS.vat;
  const hits = profilesMatching(permissions.raw, spec.labelPatterns || []);
  if (hits.length > 0) {
    return hits.some((h) => asTruthyFlag(h.can_view));
  }

  return true;
}

function menuKeyAllowed(
  permissions: MenuPermissionStateLike,
  objectKey: string
): boolean {
  if (!permissions.fetched) return true;
  if (!objectKey) return true;
  if (Object.prototype.hasOwnProperty.call(permissions.menus, objectKey)) {
    return permissions.menus[objectKey] === true;
  }
  return true;
}

function profilesMatching(
  raw: AccessObjectPermission[] | undefined,
  patterns: RegExp[]
): AccessObjectPermission[] {
  if (!raw?.length || !patterns.length) return [];
  return raw.filter((p) => {
    const label = String(p.label || "");
    const key = String(p.object_key || "");
    return patterns.some((re) => re.test(label) || re.test(key));
  });
}

/**
 * True if the user may open this hub feature.
 * - Explicit false on menu / extra / matched feature AO → deny
 * - Missing keys → allow (until BA lists them)
 */
export function canAccessHubFeature(
  permissions: MenuPermissionStateLike,
  featureId: string,
  override?: HubAccessSpec
): boolean {
  const spec = override || HUB_ACCESS[featureId];
  if (!spec) return true;
  if (!permissions.fetched) return true;

  if (spec.menuKey && !menuKeyAllowed(permissions, spec.menuKey)) {
    return false;
  }

  for (const k of spec.extraKeys || []) {
    if (
      Object.prototype.hasOwnProperty.call(permissions.menus, k) &&
      permissions.menus[k] !== true
    ) {
      return false;
    }
  }

  if (spec.labelPatterns?.length) {
    const hits = profilesMatching(permissions.raw, spec.labelPatterns);
    if (hits.length > 0) {
      // Prefer specific feature AOs (Customer 360, etc.) over broad siblings
      const specific = hits.filter((h) =>
        /customer\s*360|get_customer_360|profitability|salesperson|product\s*performance|sales\s*order/i.test(
          String(h.label || h.object_key || "")
        )
      );
      const check = specific.length ? specific : hits;
      if (check.every((h) => !asTruthyFlag(h.can_view))) {
        return false;
      }
    }
  }

  return true;
}
