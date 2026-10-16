import { normalizeWidgetKey } from "./kpiFormat";
import { ALL_TERRITORIES } from "./dashboardTerritory";

function isMoneyKpi(widgetKey: string, label?: string): boolean {
  const hay = `${normalizeWidgetKey(widgetKey)} ${String(label || "").toLowerCase()}`;
  if (/margin|pct|percent|ratio|turnover|days|dso/.test(hay)) return false;
  if (/customer|order|invoice|count|qty|quantity|active|returns_kpi/.test(hay)) {
    return false;
  }
  return /sales|cogs|cost_of_goods|gross_profit|gp_|receivable|payable|inventory|purchase|profit|revenue/.test(
    hay
  );
}

function isDerivedKpi(meta: Record<string, unknown> | undefined): boolean {
  if (!meta) return false;
  return Boolean(
    meta.cogs_derived ||
      meta.gp_derived ||
      meta.derived_from ||
      meta.territory_scope_mismatch
  );
}

export function territoryFilterActive(
  selectedTerritory: string | undefined | null
): boolean {
  const t = String(selectedTerritory || "").trim();
  return Boolean(t && t !== ALL_TERRITORIES);
}

/**
 * Hide vs LY when TY/LY are different scopes (territory TY + company LY) or derived KPIs without LY.
 */
export function sanitizeKpiLyDisplay(opts: {
  showLy: boolean;
  territoryFiltered: boolean;
  widgetKey: string;
  label?: string;
  value: number | null;
  previous: number | null;
  changePct: number | null;
  meta?: Record<string, unknown>;
}): { previous: number | null; changePct: number | null } {
  if (!opts.showLy) {
    return { previous: null, changePct: null };
  }

  if (isDerivedKpi(opts.meta)) {
    return { previous: null, changePct: null };
  }

  let previous = opts.previous;
  let changePct = opts.changePct;
  const value = opts.value;

  if (previous == null && changePct == null) {
    return { previous: null, changePct: null };
  }

  if (
    value != null &&
    value > 0 &&
    previous != null &&
    previous === 0 &&
    isMoneyKpi(opts.widgetKey, opts.label)
  ) {
    return { previous: null, changePct: null };
  }

  if (opts.territoryFiltered && value != null && value > 0 && previous != null) {
    if (isMoneyKpi(opts.widgetKey, opts.label) && previous > value * 1.25) {
      return { previous: null, changePct: null };
    }
  }

  if (previous == null && changePct != null && opts.territoryFiltered) {
    return { previous: null, changePct: null };
  }

  return { previous, changePct };
}
