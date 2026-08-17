import { http } from "./http";
import { ERP_ANALYSIS } from "./endpoints";
import { filterBaParams } from "./apiResilience";
import { normalizeAccessScope } from "./accessScope";
import type { MobileConfig } from "./mobileConfig";

export interface AccessObjectPermission {
  object_key: string;
  object_type: string;
  label?: string | null;
  can_view: boolean;
  can_approve?: boolean;
  can_export?: boolean;
  can_create?: boolean;
  can_edit?: boolean;
  priority?: number | null;
}

/**
 * Access scope from `get_my_access`.
 *
 * Split territories:
 * - `view_territories` / `territories` → Sales, GP, analytics (read)
 * - `approve_territories` → Approvals inbox / approve+reject only
 * - `branch` → legacy single-site default; used as approve fallback
 * - `allow_view_all_sales` → company-wide Sales (mobile omits territories filter)
 */
export interface AccessPermissionScope {
  user?: string | null;
  company?: string | null;
  /** Legacy primary territory (first view territory). */
  territory?: string | null;
  branch?: string | null;
  /** Alias of view_territories (backward compatible). */
  territories?: string[];
  view_territories?: string[];
  approve_territories?: string[];
  /** Desk: Allow View All Sales — Sales/GP/executive ignore view_territories. */
  allow_view_all_sales?: boolean;
  allow_view_all_stock?: boolean;
  allow_all_receivable?: boolean;
}

export interface GetMyAccessResponse {
  scope?: AccessPermissionScope;
  profiles: AccessObjectPermission[];
}

export async function getMyAccess(
  scope?: Partial<AccessPermissionScope>,
  config?: MobileConfig | null
): Promise<GetMyAccessResponse> {
  const sanitizedScope = filterBaParams(
    {
      ...scope,
      territory: scope?.territory ?? undefined,
    } as Record<string, unknown>,
    config
  );

  try {
    const response = await http.post<{
      message?: GetMyAccessResponse & Record<string, unknown>;
      profiles?: AccessObjectPermission[];
      scope?: AccessPermissionScope;
      access_profile?: Record<string, unknown>;
      allow_view_all_sales?: unknown;
    }>(ERP_ANALYSIS.api.getMyAccess, sanitizedScope);

    const payload =
      response.message ?? {
        profiles: response.profiles ?? [],
        scope: response.scope,
      };

    // Merge Access Profile override flags from scope / root / access_profile
    const root = (payload || {}) as Record<string, unknown>;
    const scopeRaw = {
      ...(typeof root.scope === "object" && root.scope
        ? (root.scope as Record<string, unknown>)
        : {}),
      ...(typeof root.access_profile === "object" && root.access_profile
        ? (root.access_profile as Record<string, unknown>)
        : {}),
      allow_view_all_sales:
        (root.scope as any)?.allow_view_all_sales ??
        root.allow_view_all_sales ??
        (root.access_profile as any)?.allow_view_all_sales,
      allow_view_all_stock:
        (root.scope as any)?.allow_view_all_stock ??
        root.allow_view_all_stock ??
        (root.access_profile as any)?.allow_view_all_stock,
      allow_all_receivable:
        (root.scope as any)?.allow_all_receivable ??
        root.allow_all_receivable ??
        (root.access_profile as any)?.allow_all_receivable,
    };

    const normalizedScope = normalizeAccessScope(
      Object.keys(scopeRaw).length ? scopeRaw : sanitizedScope
    );

    if (__DEV__) {
      console.log("🔐 Access scope normalized:", {
        view: normalizedScope.view_territories,
        approve: normalizedScope.approve_territories,
        allowViewAllSales: normalizedScope.allow_view_all_sales,
        branch: normalizedScope.branch,
      });
    }

    return {
      profiles: payload?.profiles ?? [],
      scope: normalizedScope,
    };
  } catch (error) {
    console.warn("⚠️ get_my_access failed, allowing all menus:", error);
    return {
      profiles: [],
      scope: normalizeAccessScope(sanitizedScope),
    };
  }
}

export async function clearMyAccessCache(user?: string): Promise<void> {
  try {
    await http.get(
      ERP_ANALYSIS.api.clearMyAccessCache,
      filterBaParams({ user })
    );
  } catch (error) {
    console.warn("⚠️ clear_my_access_cache failed:", error);
  }
}
