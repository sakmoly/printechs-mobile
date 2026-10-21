/**
 * Drop duplicate territory KPI tiles (e.g. two "Jeddah" receivables_card rows).
 */

const KNOWN_TERRITORIES = /^(riyadh|jeddah|dammam|all(?:\s+territories)?)$/i;

export function isTerritoryChipLabel(label: string): boolean {
  const t = String(label || "").trim();
  if (!t || t.length > 32) return false;
  if (KNOWN_TERRITORIES.test(t)) return true;
  // Single-word site names from legacy expandable cards (no KPI phrases)
  if (/\s/.test(t)) return false;
  if (
    /total|receivable|sales|inventory|payable|profit|margin|ratio|kpi|overdue|current|advance|dso|days|customer|owing|due|pct|percent|collection/i.test(
      t
    )
  ) {
    return false;
  }
  return t.length <= 20;
}

function normLabel(label: string): string {
  return String(label || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export type DedupeWidgetEntry = {
  key: string;
  label: string;
  sortOrder: number;
  widgetType: string;
};

/** Keep one overview KPI per display label (e.g. three "COGS" bootstrap keys → one card). */
/** Prefer `sales_donut_*` over `sales_by_*` when both render as summary donuts. */
function summaryDonutKeyPriority(key: string): number {
  const k = String(key || "")
    .replace(/__\d+$/i, "")
    .toLowerCase();
  if (/sales_donut_|_donut$|donut_/.test(k)) return 10;
  if (/^sales_by_/.test(k)) return 1;
  return 5;
}

/** One carousel card per display title (e.g. two "Division" donuts from BA). */
export function dedupeSummaryDonutByLabel<T extends DedupeWidgetEntry>(
  entries: T[]
): T[] {
  const sorted = [...entries].sort(
    (a, b) => summaryDonutKeyPriority(b.key) - summaryDonutKeyPriority(a.key)
  );
  const seen = new Set<string>();
  const out: T[] = [];
  for (const entry of sorted) {
    const label = normLabel(entry.label);
    if (!label || seen.has(label)) continue;
    seen.add(label);
    out.push(entry);
  }
  return out.sort((a, b) => a.sortOrder - b.sortOrder);
}

function overviewKpiDedupePriority(entry: DedupeWidgetEntry): number {
  const k = String(entry.key || "")
    .replace(/__\d+$/i, "")
    .toLowerCase();
  if (/^receivables_customer_advances_kpi$/.test(k)) return 20;
  if (/customer_advances/.test(k)) return 10;
  return 0;
}

export function dedupeOverviewKpiByLabel<T extends DedupeWidgetEntry>(
  entries: T[]
): T[] {
  const bestKpiByLabel = new Map<string, T>();
  for (const entry of entries) {
    if (entry.widgetType !== "KPI") continue;
    const label = normLabel(entry.label);
    if (!label) continue;
    const prev = bestKpiByLabel.get(label);
    if (
      !prev ||
      overviewKpiDedupePriority(entry) > overviewKpiDedupePriority(prev) ||
      (overviewKpiDedupePriority(entry) === overviewKpiDedupePriority(prev) &&
        entry.sortOrder < prev.sortOrder)
    ) {
      bestKpiByLabel.set(label, entry);
    }
  }

  const seen = new Set<string>();
  const out: T[] = [];
  for (const entry of entries) {
    if (entry.widgetType !== "KPI") {
      out.push(entry);
      continue;
    }
    const label = normLabel(entry.label);
    if (!label) {
      out.push(entry);
      continue;
    }
    const best = bestKpiByLabel.get(label);
    if (best && best.key !== entry.key) continue;
    if (seen.has(label)) continue;
    seen.add(label);
    out.push(entry);
  }
  return out;
}

/**
 * Keep the first KPI per territory label; non-territory widgets pass through unchanged.
 */
export function dedupeTerritoryKpiEntries<T extends DedupeWidgetEntry>(
  entries: T[]
): T[] {
  const seenTerritoryLabels = new Set<string>();
  const out: T[] = [];

  for (const entry of entries) {
    if (entry.widgetType !== "KPI") {
      out.push(entry);
      continue;
    }
    const label = normLabel(entry.label);
    if (!isTerritoryChipLabel(entry.label)) {
      out.push(entry);
      continue;
    }
    if (seenTerritoryLabels.has(label)) continue;
    seenTerritoryLabels.add(label);
    out.push(entry);
  }

  return out;
}

/** Hide per-territory breakdown tiles when user picked one territory in the filter bar. */
export function hideTerritoryBreakdownWhenFiltered<T extends DedupeWidgetEntry>(
  entries: T[],
  territoryFilterActive: boolean
): T[] {
  if (!territoryFilterActive) return entries;
  return entries.filter(
    (e) => !(e.widgetType === "KPI" && isTerritoryChipLabel(e.label))
  );
}
/** Hide legacy per-territory receivables_card tiles when a summary KPI exists. */
export function filterLegacyTerritoryCardKpis<T extends DedupeWidgetEntry>(
  entries: T[],
  summaryKeyPattern: RegExp,
  legacyKeyPattern: RegExp
): T[] {
  const hasSummary = entries.some((e) =>
    summaryKeyPattern.test(String(e.key || "").toLowerCase())
  );
  if (!hasSummary) return entries;

  return entries.filter((e) => {
    if (e.widgetType !== "KPI") return true;
    const key = String(e.key || "").toLowerCase();
    if (!legacyKeyPattern.test(key)) return true;
    return !isTerritoryChipLabel(e.label);
  });
}
