/**
 * Tenant bootstrap store — source of truth for business_type, modules, dimensions.
 * Access Profile (auth.permissions) remains authoritative for can_view.
 * Disk cache: hydrate last layout instantly, refresh in background.
 */

import { create } from "zustand";
import type { MobileBootstrap } from "../types/bootstrap";
import {
  fetchMobileBootstrap,
  bootstrapFromMobileConfig,
  type FetchBootstrapResult,
} from "../api/mobileBootstrap";
import { DEFAULT_MOBILE_CONFIG } from "../api/mobileConfig";
import {
  readCachedBootstrap,
  writeCachedBootstrap,
  clearSessionCache,
  getActiveSessionUserKey,
  setActiveSessionUserKey,
} from "../api/sessionCache";
import { logger } from "../utils/logger";

type BootstrapState = {
  bootstrap: MobileBootstrap | null;
  loading: boolean;
  error: string | null;
  /** True once a successful load completed (including cache hydrate / legacy fallback) */
  loaded: boolean;
  /** True when current bootstrap came from disk (until network refresh succeeds) */
  fromCache: boolean;
  schemaVersion: number;
  moduleMap: Record<string, boolean>;
  dimensionMap: Record<string, boolean>;
  /** Apply disk cache before network — returns true if UI can proceed */
  hydrateFromCache: (userKey: string) => Promise<boolean>;
  loadBootstrap: (userKey?: string | null) => Promise<FetchBootstrapResult | null>;
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

function applyBootstrap(
  set: (partial: Partial<BootstrapState>) => void,
  bootstrap: MobileBootstrap,
  opts: { fromCache: boolean; error?: string | null }
) {
  const { moduleMap, dimensionMap } = mapsFromBootstrap(bootstrap);
  set({
    bootstrap,
    loading: false,
    loaded: true,
    fromCache: opts.fromCache,
    error: opts.error ?? null,
    schemaVersion: bootstrap.schema_version,
    moduleMap,
    dimensionMap,
  });
}

async function runLoad(
  set: (partial: Partial<BootstrapState>) => void,
  get: () => BootstrapState,
  userKey?: string | null
): Promise<FetchBootstrapResult | null> {
  const key = userKey || getActiveSessionUserKey();
  const hadUi = Boolean(get().bootstrap && get().loaded);
  // Don't blank the UI when refreshing over a warm cache
  if (!hadUi) {
    set({ loading: true, error: null });
  } else {
    set({ loading: true });
  }

  try {
    const result = await fetchMobileBootstrap();
    applyBootstrap(set, result.bootstrap, { fromCache: false });
    if (key && result.bootstrap?.modules?.length) {
      void writeCachedBootstrap(key, result.bootstrap);
    }
    return result;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (hadUi && get().bootstrap) {
      logger.warn("Bootstrap refresh failed — keeping cached layout", e);
      set({ loading: false, error: message, fromCache: true });
      return {
        bootstrap: get().bootstrap!,
        mobileConfig: DEFAULT_MOBILE_CONFIG,
      };
    }
    logger.warn("Bootstrap load failed — applying local defaults", e);
    const fallback = bootstrapFromMobileConfig(
      DEFAULT_MOBILE_CONFIG,
      "defaults"
    );
    applyBootstrap(set, fallback, { fromCache: false, error: message });
    return { bootstrap: fallback, mobileConfig: DEFAULT_MOBILE_CONFIG };
  }
}

export const useBootstrapStore = create<BootstrapState>((set, get) => ({
  bootstrap: null,
  loading: false,
  error: null,
  loaded: false,
  fromCache: false,
  schemaVersion: 0,
  moduleMap: {},
  dimensionMap: {},

  hydrateFromCache: async (userKey: string) => {
    if (!userKey) return false;
    setActiveSessionUserKey(userKey);
    const cached = await readCachedBootstrap(userKey);
    if (!cached) return false;
    applyBootstrap(set, cached.bootstrap, { fromCache: true });
    logger.info("Bootstrap hydrated from disk cache", {
      modules: cached.bootstrap.modules?.length,
      ageSec: Math.round((Date.now() - cached.savedAt) / 1000),
    });
    return true;
  },

  loadBootstrap: async (userKey) => runLoad(set, get, userKey),

  refresh: async () => {
    logger.info("Refreshing mobile bootstrap");
    return runLoad(set, get, getActiveSessionUserKey());
  },

  clearBootstrap: () => {
    const key = getActiveSessionUserKey();
    void clearSessionCache(key);
    setActiveSessionUserKey(null);
    set({
      bootstrap: null,
      loading: false,
      error: null,
      loaded: false,
      fromCache: false,
      schemaVersion: 0,
      moduleMap: {},
      dimensionMap: {},
    });
  },
}));
