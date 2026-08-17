/**
 * Bootstrap store helpers — prefer bootstrap maps, fall back to mobileConfig.
 */

import { useMemo } from "react";
import { useBootstrapStore } from "../store/bootstrap";
import { useAuthStore } from "../store/auth";
import {
  isDimensionEnabled as isConfigDimensionEnabled,
  isModuleEnabled as isConfigModuleEnabled,
  type MobileDimension,
  type MobileModules,
} from "../api/mobileConfig";
import { isKnownModuleKey, resolveModuleEntry } from "../modules/registry";
import {
  getFilterableDimensions,
  resolveDimensions,
  type ResolvedDimension,
} from "../dimensions";
import { assertLogicalDimensionKey } from "../dimensions/logicalKeys";

/** True while authenticated user is waiting on first bootstrap resolve */
export function useBootstrapReady(): boolean {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const loaded = useBootstrapStore((s) => s.loaded);
  if (!isAuthenticated) return true;
  return loaded;
}

export function useBusinessType(): string {
  return useBootstrapStore((s) => s.bootstrap?.context?.business_type || "B2B");
}

export function useBranding() {
  return useBootstrapStore((s) => s.bootstrap?.branding);
}

/**
 * Module enabled: bootstrap moduleMap wins when loaded; else mobileConfig.
 */
export function useModuleEnabled(key: string): boolean {
  const loaded = useBootstrapStore((s) => s.loaded);
  const moduleMap = useBootstrapStore((s) => s.moduleMap);
  const mobileConfig = useAuthStore((s) => s.mobileConfig);

  if (loaded && Object.keys(moduleMap).length > 0) {
    if (Object.prototype.hasOwnProperty.call(moduleMap, key)) {
      return moduleMap[key] !== false;
    }
    const entry = resolveModuleEntry(key);
    if (entry?.configModule && moduleMap[entry.configModule] !== undefined) {
      return moduleMap[entry.configModule] !== false;
    }
    return isConfigModuleEnabled(
      mobileConfig,
      (entry?.configModule || key) as keyof MobileModules
    );
  }

  return isConfigModuleEnabled(mobileConfig, key as keyof MobileModules);
}

export function useDimensionEnabled(key: string): boolean {
  const loaded = useBootstrapStore((s) => s.loaded);
  const dimensionMap = useBootstrapStore((s) => s.dimensionMap);
  const mobileConfig = useAuthStore((s) => s.mobileConfig);

  if (!assertLogicalDimensionKey(key)) return false;

  if (loaded && Object.keys(dimensionMap).length > 0) {
    if (Object.prototype.hasOwnProperty.call(dimensionMap, key)) {
      return dimensionMap[key] !== false;
    }
    // Known fashion/retail dims omitted from B2B bootstrap → off
    if (
      ["season", "year", "style", "color", "size", "region", "store"].includes(
        key
      )
    ) {
      return false;
    }
  }
  return isConfigDimensionEnabled(mobileConfig, key as MobileDimension);
}

/** Full resolved dimension metadata for filters (Phase F / G) */
export function useResolvedDimensions(): ResolvedDimension[] {
  const bootstrap = useBootstrapStore((s) => s.bootstrap);
  const mobileConfig = useAuthStore((s) => s.mobileConfig);
  return useMemo(
    () => resolveDimensions(bootstrap?.dimensions, mobileConfig.dimensions),
    [bootstrap?.dimensions, mobileConfig.dimensions]
  );
}

export function useFilterableDimensions(): ResolvedDimension[] {
  const dims = useResolvedDimensions();
  return useMemo(() => getFilterableDimensions(dims), [dims]);
}

/** Non-hook helpers for layouts / non-React code */
export function isBootstrapModuleEnabled(key: string): boolean {
  const { loaded, moduleMap, bootstrap } = useBootstrapStore.getState();
  const mobileConfig = useAuthStore.getState().mobileConfig;

  if (loaded && Object.keys(moduleMap).length > 0) {
    if (Object.prototype.hasOwnProperty.call(moduleMap, key)) {
      return moduleMap[key] !== false;
    }
    const entry = resolveModuleEntry(key);
    if (entry?.configModule && moduleMap[entry.configModule] !== undefined) {
      return moduleMap[entry.configModule] !== false;
    }
    if (bootstrap?.source === "bootstrap" && isKnownModuleKey(key)) {
      return false;
    }
  }
  return isConfigModuleEnabled(mobileConfig, key as keyof MobileModules);
}

export function isBootstrapDimensionEnabled(key: string): boolean {
  if (!assertLogicalDimensionKey(key)) return false;
  const { loaded, dimensionMap } = useBootstrapStore.getState();
  const mobileConfig = useAuthStore.getState().mobileConfig;
  if (loaded && Object.prototype.hasOwnProperty.call(dimensionMap, key)) {
    return dimensionMap[key] !== false;
  }
  if (
    loaded &&
    Object.keys(dimensionMap).length > 0 &&
    ["season", "year", "style", "color", "size", "region", "store"].includes(key)
  ) {
    return false;
  }
  return isConfigDimensionEnabled(mobileConfig, key as MobileDimension);
}
