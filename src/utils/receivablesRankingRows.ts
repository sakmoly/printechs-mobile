import type { AnalysisRow } from "../api/genericAnalysisTypes";
import { isCustomerAdvancesWidgetKey } from "./receivablesNavigation";

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

/** Hide noise balances in Top Overdue / View All lists. */
export const MIN_OVERDUE_LIST_AMOUNT_SAR = 500;

export function filterOverdueRankingRows(rows: AnalysisRow[]): AnalysisRow[] {
  return rows.filter(
    (row) => rowOutstanding(row) >= MIN_OVERDUE_LIST_AMOUNT_SAR
  );
}

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
