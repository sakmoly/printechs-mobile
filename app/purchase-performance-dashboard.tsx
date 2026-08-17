import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { PeriodSelector } from "../src/components/PeriodSelector";
import { ExecutiveKpiTile } from "../src/components/ExecutiveKpiTile";
import { RankingCard, currencyMetric } from "../src/components/RankingCard";
import { LoadingScreen } from "../src/components/LoadingScreen";
import { usePurchaseDashboard } from "../src/hooks/usePurchase";
import { useAuthStore } from "../src/store/auth";
import { isModuleEnabled } from "../src/api/mobileConfig";
import { resolveCompanyName } from "../src/api/apiResilience";
import {
  defaultPeriod,
  resolvePeriod,
  type DateRange,
  type PeriodPreset,
} from "../src/utils/period";
import { formatCurrency } from "../src/utils/currency";
import type { PurchaseOrderLine, PurchaseRow } from "../src/api/purchaseTypes";
import { SafeScreen } from "../src/components/SafeScreen";

type Tab = "overview" | "suppliers" | "orders";
type Breakdown = "supplier" | "category";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function statusTone(status?: string | null): string {
  const s = (status || "").toLowerCase();
  if (s.includes("draft")) return "#6b7280";
  if (s.includes("receive") && s.includes("bill")) return "#7c3aed";
  if (s.includes("receive")) return "#0ea5e9";
  if (s.includes("bill")) return "#d97706";
  if (s.includes("complet")) return "#059669";
  return "#6b7280";
}

function OrderCard({
  order,
  currency,
}: {
  order: PurchaseOrderLine;
  currency: string;
}) {
  return (
    <View style={styles.orderCard}>
      <View style={styles.orderTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.orderId}>{order.name}</Text>
          <Text style={styles.orderSupplier}>{order.supplier || "—"}</Text>
        </View>
        <Text style={styles.orderAmount}>
          {formatCurrency(order.grand_total, currency, { compact: true })}
        </Text>
      </View>
      {order.status ? (
        <View
          style={[
            styles.statusPill,
            { backgroundColor: `${statusTone(order.status)}18` },
          ]}
        >
          <Text style={[styles.statusText, { color: statusTone(order.status) }]}>
            {order.status}
          </Text>
        </View>
      ) : null}
      <View style={styles.orderMeta}>
        {order.transaction_date ? (
          <Text style={styles.metaText}>PO {order.transaction_date}</Text>
        ) : null}
        {order.schedule_date ? (
          <Text style={styles.metaText}>Expect {order.schedule_date}</Text>
        ) : null}
      </View>
      <View style={styles.orderStats}>
        {order.pending_receipt != null && (
          <Text style={styles.statText}>
            Pending receipt{" "}
            {formatCurrency(order.pending_receipt, currency, { compact: true })}
          </Text>
        )}
        {order.pending_billing != null && (
          <Text style={styles.statText}>
            Pending billing{" "}
            {formatCurrency(order.pending_billing, currency, { compact: true })}
          </Text>
        )}
      </View>
    </View>
  );
}

export default function PurchasePerformanceDashboardScreen() {
  const mobileConfig = useAuthStore((s) => s.mobileConfig);
  const permissions = useAuthStore((s) => s.permissions);
  const user = useAuthStore((s) => s.user);
  const enabled = isModuleEnabled(mobileConfig, "purchase");

  const company = resolveCompanyName(
    permissions.scope?.company,
    user?.company
  );

  const [period, setPeriod] = useState<DateRange>(() => defaultPeriod());
  const [tab, setTab] = useState<Tab>("overview");
  const [breakdown, setBreakdown] = useState<Breakdown>("supplier");
  const [refreshing, setRefreshing] = useState(false);

  const params = useMemo(
    () => ({
      company,
      from_date: period.from_date,
      to_date: period.to_date,
      period: period.preset,
    }),
    [company, period]
  );

  const { data, isLoading, error, refetch } = usePurchaseDashboard(params, {
    enabled,
  });

  const currency = data?.meta.currency || "SAR";
  const kpis = data?.kpis;

  const rows: PurchaseRow[] = useMemo(() => {
    if (!data) return [];
    return breakdown === "category"
      ? data.by_category || []
      : data.by_supplier || [];
  }, [data, breakdown]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  if (!enabled) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Purchase is disabled for this site.</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.link}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isLoading && !data) {
    return <LoadingScreen message="Loading purchase…" />;
  }

  return (
    <SafeScreen style={styles.container}>
      <LinearGradient colors={["#f97316", "#c2410c"]} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Purchase</Text>
            <Text style={styles.headerSub}>PO performance & open orders</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.tabRow}>
        {(
          [
            ["overview", "Overview"],
            ["suppliers", "Breakdown"],
            ["orders", "Open PO"],
          ] as const
        ).map(([id, label]) => (
          <TouchableOpacity
            key={id}
            style={[styles.tab, tab === id && styles.tabActive]}
            onPress={() => setTab(id)}
          >
            <Text style={[styles.tabText, tab === id && styles.tabTextActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <PeriodSelector
          value={period}
          onChange={(p: PeriodPreset) => setPeriod(resolvePeriod(p))}
        />

        {error && (
          <Text style={styles.error}>
            {(error as Error).message || "Failed to load"}
          </Text>
        )}

        {tab === "overview" && (
          <>
            <Section title="Purchased">
              <View style={styles.grid}>
                <ExecutiveKpiTile
                  title="Today"
                  value={kpis?.today}
                  currency={currency}
                  compact
                />
                <ExecutiveKpiTile
                  title="MTD"
                  value={kpis?.mtd}
                  currency={currency}
                  compact
                />
                <ExecutiveKpiTile
                  title="YTD"
                  value={kpis?.ytd}
                  previous={kpis?.ytd_ly}
                  changePct={kpis?.growth_pct}
                  currency={currency}
                  compact
                />
                <ExecutiveKpiTile
                  title="Suppliers"
                  value={kpis?.supplier_count}
                  format="number"
                  compact
                />
                <ExecutiveKpiTile
                  title="Avg PO"
                  value={kpis?.avg_order_value}
                  currency={currency}
                  compact
                />
                <ExecutiveKpiTile
                  title="Avg lead days"
                  value={kpis?.avg_lead_time}
                  format="number"
                  compact
                />
              </View>
            </Section>

            <Section title="Open book">
              <View style={styles.grid}>
                <ExecutiveKpiTile
                  title="Open PO value"
                  value={kpis?.open_po_value}
                  currency={currency}
                  compact
                />
                <ExecutiveKpiTile
                  title="Open PO count"
                  value={kpis?.open_po_count}
                  format="number"
                  compact
                />
                <ExecutiveKpiTile
                  title="Pending receipt"
                  value={kpis?.pending_receipt}
                  currency={currency}
                  compact
                />
                <ExecutiveKpiTile
                  title="Pending billing"
                  value={kpis?.pending_billing}
                  currency={currency}
                  compact
                />
              </View>
            </Section>

            {data?.by_status && data.by_status.length > 0 && (
              <Section title="By status">
                <View style={styles.agingCard}>
                  {data.by_status.map((b) => (
                    <View key={b.label} style={styles.agingRow}>
                      <Text style={styles.agingLabelWide}>{b.label}</Text>
                      <Text style={styles.agingValue}>
                        {formatCurrency(b.amount, currency, { compact: true })}
                      </Text>
                      {b.count != null && (
                        <Text style={styles.agingCount}>{b.count}</Text>
                      )}
                    </View>
                  ))}
                </View>
              </Section>
            )}

            {data?.charts?.months && data.charts.purchased && (
              <Section title="Purchased vs received">
                <View style={styles.trendCard}>
                  {data.charts.months.slice(-6).map((m, i) => {
                    const idx = data.charts!.months!.length - 6 + i;
                    const purchased = data.charts!.purchased?.[idx];
                    const received = data.charts!.received?.[idx];
                    return (
                      <View key={`${m}-${i}`} style={styles.trendRow}>
                        <Text style={styles.trendMonth}>{m}</Text>
                        <Text style={styles.trendVal}>
                          PO{" "}
                          {purchased == null
                            ? "—"
                            : formatCurrency(purchased, currency, {
                                compact: true,
                              })}
                        </Text>
                        <Text style={styles.trendValMuted}>
                          Rec{" "}
                          {received == null
                            ? "—"
                            : formatCurrency(received, currency, {
                                compact: true,
                              })}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </Section>
            )}
          </>
        )}

        {tab === "suppliers" && (
          <>
            <View style={styles.chipRow}>
              {(
                [
                  ["supplier", "Supplier"],
                  ["category", "Category"],
                ] as const
              ).map(([id, label]) => (
                <TouchableOpacity
                  key={id}
                  style={[styles.chip, breakdown === id && styles.chipActive]}
                  onPress={() => setBreakdown(id)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      breakdown === id && styles.chipTextActive,
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {rows.map((row, idx) => (
              <RankingCard
                key={row.id}
                rank={idx + 1}
                title={row.name}
                primary={formatCurrency(row.amount, currency, {
                  compact: true,
                })}
                changePct={row.growth_pct}
                metrics={[
                  ...(row.po_count != null
                    ? [{ label: "POs", value: String(row.po_count) }]
                    : []),
                  currencyMetric("Open PO", row.open_po_value, currency),
                  ...(row.avg_lead_time != null
                    ? [
                        {
                          label: "Lead days",
                          value: String(row.avg_lead_time),
                        },
                      ]
                    : []),
                  currencyMetric("Avg PO", row.avg_order_value, currency),
                ]}
              />
            ))}
            {rows.length === 0 && (
              <Text style={styles.muted}>No breakdown for this period.</Text>
            )}
          </>
        )}

        {tab === "orders" && (
          <>
            {(data?.orders || []).map((o) => (
              <OrderCard key={o.id} order={o} currency={currency} />
            ))}
            {(data?.orders || []).length === 0 && (
              <Text style={styles.muted}>No open purchase orders.</Text>
            )}
          </>
        )}
      </ScrollView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  header: {
    paddingTop: Platform.OS === "ios" ? 52 : 40,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "800" },
  headerSub: { color: "rgba(255,255,255,0.85)", fontSize: 12, marginTop: 2 },
  tabRow: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingTop: 10,
    gap: 6,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: { borderBottomColor: "#f97316" },
  tabText: { fontSize: 13, fontWeight: "600", color: "#6b7280" },
  tabTextActive: { color: "#c2410c", fontWeight: "800" },
  body: { padding: 16, paddingBottom: 40 },
  section: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1f2937",
    marginBottom: 10,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  chipActive: { backgroundColor: "#ffedd5", borderColor: "#f97316" },
  chipText: { fontSize: 12, fontWeight: "700", color: "#6b7280" },
  chipTextActive: { color: "#c2410c" },
  agingCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#ffedd5",
  },
  agingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e7eb",
  },
  agingLabelWide: { width: 110, fontWeight: "700", color: "#6b7280" },
  agingValue: { flex: 1, fontWeight: "800", color: "#111827" },
  agingCount: { fontSize: 12, color: "#9ca3af", fontWeight: "600" },
  trendCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#ffedd5",
  },
  trendRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    gap: 8,
  },
  trendMonth: { width: 40, fontWeight: "700", color: "#6b7280" },
  trendVal: { flex: 1, fontSize: 12, color: "#111827", fontWeight: "600" },
  trendValMuted: { fontSize: 11, color: "#9ca3af" },
  orderCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#ffedd5",
  },
  orderTop: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  orderId: { fontSize: 14, fontWeight: "800", color: "#111827" },
  orderSupplier: { fontSize: 13, color: "#c2410c", fontWeight: "600", marginTop: 2 },
  orderAmount: { fontSize: 14, fontWeight: "800", color: "#111827" },
  statusPill: {
    alignSelf: "flex-start",
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusText: { fontSize: 11, fontWeight: "700" },
  orderMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 8,
  },
  metaText: { fontSize: 11, color: "#6b7280", fontWeight: "600" },
  orderStats: { marginTop: 8, gap: 4 },
  statText: { fontSize: 11, color: "#374151", fontWeight: "600" },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#f8fafc",
  },
  muted: { color: "#6b7280", textAlign: "center", marginTop: 24 },
  link: { color: "#f97316", fontWeight: "700", marginTop: 12 },
  error: { color: "#dc2626", marginBottom: 12, fontWeight: "600" },
});
