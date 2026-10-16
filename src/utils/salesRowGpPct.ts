import type { AnalysisRow } from "../api/genericAnalysisTypes";

const GP_PCT_KEYS = [
  "gp_pct",
  "margin_pct",
  "margin_percentage",
  "gross_profit_percent",
  "gp_margin",
  "gp_margin_pct",
] as const;

function numOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Hide bogus ~100% margins when COGS is missing on the server. */
function sanitizeGpPct(pct: number | null): number | null {
  if (pct == null) return null;
  if (pct >= 95 || pct <= -95) return null;
  return pct;
}

/**
 * Gross margin % for Sales By ranking rows (board table, chart, or drill).
 * Binds `gp_pct` column/cells from get_dashboard_board_data widgets.
 */
export function readSalesRowGpPct(row: AnalysisRow): number | null {
  const meta = row.meta as Record<string, unknown> | undefined;
  if (meta) {
    for (const k of GP_PCT_KEYS) {
      const hit = sanitizeGpPct(numOrNull(meta[k]));
      if (hit != null) return hit;
    }
    const cells = meta.cells as Record<string, unknown> | undefined;
    if (cells && typeof cells === "object") {
      for (const k of GP_PCT_KEYS) {
        const hit = sanitizeGpPct(numOrNull(cells[k]));
        if (hit != null) return hit;
      }
    }
  }

  const sales = Number(row.value) || 0;
  if (sales > 0 && row.secondary != null) {
    const gp = Number(row.secondary);
    if (Number.isFinite(gp)) {
      return sanitizeGpPct((gp / sales) * 100);
    }
  }

  return null;
}

export function formatSalesRowGpPct(pct: number | null | undefined): string | null {
  if (pct == null || !Number.isFinite(pct)) return null;
  return `${pct.toFixed(1)}% GP`;
}
