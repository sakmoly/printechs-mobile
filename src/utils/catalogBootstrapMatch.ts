/**
 * Match catalog widget entries to bootstrap layout keys (and aliases).
 * Used to avoid fetching every static catalog key when only a subset is configured on server.
 */

export function normalizeCatalogKey(key: string): string {
  return String(key || "")
    .trim()
    .replace(/__\d+$/i, "")
    .toLowerCase();
}

export function catalogItemMatchesBootstrap(
  item: { key: string; aliases?: string[] },
  bootstrapKeys: string[] | undefined
): boolean {
  if (!bootstrapKeys?.length) return true;
  const candidates = new Set([
    normalizeCatalogKey(item.key),
    ...(item.aliases || []).map(normalizeCatalogKey),
  ]);
  return bootstrapKeys.some((bk) => candidates.has(normalizeCatalogKey(bk)));
}
