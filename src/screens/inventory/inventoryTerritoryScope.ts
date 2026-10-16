import type { DashboardWidgetDataResponse } from "../../api/dashboardWidgetData";
import { fetchDashboardWidgetData } from "../../api/dashboardWidgetData";
import { fetchTerritoryCostOfSales } from "../../api/profitability";
import { optimizedApis } from "../../api/optimized-apis";
import { normalizeCatalogKey } from "../../utils/catalogBootstrapMatch";
import {
  ALL_TERRITORIES,
  rowMatchesTerritory,
  territoryFilters,
} from "../../utils/dashboardTerritory";
import { INVENTORY_WIDGET_CATALOG } from "./inventoryWidgetCatalog";
import type { InventoryWidgetEntry } from "./buildInventorySections";

export type InventoryTerritoryRollup = {
  territory: string;
  totalValue: number | null;
  totalQty: number | null;
  availableValue: number | null;
  reservedValue: number | null;
  turnover: number | null;
  daysOfInventory: number | null;
};

export type InventoryTerritoryRollupRequest = {
  company?: string;
  territory: string;
  from_date?: string;
  to_date?: string;
  period?: string;
  /** Skip slow live-sales COGS estimate (hierarchy + widgets only). */
  fast?: boolean;
};

const TURNOVER_KEYS = new Set(
  [
    "inventory_turnover_kpi",
    "inventory_turnover_ytd_kpi",
    "turnover_kpi",
    "stock_turnover_kpi",
  ].map(normalizeCatalogKey)
);

const DAYS_KEYS = new Set(
  [
    "inventory_days_kpi",
    "days_of_inventory_kpi",
    "inventory_doi_kpi",
    "days_in_inventory_kpi",
  ].map(normalizeCatalogKey)
);

const TURNOVER_WIDGET_KEYS = [
  "inventory_turnover_kpi",
  "inventory_turnover_ytd_kpi",
  "turnover_kpi",
  "stock_turnover_kpi",
];

const DAYS_WIDGET_KEYS = [
  "inventory_days_kpi",
  "days_of_inventory_kpi",
  "inventory_doi_kpi",
  "days_in_inventory_kpi",
];

const TOTAL_VALUE_KEYS = new Set(
  [
    "inventory_total_value_kpi",
    "total_inventory_value_kpi",
    "inventory_value_kpi",
    "stock_value_kpi",
  ].map(normalizeCatalogKey)
);

const QTY_KEYS = new Set(
  [
    "inventory_stock_qty_kpi",
    "total_stock_quantity_kpi",
    "stock_quantity_kpi",
    "sku_qty_kpi",
  ].map(normalizeCatalogKey)
);

const AVAILABLE_KEYS = new Set(
  ["inventory_available_value_kpi", "available_stock_value_kpi", "available_value_kpi"].map(
    normalizeCatalogKey
  )
);

const RESERVED_KEYS = new Set(
  ["inventory_reserved_value_kpi", "reserved_stock_value_kpi", "reserved_value_kpi"].map(
    normalizeCatalogKey
  )
);

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function rowMetric(
  row: Record<string, unknown>,
  keys: string[]
): number | null {
  for (const k of keys) {
    const n = num(row[k]);
    if (n != null) return n;
  }
  return null;
}

function hierarchyRows(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  if (payload && typeof payload === "object") {
    const p = payload as Record<string, unknown>;
    if (Array.isArray(p.rows)) return p.rows as Record<string, unknown>[];
    if (Array.isArray(p.message)) return p.message as Record<string, unknown>[];
  }
  return [];
}

function territoryNameFromRow(row: Record<string, unknown>): string {
  return String(row.id ?? row.name ?? row.territory ?? "").trim();
}

function findTerritoryRow(
  rows: Record<string, unknown>[],
  territory: string
): Record<string, unknown> | undefined {
  const exact = rows.find((r) =>
    rowMatchesTerritory(territoryNameFromRow(r), territory)
  );
  if (exact) return exact;
  const want = territory.trim().toLowerCase();
  if (!want) return undefined;
  return rows.find((r) => {
    const name = territoryNameFromRow(r).toLowerCase();
    return name === want || name.startsWith(want) || name.includes(want);
  });
}

async function rollupFromSnapshot(
  company: string | undefined,
  territory: string
): Promise<Partial<InventoryTerritoryRollup>> {
  try {
    const snap = await optimizedApis.getInventorySnapshot({ company });
    const root = snap as Record<string, unknown>;
    const list =
      (root.inventory_by_territory as unknown[]) ||
      (root.by_territory as unknown[]) ||
      (root.territories as unknown[]) ||
      [];
    if (!Array.isArray(list)) return {};
    const row = list.find((r) => {
      if (!r || typeof r !== "object") return false;
      const name = String(
        (r as Record<string, unknown>).territory ??
          (r as Record<string, unknown>).name ??
          (r as Record<string, unknown>).id ??
          ""
      );
      return rowMatchesTerritory(name, territory);
    }) as Record<string, unknown> | undefined;
    if (!row) return {};
    return {
      totalValue: rowMetric(row, ["value", "stock_value", "amount"]),
      totalQty: rowMetric(row, ["qty", "actual_qty", "stock_qty", "sku_count"]),
    };
  } catch {
    return {};
  }
}

function inclusivePeriodDays(from_date?: string, to_date?: string): number {
  if (!from_date || !to_date) return 365;
  const a = new Date(from_date);
  const b = new Date(to_date);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 365;
  const ms = Math.abs(b.getTime() - a.getTime());
  return Math.max(1, Math.round(ms / (24 * 3600 * 1000)) + 1);
}

function reconcileTurnoverAndDays(
  turnover: number | null,
  days: number | null,
  periodDays: number
): { turnover: number | null; daysOfInventory: number | null } {
  const t = turnover != null && turnover > 0 ? turnover : null;
  const d = days != null && days > 0 ? days : null;

  if (t != null && d != null) {
    const impliedDays = periodDays / t;
    const drift = Math.abs(impliedDays - d) / Math.max(d, 1);
    if (drift <= 0.2) {
      return { turnover: t, daysOfInventory: Math.round(d) };
    }
    return {
      turnover: t,
      daysOfInventory: Math.round(periodDays / t),
    };
  }
  if (t != null) {
    return { turnover: t, daysOfInventory: Math.round(periodDays / t) };
  }
  if (d != null) {
    return { turnover: periodDays / d, daysOfInventory: Math.round(d) };
  }
  return { turnover: null, daysOfInventory: null };
}

/** Widget KPIs still company-wide while branch stock is much smaller. */
function looksLikeCompanyWideTurnoverWidgets(
  turnover: number | null,
  days: number | null,
  branchStockValue: number | null,
  periodDays: number
): boolean {
  if (turnover == null && days == null) return false;
  const stock = branchStockValue ?? 0;
  if (stock <= 0) return false;

  if (days != null && turnover != null && turnover > 0) {
    const impliedDays = periodDays / turnover;
    const drift = Math.abs(impliedDays - days) / Math.max(days, 1);
    if (drift > 0.2) return true;
  }

  if (
    stock < 8_000_000 &&
    turnover != null &&
    turnover > 2.5 &&
    days != null &&
    days > 150
  ) {
    return true;
  }

  return false;
}

async function widgetKpiValueFirst(
  widget_keys: string[],
  req: InventoryTerritoryRollupRequest
): Promise<number | null> {
  const values = await Promise.all(
    widget_keys.map((widget_key) => widgetKpiValue(widget_key, req))
  );
  return values.find((v) => v != null && Number.isFinite(v)) ?? null;
}

async function widgetKpiValue(
  widget_key: string,
  req: InventoryTerritoryRollupRequest
): Promise<number | null> {
  const filters = territoryFilters(req.territory);
  try {
    const data = await fetchDashboardWidgetData({
      widget_key,
      company: req.company,
      from_date: req.from_date,
      to_date: req.to_date,
      period: req.period,
      filters,
      show_ly: false,
    });
    const v = Number(data.kpis?.[0]?.value ?? data.value);
    return Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

async function turnoverFromCogsAndStock(
  req: InventoryTerritoryRollupRequest,
  avgInventoryValue: number | null
): Promise<{ turnover: number | null; daysOfInventory: number | null }> {
  if (avgInventoryValue == null || avgInventoryValue <= 0) {
    return { turnover: null, daysOfInventory: null };
  }
  try {
    const { cogs: rawCogs } = await fetchTerritoryCostOfSales({
      company: req.company,
      territory: req.territory,
      from_date: req.from_date,
      to_date: req.to_date,
      period: req.period,
    });
    const cogs = Number(rawCogs);
    if (!Number.isFinite(cogs) || cogs <= 0) {
      return { turnover: null, daysOfInventory: null };
    }
    const turnover = cogs / avgInventoryValue;
    const periodDays = inclusivePeriodDays(req.from_date, req.to_date);
    const daysOfInventory = Math.round(periodDays / turnover);
    return { turnover, daysOfInventory };
  } catch {
    return { turnover: null, daysOfInventory: null };
  }
}

export async function fetchInventoryTerritoryRollup(
  req: InventoryTerritoryRollupRequest | string,
  legacyTerritory?: string
): Promise<InventoryTerritoryRollup | null> {
  const normalized: InventoryTerritoryRollupRequest =
    typeof req === "string"
      ? { company: undefined, territory: req }
      : req;
  const t = String(normalized.territory || legacyTerritory || "").trim();
  if (!t || t === ALL_TERRITORIES) return null;
  const company = normalized.company;

  const rollupReq = { ...normalized, territory: t, company };
  const periodDays = inclusivePeriodDays(normalized.from_date, normalized.to_date);

  const loadBranchStock = async (): Promise<{
    totalValue: number | null;
    totalQty: number | null;
    availableValue: number | null;
    reservedValue: number | null;
  }> => {
    let totalValue: number | null = null;
    let totalQty: number | null = null;
    let availableValue: number | null = null;
    let reservedValue: number | null = null;

    const loadTerritoryRoot = () =>
      optimizedApis
        .getInventoryHierarchy({
          company,
          level: "territory",
          territories: t,
          limit: 100,
        })
        .catch(() => null);

    const loadWarehouses = () =>
      optimizedApis
        .getInventoryHierarchy({
          company,
          level: "warehouse",
          territory: t,
          territories: t,
          limit: 200,
        })
        .catch(() => null);

    const [territoryRoot, whPayload] = normalized.fast
      ? [null, await loadWarehouses()]
      : await Promise.all([loadTerritoryRoot(), loadWarehouses()]);

    if (territoryRoot) {
      const match = findTerritoryRow(hierarchyRows(territoryRoot), t);
      if (match) {
        totalValue = rowMetric(match, ["value", "stock_value", "amount"]);
        totalQty = rowMetric(match, ["qty", "actual_qty", "stock_qty"]);
      }
    }

    if (whPayload) {
      const whRows = hierarchyRows(whPayload);
      if (whRows.length) {
        const sum = (keys: string[]) =>
          whRows.reduce((acc, r) => acc + (rowMetric(r, keys) || 0), 0);
        const whValue = sum(["value", "stock_value", "amount"]);
        if (whValue > 0) totalValue = whValue;
        const whQty = sum(["qty", "actual_qty", "stock_qty"]);
        if (whQty > 0) totalQty = whQty;
        const avail = sum([
          "available_value",
          "available_stock_value",
          "available",
        ]);
        const reserved = sum([
          "reserved_value",
          "reserved_stock_value",
          "reserved",
        ]);
        if (avail > 0) availableValue = avail;
        if (reserved > 0) reservedValue = reserved;
      }
    }

    if (totalValue == null && totalQty == null) {
      const fromSnap = await rollupFromSnapshot(company, t);
      if (fromSnap.totalValue != null) totalValue = fromSnap.totalValue;
      if (fromSnap.totalQty != null) totalQty = fromSnap.totalQty;
    }

    return { totalValue, totalQty, availableValue, reservedValue };
  };

  const [stock, wt, wd] = await Promise.all([
    loadBranchStock(),
    widgetKpiValueFirst(TURNOVER_WIDGET_KEYS, rollupReq),
    widgetKpiValueFirst(DAYS_WIDGET_KEYS, rollupReq),
  ]);

  const { totalValue, totalQty, availableValue, reservedValue } = stock;
  if (totalValue == null && totalQty == null) return null;

  let turnover: number | null = null;
  let daysOfInventory: number | null = null;

  const widgetsCompanyWide = looksLikeCompanyWideTurnoverWidgets(
    wt,
    wd,
    totalValue,
    periodDays
  );

  if (!widgetsCompanyWide) {
    ({ turnover, daysOfInventory } = reconcileTurnoverAndDays(
      wt,
      wd,
      periodDays
    ));
  }

  if (
    (turnover == null || widgetsCompanyWide) &&
    totalValue != null &&
    totalValue > 0
  ) {
    const derived = await turnoverFromCogsAndStock(rollupReq, totalValue);
    if (derived.turnover != null && Number.isFinite(derived.turnover)) {
      turnover = derived.turnover;
      daysOfInventory = derived.daysOfInventory;
    }
  }

  if (turnover != null && daysOfInventory == null) {
    daysOfInventory = Math.round(periodDays / turnover);
  }

  return {
    territory: t,
    totalValue,
    totalQty,
    availableValue,
    reservedValue,
    turnover,
    daysOfInventory,
  };
}

function patchKpiPayload(
  payload: DashboardWidgetDataResponse,
  value: number,
  territory: string,
  clearLy: boolean
): DashboardWidgetDataResponse {
  const kpis = payload.kpis?.length
    ? payload.kpis.map((k, i) =>
        i === 0
          ? {
              ...k,
              value,
              previous: clearLy ? null : k.previous,
              change_pct: clearLy ? null : k.change_pct,
            }
          : k
      )
    : [
        {
          key: "total",
          label: payload.label || "KPI",
          value,
          format: payload.config?.format as string | undefined,
        },
      ];

  const summary = payload.chart?.summary;
  const chart = payload.chart
    ? {
        ...payload.chart,
        summary: summary
          ? {
              ...summary,
              value,
              value_ly: clearLy ? null : summary.value_ly,
              change_pct: clearLy ? null : summary.change_pct,
            }
          : summary,
      }
    : payload.chart;

  return {
    ...payload,
    value,
    kpis,
    chart,
    meta: {
      ...(payload.meta || {}),
      territory_scoped: territory,
      territory_scope_source: "get_inventory_hierarchy",
    },
  };
}

function keysForPayload(mapKey: string, payload: DashboardWidgetDataResponse): Set<string> {
  const keys = new Set<string>();
  keys.add(normalizeCatalogKey(mapKey));
  if (payload.widget_key) keys.add(normalizeCatalogKey(String(payload.widget_key)));
  return keys;
}

function patchKeys(
  map: Record<string, DashboardWidgetDataResponse>,
  allowed: Set<string>,
  value: number | null,
  territory: string,
  clearLy: boolean
): Record<string, DashboardWidgetDataResponse> {
  if (value == null || !Number.isFinite(value)) return map;
  const out = { ...map };
  for (const [mapKey, payload] of Object.entries(out)) {
    if (!payload) continue;
    const keys = keysForPayload(mapKey, payload);
    if (![...keys].some((k) => allowed.has(k))) continue;
    out[mapKey] = patchKpiPayload(payload, value, territory, clearLy);
  }
  return out;
}

/** Drop company-wide turnover/days from the board batch when branch has no trusted metric. */
function clearKeys(
  map: Record<string, DashboardWidgetDataResponse>,
  allowed: Set<string>
): Record<string, DashboardWidgetDataResponse> {
  const out = { ...map };
  for (const [mapKey, payload] of Object.entries(out)) {
    if (!payload) continue;
    const keys = keysForPayload(mapKey, payload);
    if (![...keys].some((k) => allowed.has(k))) continue;
    const kpis = payload.kpis?.length
      ? payload.kpis.map((k, i) =>
          i === 0 ? { ...k, value: null, previous: null, change_pct: null } : k
        )
      : payload.kpis;
    out[mapKey] = {
      ...payload,
      value: null as unknown as number,
      kpis: kpis as DashboardWidgetDataResponse["kpis"],
      meta: {
        ...(payload.meta || {}),
        territory_scoped: false,
        territory_scope_suppressed: true,
      } as DashboardWidgetDataResponse["meta"],
    };
  }
  return out;
}

/** Remove turnover/days from board batch (company-wide) until branch rollup is ready. */
export function stripCompanyWideTurnoverDays(
  widgetMap: Record<string, DashboardWidgetDataResponse>
): Record<string, DashboardWidgetDataResponse> {
  let map = widgetMap;
  map = clearKeys(map, TURNOVER_KEYS);
  map = clearKeys(map, DAYS_KEYS);
  return map;
}

/** Replace company-wide KPIs with territory stock rollup when board batch ignores filters. */
export function applyInventoryTerritoryScope(
  widgetMap: Record<string, DashboardWidgetDataResponse>,
  rollup: InventoryTerritoryRollup | null | undefined
): Record<string, DashboardWidgetDataResponse> {
  if (!rollup?.territory) return widgetMap;

  let map = widgetMap;
  map = patchKeys(map, TOTAL_VALUE_KEYS, rollup.totalValue, rollup.territory, true);
  map = patchKeys(map, QTY_KEYS, rollup.totalQty, rollup.territory, true);
  map = patchKeys(map, AVAILABLE_KEYS, rollup.availableValue, rollup.territory, true);
  map = patchKeys(map, RESERVED_KEYS, rollup.reservedValue, rollup.territory, true);
  const daysReady =
    rollup.daysOfInventory != null && Number.isFinite(rollup.daysOfInventory);
  const turnoverReady =
    rollup.turnover != null && Number.isFinite(rollup.turnover);

  if (turnoverReady && daysReady) {
    map = patchKeys(map, TURNOVER_KEYS, rollup.turnover, rollup.territory, true);
    map = patchKeys(
      map,
      DAYS_KEYS,
      rollup.daysOfInventory,
      rollup.territory,
      true
    );
  } else {
    map = clearKeys(map, TURNOVER_KEYS);
    map = clearKeys(map, DAYS_KEYS);
  }
  return map;
}

/** Overview KPI catalog keys — refetch with territory filters when batch is company-wide. */
export function inventoryTerritoryKpiKeys(): string[] {
  return INVENTORY_WIDGET_CATALOG.filter((c) => c.layout === "overview_kpi").map(
    (c) => c.key
  );
}

function entryCatalogKeys(entry: InventoryWidgetEntry): Set<string> {
  const keys = new Set<string>();
  keys.add(normalizeCatalogKey(entry.key));
  keys.add(normalizeCatalogKey(String(entry.payload.widget_key || "")));
  return keys;
}

function entryMatchesKeySet(
  entry: InventoryWidgetEntry,
  allowed: Set<string>
): boolean {
  const keys = entryCatalogKeys(entry);
  for (const k of keys) {
    if (allowed.has(k)) return true;
  }
  return false;
}

function rollupMetricReady(value: number | null | undefined): boolean {
  return value != null && Number.isFinite(value);
}

/**
 * Hide Available / Reserved KPIs when a branch is selected but hierarchy did not
 * return territory-level available/reserved (avoids company-wide SAR figures).
 */
export function filterOverviewKpisForTerritoryScope(
  kpis: InventoryWidgetEntry[],
  rollup: InventoryTerritoryRollup | null | undefined,
  territoryScoped: boolean
): InventoryWidgetEntry[] {
  if (!territoryScoped) return kpis;

  return kpis.filter((entry) => {
    const isAvailable = entryMatchesKeySet(entry, AVAILABLE_KEYS);
    const isReserved = entryMatchesKeySet(entry, RESERVED_KEYS);
    const isTurnover = entryMatchesKeySet(entry, TURNOVER_KEYS);
    const isDays = entryMatchesKeySet(entry, DAYS_KEYS);

    if (isTurnover || isDays) {
      return (
        rollupMetricReady(rollup?.turnover) &&
        rollupMetricReady(rollup?.daysOfInventory)
      );
    }
    if (!isAvailable && !isReserved) return true;

    const scoped = Boolean(entry.payload.meta?.territory_scoped);

    if (isAvailable) {
      return rollupMetricReady(rollup?.availableValue) && scoped;
    }
    if (isReserved) {
      return rollupMetricReady(rollup?.reservedValue) && scoped;
    }
    return true;
  });
}
