/**
 * Phase 3A — Executive Dashboard types + flexible normalizer.
 * Accepts snake_case Frappe payloads; optional sections may be null/omitted.
 */

export type MetricPoint = {
  value: number;
  previous?: number | null;
  change_pct?: number | null;
  label?: string;
};

export type ExecutiveMeta = {
  currency: string;
  company: string;
  from_date?: string;
  to_date?: string;
  generated_at?: string;
};

export type ExecutiveDashboard = {
  meta: ExecutiveMeta;
  sales?: {
    today?: MetricPoint | null;
    mtd?: MetricPoint | null;
    ytd?: MetricPoint | null;
  } | null;
  gross_profit?: {
    mtd?: MetricPoint | null;
    ytd?: MetricPoint | null;
    gp_pct?: MetricPoint | null;
  } | null;
  collection?: {
    today?: MetricPoint | null;
    mtd?: MetricPoint | null;
    ytd?: MetricPoint | null;
  } | null;
  receivables?: {
    total?: number | null;
    overdue?: number | null;
    overdue_pct?: number | null;
    current?: number | null;
  } | null;
  inventory?: {
    value?: number | null;
    low_stock_count?: number | null;
    non_moving_value?: number | null;
  } | null;
  orders?: {
    open_so_value?: number | null;
    pending_delivery_value?: number | null;
  } | null;
  purchasing?: {
    open_po_value?: number | null;
    pending_receipt_value?: number | null;
  } | null;
  payables?: {
    total?: number | null;
    overdue?: number | null;
  } | null;
  approvals?: {
    pending_count?: number | null;
  } | null;
};

function num(v: unknown, fallback = 0): number {
  if (v == null || v === "") return fallback;
  if (typeof v === "number") return Number.isFinite(v) ? v : fallback;
  // "1,234,567.89" or "SAR 1234"
  const cleaned = String(v).replace(/[^0-9.\-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : fallback;
}

function metric(raw: any): MetricPoint | null {
  if (raw == null) return null;
  if (typeof raw === "number" || typeof raw === "string") {
    return { value: num(raw) };
  }
  return {
    value: num(
      raw.value ?? raw.amount ?? raw.total ?? raw.sales ?? raw.current ?? 0
    ),
    previous:
      raw.previous != null
        ? num(raw.previous)
        : raw.previous_year_value != null
          ? num(raw.previous_year_value)
          : raw.ly != null
            ? num(raw.ly)
            : raw.previous_value != null
              ? num(raw.previous_value)
              : null,
    change_pct:
      raw.change_pct != null
        ? num(raw.change_pct)
        : raw.change_percentage != null
          ? num(raw.change_percentage)
          : raw.growth != null
            ? num(raw.growth)
            : raw.growth_pct != null
              ? num(raw.growth_pct)
              : null,
    label: raw.label,
  };
}

function pick(obj: any, ...keys: string[]): any {
  if (!obj || typeof obj !== "object") return undefined;
  for (const k of keys) {
    if (obj[k] != null) return obj[k];
  }
  return undefined;
}

/** Normalize Frappe `message` / nested / alternate key layouts */
export function normalizeExecutiveDashboard(raw: any): ExecutiveDashboard {
  let root =
    raw?.data && typeof raw.data === "object" && !Array.isArray(raw.data)
      ? raw.data
      : raw;

  // Flat KPI list (legacy dashboard shape) → map into sales section
  if (!root?.sales && Array.isArray(root?.kpis)) {
    const byId: Record<string, any> = {};
    root.kpis.forEach((k: any) => {
      if (k?.id) byId[k.id] = k;
    });
    root = {
      ...root,
      sales: {
        today: byId.sales_today
          ? {
              value: byId.sales_today.value,
              change_pct: byId.sales_today.change_percentage,
              previous: byId.sales_today.previous_year_value,
            }
          : null,
        mtd: byId.sales_mtd
          ? {
              value: byId.sales_mtd.value,
              change_pct: byId.sales_mtd.change_percentage,
              previous: byId.sales_mtd.previous_year_value,
            }
          : null,
        ytd: byId.sales_ytd
          ? {
              value: byId.sales_ytd.value,
              change_pct: byId.sales_ytd.change_percentage,
              previous: byId.sales_ytd.previous_year_value,
            }
          : null,
      },
    };
  }

  // Root-level aliases: sales_today / sales_mtd / …
  if (!root?.sales && (root?.sales_today != null || root?.sales_mtd != null)) {
    root = {
      ...root,
      sales: {
        today: root.sales_today,
        mtd: root.sales_mtd,
        ytd: root.sales_ytd,
      },
    };
  }

  const metaRaw = root?.meta || {};

  return {
    meta: {
      currency: String(metaRaw.currency || root.currency || "SAR"),
      company: String(metaRaw.company || root.company || ""),
      from_date: metaRaw.from_date || root.from_date,
      to_date: metaRaw.to_date || root.to_date,
      generated_at: metaRaw.generated_at || root.generated_at,
    },
    sales: root.sales
      ? {
          today: metric(pick(root.sales, "today", "sales_today")),
          mtd: metric(pick(root.sales, "mtd", "sales_mtd")),
          ytd: metric(pick(root.sales, "ytd", "sales_ytd")),
        }
      : null,
    gross_profit: root.gross_profit || root.gp
      ? {
          mtd: metric(pick(root.gross_profit || root.gp, "mtd", "gp_mtd")),
          ytd: metric(pick(root.gross_profit || root.gp, "ytd", "gp_ytd")),
          gp_pct: metric(
            pick(
              root.gross_profit || root.gp,
              "gp_pct",
              "margin_pct",
              "gp_percent"
            )
          ),
        }
      : null,
    collection: root.collection
      ? {
          today: metric(pick(root.collection, "today")),
          mtd: metric(pick(root.collection, "mtd")),
          ytd: metric(pick(root.collection, "ytd")),
        }
      : null,
    receivables: root.receivables
      ? {
          total: num(
            pick(root.receivables, "total", "total_unpaid", "totalUnpaid"),
            0
          ),
          overdue: num(pick(root.receivables, "overdue", "total_overdue"), 0),
          overdue_pct: num(
            pick(root.receivables, "overdue_pct", "overduePercentage"),
            0
          ),
          current:
            pick(root.receivables, "current") != null
              ? num(pick(root.receivables, "current"))
              : null,
        }
      : null,
    inventory: root.inventory
      ? {
          value: num(
            pick(
              root.inventory,
              "value",
              "total_value",
              "totalInventoryValue"
            ),
            0
          ),
          low_stock_count: num(
            pick(
              root.inventory,
              "low_stock_count",
              "lowStockCount",
              "reorder_alerts"
            ),
            0
          ),
          non_moving_value:
            pick(root.inventory, "non_moving_value", "nonMovingValue") != null
              ? num(pick(root.inventory, "non_moving_value", "nonMovingValue"))
              : null,
        }
      : null,
    orders: root.orders || root.sales_orders
      ? {
          open_so_value: num(
            pick(
              root.orders || root.sales_orders,
              "open_so_value",
              "open_value",
              "open_sales_order_value"
            ),
            0
          ),
          pending_delivery_value: num(
            pick(
              root.orders || root.sales_orders,
              "pending_delivery_value",
              "pending_delivery"
            ),
            0
          ),
        }
      : null,
    purchasing: root.purchasing || root.purchase
      ? {
          open_po_value: num(
            pick(
              root.purchasing || root.purchase,
              "open_po_value",
              "open_value",
              "open_purchase_order_value"
            ),
            0
          ),
          pending_receipt_value: num(
            pick(
              root.purchasing || root.purchase,
              "pending_receipt_value",
              "pending_receipt"
            ),
            0
          ),
        }
      : null,
    payables: root.payables
      ? {
          total: num(pick(root.payables, "total", "total_payable"), 0),
          overdue: num(pick(root.payables, "overdue", "overdue_payable"), 0),
        }
      : null,
    approvals: root.approvals
      ? {
          pending_count: num(
            pick(root.approvals, "pending_count", "pending", "total_pending"),
            0
          ),
        }
      : null,
  };
}

export function getDemoExecutiveDashboard(
  company = "Demo Company"
): ExecutiveDashboard {
  return {
    meta: {
      currency: "SAR",
      company,
      from_date: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        .toISOString()
        .slice(0, 10),
      to_date: new Date().toISOString().slice(0, 10),
      generated_at: new Date().toISOString(),
    },
    sales: {
      today: { value: 184500, previous: 164700, change_pct: 12.0 },
      mtd: { value: 3850000, previous: 3550000, change_pct: 8.4 },
      ytd: { value: 28400000, previous: 25100000, change_pct: 13.1 },
    },
    gross_profit: {
      mtd: { value: 1209000, change_pct: -1.1 },
      ytd: { value: 8920000, change_pct: 4.2 },
      gp_pct: { value: 31.4, previous: 32.5, change_pct: -1.1 },
    },
    collection: {
      today: { value: 245000 },
      mtd: { value: 3120000 },
      ytd: { value: 22100000 },
    },
    receivables: {
      total: 7800000,
      overdue: 2100000,
      overdue_pct: 26.9,
      current: 5700000,
    },
    inventory: {
      value: 11400000,
      low_stock_count: 18,
      non_moving_value: 890000,
    },
    orders: {
      open_so_value: 4200000,
      pending_delivery_value: 1850000,
    },
    purchasing: {
      open_po_value: 2650000,
      pending_receipt_value: 980000,
    },
    payables: {
      total: 3450000,
      overdue: 420000,
    },
    approvals: {
      pending_count: 7,
    },
  };
}
