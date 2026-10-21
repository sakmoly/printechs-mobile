import type { ReceivablesWidgetEntry } from "../screens/receivables/buildReceivablesSections";
import type { AccessPermissionScope } from "../api/permissions";
import { isKnownTerritoryName } from "./dashboardTerritory";
import { pickWidgetKpiMetrics } from "./kpiFormat";

export type TerritoryReceivablePoint = {
  territory: string;
  value: number;
  widgetKey: string;
};

const TERRITORY_ORDER = ["Riyadh", "Jeddah", "Dammam"];
const KNOWN_SITE_TERRITORIES = /^(riyadh|jeddah|dammam)$/i;

/** KPI widgets that must never become territory bar rows (Overdue, DSO, etc.). */
function isStandardReceivablesKpi(entry: ReceivablesWidgetEntry): boolean {
  const key = String(entry.key || "")
    .replace(/__\d+$/i, "")
    .toLowerCase();
  if (
    /receivables_(total|overdue|current|dso|customer|advances|overdue_pct)/.test(
      key
    )
  ) {
    return true;
  }
  if (/total_receivable|overdue_pct|customer_advances/.test(key)) {
    return true;
  }
  const label = String(entry.label || "").trim();
  if (
    /overdue|dso|current|customer|advance|total|%|days|receivable|owing|collection/i.test(
      label
    )
  ) {
    return true;
  }
  return false;
}

export function isValidReceivablesTerritoryDrillName(
  name: string,
  scope?: AccessPermissionScope | null
): boolean {
  const label = String(name || "").trim();
  if (!label) return false;
  if (
    /overdue|dso|current|customer|advance|total|%|days|receivable|owing|collection/i.test(
      label
    )
  ) {
    return false;
  }
  if (KNOWN_SITE_TERRITORIES.test(label)) return true;
  return isKnownTerritoryName(label, scope);
}

export function isReceivablesTerritoryBarEntry(
  entry: ReceivablesWidgetEntry,
  scope?: AccessPermissionScope | null
): boolean {
  if (entry.widgetType !== "KPI") return false;
  if (isStandardReceivablesKpi(entry)) return false;
  const label = String(entry.label || "").trim();
  if (!label) return false;
  if (KNOWN_SITE_TERRITORIES.test(label)) return true;
  return isKnownTerritoryName(label, scope);
}

function kpiValueFromEntry(entry: ReceivablesWidgetEntry): number {
  const root = entry.payload as unknown as Record<string, unknown>;
  const kpi = entry.payload.kpis?.[0] as Record<string, unknown> | undefined;
  const picked = pickWidgetKpiMetrics(
    { ...root, label: entry.label, config: entry.payload.config },
    kpi || null,
    entry.key,
    entry.label
  );
  if (picked?.value != null && Number.isFinite(picked.value)) {
    return Math.max(0, picked.value);
  }
  const summary = entry.payload.chart?.summary?.value;
  if (summary != null && Number.isFinite(Number(summary))) {
    return Math.max(0, Number(summary));
  }
  return 0;
}

function territorySortRank(name: string): number {
  const i = TERRITORY_ORDER.findIndex(
    (t) => t.toLowerCase() === name.trim().toLowerCase()
  );
  return i >= 0 ? i : 100 + name.localeCompare("");
}

export function sortTerritoryReceivablePoints(
  points: TerritoryReceivablePoint[]
): TerritoryReceivablePoint[] {
  return [...points].sort((a, b) => {
    const ra = territorySortRank(a.territory);
    const rb = territorySortRank(b.territory);
    if (ra !== rb) return ra - rb;
    return b.value - a.value;
  });
}

/** Split overview KPIs into territory receivable bars vs normal KPI cards. */
export function partitionReceivablesTerritoryKpis(
  items: ReceivablesWidgetEntry[],
  scope?: AccessPermissionScope | null
): {
  territoryPoints: TerritoryReceivablePoint[];
  otherKpis: ReceivablesWidgetEntry[];
} {
  const territoryPoints: TerritoryReceivablePoint[] = [];
  const otherKpis: ReceivablesWidgetEntry[] = [];

  for (const entry of items) {
    if (isReceivablesTerritoryBarEntry(entry, scope)) {
      territoryPoints.push({
        territory: entry.label.trim(),
        value: kpiValueFromEntry(entry),
        widgetKey: entry.key,
      });
    } else {
      otherKpis.push(entry);
    }
  }

  return {
    territoryPoints: sortTerritoryReceivablePoints(territoryPoints),
    otherKpis,
  };
}
