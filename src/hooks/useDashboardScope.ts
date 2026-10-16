import { useEffect, useMemo } from "react";
import { useAuthStore } from "../store/auth";
import { useBootstrapStore } from "../store/bootstrap";
import { useDashboardFiltersStore } from "../store/dashboardFilters";
import { resolveCompanyName } from "../api/apiResilience";
import { getTerritoryFilterOptions } from "../api/accessScope";
import {
  resolveBoardTerritoryFilters,
  shouldRequestViewAllSales,
  territoryFilterKey,
} from "../utils/dashboardTerritory";

/**
 * Company from Access Profile (not user-selectable) + territory filter state.
 */
export function useDashboardScope() {
  const permissions = useAuthStore((s) => s.permissions);
  const user = useAuthStore((s) => s.user);
  const bootstrap = useBootstrapStore((s) => s.bootstrap);

  // Full ERP company name must load before dashboard APIs run. Using short
  // user.company (e.g. "Printechs") before permissions fetch returns zeros.
  const company = useMemo(() => {
    const fromScope = String(permissions.scope?.company || "").trim();
    if (fromScope) return fromScope;
    const fromBootstrap = String(bootstrap?.context?.company || "").trim();
    if (fromBootstrap) return fromBootstrap;
    if (permissions.fetched) {
      return resolveCompanyName(null, user?.company, null);
    }
    return undefined;
  }, [
    permissions.fetched,
    permissions.scope?.company,
    bootstrap?.context?.company,
    user?.company,
  ]);

  const companyReady = Boolean(company);

  const territoryOptions = useMemo(
    () => getTerritoryFilterOptions(permissions.scope),
    [permissions.scope]
  );

  const selectedTerritory = useDashboardFiltersStore((s) => s.selectedTerritory);
  const setSelectedTerritory = useDashboardFiltersStore(
    (s) => s.setSelectedTerritory
  );
  const syncDefaultFromScope = useDashboardFiltersStore(
    (s) => s.syncDefaultFromScope
  );

  useEffect(() => {
    if (permissions.fetched) {
      syncDefaultFromScope(permissions.scope);
    }
  }, [permissions.fetched, permissions.scope, syncDefaultFromScope]);

  const filters = useMemo(
    () => resolveBoardTerritoryFilters(selectedTerritory, permissions.scope),
    [selectedTerritory, permissions.scope]
  );

  const territoryKey = territoryFilterKey(selectedTerritory);

  const viewAllSalesRequest = useMemo(
    () => shouldRequestViewAllSales(selectedTerritory, permissions.scope),
    [selectedTerritory, permissions.scope]
  );

  const businessType =
    bootstrap?.context?.business_type?.replace(/_/g, " ") || "B2B Analytics";
  const companyShort = company?.split(" ")[0] || company || "Company";

  return {
    company,
    companyReady,
    permissionsFetched: permissions.fetched,
    companyShort,
    businessType,
    territoryOptions,
    selectedTerritory,
    setSelectedTerritory,
    filters,
    territoryKey,
    viewAllSalesRequest,
  };
}
