/**
 * Phase 3C — Customer 360 types + normalizer + demo.
 */

export type CustomerSearchHit = {
  id: string;
  name: string;
  customer_group?: string;
  territory?: string;
  salesperson?: string;
};

export type Customer360 = {
  meta: {
    currency: string;
    company: string;
    from_date?: string;
    to_date?: string;
  };
  customer: {
    id: string;
    name: string;
    customer_group?: string;
    territory?: string;
    salesperson?: string;
    credit_limit?: number | null;
    mobile?: string;
    email?: string;
    address?: string;
  };
  sales?: {
    today?: number | null;
    mtd?: number | null;
    ytd?: number | null;
    ytd_ly?: number | null;
    growth_pct?: number | null;
    gp?: number | null;
    gp_pct?: number | null;
    avg_invoice?: number | null;
    last_invoice_date?: string | null;
  } | null;
  receivables?: {
    outstanding?: number | null;
    overdue?: number | null;
    current?: number | null;
    /** Average monthly sales for this customer (derived or from BA). */
    avg_monthly_sales?: number | null;
    /** Average monthly amount paid / collected from this customer. */
    avg_monthly_paid?: number | null;
    oldest_invoice?: string | null;
  } | null;
  orders?: {
    open_so_count?: number | null;
    open_so_value?: number | null;
    pending_delivery?: number | null;
    pending_billing?: number | null;
    backorder?: number | null;
  } | null;
  activity?: {
    last_quotation?: string | null;
    last_sales_order?: string | null;
    last_delivery?: string | null;
    last_invoice?: string | null;
    last_payment?: string | null;
  } | null;
  charts?: {
    months?: string[];
    sales?: number[];
    /** Same-month sales last year (aligned with `months`). */
    sales_ly?: number[];
    /** YoY % vs last year for each month ((sales − sales_ly) / sales_ly × 100). */
    sales_growth_pct?: (number | null)[];
    collection?: number[];
    receivables?: number[];
  } | null;
};

const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** Parse BA month labels: "Jan", "January", "2026-01", "01", etc. → 0–11. */
export function monthLabelToIndex(label: unknown): number | null {
  if (label == null) return null;
  const raw = String(label).trim();
  if (!raw) return null;
  const iso = raw.match(/^(\d{4})-(\d{1,2})/);
  if (iso) {
    const m = Number(iso[2]);
    return m >= 1 && m <= 12 ? m - 1 : null;
  }
  const numOnly = raw.match(/^(\d{1,2})$/);
  if (numOnly) {
    const m = Number(numOnly[1]);
    return m >= 1 && m <= 12 ? m - 1 : null;
  }
  const lower = raw.toLowerCase().slice(0, 3);
  const idx = SHORT_MONTHS.findIndex((m) => m.toLowerCase() === lower);
  return idx >= 0 ? idx : null;
}

/**
 * Expand a partial BA chart (often Mar–Aug, skipping empty months) to
 * calendar YTD Jan…current month. Missing months get `0` (not invented
 * activity — BA typically omits zero months).
 */
export function completeCustomerChartsYtd(
  charts: NonNullable<Customer360["charts"]> | null | undefined,
  endDate: Date = new Date()
): NonNullable<Customer360["charts"]> | null {
  if (!charts) return null;
  const endMonth = endDate.getMonth(); // 0-based
  const ytdMonths = SHORT_MONTHS.slice(0, endMonth + 1).map(String);

  const byMonth = new Map<
    number,
    {
      sales?: number | null;
      sales_ly?: number | null;
      sales_growth_pct?: number | null;
      collection?: number | null;
      receivables?: number | null;
    }
  >();
  const labels = Array.isArray(charts.months) ? charts.months : [];
  for (let i = 0; i < labels.length; i++) {
    const mi = monthLabelToIndex(labels[i]);
    if (mi == null || mi > endMonth) continue;
    byMonth.set(mi, {
      sales: charts.sales?.[i] ?? null,
      sales_ly: charts.sales_ly?.[i] ?? null,
      sales_growth_pct: charts.sales_growth_pct?.[i] ?? null,
      collection: charts.collection?.[i] ?? null,
      receivables: charts.receivables?.[i] ?? null,
    });
  }

  const sales: number[] = [];
  const sales_ly: number[] = [];
  const sales_growth_pct: (number | null)[] = [];
  const collection: number[] = [];
  const receivables: number[] = [];
  let hasSales = Array.isArray(charts.sales);
  let hasSalesLy = Array.isArray(charts.sales_ly);
  let hasGrowth = Array.isArray(charts.sales_growth_pct);
  let hasCollection = Array.isArray(charts.collection);
  let hasReceivables = Array.isArray(charts.receivables);

  for (let mi = 0; mi <= endMonth; mi++) {
    const hit = byMonth.get(mi);
    sales.push(hit?.sales != null && Number.isFinite(Number(hit.sales)) ? Number(hit.sales) : 0);
    sales_ly.push(
      hit?.sales_ly != null && Number.isFinite(Number(hit.sales_ly))
        ? Number(hit.sales_ly)
        : 0
    );
    sales_growth_pct.push(
      hit?.sales_growth_pct != null && Number.isFinite(Number(hit.sales_growth_pct))
        ? Number(hit.sales_growth_pct)
        : null
    );
    collection.push(
      hit?.collection != null && Number.isFinite(Number(hit.collection))
        ? Number(hit.collection)
        : 0
    );
    receivables.push(
      hit?.receivables != null && Number.isFinite(Number(hit.receivables))
        ? Number(hit.receivables)
        : 0
    );
  }

  return {
    months: ytdMonths,
    sales: hasSales ? sales : charts.sales,
    sales_ly: hasSalesLy ? sales_ly : charts.sales_ly,
    sales_growth_pct: hasGrowth ? sales_growth_pct : charts.sales_growth_pct,
    collection: hasCollection ? collection : charts.collection,
    receivables: hasReceivables ? receivables : charts.receivables,
  };
}

/** YoY growth %; null when LY is missing/zero (no fair comparison). */
export function salesGrowthPct(
  sales: number | null | undefined,
  salesLy: number | null | undefined
): number | null {
  if (sales == null || !Number.isFinite(Number(sales))) return null;
  if (salesLy == null || !Number.isFinite(Number(salesLy)) || Number(salesLy) === 0) {
    return null;
  }
  return ((Number(sales) - Number(salesLy)) / Math.abs(Number(salesLy))) * 100;
}

function num(v: unknown, fallback: number | null = 0): number | null {
  if (v == null || v === "") return fallback;
  if (typeof v === "number") return Number.isFinite(v) ? v : fallback;
  const n = Number(String(v).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : fallback;
}

function firstNum(...vals: unknown[]): number | null {
  for (const v of vals) {
    const n = num(v, null);
    if (n != null) return n;
  }
  return null;
}

function str(v: unknown, fallback = ""): string {
  return v == null ? fallback : String(v);
}

/** Doctype label / empty placeholders — never show as the party name. */
export function isGenericCustomerLabel(name?: string | null): boolean {
  const t = (name || "").trim().toLowerCase();
  return !t || t === "customer" || t === "customers" || t === "party";
}

function pickCustomerDisplayName(
  ...candidates: Array<unknown>
): string {
  for (const c of candidates) {
    const s = str(c).trim();
    if (s && !isGenericCustomerLabel(s)) return s;
  }
  return "Customer";
}

function rootOf(raw: any): any {
  if (!raw) return {};
  if (raw.data && typeof raw.data === "object" && !Array.isArray(raw.data)) {
    return raw.data;
  }
  return raw;
}

/**
 * BA / Frappe may send:
 * - `customer` as string id + `profile` object (live erp_analysis shape)
 * - `customer` as nested object (contract shape)
 * - flat fields on the root
 */
function resolveCustomerIdentity(root: any): {
  id: string;
  name: string;
  customer_group?: string;
  territory?: string;
  salesperson?: string;
  credit_limit?: number | null;
  mobile?: string;
  email?: string;
  address?: string;
} {
  const profile =
    root.profile && typeof root.profile === "object" ? root.profile : null;
  const customerObj =
    root.customer && typeof root.customer === "object" ? root.customer : null;
  const customerStr =
    typeof root.customer === "string" ? root.customer : null;

  const obj = customerObj || profile || root;
  const id = str(
    obj.id ||
      obj.name ||
      (typeof obj.customer === "string" ? obj.customer : "") ||
      customerStr ||
      root.customer_id ||
      ""
  );
  const name = pickCustomerDisplayName(
    obj.customer_name,
    obj.customer_title,
    profile?.customer_name,
    profile?.customer_title,
    root.customer_name,
    // Prefer string customer id as display only if it isn't a generic label
    customerStr,
    obj.name,
    id
  );

  return {
    id: id || name,
    name,
    customer_group:
      obj.customer_group ||
      obj.group ||
      profile?.customer_group ||
      root.customer_group,
    territory: obj.territory || profile?.territory || root.territory,
    salesperson:
      obj.salesperson ||
      obj.sales_person ||
      profile?.salesperson ||
      profile?.sales_person ||
      root.salesperson,
    credit_limit: firstNum(obj.credit_limit, profile?.credit_limit, root.credit_limit),
    mobile:
      obj.mobile ||
      obj.mobile_no ||
      obj.phone ||
      profile?.mobile ||
      profile?.mobile_no ||
      root.mobile_no,
    email:
      obj.email ||
      obj.email_id ||
      profile?.email ||
      profile?.email_id ||
      root.email_id,
    address:
      obj.address ||
      obj.primary_address ||
      profile?.address ||
      profile?.primary_address ||
      root.primary_address,
  };
}

function avgOfNumbers(arr: unknown): number | null {
  if (!Array.isArray(arr) || !arr.length) return null;
  const nums = arr
    .map((v) => firstNum(v))
    .filter((n): n is number => n != null);
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/**
 * Parse BA aging into a label→amount map.
 * Accepts object maps or arrays of { label|bucket|age, amount|value|outstanding }.
 */
function parseAgingBuckets(aging: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!aging) return out;

  if (Array.isArray(aging)) {
    for (const row of aging) {
      if (!row || typeof row !== "object") continue;
      const label = str(
        row.label || row.bucket || row.age || row.range || row.name
      )
        .trim()
        .toLowerCase();
      const amt = firstNum(
        row.amount,
        row.value,
        row.outstanding,
        row.balance,
        row.total
      );
      if (label && amt != null) out[label] = amt;
    }
    return out;
  }

  if (typeof aging === "object") {
    for (const [k, v] of Object.entries(aging as Record<string, unknown>)) {
      const amt = firstNum(v);
      if (amt != null) out[String(k).trim().toLowerCase()] = amt;
    }
  }
  return out;
}

function sumAgingByMatch(
  aging: Record<string, number>,
  matchers: RegExp[]
): number | null {
  let sum = 0;
  let hit = false;
  for (const [label, amt] of Object.entries(aging)) {
    if (matchers.some((re) => re.test(label))) {
      sum += amt;
      hit = true;
    }
  }
  return hit ? sum : null;
}

function normalizeReceivablesBlock(
  ar: any,
  root: any,
  _creditLimitFallback: number | null
): Customer360["receivables"] {
  const source = ar && typeof ar === "object" ? ar : {};
  const statement =
    root.statement && typeof root.statement === "object" ? root.statement : {};

  const outstanding = firstNum(
    source.outstanding,
    source.total_outstanding,
    source.customer_outstanding,
    source.outstanding_amount,
    source.total_unpaid,
    source.total,
    source.balance,
    statement.total_outstanding,
    statement.outstanding,
    root.outstanding,
    root.total_outstanding,
    root.customer_outstanding
  );
  const overdue = firstNum(
    source.overdue,
    source.total_overdue,
    source.customer_overdue,
    source.overdue_amount,
    statement.total_overdue,
    statement.overdue,
    root.overdue,
    root.total_overdue,
    root.customer_overdue
  );

  const aging = parseAgingBuckets(
    source.aging_buckets ||
      source.aging ||
      source.ageing ||
      root.aging_buckets ||
      root.aging
  );

  // Not-yet-due / "Current" bucket from aging when present
  let current = firstNum(
    source.current,
    source.not_due,
    source.current_amount,
    statement.current,
    root.current,
    sumAgingByMatch(aging, [
      /^current$/,
      /^not[\s_-]*due$/,
      /^0$/,
      /^0[\s_-]*days?$/,
    ])
  );
  if (current == null && outstanding != null && overdue != null) {
    current = Math.max(0, outstanding - overdue);
  }

  let avg_monthly_sales = firstNum(
    source.avg_monthly_sales,
    source.average_monthly_sales,
    statement.avg_monthly_sales,
    root.avg_monthly_sales,
    root.sales?.avg_monthly_sales
  );

  // Average monthly payments / collections from this customer
  let avg_monthly_paid = firstNum(
    source.avg_monthly_paid,
    source.monthly_paid,
    source.avg_monthly_collection,
    source.monthly_collection,
    source.average_monthly_payment,
    // legacy / misnamed BA fields still accepted
    source.monthly_receivable,
    statement.avg_monthly_paid,
    statement.monthly_collection,
    statement.total_collected,
    root.avg_monthly_paid,
    root.monthly_collection
  );

  if (avg_monthly_sales == null) {
    avg_monthly_sales = avgOfNumbers(root.charts?.sales);
  }
  if (avg_monthly_paid == null) {
    avg_monthly_paid = avgOfNumbers(root.charts?.collection);
  }
  // If BA only sent a yearly collection total, convert later in enrich

  const hasAny =
    outstanding != null ||
    overdue != null ||
    current != null ||
    avg_monthly_sales != null ||
    avg_monthly_paid != null;

  if (!hasAny && !(root.receivables || root.ar || root.statement)) return null;

  return {
    outstanding,
    overdue,
    current,
    avg_monthly_sales,
    avg_monthly_paid,
    oldest_invoice:
      source.oldest_invoice ||
      source.oldest_invoice_date ||
      statement.oldest_invoice ||
      root.oldest_invoice ||
      null,
  };
}

function normalizeOrdersFromRoot(root: any): Customer360["orders"] {
  const orders = root.orders || root.sales_orders || {};
  const openList = Array.isArray(root.open_sales_orders)
    ? root.open_sales_orders
    : Array.isArray(orders.rows)
      ? orders.rows
      : null;

  if (root.orders || root.sales_orders) {
    return {
      open_so_count: firstNum(
        orders.open_so_count,
        orders.open_count,
        openList?.length
      ),
      open_so_value: firstNum(
        orders.open_so_value,
        orders.open_value,
        orders.total
      ),
      pending_delivery: firstNum(
        orders.pending_delivery,
        orders.pending_delivery_value
      ),
      pending_billing: firstNum(
        orders.pending_billing,
        orders.pending_billing_value
      ),
      backorder: firstNum(orders.backorder),
    };
  }

  if (openList) {
    const value = openList.reduce((acc: number, row: any) => {
      const n = firstNum(
        row.grand_total,
        row.base_grand_total,
        row.amount,
        row.value,
        row.outstanding_amount
      );
      return acc + (n || 0);
    }, 0);
    return {
      open_so_count: openList.length,
      open_so_value: value || null,
      pending_delivery: null,
      pending_billing: null,
      backorder: null,
    };
  }

  return null;
}

function normalizeActivityFromRoot(root: any): Customer360["activity"] {
  const activity = root.activity || {};
  const invoices = Array.isArray(root.recent_invoices)
    ? root.recent_invoices
    : [];
  const orders = Array.isArray(root.open_sales_orders)
    ? root.open_sales_orders
    : Array.isArray(root.sales_orders)
      ? root.sales_orders
      : [];

  const lastInv =
    activity.last_invoice ||
    invoices[0]?.posting_date ||
    invoices[0]?.date ||
    null;
  const lastSo =
    activity.last_sales_order ||
    orders[0]?.transaction_date ||
    orders[0]?.delivery_date ||
    orders[0]?.posting_date ||
    orders[0]?.date ||
    null;

  if (!root.activity && !invoices.length && !orders.length) return null;

  return {
    last_quotation: activity.last_quotation || null,
    last_sales_order: lastSo,
    last_delivery: activity.last_delivery || null,
    last_invoice: lastInv,
    last_payment: activity.last_payment || null,
  };
}

function normalizeSalesFromRoot(root: any): Customer360["sales"] {
  const sales = root.sales || root.profile?.sales || {};
  const statement =
    root.statement && typeof root.statement === "object" ? root.statement : {};
  const receivables =
    root.receivables && typeof root.receivables === "object"
      ? root.receivables
      : {};
  const invoices = Array.isArray(root.recent_invoices)
    ? root.recent_invoices
    : [];

  const hasSales = Boolean(root.sales || root.profile?.sales);
  const hasFallback =
    statement.total_invoiced != null ||
    statement.sales_ytd != null ||
    receivables.sales_ytd != null ||
    receivables.ytd != null ||
    receivables.avg_monthly_sales != null ||
    invoices.length > 0;

  if (!hasSales && !hasFallback) return null;

  // Sum recent invoice amounts as a weak YTD hint when only a list is present
  let invoiceSum: number | null = null;
  if (invoices.length) {
    invoiceSum = invoices.reduce((acc: number, row: any) => {
      const n = Number(
        row.grand_total ?? row.base_grand_total ?? row.amount ?? 0
      );
      return acc + (Number.isFinite(n) ? n : 0);
    }, 0);
  }

  return {
    today: firstNum(
      sales.today,
      sales.sales_today,
      statement.sales_today,
      receivables.sales_today
    ),
    mtd: firstNum(
      sales.mtd,
      sales.sales_mtd,
      statement.sales_mtd,
      receivables.sales_mtd,
      receivables.mtd
    ),
    ytd: firstNum(
      sales.ytd,
      sales.sales_ytd,
      statement.sales_ytd,
      statement.total_invoiced,
      receivables.sales_ytd,
      receivables.ytd,
      invoiceSum
    ),
    ytd_ly: firstNum(sales.ytd_ly, sales.previous_year_ytd),
    growth_pct: firstNum(sales.growth_pct, sales.change_pct),
    gp: firstNum(sales.gp, sales.gross_profit),
    gp_pct: firstNum(sales.gp_pct, sales.gross_profit_percent),
    avg_invoice: firstNum(
      sales.avg_invoice,
      sales.average_invoice,
      sales.avg_invoice_value
    ),
    last_invoice_date:
      sales.last_invoice_date ||
      invoices[0]?.posting_date ||
      invoices[0]?.date ||
      null,
  };
}

export function normalizeCustomerSearch(raw: any): CustomerSearchHit[] {
  const root = rootOf(raw);
  const list =
    root.customers || root.results || root.rows || root.data || root || [];
  if (!Array.isArray(list)) return [];
  return list.map((r: any) => {
    const id = str(r.id || r.customer || r.name || r.value);
    const name = pickCustomerDisplayName(
      r.customer_name,
      r.customer_title,
      r.customer,
      // Frappe search_link often puts the doctype label in `description`
      isGenericCustomerLabel(str(r.description))
        ? null
        : str(r.description).split(",")[0],
      r.name,
      r.value,
      id
    );
    return {
      id: id || name,
      name,
      customer_group: r.customer_group || r.group,
      territory: r.territory,
      salesperson: r.salesperson || r.sales_person,
    };
  });
}

export function normalizeCustomer360(raw: any): Customer360 {
  const root = rootOf(raw);
  const identity = resolveCustomerIdentity(root);
  const ar = root.receivables || root.ar || {};
  const charts = root.charts || {};
  const meta = root.meta || {};

  const hasArSection = Boolean(
    root.receivables ||
      root.ar ||
      root.statement ||
      root.outstanding != null ||
      root.total_outstanding != null ||
      root.overdue != null ||
      root.customer_overdue != null
  );
  const hasChartsSection = Boolean(root.charts);

  return {
    meta: {
      currency: str(
        meta.currency || root.currency || root.profile?.default_currency,
        "SAR"
      ),
      company: str(meta.company || root.company || root.profile?.company, ""),
      from_date: meta.from_date || root.from_date,
      to_date: meta.to_date || root.to_date,
    },
    customer: {
      id: identity.id,
      name: identity.name,
      customer_group: identity.customer_group,
      territory: identity.territory,
      salesperson: identity.salesperson,
      credit_limit: identity.credit_limit,
      mobile: identity.mobile,
      email: identity.email,
      address: identity.address,
    },
    sales: normalizeSalesFromRoot(root),
    receivables: hasArSection
      ? normalizeReceivablesBlock(ar, root, identity.credit_limit ?? null)
      : null,
    orders: normalizeOrdersFromRoot(root),
    activity: normalizeActivityFromRoot(root),
    charts: hasChartsSection
      ? {
          months: Array.isArray(charts.months) ? charts.months : charts.labels,
          sales: Array.isArray(charts.sales) ? charts.sales : undefined,
          sales_ly: Array.isArray(charts.sales_ly)
            ? charts.sales_ly
            : Array.isArray(charts.sales_previous_year)
              ? charts.sales_previous_year
              : undefined,
          sales_growth_pct: Array.isArray(charts.sales_growth_pct)
            ? charts.sales_growth_pct
            : Array.isArray(charts.growth_pct)
              ? charts.growth_pct
              : undefined,
          collection: Array.isArray(charts.collection)
            ? charts.collection
            : undefined,
          receivables: Array.isArray(charts.receivables)
            ? charts.receivables
            : undefined,
        }
      : null,
  };
}

export function getDemoCustomerSearch(q: string): CustomerSearchHit[] {
  const all = [
    {
      id: "CUST-ALNOOR",
      name: "Al Noor Trading",
      customer_group: "Commercial",
      territory: "Dammam",
      salesperson: "Ahmed Al-Rashid",
    },
    {
      id: "CUST-FADECO",
      name: "Fadeco-Arabian Food & Dairy Factories Co.",
      customer_group: "Industrial",
      territory: "Dammam",
      salesperson: "Sara Khan",
    },
    {
      id: "CUST-RIYADH",
      name: "Riyadh Supplies LLC",
      customer_group: "Retail",
      territory: "Riyadh",
      salesperson: "Omar Hassan",
    },
  ];
  const needle = (q || "").trim().toLowerCase();
  if (!needle) return all;
  return all.filter(
    (c) =>
      c.name.toLowerCase().includes(needle) ||
      c.id.toLowerCase().includes(needle)
  );
}

export function getDemoCustomer360(customerId: string): Customer360 {
  const hit =
    getDemoCustomerSearch("").find((c) => c.id === customerId) ||
    getDemoCustomerSearch("")[0];
  return {
    meta: {
      currency: "SAR",
      company: "Demo Company",
      from_date: `${new Date().getFullYear()}-01-01`,
      to_date: new Date().toISOString().slice(0, 10),
    },
    customer: {
      id: hit.id,
      name: hit.name,
      customer_group: hit.customer_group,
      territory: hit.territory,
      salesperson: hit.salesperson,
      credit_limit: 500000,
      mobile: "+966500000000",
      email: "accounts@example.com",
      address: "Dammam, Saudi Arabia",
    },
    sales: {
      today: 18500,
      mtd: 245000,
      ytd: 1980000,
      ytd_ly: 1720000,
      growth_pct: 15.1,
      gp: 594000,
      gp_pct: 30.0,
      avg_invoice: 12400,
      last_invoice_date: "2026-08-02",
    },
    receivables: {
      outstanding: 23667.8,
      overdue: 6739.8,
      current: 16928,
      avg_monthly_sales: 165000,
      avg_monthly_paid: 148000,
      oldest_invoice: "2025-11-18",
    },
    orders: {
      open_so_count: 3,
      open_so_value: 128000,
      pending_delivery: 85000,
      pending_billing: 43000,
      backorder: 12000,
    },
    activity: {
      last_quotation: "2026-07-20",
      last_sales_order: "2026-07-28",
      last_delivery: "2026-08-01",
      last_invoice: "2026-08-02",
      last_payment: "2026-07-15",
    },
    charts: {
      months: [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
      ],
      sales: [0, 0, 140000, 155000, 162000, 178000, 190000, 245000],
      sales_ly: [0, 0, 120000, 135000, 150000, 160000, 170000, 200000],
      sales_growth_pct: [null, null, 16.7, 14.8, 8.0, 11.3, 11.8, 22.5],
      collection: [0, 0, 120000, 148000, 150000, 160000, 175000, 210000],
      receivables: [0, 0, 28000, 30000, 29000, 27000, 25000, 23668],
    },
  };
}
