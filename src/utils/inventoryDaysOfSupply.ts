import { fetchItemSalesQty } from "../api/itemSalesQty";
import { trailingTwelveMonthsRange } from "./period";

/** Days of supply = on-hand qty ÷ average daily sales (trailing period). */
export function computeDaysOfSupply(
  stockQty: number,
  salesQtyInPeriod: number | null,
  daysInPeriod = 365
): number | null {
  if (!Number.isFinite(stockQty)) return null;
  if (stockQty <= 0) return 0;
  if (salesQtyInPeriod == null || salesQtyInPeriod <= 0) return null;
  const daily = salesQtyInPeriod / daysInPeriod;
  if (daily <= 0) return null;
  return stockQty / daily;
}

export function formatDaysOfSupply(days: number | null): string {
  if (days == null) return "—";
  if (!Number.isFinite(days)) return "—";
  if (days >= 999) return "999+";
  if (days >= 100) return Math.round(days).toLocaleString("en-US");
  if (days >= 10) return Math.round(days).toLocaleString("en-US");
  return days.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

export async function fetchItemSalesQtyTrailingYear(
  itemCode: string,
  options: {
    company?: string;
    territory?: string | null;
    brand?: string;
  } = {}
): Promise<number | null> {
  const code = String(itemCode || "").trim();
  if (!code) return null;

  const range = trailingTwelveMonthsRange();
  const territory = String(options.territory || "").trim();
  const brand = String(options.brand || "").trim();

  const qty = await fetchItemSalesQty({
    company: options.company,
    item_code: code,
    from_date: range.from_date,
    to_date: range.to_date,
    brand: brand || undefined,
    territory: territory || undefined,
  });
  if (qty != null) return qty;

  if (territory) {
    return fetchItemSalesQty({
      company: options.company,
      item_code: code,
      from_date: range.from_date,
      to_date: range.to_date,
      brand: brand || undefined,
    });
  }

  return null;
}
