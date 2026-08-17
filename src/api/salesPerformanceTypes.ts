/**
 * Phase 3B′ — Salesperson & Product performance (no targets).
 */

export type BaMeta = {
  currency: string;
  company: string;
  from_date?: string;
  to_date?: string;
  generated_at?: string;
};

export type SalespersonRow = {
  id: string;
  name: string;
  sales: number;
  sales_ly?: number | null;
  growth_pct?: number | null;
  gp?: number | null;
  gp_pct?: number | null;
  collection?: number | null;
  outstanding?: number | null;
  overdue?: number | null;
  invoice_count?: number | null;
  customers?: CustomerPerfRow[] | null;
};

export type CustomerPerfRow = {
  id: string;
  name: string;
  sales: number;
  sales_ly?: number | null;
  growth_pct?: number | null;
  gp?: number | null;
  gp_pct?: number | null;
  outstanding?: number | null;
  overdue?: number | null;
  invoices?: InvoicePerfRow[] | null;
};

export type InvoicePerfRow = {
  id: string;
  name: string;
  posting_date?: string;
  sales: number;
  gp?: number | null;
  gp_pct?: number | null;
  /** Customer display name when loaded from SI list */
  customer?: string;
  items?: ItemPerfRow[] | null;
};

export type ItemPerfRow = {
  id: string;
  name: string;
  qty?: number | null;
  sales: number;
  gp?: number | null;
  gp_pct?: number | null;
  asp?: number | null;
};

export type SalespersonPerformance = {
  meta: BaMeta;
  rows: SalespersonRow[];
};

export type ProductLevel =
  | "division"
  | "brand"
  | "item_group"
  | "item";

export type ProductPerfRow = {
  id: string;
  name: string;
  level: ProductLevel | string;
  sales: number;
  qty?: number | null;
  gp?: number | null;
  gp_pct?: number | null;
  sales_ly?: number | null;
  growth_pct?: number | null;
  invoice_count?: number | null;
  customer_count?: number | null;
  asp?: number | null;
};

export type ProductPerformance = {
  meta: BaMeta;
  level: ProductLevel | string;
  rows: ProductPerfRow[];
};

function num(v: unknown, fallback = 0): number {
  if (v == null || v === "") return fallback;
  if (typeof v === "number") return Number.isFinite(v) ? v : fallback;
  const n = Number(String(v).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : fallback;
}

/** Prefer first finite number; otherwise null (shows as — in UI). */
function numOrNull(...vals: unknown[]): number | null {
  for (const v of vals) {
    if (v == null || v === "") continue;
    if (typeof v === "number") {
      if (Number.isFinite(v)) return v;
      continue;
    }
    const n = Number(String(v).replace(/[^0-9.\-]/g, ""));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function str(v: unknown, fallback = ""): string {
  if (v == null) return fallback;
  const s = String(v).trim();
  return s.length ? s : fallback;
}

/**
 * Resolve gross profit for a sales row.
 * Prefer explicit `gp` / derive from `sales - cogs`. Always derive `gp_pct`
 * from amounts (ignore backend %). When GP ≈ sales with no COGS, treat as
 * missing valuation (common BA bug) and return nulls.
 */
function resolveGrossProfit(
  sales: number,
  x: Record<string, unknown>
): { gp: number | null; gp_pct: number | null } {
  const cogs = numOrNull(
    x.cogs,
    x.total_cogs,
    x.cost_of_goods_sold,
    x.total_cost,
    x.cost
  );
  let gp = numOrNull(
    x.gp,
    x.gross_profit,
    x.gross_profit_amount,
    x.gp_amount
  );
  if (gp == null && cogs != null && sales > 0) {
    gp = sales - cogs;
  }

  // Signature of "COGS not applied": GP almost equals sales, no real cost.
  if (
    gp != null &&
    sales > 0 &&
    gp / sales >= 0.95 &&
    (cogs == null || cogs === 0)
  ) {
    return { gp: null, gp_pct: null };
  }

  if (gp == null || sales <= 0) {
    // Percent-only fallback (0–1 ratio → 0–100)
    let pct = numOrNull(
      x.gp_pct,
      x.gross_profit_percent,
      x.gross_profit_percentage,
      x.margin_pct,
      x.gp_percentage
    );
    if (pct != null && pct > 0 && pct <= 1) pct = pct * 100;
    // Same missing-COGS guard on percent-only payloads
    if (pct != null && pct >= 95) return { gp: null, gp_pct: null };
    return { gp: null, gp_pct: pct };
  }

  return { gp, gp_pct: (gp / sales) * 100 };
}

function rootOf(raw: any): any {
  if (!raw) return {};
  if (raw.data && typeof raw.data === "object" && !Array.isArray(raw.data)) {
    return raw.data;
  }
  return raw;
}

function metaOf(root: any): BaMeta {
  const m = root.meta || {};
  return {
    currency: str(m.currency || root.currency, "SAR"),
    company: str(m.company || root.company, ""),
    from_date: m.from_date || root.from_date,
    to_date: m.to_date || root.to_date,
    generated_at: m.generated_at || root.generated_at,
  };
}

/** Flatten common nested KPI bags onto the row for alias lookup. */
function rowWithMetrics(r: any): any {
  if (!r || typeof r !== "object") return {};
  const bag =
    (r.metrics && typeof r.metrics === "object" && r.metrics) ||
    (r.kpis && typeof r.kpis === "object" && r.kpis) ||
    (r.totals && typeof r.totals === "object" && r.totals) ||
    (r.summary && typeof r.summary === "object" && r.summary) ||
    null;
  return bag ? { ...bag, ...r } : r;
}

function mapItem(r: any): ItemPerfRow {
  const x = rowWithMetrics(r);
  return {
    id: str(x.id || x.item_code || x.item || x.name, "item"),
    name: str(x.name || x.item_name || x.item_code || x.item, "Item"),
    qty: numOrNull(x.qty, x.quantity),
    sales: num(x.sales ?? x.total_sales ?? x.amount),
    gp: numOrNull(x.gp, x.gross_profit, x.gross_profit_amount),
    gp_pct: numOrNull(
      x.gp_pct,
      x.gross_profit_percent,
      x.gross_profit_percentage,
      x.margin_pct,
      x.margin
    ),
    asp: numOrNull(x.asp, x.avg_selling_price, x.average_selling_price),
  };
}

function mapInvoice(r: any): InvoicePerfRow {
  const x = rowWithMetrics(r);
  return {
    id: str(x.id || x.name || x.invoice, "invoice"),
    name: str(x.name || x.invoice || x.id, "Invoice"),
    posting_date: x.posting_date || x.date,
    sales: num(x.sales ?? x.grand_total ?? x.total_sales ?? x.amount),
    gp: numOrNull(x.gp, x.gross_profit),
    gp_pct: numOrNull(x.gp_pct, x.gross_profit_percent),
    items: Array.isArray(x.items) ? x.items.map(mapItem) : null,
  };
}

function mapCustomer(r: any): CustomerPerfRow {
  const x = rowWithMetrics(r);
  const sales = num(x.sales ?? x.total_sales ?? x.amount ?? x.net_total);
  const sales_lyRaw = numOrNull(
    x.sales_ly,
    x.previous_year_sales,
    x.ly_sales,
    x.last_year_sales,
    x.sales_previous_year
  );
  const sales_ly =
    sales_lyRaw != null && sales_lyRaw !== 0 ? sales_lyRaw : null;
  let growth_pct = numOrNull(
    x.growth_pct,
    x.change_pct,
    x.change_percentage,
    x.yoy_pct,
    x.vs_ly_pct
  );
  if (sales_ly == null) {
    growth_pct = null;
  } else if (growth_pct == null) {
    growth_pct = ((sales - sales_ly) / Math.abs(sales_ly)) * 100;
  }
  const { gp, gp_pct } = resolveGrossProfit(sales, x);
  return {
    id: str(x.id || x.customer || x.name, "customer"),
    name: str(x.name || x.customer_name || x.customer, "Customer"),
    sales,
    sales_ly,
    growth_pct,
    gp,
    gp_pct,
    outstanding: numOrNull(
      x.outstanding,
      x.total_outstanding,
      x.customer_outstanding,
      x.receivables
    ),
    overdue: numOrNull(
      x.overdue,
      x.total_overdue,
      x.customer_overdue,
      x.overdue_amount
    ),
    invoices: Array.isArray(x.invoices) ? x.invoices.map(mapInvoice) : null,
  };
}

function mapSalesperson(r: any): SalespersonRow {
  const x = rowWithMetrics(r);
  const sales = num(
    x.sales ??
      x.actual_sales ??
      x.total_sales ??
      x.amount ??
      x.net_total ??
      x.grand_total
  );
  const sales_lyRaw = numOrNull(
    x.sales_ly,
    x.previous_year_sales,
    x.ly_sales,
    x.last_year_sales,
    x.sales_previous_year,
    x.previous_sales
  );
  // 0 usually means "no LY data", not a real prior-year total
  const sales_ly =
    sales_lyRaw != null && sales_lyRaw !== 0 ? sales_lyRaw : null;

  let growth_pct = numOrNull(
    x.growth_pct,
    x.change_pct,
    x.change_percentage,
    x.yoy_pct,
    x.vs_ly_pct,
    x.growth_percentage
  );
  if (sales_ly == null) {
    growth_pct = null;
  } else if (growth_pct == null && sales_ly !== 0) {
    growth_pct = ((sales - sales_ly) / Math.abs(sales_ly)) * 100;
  }

  const { gp, gp_pct } = resolveGrossProfit(sales, x);

  // Collection must be for the same period as sales. If BA returns a lifetime
  // / open-balance figure (often >> period sales), treat as missing.
  let collection = numOrNull(
    x.collection,
    x.collected,
    x.total_collection,
    x.collections,
    x.payment,
    x.payments,
    x.paid_amount,
    x.total_paid,
    x.receipts
  );
  if (
    collection != null &&
    sales > 0 &&
    collection > sales * 20
  ) {
    // Implausible vs period sales — keep sales, drop bad collection for UI
    collection = null;
  }

  return {
    id: str(
      x.id || x.salesperson || x.sales_person || x.name || x.employee,
      "sp"
    ),
    name: str(
      x.name || x.salesperson_name || x.sales_person || x.salesperson,
      "Salesperson"
    ),
    sales,
    sales_ly,
    growth_pct,
    gp,
    gp_pct,
    collection,
    outstanding: numOrNull(
      x.outstanding,
      x.total_outstanding,
      x.customer_outstanding,
      x.receivables,
      x.receivable
    ),
    overdue: numOrNull(
      x.overdue,
      x.total_overdue,
      x.customer_overdue,
      x.overdue_amount,
      x.overdue_outstanding
    ),
    invoice_count: numOrNull(
      x.invoice_count,
      x.invoices_count,
      typeof x.invoices === "number" ? x.invoices : null,
      x.si_count,
      x.count
    ),
    customers: Array.isArray(x.customers)
      ? x.customers.map(mapCustomer)
      : Array.isArray(x.customer_rows)
        ? x.customer_rows.map(mapCustomer)
        : null,
  };
}

export function normalizeSalespersonPerformance(raw: any): SalespersonPerformance {
  const root = rootOf(raw);
  const list =
    root.rows ||
    root.salespersons ||
    root.salesperson ||
    root.data ||
    root.items ||
    root.ranking ||
    [];
  const rows = Array.isArray(list) ? list.map(mapSalesperson) : [];
  if (
    typeof __DEV__ !== "undefined" &&
    __DEV__ &&
    Array.isArray(list) &&
    list[0]
  ) {
    console.log("📊 Salesperson row keys:", Object.keys(list[0]), {
      sample: {
        sales: list[0].sales ?? list[0].total_sales,
        gp: list[0].gp ?? list[0].gross_profit,
        collection: list[0].collection ?? list[0].collected,
        outstanding: list[0].outstanding ?? list[0].total_outstanding,
        overdue: list[0].overdue ?? list[0].total_overdue,
        sales_ly: list[0].sales_ly ?? list[0].previous_year_sales,
        metrics: list[0].metrics ? Object.keys(list[0].metrics) : null,
      },
      mapped: rows[0]
        ? {
            sales: rows[0].sales,
            gp: rows[0].gp,
            gp_pct: rows[0].gp_pct,
            collection: rows[0].collection,
            outstanding: rows[0].outstanding,
            overdue: rows[0].overdue,
            sales_ly: rows[0].sales_ly,
          }
        : null,
    });
  }
  return { meta: metaOf(root), rows };
}

function mapProduct(r: any, level: string): ProductPerfRow {
  const x = rowWithMetrics(r);
  // Flatten dimension bags some BA builds nest under dimensions / filters
  const dim =
    (x.dimensions && typeof x.dimensions === "object" && x.dimensions) ||
    (x.filters && typeof x.filters === "object" && x.filters) ||
    null;
  const row = dim ? { ...dim, ...x } : x;

  const sales = num(
    row.sales ?? row.total_sales ?? row.amount ?? row.value ?? row.net_total
  );
  const { gp, gp_pct } = resolveGrossProfit(sales, row);
  const sales_lyRaw = numOrNull(
    row.sales_ly,
    row.previous_year_sales,
    row.ly_sales,
    row.last_year_sales
  );
  const sales_ly =
    sales_lyRaw != null && sales_lyRaw !== 0 ? sales_lyRaw : null;
  let growth_pct = numOrNull(row.growth_pct, row.change_pct, row.yoy_pct);
  if (sales_ly == null) growth_pct = null;
  else if (growth_pct == null)
    growth_pct = ((sales - sales_ly) / Math.abs(sales_ly)) * 100;

  const levelKeys: Record<string, string[]> = {
    division: ["division", "division_name", "dept", "department"],
    brand: ["brand", "brand_name"],
    item_group: [
      "item_group",
      "item_group_name",
      "group",
      "group_name",
      "parent_item_group",
      "category",
      "category_name",
    ],
    item: ["item_name", "item_code", "item", "product", "product_name"],
  };
  const prefer = levelKeys[level] || levelKeys.item_group;

  const pickStr = (...vals: unknown[]): string => {
    for (const v of vals) {
      if (v == null || v === "") continue;
      if (typeof v === "object") continue;
      const s = String(v).trim();
      if (
        !s ||
        s === "Item" ||
        s === "null" ||
        s === "undefined" ||
        s === level
      ) {
        continue;
      }
      return s;
    }
    return "";
  };

  let name = pickStr(
    row.label,
    row.key,
    row.name,
    row.title,
    row.display_name,
    ...prefer.map((k) => row[k]),
    row.item_name,
    row.item_code,
    row.brand,
    row.division,
    row.item_group,
    row.category,
    row.group_name,
    row.item_group_name,
    row.brand_name,
    row.division_name,
    row.product_name
  );

  // Last resort: first non-numeric string field that looks like a label
  if (!name && row && typeof row === "object") {
    const skip = new Set([
      "level",
      "currency",
      "company",
      "from_date",
      "to_date",
      "period",
      "rank",
      "id",
      "metrics",
      "kpis",
      "totals",
      "summary",
      "dimensions",
      "filters",
    ]);
    for (const [k, v] of Object.entries(row)) {
      if (skip.has(k)) continue;
      if (typeof v !== "string") continue;
      const s = v.trim();
      if (s.length > 1 && s !== level && !/^\d{4}-\d{2}-\d{2}/.test(s)) {
        name = s;
        break;
      }
    }
  }

  const id =
    pickStr(
      row.key,
      row.id,
      row.code,
      ...prefer.map((k) => row[k]),
      row.item_code,
      row.label,
      row.name,
      name
    ) || level;

  return {
    id,
    name: name || "—",
    level: str(row.level || level, level),
    sales,
    qty: numOrNull(row.qty, row.quantity, row.total_qty, row.sold_qty, row.qty_sold),
    gp,
    gp_pct,
    sales_ly,
    growth_pct,
    invoice_count: numOrNull(
      row.invoice_count,
      row.invoices_count,
      row.si_count,
      row.count
    ),
    customer_count: numOrNull(
      row.customer_count,
      row.customers_count,
      row.unique_customers
    ),
    asp: (() => {
      const explicit = numOrNull(
        row.asp,
        row.avg_selling_price,
        row.average_selling_price
      );
      if (explicit != null) return explicit;
      const q = numOrNull(
        row.qty,
        row.quantity,
        row.total_qty,
        row.sold_qty,
        row.qty_sold
      );
      if (q != null && q > 0 && sales > 0) return sales / q;
      return null;
    })(),
  };
}

export function normalizeProductPerformance(
  raw: any,
  fallbackLevel: ProductLevel = "division"
): ProductPerformance {
  const root = rootOf(raw);
  const level = str(root.level, fallbackLevel) as ProductLevel;
  const list =
    root.rows ||
    root.items ||
    root.data ||
    root.hierarchy ||
    root.products ||
    root.by_item_group ||
    root.by_brand ||
    root.by_division ||
    [];
  const rows = Array.isArray(list)
    ? list.map((r) => mapProduct(r, level))
    : [];

  if (
    typeof __DEV__ !== "undefined" &&
    __DEV__ &&
    Array.isArray(list) &&
    list[0]
  ) {
    console.log("📊 Product performance row keys:", Object.keys(list[0]), {
      level,
      sample: list[0],
      mapped: rows[0]
        ? {
            id: rows[0].id,
            name: rows[0].name,
            sales: rows[0].sales,
            gp: rows[0].gp,
            invoice_count: rows[0].invoice_count,
          }
        : null,
    });
  }

  return { meta: metaOf(root), level, rows };
}

export function getDemoSalespersonPerformance(): SalespersonPerformance {
  return {
    meta: {
      currency: "SAR",
      company: "Demo Company",
      from_date: `${new Date().getFullYear()}-01-01`,
      to_date: new Date().toISOString().slice(0, 10),
    },
    rows: [
      {
        id: "SP-01",
        name: "Ahmed Al-Rashid",
        sales: 4250000,
        sales_ly: 3800000,
        growth_pct: 11.8,
        gp: 1320000,
        gp_pct: 31.1,
        collection: 3900000,
        outstanding: 620000,
        overdue: 145000,
        invoice_count: 186,
        customers: [
          {
            id: "CUST-1",
            name: "Al Noor Trading",
            sales: 980000,
            growth_pct: 8.2,
            outstanding: 120000,
            overdue: 35000,
            invoices: [
              {
                id: "SI-1001",
                name: "SI-1001",
                posting_date: "2026-07-12",
                sales: 85000,
                items: [
                  { id: "ITM-1", name: "Widget A", qty: 40, sales: 45000, gp_pct: 28 },
                  { id: "ITM-2", name: "Widget B", qty: 20, sales: 40000, gp_pct: 32 },
                ],
              },
            ],
          },
        ],
      },
      {
        id: "SP-02",
        name: "Sara Khan",
        sales: 3680000,
        sales_ly: 4100000,
        growth_pct: -10.2,
        gp: 1100000,
        gp_pct: 29.9,
        collection: 3400000,
        outstanding: 510000,
        overdue: 98000,
        invoice_count: 152,
        customers: [],
      },
      {
        id: "SP-03",
        name: "Omar Hassan",
        sales: 2950000,
        sales_ly: 2700000,
        growth_pct: 9.3,
        gp: 980000,
        gp_pct: 33.2,
        collection: 2800000,
        outstanding: 340000,
        overdue: 42000,
        invoice_count: 121,
        customers: [],
      },
    ],
  };
}

export function getDemoProductPerformance(
  level: ProductLevel = "division"
): ProductPerformance {
  const byLevel: Record<ProductLevel, ProductPerfRow[]> = {
    division: [
      {
        id: "DIV-R",
        name: "Retail",
        level: "division",
        sales: 8200000,
        qty: 12000,
        gp: 2460000,
        gp_pct: 30.0,
        sales_ly: 7600000,
        growth_pct: 7.9,
        invoice_count: 420,
        customer_count: 88,
      },
      {
        id: "DIV-I",
        name: "Industrial",
        level: "division",
        sales: 6100000,
        qty: 5400,
        gp: 2010000,
        gp_pct: 33.0,
        sales_ly: 5800000,
        growth_pct: 5.2,
        invoice_count: 210,
        customer_count: 45,
      },
    ],
    brand: [
      {
        id: "BR-1",
        name: "Printechs Pro",
        level: "brand",
        sales: 3100000,
        qty: 4200,
        gp: 980000,
        gp_pct: 31.6,
        growth_pct: 6.1,
      },
      {
        id: "BR-2",
        name: "ValueLine",
        level: "brand",
        sales: 2100000,
        qty: 6100,
        gp: 520000,
        gp_pct: 24.8,
        growth_pct: -2.4,
      },
    ],
    item_group: [
      {
        id: "IG-1",
        name: "POS Hardware",
        level: "item_group",
        sales: 1400000,
        qty: 900,
        gp: 420000,
        gp_pct: 30.0,
      },
    ],
    item: [
      {
        id: "ITM-88",
        name: "Thermal Printer X2",
        level: "item",
        sales: 420000,
        qty: 210,
        gp: 126000,
        gp_pct: 30.0,
        asp: 2000,
      },
    ],
  };
  return {
    meta: {
      currency: "SAR",
      company: "Demo Company",
      from_date: `${new Date().getFullYear()}-01-01`,
      to_date: new Date().toISOString().slice(0, 10),
    },
    level,
    rows: byLevel[level] || byLevel.division,
  };
}
