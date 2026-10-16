/**
 * Shared dashboard territory filter (Home, Sales, Receivables, Inventory).
 * In-memory for the app session; reset on logout.
 */

import { create } from "zustand";
import type { AccessPermissionScope } from "../api/permissions";
import {
  getTerritoryFilterOptions,
  resolveProfileDefaultTerritory,
} from "../api/accessScope";
import { ALL_TERRITORIES } from "../utils/dashboardTerritory";

type DashboardFiltersState = {
  selectedTerritory: string;
  /** User picked a territory this session — do not overwrite with profile default. */
  userHasSetTerritory: boolean;
  setSelectedTerritory: (territory: string) => void;
  syncDefaultFromScope: (scope?: AccessPermissionScope | null) => void;
  reset: () => void;
};

function territoryAllowed(
  territory: string,
  options: string[]
): boolean {
  if (!territory || territory === ALL_TERRITORIES) return true;
  const key = territory.toLowerCase();
  return options.some((o) => o.toLowerCase() === key);
}

const initialState = {
  selectedTerritory: ALL_TERRITORIES,
  userHasSetTerritory: false,
};

export const useDashboardFiltersStore = create<DashboardFiltersState>(
  (set, get) => ({
    ...initialState,
    setSelectedTerritory: (territory) => {
      set({
        selectedTerritory: territory || ALL_TERRITORIES,
        userHasSetTerritory: true,
      });
    },
    syncDefaultFromScope: (scope) => {
      const options = getTerritoryFilterOptions(scope);
      const { selectedTerritory, userHasSetTerritory } = get();

      if (userHasSetTerritory) {
        if (!territoryAllowed(selectedTerritory, options)) {
          set({
            selectedTerritory: resolveProfileDefaultTerritory(scope, options),
            userHasSetTerritory: false,
          });
        }
        return;
      }

      set({
        selectedTerritory: resolveProfileDefaultTerritory(scope, options),
      });
    },
    reset: () => set({ ...initialState }),
  })
);
