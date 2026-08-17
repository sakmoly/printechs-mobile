/**
 * Resolve Ionicons names from bootstrap icon_key (never crash on bad names).
 */

import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";

export type IoniconName = ComponentProps<typeof Ionicons>["name"];

const FALLBACK_ICON: IoniconName = "grid-outline";

export function resolveBootstrapIcon(
  iconKey?: string | null,
  fallback: IoniconName = FALLBACK_ICON
): IoniconName {
  const key = String(iconKey || "").trim();
  if (!key) return fallback;
  const map = Ionicons.glyphMap as Record<string, number>;
  if (key in map) return key as IoniconName;
  // Common Desk aliases without -outline
  const outlined = `${key}-outline`;
  if (outlined in map) return outlined as IoniconName;
  return fallback;
}

/** Stable accent color for dynamic modules without a registry entry. */
export function colorForModuleKey(key: string): string {
  const palette = [
    "#0f766e",
    "#0369a1",
    "#7c3aed",
    "#c2410c",
    "#be185d",
    "#4f46e5",
    "#059669",
  ];
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  return palette[Math.abs(hash) % palette.length];
}
