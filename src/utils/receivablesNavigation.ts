import { Alert } from "react-native";
import { router } from "expo-router";
import type { AnalysisRow } from "../api/genericAnalysisTypes";
import type { DrillFilters } from "../api/dashboardWidgetData";
import { useAuthStore } from "../store/auth";
import { isModuleEnabled } from "../api/mobileConfig";
import { canAccessHubFeature } from "../api/menuAccess";
import {
  isKnownTerritoryName,
  territoryFilters,
} from "./dashboardTerritory";
import type { AccessPermissionScope } from "../api/permissions";
import { getTerritoryFilterOptions } from "../api/accessScope";

export type ReceivablesWidgetListScope = {
  widgetKey: string;
  title?: string;
  company?: string;
  from_date?: string;
  to_date?: string;
  period?: string;
  selectedTerritory?: string;
  /** Filter overdue / customer list to one aging bucket (API + client match). */
  aging_bucket?: string;
  aging_bucket_label?: string;
  /** Dashboard aging card total for this bucket (reconcile hint). */
  bucket_card_total?: string;
};

function rowIdLooksLikeRank(id: string): boolean {
  return /^\d{1,4}$/.test(String(id || "").trim());
}

function rowHasCustomerParty(meta: Record<string, unknown>): boolean {
  const cells = meta.cells as Record<string, unknown> | undefined;
  return Boolean(
    meta.customer ||
      meta.customer_id ||
      meta.party ||
      meta.customer_name ||
      cells?.customer ||
      cells?.customer_id ||
      cells?.party ||
      cells?.customer_name
  );
}

/** Receivables widgets sometimes rank territories — not openable as Customer 360. */
export function rowIsTerritoryAggregate(
  row: AnalysisRow,
  scope?: AccessPermissionScope | null
): boolean {
  const meta = row.meta || {};
  if (rowHasCustomerParty(meta)) return false;
  const dim = String(
    meta.dimension || meta.dimension_key || meta.group_by || meta.entity_type || ""
  ).toLowerCase();
  if (/territory/.test(dim)) return true;
  const label = String(row.label || "").trim();
  if (!label) return false;
  if (isKnownTerritoryName(label, scope)) return true;
  const labelBase = label.replace(/\s*\([A-Za-z]{2,6}\)\s*$/i, "").trim();
  if (labelBase !== label && isKnownTerritoryName(labelBase, scope)) {
    return true;
  }
  if (/^\([A-Za-z]{2,6}\)$/.test(String(row.id || "").trim())) {
    return true;
  }
  const rawId = String(row.id || "").trim();
  if (rawId && !rowIdLooksLikeRank(rawId) && isKnownTerritoryName(rawId, scope)) {
    return true;
  }
  const territories = getTerritoryFilterOptions(scope);
  if (
    territories.length > 1 &&
    territories.some((t) => t.toLowerCase() === label.toLowerCase())
  ) {
    return true;
  }
  return false;
}

/** Prefer ERP Customer name/id — widget rows often use numeric rank as `id`. */
export function customerIdFromRow(
  row: AnalysisRow,
  scope?: AccessPermissionScope | null
): string {
  const meta = row.meta || {};
  const cells = meta.cells as Record<string, unknown> | undefined;
  const rawId = String(row.id || "").trim();
  const id = rawId && !rowIdLooksLikeRank(rawId) ? rawId : "";
  const fromMeta = String(
    id ||
      meta.customer ||
      meta.customer_id ||
      meta.party ||
      meta.customer_name ||
      cells?.customer ||
      cells?.customer_id ||
      cells?.party ||
      cells?.customer_name ||
      ""
  ).trim();
  if (fromMeta) return fromMeta;
  const label = String(row.label || "").trim();
  if (rowIsTerritoryAggregate(row, scope) || isKnownTerritoryName(label, scope)) {
    return "";
  }
  return label;
}

export function openCustomerFromRow(row: AnalysisRow): void {
  const scope = useAuthStore.getState().permissions?.scope;
  if (rowIsTerritoryAggregate(row, scope)) {
    Alert.alert(
      "Territory total",
      "This row is a territory summary, not a customer. Choose a customer name from the list."
    );
    return;
  }
  const customer = customerIdFromRow(row, scope);
  if (!customer) return;
  if (isKnownTerritoryName(customer, scope)) {
    Alert.alert(
      "Not a customer",
      `"${customer}" is a territory filter name, not a Customer record.`
    );
    return;
  }

  const state = useAuthStore.getState();
  const enabled = isModuleEnabled(state.mobileConfig, "customer_360");
  const allowed = canAccessHubFeature(state.permissions, "customer360");
  if (!enabled || !allowed) {
    Alert.alert(
      "Customer profile",
      "Customer 360 is not enabled for your mobile profile."
    );
    return;
  }

  router.push({
    pathname: "/(tabs)/customer-360",
    params: { customer },
  });
}

export function isCustomerAdvancesWidgetKey(widgetKey: string): boolean {
  return /customer_advances/i.test(String(widgetKey || ""));
}

export function kpiDrillWidgetKey(kpiWidgetKey: string): string | null {
  const k = String(kpiWidgetKey || "")
    .replace(/__\d+$/i, "")
    .toLowerCase();
  if (/customer_advances/.test(k)) {
    return "receivables_customer_advances_ranking";
  }
  return null;
}

export function openReceivablesKpiDrill(
  kpiWidgetKey: string,
  title: string,
  listScope: Omit<ReceivablesWidgetListScope, "widgetKey" | "title">,
  payloadConfig?: Record<string, unknown> | null
): void {
  const fromConfig = String(
    payloadConfig?.drill_widget_key ||
      payloadConfig?.ranking_widget_key ||
      ""
  ).trim();
  const drillKey =
    fromConfig || kpiDrillWidgetKey(kpiWidgetKey) || "";
  if (!drillKey) {
    Alert.alert(
      "Details",
      "This KPI does not have a detail list configured yet."
    );
    return;
  }
  openReceivablesWidgetList({
    widgetKey: drillKey,
    title: title || "Details",
    ...listScope,
  });
}

export async function openCustomerAdvancePaymentsDrill(
  row: AnalysisRow,
  scope: {
    company?: string;
    territory?: string;
  }
): Promise<void> {
  const customer = customerIdFromRow(row);
  if (!customer) {
    Alert.alert("Customer Advances", "Could not resolve customer on this row.");
    return;
  }
  try {
    const { fetchCustomerAdvances } = await import("../api/customerAdvances");
    const res = await fetchCustomerAdvances({
      company: scope.company,
      customer,
      limit: 50,
      min_unallocated: 0.01,
      territory: scope.territory,
    });
    const payments = res.payments || [];
    if (!payments.length) {
      Alert.alert(
        customer,
        "No unallocated advance payments returned for this customer."
      );
      return;
    }
    const lines = payments.slice(0, 8).map((p) => {
      const amt = Number(p.unallocated_amount ?? p.paid_amount ?? 0);
      const ref = p.reference_no || p.name || "Payment";
      const dt = p.posting_date ? ` (${p.posting_date})` : "";
      return `• ${ref}${dt}: ${amt.toLocaleString()} SAR`;
    });
    const more =
      payments.length > 8
        ? `\n…and ${payments.length - 8} more payment(s).`
        : "";
    Alert.alert(
      row.label || customer,
      `Unallocated advances:\n\n${lines.join("\n")}${more}`
    );
  } catch (e) {
    Alert.alert(
      "Customer Advances",
      e instanceof Error ? e.message : "Failed to load payment details"
    );
  }
}

export function openReceivablesWidgetList(
  scope: ReceivablesWidgetListScope
): void {
  if (!scope.widgetKey?.trim()) return;
  const territory = String(scope.selectedTerritory || "").trim();
  router.push({
    pathname: "/(tabs)/receivables-widget-list",
    params: {
      widget_key: scope.widgetKey,
      title: scope.title || "",
      company: scope.company || "",
      from_date: scope.from_date || "",
      to_date: scope.to_date || "",
      period: scope.period || "",
      territory: territory && territory !== "__all__" ? territory : "",
      aging_bucket: scope.aging_bucket || "",
      aging_bucket_label: scope.aging_bucket_label || "",
      bucket_card_total: scope.bucket_card_total || "",
    },
  });
}

export function openReceivablesAgingBucketList(
  drillWidgetKey: string,
  bucket: { label: string; value: string; cardTotal?: number },
  listScope: Omit<
    ReceivablesWidgetListScope,
    "widgetKey" | "title" | "aging_bucket" | "aging_bucket_label" | "bucket_card_total"
  >
): void {
  const label = bucket.label || bucket.value;
  openReceivablesWidgetList({
    widgetKey: drillWidgetKey,
    title: `${label} · Customers`,
    aging_bucket: bucket.value,
    aging_bucket_label: label,
    bucket_card_total:
      bucket.cardTotal != null && Number.isFinite(bucket.cardTotal)
        ? String(Math.round(bucket.cardTotal))
        : "",
    ...listScope,
  });
}

export function openCollectionDashboard(): void {
  router.push({
    pathname: "/(tabs)/dashboard-board/[boardKey]",
    params: { boardKey: "collection_overview" },
  });
}

export function filtersFromTerritoryParam(
  territory: string | undefined
): DrillFilters | undefined {
  const t = String(territory || "").trim();
  if (!t) return undefined;
  return territoryFilters(t);
}
