/**
 * Phase 3I — Profitability (Gross Profit).
 */

export type BaMeta = {
  currency: string;
  company: string;
  from_date?: string;
  to_date?: string;
  generated_at?: string;
};

export type ProfitabilityKpis = {
  sales?: number | null;
  cogs?: number | null;
  gp?: number | null;
  gp_pct?: number | null;
  sales_ly?: number | null;
  gp_ly?: number | null;
  gp_pct_ly?: number | null;
  growth_pct?: number | null;
  gp_growth_pct?: number | null;
  invoice_count?: number | null;
};

export type ProfitRow = {
  id: string;
  name: string;
  sales: number;
  cogs?: number | null;
  gp?: number | null;
  gp_pct?: number | null;
  sales_ly?: number | null;
  gp_ly?: number | null;
  growth_pct?: number | null;
  invoice_count?: number | null;
};

export type ProfitabilityDashboard = {
  meta: BaMeta;
  kpis: ProfitabilityKpis;
  by_customer?: ProfitRow[] | null;
  by_product?: ProfitRow[] | null;
  by_salesperson?: ProfitRow[] | null;
  by_territory?: ProfitRow[] | null;
  by_brand?: ProfitRow[] | null;
  charts?: {
    months?: string[];
    sales?: number[];
    gp?: number[];
    gp_pct?: number[];
  } | null;
};

function num(v: unknown, fallback: number | null = 0): number | null {
  if (v == null || v === "") return fallback;
  if (typeof v === "number") return Number.isFinite(v) ? v : fallback;
  // MetricPoint / nested { value }
  if (typeof v === "object" && !Array.isArray(v)) {
    const o = v as Record<string, unknown>;
    if (o.value != null) return num(o.value, fallback);
    if (o.amount != null) return num(o.amount, fallback);
    if (o.total != null) return num(o.total, fallback);
  }
  const n = Number(String(v).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : fallback;
}

function str(v: unknown, fallback = ""): string {
  return v == null ? fallback : String(v);
}

function rootOf(raw: any): any {
  if (!raw) return {};
  // Frappe sometimes nests message → data
  if (raw.message && typeof raw.message === "object" && !Array.isArray(raw.message)) {
    return rootOf(raw.message);
  }
  if (raw.data && typeof raw.data === "object" && !Array.isArray(raw.data)) {
    return raw.data;
  }
  return raw;
}

function pickKpiBag(root: any): Record<string, unknown> {
  const candidates = [
    root.kpis,
    root.summary,
    root.profitability,
    root.gp,
    root.totals,
    root.metrics,
    root.overview,
  ];
  for (const c of candidates) {
    if (c && typeof c === "object" && !Array.isArray(c)) return c as any;
  }
  // Flat root KPIs (sales / cogs / gp on the payload itself)
  if (
    root.sales != null ||
    root.total_sales != null ||
    root.gp != null ||
    root.gross_profit != null ||
    root.cogs != null
  ) {
    return root;
  }
  return {};
}

function normalizeRow(r: any): ProfitRow {
  return {
    id: str(
      r.id ||
        r.name ||
        r.customer ||
        r.item_code ||
        r.salesperson ||
        r.territory ||
        r.brand
    ),
    name: str(
      r.name ||
        r.customer_name ||
        r.customer ||
        r.item_name ||
        r.item_code ||
        r.salesperson ||
        r.territory ||
        r.brand ||
        "—"
    ),
    sales: num(r.sales ?? r.revenue ?? r.amount ?? r.net_sales ?? r.total_sales, 0) || 0,
    cogs: num(r.cogs ?? r.cost_of_goods_sold ?? r.cost ?? r.total_cost, null),
    gp: num(r.gp ?? r.gross_profit ?? r.gross_profit_amount ?? r.profit, null),
    gp_pct: num(
      r.gp_pct ?? r.gross_profit_percent ?? r.margin_pct ?? r.margin_percentage,
      null
    ),
    sales_ly: num(r.sales_ly ?? r.previous_sales, null),
    gp_ly: num(r.gp_ly ?? r.previous_gp, null),
    growth_pct: num(r.growth_pct ?? r.change_pct, null),
    invoice_count: num(r.invoice_count ?? r.count, null),
  };
}

export function profitabilityKpisAreEmpty(kpis: ProfitabilityKpis): boolean {
  return (
    kpis.sales == null &&
    kpis.cogs == null &&
    kpis.gp == null &&
    kpis.gp_pct == null &&
    kpis.invoice_count == null
  );
}

export function normalizeProfitabilityDashboard(
  raw: any
): ProfitabilityDashboard {
  const root = rootOf(raw);
  const meta = root.meta || {};
  const kpis = pickKpiBag(root);
  const charts = root.charts || {};

  const sales = num(
    kpis.sales ??
      kpis.revenue ??
      kpis.net_sales ??
      kpis.total_sales ??
      root.total_sales,
    null
  );
  const cogs = num(
    kpis.cogs ?? kpis.cost_of_goods_sold ?? kpis.total_cost ?? root.cogs,
    null
  );
  let gp = num(
    kpis.gp ??
      kpis.gross_profit ??
      kpis.gross_profit_amount ??
      kpis.profit ??
      root.gp ??
      root.gross_profit,
    null
  );
  let gp_pct = num(
    kpis.gp_pct ??
      kpis.gross_profit_percent ??
      kpis.gross_profit_percentage ??
      kpis.margin_pct ??
      kpis.margin,
    null
  );
  if (gp == null && sales != null && cogs != null) {
    gp = sales - cogs;
  }
  if (gp_pct == null && gp != null && sales != null && sales > 0) {
    gp_pct = (gp / sales) * 100;
  }

  const normalized: ProfitabilityDashboard = {
    meta: {
      currency: str(meta.currency || root.currency, "SAR"),
      company: str(meta.company || root.company, ""),
      from_date: meta.from_date || root.from_date,
      to_date: meta.to_date || root.to_date,
      generated_at: meta.generated_at,
    },
    kpis: {
      sales,
      cogs,
      gp,
      gp_pct,
      sales_ly: num(kpis.sales_ly ?? kpis.previous_sales, null),
      gp_ly: num(kpis.gp_ly ?? kpis.previous_gp, null),
      gp_pct_ly: num(kpis.gp_pct_ly ?? kpis.previous_gp_pct, null),
      growth_pct: num(kpis.growth_pct ?? kpis.sales_growth_pct ?? kpis.change_pct, null),
      gp_growth_pct: num(kpis.gp_growth_pct, null),
      invoice_count: num(
        kpis.invoice_count ?? kpis.count ?? kpis.total_invoices,
        null
      ),
    },
    by_customer: Array.isArray(root.by_customer || root.customers)
      ? (root.by_customer || root.customers).map(normalizeRow)
      : null,
    by_product: Array.isArray(
      root.by_product || root.products || root.items || root.by_item
    )
      ? (root.by_product || root.products || root.items || root.by_item).map(
          normalizeRow
        )
      : null,
    by_salesperson: Array.isArray(root.by_salesperson || root.salespersons)
      ? (root.by_salesperson || root.salespersons).map(normalizeRow)
      : null,
    by_territory: Array.isArray(root.by_territory || root.territories)
      ? (root.by_territory || root.territories).map(normalizeRow)
      : null,
    by_brand: Array.isArray(root.by_brand || root.brands)
      ? (root.by_brand || root.brands).map(normalizeRow)
      : null,
    charts: root.charts
      ? {
          months: Array.isArray(charts.months) ? charts.months : charts.labels,
          sales: Array.isArray(charts.sales) ? charts.sales : undefined,
          gp: Array.isArray(charts.gp) ? charts.gp : undefined,
          gp_pct: Array.isArray(charts.gp_pct) ? charts.gp_pct : undefined,
        }
      : null,
  };

  if (typeof __DEV__ !== "undefined" && __DEV__) {
    console.log("📊 Profitability normalized:", {
      rootKeys: Object.keys(root || {}),
      kpiKeys: Object.keys(kpis || {}),
      sales: normalized.kpis.sales,
      cogs: normalized.kpis.cogs,
      gp: normalized.kpis.gp,
      gp_pct: normalized.kpis.gp_pct,
      empty: profitabilityKpisAreEmpty(normalized.kpis),
    });
  }

  return normalized;
}

export function getDemoProfitabilityDashboard(): ProfitabilityDashboard {
  return {
    meta: {
      currency: "SAR",
      company: "Demo Company",
      from_date: `${new Date().getFullYear()}-01-01`,
      to_date: new Date().toISOString().slice(0, 10),
    },
    kpis: {
      sales: 15470000,
      cogs: 10829000,
      gp: 4641000,
      gp_pct: 30.0,
      sales_ly: 13800000,
      gp_ly: 4002000,
      gp_pct_ly: 29.0,
      growth_pct: 12.1,
      gp_growth_pct: 16.0,
      invoice_count: 1842,
    },
    by_customer: [
      {
        id: "CUST-ALNOOR",
        name: "Al Noor Trading",
        sales: 980000,
        gp: 312000,
        gp_pct: 31.8,
        growth_pct: 9.2,
        invoice_count: 42,
      },
      {
        id: "CUST-FADECO",
        name: "Fadeco-Arabian Food & Dairy",
        sales: 860000,
        gp: 215000,
        gp_pct: 25.0,
        growth_pct: 4.1,
        invoice_count: 28,
      },
      {
        id: "CUST-RIYADH",
        name: "Riyadh Supplies LLC",
        sales: 720000,
        gp: 244800,
        gp_pct: 34.0,
        growth_pct: 14.5,
        invoice_count: 35,
      },
    ],
    by_product: [
      {
        id: "Paper",
        name: "Paper Products",
        sales: 5200000,
        gp: 1560000,
        gp_pct: 30.0,
        invoice_count: 620,
      },
      {
        id: "Ink",
        name: "Ink & Toner",
        sales: 4100000,
        gp: 1476000,
        gp_pct: 36.0,
        invoice_count: 410,
      },
      {
        id: "Pack",
        name: "Packaging",
        sales: 2800000,
        gp: 700000,
        gp_pct: 25.0,
        invoice_count: 380,
      },
    ],
    by_salesperson: [
      {
        id: "Ahmed",
        name: "Ahmed Al-Rashid",
        sales: 5200000,
        gp: 1664000,
        gp_pct: 32.0,
        growth_pct: 11.0,
      },
      {
        id: "Sara",
        name: "Sara Khan",
        sales: 4800000,
        gp: 1440000,
        gp_pct: 30.0,
        growth_pct: 13.2,
      },
      {
        id: "Omar",
        name: "Omar Hassan",
        sales: 3900000,
        gp: 1053000,
        gp_pct: 27.0,
        growth_pct: 6.5,
      },
    ],
    by_territory: [
      {
        id: "Dammam",
        name: "Dammam",
        sales: 7200000,
        gp: 2304000,
        gp_pct: 32.0,
      },
      {
        id: "Riyadh",
        name: "Riyadh",
        sales: 5100000,
        gp: 1479000,
        gp_pct: 29.0,
      },
      {
        id: "Jeddah",
        name: "Jeddah",
        sales: 3170000,
        gp: 855900,
        gp_pct: 27.0,
      },
    ],
    by_brand: [
      {
        id: "BrandA",
        name: "Brand A",
        sales: 4500000,
        gp: 1485000,
        gp_pct: 33.0,
      },
      {
        id: "BrandB",
        name: "Brand B",
        sales: 3800000,
        gp: 1064000,
        gp_pct: 28.0,
      },
    ],
    charts: {
      months: ["Mar", "Apr", "May", "Jun", "Jul", "Aug"],
      sales: [2100000, 2300000, 2450000, 2600000, 2550000, 2100000],
      gp: [630000, 690000, 735000, 780000, 765000, 630000],
      gp_pct: [30, 30, 30, 30, 30, 30],
    },
  };
}
