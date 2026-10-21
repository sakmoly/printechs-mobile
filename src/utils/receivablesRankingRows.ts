import type { AnalysisRow } from "../api/genericAnalysisTypes";
import { isCustomerAdvancesWidgetKey } from "./receivablesNavigation";
import { resolveOverdueDays } from "../components/receivables/overdueDueStatus";

/** Table/API rows may put the figure in cells or alternate keys. */
export function rowOutstanding(row: AnalysisRow): number {
  const direct = Number(row.value);
  if (Number.isFinite(direct) && direct !== 0) return direct;

  const cells = row.meta?.cells as Record<string, unknown> | undefined;
  const candidates = [
    cells?.outstanding,
    cells?.outstanding_amount,
    cells?.amount,
    cells?.overdue,
    cells?.balance,
    cells?.value,
    row.meta?.outstanding,
    row.secondary,
  ];
  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n) && n !== 0) return n;
  }
  return Number.isFinite(direct) ? direct : 0;
}

/** Hide small balances in overdue customer lists (Top Overdue, territory drill, etc.). */
export const MIN_OVERDUE_LIST_AMOUNT_SAR = 250;

export function rowAdvanceAmount(row: AnalysisRow): number {
  const direct = Number(row.value);
  if (Number.isFinite(direct) && direct !== 0) return direct;
  const meta = row.meta || {};
  const cells = meta.cells as Record<string, unknown> | undefined;
  const candidates = [
    cells?.unallocated,
    cells?.unallocated_amount,
    cells?.advance,
    cells?.advance_amount,
    meta.unallocated,
    meta.unallocated_amount,
    meta.advance,
  ];
  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n) && n !== 0) return n;
  }
  return Number.isFinite(direct) ? direct : 0;
}

export function filterReceivablesRankingRows(
  widgetKey: string,
  rows: AnalysisRow[]
): AnalysisRow[] {
  if (isCustomerAdvancesWidgetKey(widgetKey)) {
    return rows.filter((r) => rowAdvanceAmount(r) >= 0.01);
  }
  return filterOverdueRankingRows(rows);
}

export function rankingRowDisplayAmount(
  widgetKey: string,
  row: AnalysisRow
): number {
  if (isCustomerAdvancesWidgetKey(widgetKey)) {
    return rowAdvanceAmount(row);
  }
  return rowOutstanding(row);
}

function isCurrentAgingKey(key: string): boolean {
  return /current|not.?due|not.?yet/i.test(String(key || ""));
}

/** Sum non-current aging bucket amounts on a customer row. */
export function sumOverdueFromAgingOnRow(row: AnalysisRow): number {
  const cells = row.meta?.cells as Record<string, unknown> | undefined;
  const aging =
    cells?.aging_buckets ??
    cells?.aging ??
    row.meta?.aging_buckets ??
    row.meta?.aging;
  if (!aging || typeof aging !== "object" || Array.isArray(aging)) return 0;
  let sum = 0;
  for (const [k, v] of Object.entries(aging as Record<string, unknown>)) {
    if (isCurrentAgingKey(k)) continue;
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) sum += n;
  }
  return sum;
}

function rowAgingBucketLabel(row: AnalysisRow): string {
  const cells = row.meta?.cells as Record<string, unknown> | undefined;
  return String(
    cells?.aging_bucket ?? cells?.bucket ?? row.meta?.aging_bucket ?? ""
  ).trim();
}

/** Overdue portion of balance when API splits outstanding vs overdue. */
export function rowOverdueAmount(row: AnalysisRow): number {
  const cells = row.meta?.cells as Record<string, unknown> | undefined;
  const candidates = [
    cells?.overdue,
    cells?.overdue_amount,
    row.meta?.overdue,
    row.meta?.overdue_amount,
  ];
  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n) && n > 0) return n;
  }
  const fromAging = sumOverdueFromAgingOnRow(row);
  if (fromAging > 0) return fromAging;
  if (resolveOverdueDays(row) != null) {
    return rowOutstanding(row);
  }
  const bucket = rowAgingBucketLabel(row).toLowerCase();
  if (bucket && !isCurrentAgingKey(bucket) && /over|past|31|61|91|120|\d/.test(bucket)) {
    return rowOutstanding(row);
  }
  return 0;
}

/** Overdue slice when present; otherwise total outstanding (for list thresholds). */
export function overdueListDisplayAmount(row: AnalysisRow): number {
  const od = rowOverdueAmount(row);
  if (od >= 0.01) return od;
  return rowOutstanding(row);
}

export function meetsMinOverdueListAmount(row: AnalysisRow): boolean {
  return overdueListDisplayAmount(row) >= MIN_OVERDUE_LIST_AMOUNT_SAR;
}

export function filterOverdueRankingRows(rows: AnalysisRow[]): AnalysisRow[] {
  return rows.filter(meetsMinOverdueListAmount);
}

export function isOverdueReceivableRow(row: AnalysisRow): boolean {
  if (rowOverdueAmount(row) >= 0.01 || resolveOverdueDays(row) != null) {
    return true;
  }
  const bucket = rowAgingBucketLabel(row);
  if (bucket && !isCurrentAgingKey(bucket)) return true;
  return false;
}

export function customerMergeKey(row: AnalysisRow): string {
  return String(
    row.meta?.customer_id ??
      row.meta?.customer ??
      row.id ??
      row.label ??
      ""
  )
    .trim()
    .toLowerCase();
}

export function filterTerritoryReceivableCustomerRows(
  rows: AnalysisRow[]
): AnalysisRow[] {
  return rows.filter((row) => rowOutstanding(row) >= 0.01);
}
