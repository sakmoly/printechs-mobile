/**
 * Phase 3H — Inventory Health / Stock Cover / Dead Stock.
 */

export type BaMeta = {
  currency: string;
  company: string;
  from_date?: string;
  to_date?: string;
  generated_at?: string;
};

export type InventoryHealthKpis = {
  total_value?: number | null;
  low_stock_count?: number | null;
  low_stock_value?: number | null;
  overstock_count?: number | null;
  overstock_value?: number | null;
  non_moving_value?: number | null;
  non_moving_count?: number | null;
  turnover?: number | null;
  days_of_cover?: number | null;
  sku_count?: number | null;
};

export type HealthItem = {
  id: string;
  name: string;
  item_code?: string | null;
  warehouse?: string | null;
  qty?: number | null;
  value?: number | null;
  reorder_level?: number | null;
  status?: string | null;
  days_cover?: number | null;
  last_movement?: string | null;
};

export type InventoryHealth = {
  meta: BaMeta;
  kpis: InventoryHealthKpis;
  low_stock?: HealthItem[] | null;
  overstock?: HealthItem[] | null;
  by_warehouse?: { id: string; name: string; value: number; sku_count?: number | null }[] | null;
  by_category?: { id: string; name: string; value: number; low_stock?: number | null }[] | null;
};

export type StockCoverRow = {
  id: string;
  name: string;
  item_code?: string | null;
  warehouse?: string | null;
  qty?: number | null;
  value?: number | null;
  avg_daily_usage?: number | null;
  days_cover?: number | null;
  status?: "critical" | "low" | "ok" | "excess" | string | null;
};

export type StockCover = {
  meta: BaMeta;
  summary?: {
    avg_days_cover?: number | null;
    critical_count?: number | null;
    low_count?: number | null;
    excess_count?: number | null;
  } | null;
  items: StockCoverRow[];
};

export type DeadStockRow = {
  id: string;
  name: string;
  item_code?: string | null;
  warehouse?: string | null;
  qty?: number | null;
  value?: number | null;
  days_since_movement?: number | null;
  last_movement?: string | null;
  category?: string | null;
};

export type DeadStock = {
  meta: BaMeta;
  summary?: {
    total_value?: number | null;
    item_count?: number | null;
    pct_of_inventory?: number | null;
  } | null;
  items: DeadStockRow[];
  by_category?: { name: string; value: number; count?: number | null }[] | null;
};

function num(v: unknown, fallback: number | null = 0): number | null {
  if (v == null || v === "") return fallback;
  if (typeof v === "number") return Number.isFinite(v) ? v : fallback;
  const n = Number(String(v).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : fallback;
}

function str(v: unknown, fallback = ""): string {
  return v == null ? fallback : String(v);
}

function rootOf(raw: any): any {
  if (!raw) return {};
  if (raw.data && typeof raw.data === "object") return raw.data;
  return raw;
}

function normalizeHealthItem(r: any): HealthItem {
  return {
    id: str(r.id || r.item_code || r.name),
    name: str(r.item_name || r.name || r.item_code, "Item"),
    item_code: r.item_code || r.id || null,
    warehouse: r.warehouse || null,
    qty: num(r.qty ?? r.actual_qty ?? r.quantity, null),
    value: num(r.value ?? r.stock_value ?? r.amount, null),
    reorder_level: num(r.reorder_level ?? r.reorder_qty, null),
    status: r.status || r.health_status || null,
    days_cover: num(r.days_cover ?? r.cover_days, null),
    last_movement: r.last_movement || r.last_movement_date || null,
  };
}

export function normalizeInventoryHealth(raw: any): InventoryHealth {
  const root = rootOf(raw);
  const meta = root.meta || {};
  const kpis = root.kpis || root.summary || root.health || {};

  return {
    meta: {
      currency: str(meta.currency || root.currency, "SAR"),
      company: str(meta.company || root.company, ""),
      from_date: meta.from_date || root.from_date,
      to_date: meta.to_date || root.to_date,
      generated_at: meta.generated_at,
    },
    kpis: {
      total_value: num(
        kpis.total_value ?? kpis.value ?? kpis.total_inventory_value,
        null
      ),
      low_stock_count: num(kpis.low_stock_count ?? kpis.lowStockCount, null),
      low_stock_value: num(kpis.low_stock_value, null),
      overstock_count: num(kpis.overstock_count, null),
      overstock_value: num(kpis.overstock_value, null),
      non_moving_value: num(
        kpis.non_moving_value ?? kpis.nonMovingValue,
        null
      ),
      non_moving_count: num(kpis.non_moving_count, null),
      turnover: num(kpis.turnover ?? kpis.inventory_turnover, null),
      days_of_cover: num(kpis.days_of_cover ?? kpis.avg_days_cover, null),
      sku_count: num(kpis.sku_count ?? kpis.item_count, null),
    },
    low_stock: Array.isArray(root.low_stock || root.reorder_alerts)
      ? (root.low_stock || root.reorder_alerts).map(normalizeHealthItem)
      : null,
    overstock: Array.isArray(root.overstock)
      ? root.overstock.map(normalizeHealthItem)
      : null,
    by_warehouse: Array.isArray(root.by_warehouse || root.warehouses)
      ? (root.by_warehouse || root.warehouses).map((w: any) => ({
          id: str(w.id || w.name || w.warehouse),
          name: str(w.name || w.warehouse, "Warehouse"),
          value: num(w.value ?? w.stock_value, 0) || 0,
          sku_count: num(w.sku_count ?? w.count, null),
        }))
      : null,
    by_category: Array.isArray(root.by_category || root.categories)
      ? (root.by_category || root.categories).map((c: any) => ({
          id: str(c.id || c.name || c.category),
          name: str(c.name || c.category, "Category"),
          value: num(c.value ?? c.stock_value, 0) || 0,
          low_stock: num(c.low_stock ?? c.low_stock_count, null),
        }))
      : null,
  };
}

export function normalizeStockCover(raw: any): StockCover {
  const root = rootOf(raw);
  const meta = root.meta || {};
  const summary = root.summary || {};
  const list = root.items || root.rows || root.data || [];

  return {
    meta: {
      currency: str(meta.currency || root.currency, "SAR"),
      company: str(meta.company || root.company, ""),
      from_date: meta.from_date || root.from_date,
      to_date: meta.to_date || root.to_date,
      generated_at: meta.generated_at,
    },
    summary: root.summary
      ? {
          avg_days_cover: num(summary.avg_days_cover ?? summary.days_of_cover, null),
          critical_count: num(summary.critical_count, null),
          low_count: num(summary.low_count, null),
          excess_count: num(summary.excess_count, null),
        }
      : null,
    items: (Array.isArray(list) ? list : []).map((r: any) => ({
      id: str(r.id || r.item_code || r.name),
      name: str(r.item_name || r.name || r.item_code, "Item"),
      item_code: r.item_code || null,
      warehouse: r.warehouse || null,
      qty: num(r.qty ?? r.actual_qty, null),
      value: num(r.value ?? r.stock_value, null),
      avg_daily_usage: num(r.avg_daily_usage ?? r.daily_usage, null),
      days_cover: num(r.days_cover ?? r.cover_days, null),
      status: r.status || null,
    })),
  };
}

export function normalizeDeadStock(raw: any): DeadStock {
  const root = rootOf(raw);
  const meta = root.meta || {};
  const summary = root.summary || {};
  const list = root.items || root.rows || root.dead_stock || root.data || [];

  return {
    meta: {
      currency: str(meta.currency || root.currency, "SAR"),
      company: str(meta.company || root.company, ""),
      from_date: meta.from_date || root.from_date,
      to_date: meta.to_date || root.to_date,
      generated_at: meta.generated_at,
    },
    summary: root.summary
      ? {
          total_value: num(summary.total_value ?? summary.value, null),
          item_count: num(summary.item_count ?? summary.count, null),
          pct_of_inventory: num(summary.pct_of_inventory ?? summary.pct, null),
        }
      : null,
    items: (Array.isArray(list) ? list : []).map((r: any) => ({
      id: str(r.id || r.item_code || r.name),
      name: str(r.item_name || r.name || r.item_code, "Item"),
      item_code: r.item_code || null,
      warehouse: r.warehouse || null,
      qty: num(r.qty ?? r.actual_qty, null),
      value: num(r.value ?? r.stock_value, null),
      days_since_movement: num(
        r.days_since_movement ?? r.days_idle ?? r.days,
        null
      ),
      last_movement: r.last_movement || r.last_movement_date || null,
      category: r.category || r.item_group || null,
    })),
    by_category: Array.isArray(root.by_category)
      ? root.by_category.map((c: any) => ({
          name: str(c.name || c.category, "Category"),
          value: num(c.value, 0) || 0,
          count: num(c.count, null),
        }))
      : null,
  };
}

export function getDemoInventoryHealth(): InventoryHealth {
  return {
    meta: { currency: "SAR", company: "Demo Company" },
    kpis: {
      total_value: 15800000,
      low_stock_count: 24,
      low_stock_value: 420000,
      overstock_count: 18,
      overstock_value: 2100000,
      non_moving_value: 980000,
      non_moving_count: 42,
      turnover: 4.2,
      days_of_cover: 68,
      sku_count: 1240,
    },
    low_stock: [
      {
        id: "ITEM-100",
        name: "A4 Paper Ream",
        item_code: "ITEM-100",
        warehouse: "Dammam Main",
        qty: 12,
        value: 480,
        reorder_level: 50,
        status: "critical",
        days_cover: 4,
      },
      {
        id: "ITEM-220",
        name: "Ink Cartridge CMYK",
        item_code: "ITEM-220",
        warehouse: "Dammam Main",
        qty: 8,
        value: 3200,
        reorder_level: 20,
        status: "low",
        days_cover: 9,
      },
    ],
    overstock: [
      {
        id: "ITEM-501",
        name: "Legacy Envelope Box",
        item_code: "ITEM-501",
        warehouse: "Riyadh WH",
        qty: 2400,
        value: 96000,
        days_cover: 240,
        status: "excess",
      },
    ],
    by_warehouse: [
      { id: "WH-DAM", name: "Dammam Main", value: 8200000, sku_count: 620 },
      { id: "WH-RIY", name: "Riyadh WH", value: 5100000, sku_count: 410 },
      { id: "WH-JED", name: "Jeddah WH", value: 2500000, sku_count: 210 },
    ],
    by_category: [
      { id: "Paper", name: "Paper", value: 6200000, low_stock: 8 },
      { id: "Ink", name: "Ink & Toner", value: 4800000, low_stock: 10 },
      { id: "Pack", name: "Packaging", value: 2800000, low_stock: 4 },
    ],
  };
}

export function getDemoStockCover(): StockCover {
  return {
    meta: { currency: "SAR", company: "Demo Company" },
    summary: {
      avg_days_cover: 68,
      critical_count: 6,
      low_count: 18,
      excess_count: 22,
    },
    items: [
      {
        id: "ITEM-100",
        name: "A4 Paper Ream",
        item_code: "ITEM-100",
        warehouse: "Dammam Main",
        qty: 12,
        value: 480,
        avg_daily_usage: 3,
        days_cover: 4,
        status: "critical",
      },
      {
        id: "ITEM-220",
        name: "Ink Cartridge CMYK",
        item_code: "ITEM-220",
        warehouse: "Dammam Main",
        qty: 8,
        value: 3200,
        avg_daily_usage: 0.9,
        days_cover: 9,
        status: "low",
      },
      {
        id: "ITEM-310",
        name: "Corrugated Box M",
        item_code: "ITEM-310",
        warehouse: "Jeddah WH",
        qty: 900,
        value: 45000,
        avg_daily_usage: 15,
        days_cover: 60,
        status: "ok",
      },
      {
        id: "ITEM-501",
        name: "Legacy Envelope Box",
        item_code: "ITEM-501",
        warehouse: "Riyadh WH",
        qty: 2400,
        value: 96000,
        avg_daily_usage: 10,
        days_cover: 240,
        status: "excess",
      },
    ],
  };
}

export function getDemoDeadStock(): DeadStock {
  return {
    meta: { currency: "SAR", company: "Demo Company" },
    summary: {
      total_value: 980000,
      item_count: 42,
      pct_of_inventory: 6.2,
    },
    by_category: [
      { name: "Packaging", value: 420000, count: 18 },
      { name: "Paper", value: 310000, count: 12 },
      { name: "Accessories", value: 250000, count: 12 },
    ],
    items: [
      {
        id: "ITEM-880",
        name: "Obsolete Label Roll",
        item_code: "ITEM-880",
        warehouse: "Riyadh WH",
        qty: 500,
        value: 75000,
        days_since_movement: 210,
        last_movement: "2025-12-28",
        category: "Packaging",
      },
      {
        id: "ITEM-771",
        name: "Old Brand Letterhead",
        item_code: "ITEM-771",
        warehouse: "Dammam Main",
        qty: 1200,
        value: 48000,
        days_since_movement: 185,
        last_movement: "2026-01-22",
        category: "Paper",
      },
      {
        id: "ITEM-660",
        name: "Discontinued Binder",
        item_code: "ITEM-660",
        warehouse: "Jeddah WH",
        qty: 340,
        value: 27200,
        days_since_movement: 160,
        last_movement: "2026-02-16",
        category: "Accessories",
      },
    ],
  };
}
