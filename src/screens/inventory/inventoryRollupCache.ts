import type { InventoryTerritoryRollup } from "./inventoryTerritoryScope";

const TTL_MS = 5 * 60 * 1000;
const memory = new Map<string, { savedAt: number; data: InventoryTerritoryRollup }>();

export function inventoryRollupCacheKey(parts: {
  company?: string;
  territory: string;
  from_date?: string;
  to_date?: string;
  period?: string;
}): string {
  return [
    String(parts.company || "").trim(),
    String(parts.territory || "").trim(),
    parts.from_date || "",
    parts.to_date || "",
    parts.period || "",
  ].join("|");
}

export function peekInventoryRollupCache(
  key: string
): InventoryTerritoryRollup | undefined {
  const hit = memory.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.savedAt > TTL_MS) {
    memory.delete(key);
    return undefined;
  }
  return hit.data;
}

export function writeInventoryRollupCache(
  key: string,
  data: InventoryTerritoryRollup
): void {
  memory.set(key, { savedAt: Date.now(), data });
}

export function invalidateInventoryRollupCache(key: string): void {
  memory.delete(key);
}
