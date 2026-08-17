/**
 * Resolve filterable/groupable dimensions from bootstrap (logical keys only).
 */

import type { MobileDimensionConfig } from "../types/bootstrap";
import type { MobileConfig } from "../api/mobileConfig";
import { useBootstrapStore } from "../store/bootstrap";
import { useAuthStore } from "../store/auth";
import {
  assertLogicalDimensionKey,
  humanizeDimensionKey,
  KNOWN_LOGICAL_DIMENSIONS,
  LOGICAL_DIMENSION_PARAM_KEYS,
  type DimensionDataType,
  type LogicalDimensionKey,
  type ResolvedDimension,
} from "./logicalKeys";

function fromBootstrapRow(d: MobileDimensionConfig): ResolvedDimension | null {
  if (!d?.key || !assertLogicalDimensionKey(d.key)) return null;
  return {
    key: d.key,
    label: d.label || humanizeDimensionKey(d.key),
    data_type: (d.data_type as DimensionDataType) || "Data",
    filterable: d.filterable !== false,
    groupable: d.groupable !== false,
    sortable: d.sortable !== false,
  };
}

/** Legacy boolean map → resolved list */
export function dimensionsFromLegacyFlags(
  flags: MobileConfig["dimensions"] | Record<string, boolean>
): ResolvedDimension[] {
  const out: ResolvedDimension[] = [];
  for (const key of KNOWN_LOGICAL_DIMENSIONS) {
    if (!assertLogicalDimensionKey(key)) continue;
    const enabled = (flags as Record<string, boolean>)[key] !== false;
    // cost_center default off in DEFAULT_DIMENSIONS
    if (key === "cost_center" && (flags as Record<string, boolean>)[key] !== true) {
      continue;
    }
    if (!enabled) continue;
    out.push({
      key,
      label: humanizeDimensionKey(key),
      data_type: key === "company" || key === "territory" || key === "brand"
        ? "Link"
        : "Data",
      filterable: true,
      groupable: true,
      sortable: true,
    });
  }
  return out;
}

export function resolveDimensions(
  bootstrapDims: MobileDimensionConfig[] | null | undefined,
  legacyFlags?: MobileConfig["dimensions"] | null
): ResolvedDimension[] {
  if (bootstrapDims?.length) {
    const resolved = bootstrapDims
      .map(fromBootstrapRow)
      .filter((d): d is ResolvedDimension => d != null);
    if (resolved.length) return resolved;
  }
  if (legacyFlags) return dimensionsFromLegacyFlags(legacyFlags);
  return dimensionsFromLegacyFlags({});
}

export function getFilterableDimensions(
  dims: ResolvedDimension[]
): ResolvedDimension[] {
  return dims.filter((d) => d.filterable);
}

export function getGroupableDimensions(
  dims: ResolvedDimension[]
): ResolvedDimension[] {
  return dims.filter((d) => d.groupable);
}

export function isLogicalDimensionEnabled(
  key: LogicalDimensionKey,
  dims: ResolvedDimension[]
): boolean {
  if (!assertLogicalDimensionKey(key)) return false;
  const hit = dims.find((d) => d.key === key);
  if (!hit) {
    // Unknown to list: allow only if not a known key that was explicitly omitted
    // from a real bootstrap payload — callers use bootstrap maps for that.
    return true;
  }
  return hit.filterable || hit.groupable;
}

/** Param names to strip when dimension `key` is disabled */
export function paramKeysForDimension(key: string): string[] {
  return LOGICAL_DIMENSION_PARAM_KEYS[key] || [key];
}

/**
 * Live snapshot from stores — for API layers outside React.
 */
export function getActiveResolvedDimensions(): ResolvedDimension[] {
  const bootstrap = useBootstrapStore.getState().bootstrap;
  const mobileConfig = useAuthStore.getState().mobileConfig;
  return resolveDimensions(bootstrap?.dimensions, mobileConfig.dimensions);
}

export function getActiveDimensionMap(): Record<string, boolean> {
  const fromStore = useBootstrapStore.getState().dimensionMap;
  if (fromStore && Object.keys(fromStore).length > 0) return fromStore;
  const dims = getActiveResolvedDimensions();
  const map: Record<string, boolean> = {};
  for (const d of dims) {
    map[d.key] = d.filterable || d.groupable;
  }
  return map;
}
