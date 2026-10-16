import type { AnalysisRow } from "../../api/genericAnalysisTypes";
import { RECEIVABLES } from "../../screens/receivables/receivablesTheme";

/** Red amount only when overdue more than this many days. */
export const OVERDUE_RED_DAYS = 90;

function pickNum(...values: unknown[]): number | null {
  for (const v of values) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export function rowDaysField(row: AnalysisRow): number | null {
  const fromMeta = row.meta?.days;
  if (fromMeta != null && Number.isFinite(Number(fromMeta))) return Number(fromMeta);
  const cells = row.meta?.cells as Record<string, unknown> | undefined;
  if (cells?.days != null && Number.isFinite(Number(cells.days))) {
    return Number(cells.days);
  }
  return null;
}

/** Days past due (positive), or null if unknown / not overdue. */
export function resolveOverdueDays(row: AnalysisRow): number | null {
  const cells = row.meta?.cells as Record<string, unknown> | undefined;
  const daysOverdue = pickNum(
    cells?.days_overdue,
    cells?.overdue_days,
    row.meta?.days_overdue
  );
  if (daysOverdue != null) return daysOverdue > 0 ? daysOverdue : null;

  const daysUntilDue = pickNum(
    cells?.days_until_due,
    cells?.due_in_days,
    cells?.days_to_due
  );
  let days = rowDaysField(row);
  if (daysUntilDue == null && days != null && days < 0) return null;

  if (days != null && days > 0 && daysUntilDue == null) return days;
  return null;
}

function resolveDaysUntilDue(row: AnalysisRow): number | null {
  const cells = row.meta?.cells as Record<string, unknown> | undefined;
  let daysUntilDue = pickNum(
    cells?.days_until_due,
    cells?.due_in_days,
    cells?.days_to_due
  );
  const days = rowDaysField(row);
  if (daysUntilDue == null && days != null && days < 0) {
    daysUntilDue = Math.abs(days);
  }
  return daysUntilDue != null && daysUntilDue > 0 ? daysUntilDue : null;
}

function bucketMinOverdueDays(bucket: string): number | null {
  const b = bucket.toLowerCase();
  if (/91|90\+|>90|over.?90/.test(b)) return 91;
  if (/61.?90|61.?120/.test(b)) return 61;
  if (/31.?60|31.?90/.test(b)) return 31;
  if (/1.?30|0.?30/.test(b) && /overdue|past/.test(b)) return 1;
  return null;
}

/** Amount text color: green not due, amber 30–40d / overdue ≤90d, red only >90d overdue. */
export function dueAmountColor(row: AnalysisRow): string {
  const cells = row.meta?.cells as Record<string, unknown> | undefined;
  const bucket = String(
    cells?.aging_bucket ?? cells?.bucket ?? row.meta?.aging_bucket ?? ""
  ).toLowerCase();
  const status = String(cells?.status ?? row.meta?.status ?? "").toLowerCase();

  const untilDue = resolveDaysUntilDue(row);
  const overdue = resolveOverdueDays(row);

  if (/not.?due|current|not_yet/.test(status)) return RECEIVABLES.green;
  if (/^0[-_ ]?30|current/.test(bucket) && overdue == null) {
    return RECEIVABLES.green;
  }

  if (untilDue != null) {
    if (untilDue >= 30 && untilDue <= 40) return RECEIVABLES.amber;
    if (untilDue > 40) return RECEIVABLES.green;
    if (untilDue > 0) return RECEIVABLES.amber;
  }

  if (overdue != null) {
    if (overdue > OVERDUE_RED_DAYS) return RECEIVABLES.red;
    if (overdue >= 30 && overdue <= 40) return RECEIVABLES.amber;
    if (overdue > 0) return RECEIVABLES.amber;
  }

  const bucketMin = bucketMinOverdueDays(bucket);
  if (bucketMin != null) {
    if (bucketMin > OVERDUE_RED_DAYS) return RECEIVABLES.red;
    if (bucketMin >= 30) return RECEIVABLES.amber;
    if (bucketMin > 0) return RECEIVABLES.amber;
  }

  if (/current|not|0.?30/.test(bucket) && !/overdue|past|31|61|91/.test(bucket)) {
    return RECEIVABLES.green;
  }
  if (/31.?60|30.?40|due/.test(bucket)) return RECEIVABLES.amber;

  return RECEIVABLES.value;
}
