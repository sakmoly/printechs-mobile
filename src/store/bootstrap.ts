/**
 * Tenant bootstrap store — source of truth for business_type, modules, dimensions.
 * Access Profile (auth.permissions) remains authoritative for can_view.
 */

import { create } from "zustand";
import type { MobileBootstrap } from "../types/bootstrap";
import {
  fetchMobileBootstrap,
  bootstrapFromMobileConfig,
  type FetchBootstrapResult,
} from "../api/mobileBootstrap";
import { DEFAULT_MOBILE_CONFIG } from "../api/mobileConfig";
import { logger } from "../utils/logger";

type BootstrapState = {
  bootstrap: MobileBootstrap | null;
  loading: boolean;
  error: string | null;
  /** True once a successful load completed (including legacy fallback) */
  loaded: boolean;
  schemaVersion: number;
  moduleMap: Record<string, boolean>;
  dimensionMap: Record<string, boolean>;
  loadBootstrap: () => Promise<FetchBootstrapResult | null>;
  /** Alias for pull-to-refresh / company context change */
  refresh: () => Promise<FetchBootstrapResult | null>;
  clearBootstrap: () => void;
};

function mapsFromBootstrap(b: MobileBootstrap) {
  const moduleMap: Record<string, boolean> = {};
  for (const m of b.modules) {
    moduleMap[m.key] = m.enabled !== false;
    if (m.route_key) moduleMap[m.route_key] = m.enabled !== false;
  }
  const dimensionMap: Record<string, boolean> = {};
  for (const d of b.dimensions) {
    dimensionMap[d.key] =
      d.filterable !== false || d.groupable !== false;
  }
  return { moduleMap, dimensionMap };
}

async function runLoad(
  set: (partial: Partial<BootstrapState>) => void
): Promise<FetchBootstrapResult | null> {
  set({ loading: true, error: null });
  try {
    const result = await fetchMobileBootstrap();
    const { moduleMap, dimensionMap } = mapsFromBootstrap(result.bootstrap);
    set({
      bootstrap: result.bootstrap,
      loading: false,
      loaded: true,
      error: null,
      schemaVersion: result.bootstrap.schema_version,
      moduleMap,
      dimensionMap,
    });
    return result;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    logger.warn("Bootstrap load failed — applying local defaults", e);
    const fallback = bootstrapFromMobileConfig(
      DEFAULT_MOBILE_CONFIG,
      "defaults"
    );
    const { moduleMap, dimensionMap } = mapsFromBootstrap(fallback);
    set({
      bootstrap: fallback,
      loading: false,
      loaded: true,
      error: message,
      schemaVersion: fallback.schema_version,
      moduleMap,
      dimensionMap,
    });
    return { bootstrap: fallback, mobileConfig: DEFAULT_MOBILE_CONFIG };
  }
}

export const useBootstrapStore = create<BootstrapState>((set) => ({
  bootstrap: null,
  loading: false,
  error: null,
  loaded: false,
  schemaVersion: 0,
  moduleMap: {},
  dimensionMap: {},

  loadBootstrap: async () => runLoad(set),

  refresh: async () => {
    logger.info("Refreshing mobile bootstrap");
    return runLoad(set);
  },

  clearBootstrap: () =>
    set({
      bootstrap: null,
      loading: false,
      error: null,
      loaded: false,
      schemaVersion: 0,
      moduleMap: {},
      dimensionMap: {},
    }),
}));
