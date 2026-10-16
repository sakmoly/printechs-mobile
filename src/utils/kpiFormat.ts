/**
 * KPI display format + widget-key guards (sales board dedupe / LY enrichment).
 */

export function normalizeWidgetKey(key: string | undefined | null): string {
  return String(key || "")
    .trim()
    .toLowerCase()
    .replace(/__\d+$/i, "");
}

function semanticHaystack(
  widgetKey: string | undefined | null,
  label?: string
): string {
  return `${normalizeWidgetKey(widgetKey)} ${String(label || "").toLowerCase()}`;
}

/** Count / quantity KPIs — never currency (orders, customers, invoices, stock qty). */
export function isCountKpiWidget(
  widgetKey: string | undefined | null,
  label?: string
): boolean {
  const hay = semanticHaystack(widgetKey, label);
  if (/days_of|inventory_doi|turnover|doi_kpi|days_kpi/.test(hay)) return false;
  if (isStockQuantityKpiWidget(widgetKey, label)) return true;
  return /customer|order|invoice|count|qty|quantity|units|active|dso|sku/.test(hay);
}

function isTurnoverKpiWidget(
  widgetKey: string | undefined | null,
  label?: string
): boolean {
  return /turnover/.test(semanticHaystack(widgetKey, label));
}

function isDaysMetricKpiWidget(
  widgetKey: string | undefined | null,
  label?: string
): boolean {
  return /days_of|days_in_inventory|inventory_doi|doi_kpi|days_kpi|days of inventory/.test(
    semanticHaystack(widgetKey, label)
  );
}

function isFinancialRatioKpiWidget(
  widgetKey: string | undefined | null,
  label?: string
): boolean {
  return /current_ratio|quick_ratio|debt_to_equity|debt_equity|interest_coverage/.test(
    semanticHaystack(widgetKey, label)
  );
}

function isLargeMoneyKpiWidget(
  widgetKey: string | undefined | null,
  label?: string
): boolean {
  const hay = semanticHaystack(widgetKey, label);
  if (isFinancialRatioKpiWidget(widgetKey, label)) return false;
  if (isCountKpiWidget(widgetKey, label)) return false;
  return /cash_flow|operating_cash|net_profit|gross_profit|total_sales|receivable|revenue|cogs|cost_of_goods|inventory_value|stock_value|gp_|ebitda/.test(
    hay
  );
}

/**
 * Some BA KPI payloads send `currency_compact` with values already in millions (e.g. 8.3 = SAR 8.3M).
 * Full amounts (>= 1M) are left unchanged per MOBILE_DASHBOARDS_API.md.
 */
export function normalizeKpiCurrencyValue(
  widgetKey: string | undefined | null,
  label: string | undefined,
  value: number | null | undefined,
  formatHint?: string
): number | null {
  if (value == null || !Number.isFinite(Number(value))) return null;
  const n = Number(value);
  const fmt = String(formatHint || "").toLowerCase();
  const compactHint =
    fmt === "currency_compact" ||
    fmt === "compact_currency" ||
    fmt.includes("compact");
  if (!compactHint || !isLargeMoneyKpiWidget(widgetKey, label)) return n;
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return n;
  if (abs > 0 && abs < 10_000) return n * 1_000_000;
  return n;
}

function pickNumeric(...candidates: unknown[]): number | null {
  for (const raw of candidates) {
    if (raw == null || raw === "") continue;
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function isStockQuantityKpiWidget(
  widgetKey: string | undefined | null,
  label?: string
): boolean {
  return /stock_qty|quantity_kpi|sku_qty|stock_quantity|total_stock_quantity/.test(
    semanticHaystack(widgetKey, label)
  );
}

function isOrderCountKpiWidget(
  widgetKey: string | undefined | null,
  label?: string
): boolean {
  if (isStockQuantityKpiWidget(widgetKey, label)) return false;
  return /customer|order|invoice|active_|count_kpi|returns_kpi/.test(
    semanticHaystack(widgetKey, label)
  );
}

/** Reject sales amounts wrongly assigned to count KPIs (e.g. 16.15M on Orders). */
export function sanitizeKpiDisplayValue(
  widgetKey: string | undefined | null,
  label: string | undefined,
  value: number | null | undefined,
  format?: string
): number | null {
  if (value == null || !Number.isFinite(Number(value))) return null;
  const n = Number(value);
  if (isStockQuantityKpiWidget(widgetKey, label)) {
    // Reject obvious sales-currency leaks on qty widgets (> 100M SAR-scale)
    if (n > 100_000_000) return null;
    return n;
  }
  if (isOrderCountKpiWidget(widgetKey, label)) {
    if (n > 500_000) return null;
    return n;
  }
  if (isCountKpiWidget(widgetKey, label)) {
    if (n > 500_000) return null;
    return n;
  }
  if (isTurnoverKpiWidget(widgetKey, label)) {
    if (n > 100 || n < 0) return null;
    return n;
  }
  if (isDaysMetricKpiWidget(widgetKey, label)) {
    if (n > 2_000 || n < 0) return null;
    return n;
  }
  const fmt = String(format || "").toLowerCase();
  if (
    (fmt === "percent" || fmt === "pct" || /margin|percent/.test(semanticHaystack(widgetKey, label))) &&
    n > 1000
  ) {
    return null;
  }
  return n;
}

/** Total net sales KPIs — may borrow chart summary / legacy executive LY. */
export function isSalesTotalWidget(widgetKey: string | undefined | null): boolean {
  const k = normalizeWidgetKey(widgetKey);
  if (!k) return false;
  if (
    /customer|return|order|margin|gp_margin|invoice_count|active_|count_kpi|returns_kpi|cogs|cost_of_goods/.test(
      k
    )
  ) {
    return false;
  }
  return (
    k === "sales_total_kpi" ||
    k === "sales_dash_net_ytd_kpi" ||
    k === "net_sales_kpi" ||
    k === "sales_net_kpi" ||
    k === "sales_card" ||
    k === "home_total_sales_kpi" ||
    /^(sales_)?(total_sales|net_sales|sales_ytd|sales_mtd)(_|$)/.test(k)
  );
}

/** Strict subset — only these may call legacy getDashboardData LY fallback. */
export function isSalesTotalLyWidget(widgetKey: string | undefined | null): boolean {
  return isSalesTotalWidget(widgetKey);
}

export function inferKpiFormat(
  widgetKey: string | undefined | null,
  opts?: {
    label?: string;
    configFormat?: string;
    kpiFormat?: string;
  }
): string {
  const k = normalizeWidgetKey(widgetKey);
  const label = String(opts?.label || "").toLowerCase();
  const hay = `${k} ${label}`;

  // Widget semantics beat wrong BA format (e.g. orders sent as currency_compact)
  if (/turnover/.test(hay)) return "ratio";
  if (isFinancialRatioKpiWidget(widgetKey, opts?.label)) return "ratio";
  if (/days_of|days_in_inventory|inventory_doi|doi_kpi|days_kpi/.test(hay)) {
    return "days";
  }
  if (/margin|pct|percent/.test(hay)) return "percent";
  if (/ratio/.test(hay) && !/cash_flow|operating_cash/.test(hay)) return "ratio";
  if (/customer|order|invoice|count|qty|quantity|units|active|stock_qty|sku/.test(hay)) {
    return "integer";
  }
  if (/dso/.test(hay)) return "integer";

  const fromPayload = String(opts?.kpiFormat || opts?.configFormat || "")
    .trim()
    .toLowerCase();
  if (
    fromPayload &&
    fromPayload !== "currency" &&
    fromPayload !== "currency_compact"
  ) {
    return fromPayload;
  }
  if (fromPayload === "currency_compact") return "currency";
  if (fromPayload) return fromPayload;

  return "currency";
}

/** Pick flat KPI fields from BA root without cross-contaminating count KPIs. */
export function readFlatKpiFields(
  root: Record<string, unknown>,
  widgetKey: string | undefined | null
): { value: number; previous: number | null; changePct: number | null } | null {
  const k = normalizeWidgetKey(widgetKey);
  const label = String(root.label || root.title || "");
  const changePct =
    root.change_pct != null
      ? Number(root.change_pct)
      : root.change_percentage != null
        ? Number(root.change_percentage)
        : null;
  let previous =
    root.value_ly != null
      ? Number(root.value_ly)
      : root.previous != null
        ? Number(root.previous)
        : root.previous_year_value != null
          ? Number(root.previous_year_value)
          : null;

  if (isCountKpiWidget(k, label)) {
    const countRaw =
      root.count ??
      root.order_count ??
      root.invoice_count ??
      root.customer_count ??
      root.current_value;
    if (countRaw != null) {
      const value = Number(countRaw);
      if (Number.isFinite(value) && value <= 500_000) {
        if (previous == null) previous = inferPreviousFromChangeLocal(value, changePct);
        return { value, previous, changePct };
      }
    }
    const maybe = root.value != null ? Number(root.value) : null;
    if (maybe != null && Number.isFinite(maybe) && maybe <= 500_000) {
      if (previous == null) previous = inferPreviousFromChangeLocal(maybe, changePct);
      return { value: maybe, previous, changePct };
    }
    return null;
  }

  if (/cogs|cost_of_goods/.test(k)) {
    const value = pickNumeric(
      root.cogs,
      root.cost_of_goods_sold,
      root.cost_of_goods,
      root.total_cogs,
      root.value
    );
    if (value == null) return null;
    if (previous == null) {
      previous = pickNumeric(
        root.cogs_ly,
        root.cost_of_goods_sold_ly,
        root.value_ly,
        root.previous
      );
    }
    if (previous == null) previous = inferPreviousFromChangeLocal(value, changePct);
    return { value, previous, changePct };
  }

  if (/operating_cash|cash_flow/.test(k)) {
    const value = pickNumeric(
      root.operating_cash_flow,
      root.cash_flow,
      root.operating_cash,
      root.value
    );
    if (value == null) return null;
    if (previous == null) {
      previous = pickNumeric(
        root.operating_cash_flow_ly,
        root.cash_flow_ly,
        root.value_ly,
        root.previous
      );
    }
    if (previous == null) previous = inferPreviousFromChangeLocal(value, changePct);
    return { value, previous, changePct };
  }

  if (/net_profit|profit_kpi/.test(k)) {
    const value = pickNumeric(
      root.net_profit,
      root.profit,
      root.net_income,
      root.value
    );
    if (value == null) return null;
    if (previous == null) {
      previous = pickNumeric(
        root.net_profit_ly,
        root.profit_ly,
        root.value_ly,
        root.previous
      );
    }
    if (previous == null) previous = inferPreviousFromChangeLocal(value, changePct);
    return { value, previous, changePct };
  }

  if (/turnover/.test(k)) {
    const value = pickNumeric(
      root.turnover,
      root.inventory_turnover,
      root.stock_turnover,
      root.ratio,
      root.value
    );
    if (value == null || value > 100 || value < 0) return null;
    if (previous == null) previous = inferPreviousFromChangeLocal(value, changePct);
    return { value, previous, changePct };
  }

  if (/days_of|inventory_doi|days_kpi|doi_kpi/.test(k)) {
    const value = pickNumeric(
      root.days_of_inventory,
      root.days_in_inventory,
      root.days_of_cover,
      root.days_of_inventory_kpi,
      root.doi,
      root.days,
      root.value
    );
    if (value == null || value > 2_000 || value < 0) return null;
    if (previous == null) previous = inferPreviousFromChangeLocal(value, changePct);
    return { value, previous, changePct };
  }

  if (/stock_qty|quantity_kpi|sku_qty/.test(k)) {
    const value = pickNumeric(
      root.stock_qty,
      root.total_stock_qty,
      root.total_stock_quantity,
      root.quantity,
      root.qty,
      root.total_qty,
      root.count,
      root.actual_qty,
      root.value
    );
    if (value == null || value > 100_000_000) return null;
    if (previous == null) previous = inferPreviousFromChangeLocal(value, changePct);
    return { value, previous, changePct };
  }

  if (/available/.test(k) && /value|stock|inventory/.test(k + label)) {
    const value = pickNumeric(
      root.available_value,
      root.available_stock_value,
      root.available
    );
    if (value == null) return null;
    if (previous == null) previous = inferPreviousFromChangeLocal(value, changePct);
    return { value, previous, changePct };
  }

  if (/reserved/.test(k)) {
    const value = pickNumeric(
      root.reserved_value,
      root.reserved_stock_value,
      root.reserved
    );
    if (value == null) return null;
    if (previous == null) previous = inferPreviousFromChangeLocal(value, changePct);
    return { value, previous, changePct };
  }

  if (/inventory.*value|stock_value|total_inventory/.test(k)) {
    const raw =
      root.stock_value ??
      root.inventory_value ??
      root.total_value ??
      root.value;
    if (raw == null) return null;
    const value = Number(raw);
    if (!Number.isFinite(value)) return null;
    if (previous == null) previous = inferPreviousFromChangeLocal(value, changePct);
    return { value, previous, changePct };
  }

  const valueRaw = isSalesTotalWidget(k)
    ? (root.value ?? root.net_sales)
    : (root.value ?? root.count ?? root.current_value ?? root.total);
  if (valueRaw == null) return null;
  const value = Number(valueRaw);
  if (!Number.isFinite(value)) return null;
  if (previous == null) previous = inferPreviousFromChangeLocal(value, changePct);
  return { value, previous, changePct };
}

function inferPreviousFromChangeLocal(
  value: number | null,
  changePct: number | null
): number | null {
  if (value == null || changePct == null || !Number.isFinite(changePct)) return null;
  const denom = 1 + changePct / 100;
  if (!Number.isFinite(denom) || denom === 0) return null;
  return value / denom;
}

/** Read metric-specific fields from a BA kpi object (not only `.value`). */
export function readKpiObjectFields(
  k: Record<string, unknown> | null | undefined,
  widgetKey: string | undefined | null,
  label?: string
): { value: number; previous: number | null; changePct: number | null } | null {
  if (!k || typeof k !== "object") return null;
  const key = normalizeWidgetKey(widgetKey);
  const metricLabel = label || String(k.label || k.title || "");
  const changePct = pickNumeric(k.change_pct, k.change_percentage);
  let previous = pickNumeric(
    k.previous,
    k.value_ly,
    k.previous_year_value,
    k.sales_ly
  );

  if (/turnover/.test(key)) {
    const value = pickNumeric(
      k.turnover,
      k.inventory_turnover,
      k.stock_turnover,
      k.ratio,
      k.value
    );
    if (value == null || value > 100 || value < 0) return null;
    if (previous == null) previous = inferPreviousFromChangeLocal(value, changePct);
    return { value, previous, changePct };
  }

  if (/days_of|inventory_doi|days_kpi|doi_kpi/.test(key)) {
    const value = pickNumeric(
      k.days_of_inventory,
      k.days_in_inventory,
      k.days_of_cover,
      k.doi,
      k.days,
      k.value
    );
    if (value == null || value > 2_000 || value < 0) return null;
    if (previous == null) previous = inferPreviousFromChangeLocal(value, changePct);
    return { value, previous, changePct };
  }

  if (/stock_qty|quantity_kpi|sku_qty/.test(key)) {
    const value = pickNumeric(
      k.stock_qty,
      k.total_stock_qty,
      k.total_stock_quantity,
      k.quantity,
      k.qty,
      k.total_qty,
      k.actual_qty,
      k.count,
      k.value
    );
    if (value == null || value > 100_000_000) return null;
    if (previous == null) previous = inferPreviousFromChangeLocal(value, changePct);
    return { value, previous, changePct };
  }

  if (/available/.test(key)) {
    const value = pickNumeric(
      k.available_value,
      k.available_stock_value,
      k.available
    );
    if (value == null) return null;
    if (previous == null) previous = inferPreviousFromChangeLocal(value, changePct);
    return { value, previous, changePct };
  }

  if (/reserved/.test(key)) {
    const value = pickNumeric(
      k.reserved_value,
      k.reserved_stock_value,
      k.reserved
    );
    if (value == null) return null;
    if (previous == null) previous = inferPreviousFromChangeLocal(value, changePct);
    return { value, previous, changePct };
  }

  if (/inventory.*value|stock_value|total_inventory/.test(key)) {
    const value = pickNumeric(
      k.stock_value,
      k.inventory_value,
      k.total_value,
      k.value
    );
    if (value == null) return null;
    if (previous == null) previous = inferPreviousFromChangeLocal(value, changePct);
    return { value, previous, changePct };
  }

  if (/cogs|cost_of_goods/.test(key)) {
    const value = pickNumeric(
      k.cogs,
      k.cost_of_goods_sold,
      k.cost_of_goods,
      k.total_cogs,
      k.value
    );
    if (value == null) return null;
    if (previous == null) {
      previous = pickNumeric(
        k.cogs_ly,
        k.cost_of_goods_sold_ly,
        k.value_ly,
        k.previous
      );
    }
    if (previous == null) previous = inferPreviousFromChangeLocal(value, changePct);
    return { value, previous, changePct };
  }

  if (/operating_cash|cash_flow/.test(key)) {
    const value = pickNumeric(
      k.operating_cash_flow,
      k.cash_flow,
      k.operating_cash,
      k.value
    );
    if (value == null) return null;
    if (previous == null) {
      previous = pickNumeric(
        k.operating_cash_flow_ly,
        k.cash_flow_ly,
        k.previous,
        k.value_ly
      );
    }
    if (previous == null) previous = inferPreviousFromChangeLocal(value, changePct);
    return { value, previous, changePct };
  }

  if (/net_profit|profit_kpi/.test(key)) {
    const value = pickNumeric(k.net_profit, k.profit, k.net_income, k.value);
    if (value == null) return null;
    if (previous == null) {
      previous = pickNumeric(k.net_profit_ly, k.profit_ly, k.previous, k.value_ly);
    }
    if (previous == null) previous = inferPreviousFromChangeLocal(value, changePct);
    return { value, previous, changePct };
  }

  const value = pickNumeric(k.value, k.current_value, k.total);
  if (value == null) return null;
  if (!sanitizeKpiDisplayValue(widgetKey, metricLabel, value, inferKpiFormat(widgetKey, { label: metricLabel }))) {
    return null;
  }
  if (previous == null) previous = inferPreviousFromChangeLocal(value, changePct);
  return { value, previous, changePct };
}

/** Best KPI numbers from kpi row + flat root — prefers metric-specific fields. */
export function pickWidgetKpiMetrics(
  root: Record<string, unknown>,
  k: Record<string, unknown> | null | undefined,
  widgetKey: string | undefined | null,
  label?: string
): { value: number; previous: number | null; changePct: number | null } | null {
  const metricLabel =
    label || String(k?.label || k?.title || root.label || root.title || "");
  const fromKpi = readKpiObjectFields(k, widgetKey, metricLabel);
  const fromFlat = readFlatKpiFields(root, widgetKey);
  const configFormat = String(
    root.config && typeof root.config === "object"
      ? (root.config as Record<string, unknown>).format
      : ""
  );
  const kpiFormat = String(k?.format || "");
  const fmt = inferKpiFormat(widgetKey, {
    label: metricLabel,
    configFormat,
    kpiFormat,
  });
  const formatHint = kpiFormat || configFormat;

  const candidates = [fromKpi, fromFlat].filter(Boolean) as Array<{
    value: number;
    previous: number | null;
    changePct: number | null;
  }>;

  type Scored = {
    value: number;
    previous: number | null;
    changePct: number | null;
    rank: number;
  };
  let best: Scored | null = null;
  const moneyKpi = isLargeMoneyKpiWidget(widgetKey, metricLabel);

  for (const c of candidates) {
    const scaled = normalizeKpiCurrencyValue(
      widgetKey,
      metricLabel,
      c.value,
      formatHint
    );
    const v = sanitizeKpiDisplayValue(widgetKey, metricLabel, scaled, fmt);
    if (v == null) continue;
    const prevScaled = normalizeKpiCurrencyValue(
      widgetKey,
      metricLabel,
      c.previous,
      formatHint
    );
    const previous = sanitizeKpiDisplayValue(
      widgetKey,
      metricLabel,
      prevScaled,
      fmt
    );
    const rank =
      moneyKpi && v > 0 ? 2 : moneyKpi && v === 0 ? 0 : 1;
    if (
      !best ||
      rank > best.rank ||
      (rank === best.rank && Math.abs(v) > Math.abs(best.value))
    ) {
      best = { value: v, previous, changePct: c.changePct, rank };
    }
  }

  if (!best) return null;
  return {
    value: best.value,
    previous: best.previous,
    changePct: best.changePct,
  };
}

export function toAnalysisKpiFormat(
  format: string | undefined | null
): "currency" | "number" | "percent" {
  const fmt = String(format || "currency").toLowerCase();
  if (fmt === "percent" || fmt === "pct" || fmt === "percentage") return "percent";
  if (fmt === "number" || fmt === "integer") return "number";
  return "currency";
}

export function resolveAnalysisKpiFormat(
  widgetKey: string | undefined | null,
  opts?: {
    label?: string;
    configFormat?: string;
    kpiFormat?: string;
  }
): "currency" | "number" | "percent" {
  return toAnalysisKpiFormat(inferKpiFormat(widgetKey, opts));
}
