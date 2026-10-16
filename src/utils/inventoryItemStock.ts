import { fetchItemStockByCode } from "../api/itemStockByCode";
import { optimizedApis } from "../api/optimized-apis";
import {
  hierarchyRowId,
  hierarchyRowLabel,
  hierarchyRowQty,
  hierarchyRowValue,
  hierarchyRows,
} from "./inventoryHierarchyRows";

export type ItemStockLine = {
  territory: string;
  warehouse: string;
  qty: number;
  value: number;
};

export type ItemStockResult = {
  itemCode: string;
  itemName: string;
  totalQty: number;
  totalValue: number;
  lines: ItemStockLine[];
};

/** Brand row for the root drill (step 1). */
export type BrandListRow = {
  id: string;
  label: string;
  value: number;
  qty: number;
};

function mergeBrandListRows(rows: BrandListRow[]): BrandListRow[] {
  const map = new Map<string, BrandListRow>();
  for (const row of rows) {
    const key = row.label.toLowerCase();
    const hit = map.get(key);
    if (!hit) {
      map.set(key, { ...row });
      continue;
    }
    hit.value += row.value;
    hit.qty += row.qty;
  }
  return [...map.values()].sort((a, b) => b.value - a.value);
}

/** Merged item row for a brand list (no per-warehouse breakdown). */
export type BrandCatalogItem = {
  id: string;
  code: string;
  label: string;
  qty: number;
  value: number;
};

export type FetchItemStockOptions = {
  /** When known (e.g. Stock by Brand drill), skips scanning every brand — much faster. */
  brand?: string;
  /** Max concurrent hierarchy requests (default 10). */
  concurrency?: number;
};

const ITEM_GROUP_LIMIT = 200;
const ITEM_LIMIT = 800;

function codesMatch(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function rowTerritory(
  row: Record<string, unknown>,
  fallback: string
): string {
  const t = String(row.territory ?? row.branch ?? fallback).trim();
  return t || fallback;
}

function rowWarehouse(
  row: Record<string, unknown>,
  fallback: string
): string {
  const w = String(row.warehouse ?? row.warehouse_name ?? "").trim();
  if (w) return w;
  return fallback;
}

function lineFromRow(
  row: Record<string, unknown>,
  code: string,
  territory: string,
  warehouse: string
): ItemStockLine | null {
  const rowCode = String(row.item_code ?? row.id ?? "").trim();
  if (rowCode && !codesMatch(rowCode, code)) return null;
  const qty = hierarchyRowQty(row) ?? 0;
  const value = hierarchyRowValue(row) ?? 0;
  if (qty <= 0 && value <= 0) return null;
  return {
    territory: rowTerritory(row, territory),
    warehouse: rowWarehouse(row, warehouse),
    qty,
    value,
  };
}

function inferTerritoryFromWarehouse(warehouse: string): string {
  const s = warehouse.toLowerCase();
  const names = ["Riyadh", "Jeddah", "Dammam", "Khobar", "Tabuk", "Makkah"];
  for (const t of names) {
    if (s.includes(t.toLowerCase())) return t;
  }
  return "";
}

function mergeLines(into: ItemStockLine[], add: ItemStockLine): void {
  const hit = into.find(
    (l) => l.territory === add.territory && l.warehouse === add.warehouse
  );
  if (!hit) {
    into.push({ ...add });
    return;
  }
  hit.qty += add.qty;
  hit.value += add.value;
}

function buildResult(
  code: string,
  itemName: string,
  lines: ItemStockLine[]
): ItemStockResult {
  const totalQty = lines.reduce((s, l) => s + l.qty, 0);
  const totalValue = lines.reduce((s, l) => s + l.value, 0);
  lines.sort(
    (a, b) =>
      b.qty - a.qty ||
      b.value - a.value ||
      a.territory.localeCompare(b.territory)
  );
  return { itemCode: code, itemName, totalQty, totalValue, lines };
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  if (!items.length) return [];
  const n = Math.min(Math.max(1, concurrency), items.length);
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    for (;;) {
      const i = next++;
      if (i >= items.length) break;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: n }, () => worker()));
  return results;
}

async function listTerritories(company?: string): Promise<string[]> {
  const payload = await optimizedApis.getInventoryHierarchy({
    company,
    level: "territory",
    limit: 100,
  });
  return hierarchyRows(payload)
    .map((r) => hierarchyRowId(r) || hierarchyRowLabel(r))
    .filter(Boolean);
}

async function listWarehouses(
  territory: string,
  company?: string
): Promise<string[]> {
  const whPayload = await optimizedApis.getInventoryHierarchy({
    company,
    level: "warehouse",
    territory,
    territories: territory,
    limit: 200,
  });
  return hierarchyRows(whPayload)
    .map((r) => hierarchyRowId(r))
    .filter(Boolean);
}

/** BA may return rows in one call when only item_code is set. */
async function tryDirectItemLookup(
  code: string,
  company?: string
): Promise<{ lines: ItemStockLine[]; itemName?: string } | null> {
  try {
    const payload = await optimizedApis.getInventoryHierarchy({
      company,
      level: "item",
      item_code: code,
      limit: ITEM_LIMIT,
    });
    const rows = hierarchyRows(payload);
    if (!rows.length) return null;
    const lines: ItemStockLine[] = [];
    let itemName: string | undefined;
    for (const row of rows) {
      const label = hierarchyRowLabel(row);
      if (label && label !== code) itemName = label;
      const wh = rowWarehouse(row, hierarchyRowId(row));
      if (!wh) continue;
      let territory = rowTerritory(row, "");
      if (!territory) territory = inferTerritoryFromWarehouse(wh);
      const line = lineFromRow(row, code, territory, wh);
      if (line) mergeLines(lines, line);
    }
    return lines.length ? { lines, itemName } : null;
  } catch {
    return null;
  }
}

/** Some BA builds return warehouse rows filtered by item_code under a territory. */
async function tryWarehouseLevelItemLookup(
  code: string,
  company?: string
): Promise<{ lines: ItemStockLine[] } | null> {
  const territories = await listTerritories(company);
  const chunks = await mapPool(territories, 4, async (territory) => {
    const chunk: ItemStockLine[] = [];
    try {
      const payload = await optimizedApis.getInventoryHierarchy({
        company,
        level: "warehouse",
        territory,
        territories: territory,
        item_code: code,
        limit: 200,
      });
      for (const row of hierarchyRows(payload)) {
        const wh = rowWarehouse(row, hierarchyRowId(row));
        const qty = hierarchyRowQty(row);
        const value = hierarchyRowValue(row);
        if (!wh || ((qty ?? 0) <= 0 && (value ?? 0) <= 0)) continue;
        mergeLines(chunk, {
          territory,
          warehouse: wh,
          qty: qty ?? 0,
          value: value ?? 0,
        });
      }
    } catch {
      /* territory */
    }
    return chunk;
  });

  const lines: ItemStockLine[] = [];
  for (const chunk of chunks) {
    for (const line of chunk) mergeLines(lines, line);
  }
  return lines.length ? { lines } : null;
}

async function scanWarehouseForItem(
  code: string,
  territory: string,
  warehouse: string,
  company: string | undefined,
  brand: string | undefined
): Promise<{ lines: ItemStockLine[]; itemName?: string }> {
  const lines: ItemStockLine[] = [];
  let itemName: string | undefined;

  try {
    if (brand) {
      const igPayload = await optimizedApis.getInventoryHierarchy({
        company,
        level: "item_group",
        territory,
        territories: territory,
        warehouse,
        brand,
        limit: ITEM_GROUP_LIMIT,
      });
      const groups = hierarchyRows(igPayload);
      const groupIds = groups
        .map((g) => hierarchyRowId(g) || hierarchyRowLabel(g))
        .filter(Boolean);

      const groupHits = await mapPool(groupIds, 6, async (ig) => {
        const chunk: ItemStockLine[] = [];
        let name: string | undefined;
        try {
          const itemPayload = await optimizedApis.getInventoryHierarchy({
            company,
            level: "item",
            territory,
            territories: territory,
            warehouse,
            brand,
            item_group: ig,
            limit: ITEM_LIMIT,
          });
          for (const row of hierarchyRows(itemPayload)) {
            const rowCode = String(row.item_code ?? row.id ?? "").trim();
            if (!codesMatch(rowCode, code)) continue;
            const label = hierarchyRowLabel(row);
            if (label && label !== code) name = label;
            const line = lineFromRow(row, code, territory, warehouse);
            if (line) mergeLines(chunk, line);
          }
        } catch {
          /* group */
        }
        return { chunk, name };
      });
      for (const hit of groupHits) {
        if (hit.name) itemName = hit.name;
        for (const line of hit.chunk) mergeLines(lines, line);
      }
      return { lines, itemName };
    }

    const brandPayload = await optimizedApis.getInventoryHierarchy({
      company,
      level: "brand",
      territory,
      territories: territory,
      warehouse,
      limit: 200,
    });
    const brandIds = hierarchyRows(brandPayload)
      .map((r) => hierarchyRowId(r) || hierarchyRowLabel(r))
      .filter(Boolean);
    const brandHits = await mapPool(brandIds, 4, async (b) =>
      scanWarehouseForItem(code, territory, warehouse, company, b)
    );
    for (const nested of brandHits) {
      if (nested.itemName) itemName = nested.itemName;
      for (const line of nested.lines) mergeLines(lines, line);
    }
  } catch {
    /* warehouse */
  }

  return { lines, itemName };
}

async function scanAllLocations(
  code: string,
  company: string | undefined,
  brand: string | undefined,
  concurrency: number
): Promise<{ lines: ItemStockLine[]; itemName: string }> {
  const territories = await listTerritories(company);
  const pairs: { territory: string; warehouse: string }[] = [];

  await mapPool(territories, 4, async (territory) => {
    try {
      const whNames = await listWarehouses(territory, company);
      for (const warehouse of whNames) {
        pairs.push({ territory, warehouse });
      }
    } catch {
      /* territory */
    }
  });

  let itemName = code;
  const hits = await mapPool(pairs, concurrency, async ({ territory, warehouse }) =>
    scanWarehouseForItem(code, territory, warehouse, company, brand)
  );
  const lines: ItemStockLine[] = [];
  for (const hit of hits) {
    if (hit.itemName) itemName = hit.itemName;
    for (const line of hit.lines) mergeLines(lines, line);
  }

  return { lines, itemName };
}

/** Warehouse names for filter chips (loads after brand list when using territory rollup). */
export async function fetchWarehouseNamesForScope(
  company?: string,
  activeTerritory?: string | null
): Promise<string[]> {
  const territories = activeTerritory
    ? [activeTerritory]
    : await listTerritories(company);
  const whSeen = new Set<string>();
  await mapPool(territories, 4, async (t) => {
    try {
      for (const wh of await listWarehouses(t, company)) whSeen.add(wh);
    } catch {
      /* territory */
    }
  });
  return [...whSeen];
}

/**
 * Step 1 — brand list only. Tries one API call per territory first; else parallel per warehouse.
 */
export async function fetchBrandListForScope(
  company?: string,
  scope: {
    activeTerritory?: string | null;
    warehouse?: string | null;
  } = {},
  concurrency = 14
): Promise<{ brands: BrandListRow[]; warehouses: string[] }> {
  const territories = scope.activeTerritory
    ? [scope.activeTerritory]
    : await listTerritories(company);

  if (!territories.length) {
    return { brands: [], warehouses: [] };
  }

  const collected: BrandListRow[] = [];

  if (!scope.warehouse) {
    const rollups = await mapPool(territories, 4, async (t) => {
      try {
        const payload = await optimizedApis.getInventoryHierarchy({
          company,
          level: "brand",
          territory: t,
          territories: t,
          limit: 300,
        });
        const partial: BrandListRow[] = [];
        for (const row of hierarchyRows(payload)) {
          const label = hierarchyRowLabel(row);
          if (!label) continue;
          partial.push({
            id: hierarchyRowId(row) || label,
            label,
            value: hierarchyRowValue(row) ?? 0,
            qty: hierarchyRowQty(row) ?? 0,
          });
        }
        return partial;
      } catch {
        return [];
      }
    });
    for (const chunk of rollups) collected.push(...chunk);
    if (collected.length) {
      return {
        brands: mergeBrandListRows(collected),
        warehouses: [],
      };
    }
  }

  const whSeen = new Set<string>();
  const whRefs: { territory: string; warehouse: string }[] = [];

  const whChunks = await mapPool(territories, 4, async (t) => {
    try {
      return { territory: t, names: await listWarehouses(t, company) };
    } catch {
      return { territory: t, names: [] as string[] };
    }
  });

  for (const { territory: t, names } of whChunks) {
    for (const w of names) whSeen.add(w);
    const list = scope.warehouse
      ? names.filter((w) => w === scope.warehouse)
      : names;
    for (const wh of list) whRefs.push({ territory: t, warehouse: wh });
  }

  if (!whRefs.length) {
    return { brands: [], warehouses: [] };
  }

  const whBrandChunks = await mapPool(whRefs, concurrency, async ({
    territory: t,
    warehouse: wh,
  }) => {
    const partial: BrandListRow[] = [];
    try {
      const brandPayload = await optimizedApis.getInventoryHierarchy({
        company,
        level: "brand",
        territory: t,
        territories: t,
        warehouse: wh,
        limit: 200,
      });
      for (const row of hierarchyRows(brandPayload)) {
        const label = hierarchyRowLabel(row);
        if (!label) continue;
        partial.push({
          id: hierarchyRowId(row) || label,
          label,
          value: hierarchyRowValue(row) ?? 0,
          qty: hierarchyRowQty(row) ?? 0,
        });
      }
    } catch {
      /* warehouse */
    }
    return partial;
  });

  for (const chunk of whBrandChunks) collected.push(...chunk);

  return {
    brands: mergeBrandListRows(collected),
    warehouses: [...whSeen],
  };
}

/** Items under one brand (lazy step 2 — totals only, no warehouse lines). */
export async function fetchBrandItemCatalog(
  brand: string,
  company?: string,
  scope: {
    activeTerritory?: string | null;
    warehouse?: string | null;
  } = {},
  concurrency = 8
): Promise<BrandCatalogItem[]> {
  const brandKey = String(brand || "").trim();
  if (!brandKey) return [];

  const territories = scope.activeTerritory
    ? [scope.activeTerritory]
    : await listTerritories(company);

  const whRefs: { territory: string; warehouse: string }[] = [];
  for (const t of territories) {
    try {
      const whNames = await listWarehouses(t, company);
      const list = scope.warehouse
        ? whNames.filter((w) => w === scope.warehouse)
        : whNames;
      for (const wh of list) whRefs.push({ territory: t, warehouse: wh });
    } catch {
      /* territory */
    }
  }

  if (!whRefs.length) return [];

  type Partial = BrandCatalogItem;
  const chunks = await mapPool(whRefs, concurrency, async ({ territory: t, warehouse: wh }) => {
    const partials: Partial[] = [];
    try {
      const igPayload = await optimizedApis.getInventoryHierarchy({
        company,
        level: "item_group",
        territory: t,
        territories: t,
        warehouse: wh,
        brand: brandKey,
        limit: ITEM_GROUP_LIMIT,
      });
      for (const g of hierarchyRows(igPayload)) {
        const ig = hierarchyRowId(g) || hierarchyRowLabel(g);
        if (!ig) continue;
        try {
          const payload = await optimizedApis.getInventoryHierarchy({
            company,
            level: "item",
            territory: t,
            territories: t,
            warehouse: wh,
            brand: brandKey,
            item_group: ig,
            limit: ITEM_LIMIT,
          });
          for (const row of hierarchyRows(payload)) {
            const label = hierarchyRowLabel(row);
            const code = String(row.item_code ?? row.id ?? "").trim();
            if (!label && !code) continue;
            partials.push({
              id: code || hierarchyRowId(row) || label,
              code,
              label: label || code,
              value: hierarchyRowValue(row) ?? 0,
              qty: hierarchyRowQty(row) ?? 0,
            });
          }
        } catch {
          /* item group */
        }
      }
    } catch {
      /* warehouse */
    }
    return partials;
  });

  const byCode = new Map<string, BrandCatalogItem>();
  for (const chunk of chunks) {
    for (const row of chunk) {
      const key = (row.code || row.label).toLowerCase();
      const hit = byCode.get(key);
      if (!hit) {
        byCode.set(key, { ...row });
        continue;
      }
      hit.qty += row.qty;
      hit.value += row.value;
    }
  }

  return [...byCode.values()].sort(
    (a, b) => b.qty - a.qty || b.value - a.value
  );
}

/** Lazy step 3 — warehouse lines for one item within a known brand. */
export async function fetchItemStockForBrand(
  itemCode: string,
  brand: string,
  company?: string,
  concurrency = 12,
  options?: { territory?: string | null }
): Promise<ItemStockResult | null> {
  const code = String(itemCode || "").trim();
  const brandKey = String(brand || "").trim();
  if (!code || !brandKey) return null;

  const territory = String(options?.territory || "").trim();
  const byCode = await fetchItemStockByCode({
    company,
    item_code: code,
    brand: brandKey,
    ...(territory ? { territory } : {}),
  });
  if (byCode?.lines.length) return byCode;

  const scanned = await scanAllLocations(code, company, brandKey, concurrency);
  if (!scanned.lines.length) return null;
  return buildResult(code, scanned.itemName, scanned.lines);
}

/** Full company search (slow — only when brand is unknown). */
export async function fetchItemStockAcrossCompany(
  itemCode: string,
  company?: string,
  options: FetchItemStockOptions = {}
): Promise<ItemStockResult | null> {
  const code = String(itemCode || "").trim();
  if (!code) return null;

  const concurrency = options.concurrency ?? 10;
  const brand = String(options.brand || "").trim() || undefined;

  let itemName = code;
  let lines: ItemStockLine[] = [];

  if (!brand) {
    const direct = await tryDirectItemLookup(code, company);
    if (direct?.lines.length) {
      for (const l of direct.lines) mergeLines(lines, l);
      if (direct.itemName) itemName = direct.itemName;
    }
    if (!lines.length) {
      const whLevel = await tryWarehouseLevelItemLookup(code, company);
      if (whLevel?.lines.length) {
        for (const l of whLevel.lines) mergeLines(lines, l);
      }
    }
  }

  if (!lines.length) {
    const scanned = await scanAllLocations(code, company, brand, concurrency);
    itemName = scanned.itemName;
    lines = scanned.lines;
  }

  if (!lines.length) return null;
  return buildResult(code, itemName, lines);
}
