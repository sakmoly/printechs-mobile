/**
 * Currency formatting from API meta / company — never hardcode SAR-only.
 */

export function formatCurrency(
  value: number | null | undefined,
  currency = "SAR",
  options?: { compact?: boolean; decimals?: number; hideCode?: boolean }
): string {
  if (value == null || Number.isNaN(Number(value))) return "—";
  const n = Number(value);
  const decimals = options?.decimals ?? 0;
  const code = options?.hideCode ? "" : `${currency} `;

  if (options?.compact) {
    const abs = Math.abs(n);
    if (abs >= 1_000_000) {
      return `${code}${(n / 1_000_000).toFixed(2)}M`.trim();
    }
    if (abs >= 1_000) {
      return `${code}${(n / 1_000).toFixed(1)}K`.trim();
    }
  }

  return `${code}${n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`.trim();
}

export type TableCurrencyDisplay = {
  show_symbol?: boolean;
  currency?: string;
};

/**
 * Table cell / total formatting per BA column.format + table.currency_display.
 *
 * | format            | show_symbol | example        |
 * | currency_compact  | false       | 2.28M          |
 * | number            | —           | 2,275,710      |
 * | currency          | true        | SAR 2,275,710  |
 * | currency          | false       | 2,275,710      |
 */
export function formatTableCellValue(
  value: number | null | undefined,
  format?: string | null,
  options?: {
    currency?: string;
    currency_display?: TableCurrencyDisplay | null;
  }
): string {
  if (value == null || Number.isNaN(Number(value))) return "—";
  const n = Number(value);
  const fmt = String(format || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  const showSymbol = Boolean(options?.currency_display?.show_symbol);
  const currency =
    options?.currency_display?.currency || options?.currency || "SAR";

  if (fmt === "currency_compact" || fmt === "compact_currency") {
    return formatCurrency(n, currency, {
      compact: true,
      hideCode: !showSymbol,
    });
  }
  if (fmt === "number" || fmt === "qty" || fmt === "integer" || fmt === "int") {
    return n.toLocaleString("en-US", {
      maximumFractionDigits: Number.isInteger(n) ? 0 : 2,
    });
  }
  if (
    fmt === "percent" ||
    fmt === "percentage" ||
    fmt === "pct" ||
    fmt === "change_pct"
  ) {
    return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
  }
  if (fmt === "currency" || fmt === "money") {
    return formatCurrency(n, currency, { hideCode: !showSymbol });
  }
  // Unknown / missing format: plain number — never invent "SAR "
  if (!fmt) {
    return n.toLocaleString("en-US", {
      maximumFractionDigits: Number.isInteger(n) ? 0 : 2,
    });
  }
  // Fallback for other named formats that look monetary
  if (/currency|money|amount|sales/.test(fmt)) {
    return formatCurrency(n, currency, {
      compact: /compact/.test(fmt),
      hideCode: !showSymbol,
    });
  }
  return n.toLocaleString("en-US", {
    maximumFractionDigits: Number.isInteger(n) ? 0 : 2,
  });
}

export function formatPercent(
  value: number | null | undefined,
  decimals = 1
): string {
  if (value == null || Number.isNaN(Number(value))) return "—";
  const n = Number(value);
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(decimals)}%`;
}

export function changeDirection(
  changePct: number | null | undefined
): "up" | "down" | "neutral" {
  if (changePct == null || changePct === 0) return "neutral";
  return changePct > 0 ? "up" : "down";
}
