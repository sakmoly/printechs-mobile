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
import { useSalesOrderDashboard } from "../src/hooks/useSalesOrders";
import { useAuthStore } from "../src/store/auth";
import { isModuleEnabled, isDimensionEnabled } from "../src/api/mobileConfig";
import { resolveCompanyName } from "../src/api/apiResilience";
import {
  defaultPeriod,
  resolvePeriod,
  type DateRange,
  type PeriodPreset,
} from "../src/utils/period";
import { formatCurrency } from "../src/utils/currency";
import { SafeScreen } from "../src/components/SafeScreen";
import type {
  OrderBookRow,
  SalesOrderLine,
} from "../src/api/salesOrderTypes";

type Tab = "overview" | "orders" | "breakdown";
type Breakdown = "customer" | "salesperson" | "territory";

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
  if (s.includes("hold")) return "#d97706";
  if (s.includes("deliver") && s.includes("bill")) return "#7c3aed";
  if (s.includes("deliver")) return "#0ea5e9";
  if (s.includes("bill")) return "#059669";
  return "#6b7280";
}

function OrderCard({
  order,
  currency,
}: {
  order: SalesOrderLine;
  currency: string;
}) {
  return (
    <View style={styles.orderCard}>
      <View style={styles.orderTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.orderId}>{order.name}</Text>
          <TouchableOpacity
            disabled={!order.customer_id && !order.customer}
            onPress={() =>
              router.push({
                pathname: "/customer-360",
                params: {
                  customer: order.customer_id || order.customer || "",
                },
              })
            }
          >
            <Text style={styles.orderCustomer}>{order.customer || "—"}</Text>
          </TouchableOpacity>
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
          <Text style={styles.metaText}>Booked {order.transaction_date}</Text>
        ) : null}
        {order.delivery_date ? (
          <Text style={styles.metaText}>Deliver {order.delivery_date}</Text>
        ) : null}
        {order.salesperson ? (
          <Text style={styles.metaText}>{order.salesperson}</Text>
        ) : null}
      </View>
      <View style={styles.orderStats}>
        {order.pending_delivery != null && (
          <Text style={styles.statText}>
            Pending delivery{" "}
            {formatCurrency(order.pending_delivery, currency, {
              compact: true,
            })}
          </Text>
        )}
        {order.pending_billing != null && (
          <Text style={styles.statText}>
            Pending billing{" "}
            {formatCurrency(order.pending_billing, currency, {
              compact: true,
            })}
          </Text>
        )}
      </View>
    </View>
  );
}

export default function SalesOrderDashboardScreen() {
  const mobileConfig = useAuthStore((s) => s.mobileConfig);
  const permissions = useAuthStore((s) => s.permissions);
  const user = useAuthStore((s) => s.user);
  const enabled = isModuleEnabled(mobileConfig, "sales_orders");
  const showTerritory = isDimensionEnabled(mobileConfig, "territory");

  const company = resolveCompanyName(
    permissions.scope?.company,
    user?.company
  );

  const [period, setPeriod] = useState<DateRange>(() => defaultPeriod());
  const [tab, setTab] = useState<Tab>("overview");
  const [breakdown, setBreakdown] = useState<Breakdown>("customer");
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

  const { data, isLoading, error, refetch } = useSalesOrderDashboard(params, {
    enabled,
  });

  const currency = data?.meta.currency || "SAR";
  const kpis = data?.kpis;

  const rows: OrderBookRow[] = useMemo(() => {
    if (!data) return [];
    if (breakdown === "territory") return data.by_territory || [];
    if (breakdown === "salesperson") return data.by_salesperson || [];
    return data.by_customer || [];
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
        <Text style={styles.muted}>
          Sales Orders is disabled for this site.
        </Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.link}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isLoading && !data) {
    return <LoadingScreen message="Loading order book…" />;
  }

  return (
    <SafeScreen style={styles.container}>
      <LinearGradient colors={["#7c3aed", "#5b21b6"]} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Sales Orders</Text>
            <Text style={styles.headerSub}>Order book & open SO</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.tabRow}>
        {(
          [
            ["overview", "Overview"],
            ["orders", "Open SO"],
            ["breakdown", "Breakdown"],
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
            <Section title="Order book">
              <View style={styles.grid}>
                <ExecutiveKpiTile
                  title="Open SO value"
                  value={kpis?.open_so_value}
                  currency={currency}
                  compact
                />
                <ExecutiveKpiTile
                  title="Open SO count"
                  value={kpis?.open_so_count}
                  format="number"
                  compact
                />
                <ExecutiveKpiTile
                  title="Pending delivery"
                  value={kpis?.pending_delivery}
                  currency={currency}
                  compact
                />
                <ExecutiveKpiTile
                  title="Pending billing"
                  value={kpis?.pending_billing}
                  currency={currency}
                  compact
                />
                <ExecutiveKpiTile
                  title="Backorder"
                  value={kpis?.backorder}
                  currency={currency}
                  compact
                />
                <ExecutiveKpiTile
                  title="Avg order"
                  value={kpis?.avg_order_value}
                  currency={currency}
                  compact
                />
              </View>
            </Section>

            <Section title="Booked">
              <View style={styles.grid}>
                <ExecutiveKpiTile
                  title="Today"
                  value={kpis?.booked_today}
                  currency={currency}
                  compact
                />
                <ExecutiveKpiTile
                  title="MTD"
                  value={kpis?.booked_mtd}
                  currency={currency}
                  compact
                />
                <ExecutiveKpiTile
                  title="YTD"
                  value={kpis?.booked_ytd}
                  currency={currency}
                  compact
                />
              </View>
            </Section>

            {data?.aging && data.aging.length > 0 && (
              <Section title="Open SO aging">
                <View style={styles.agingCard}>
                  {data.aging.map((b) => (
                    <View key={b.label} style={styles.agingRow}>
                      <Text style={styles.agingLabel}>{b.label}</Text>
                      <Text style={styles.agingValue}>
                        {formatCurrency(b.value, currency, { compact: true })}
                      </Text>
                      {b.count != null && (
                        <Text style={styles.agingCount}>{b.count} SO</Text>
                      )}
                    </View>
                  ))}
                </View>
              </Section>
            )}

            {data?.charts?.months && data.charts.booked && (
              <Section title="Booked vs delivered">
                <View style={styles.trendCard}>
                  {data.charts.months.slice(-6).map((m, i) => {
                    const idx = data.charts!.months!.length - 6 + i;
                    const booked = data.charts!.booked?.[idx];
                    const delivered = data.charts!.delivered?.[idx];
                    return (
                      <View key={`${m}-${i}`} style={styles.trendRow}>
                        <Text style={styles.trendMonth}>{m}</Text>
                        <Text style={styles.trendVal}>
                          Booked{" "}
                          {booked == null
                            ? "—"
                            : formatCurrency(booked, currency, {
                                compact: true,
                              })}
                        </Text>
                        <Text style={styles.trendValMuted}>
                          Del{" "}
                          {delivered == null
                            ? "—"
                            : formatCurrency(delivered, currency, {
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

        {tab === "orders" && (
          <>
            {(data?.orders || []).map((o) => (
              <OrderCard key={o.id} order={o} currency={currency} />
            ))}
            {(data?.orders || []).length === 0 && (
              <Text style={styles.muted}>No open sales orders.</Text>
            )}
          </>
        )}

        {tab === "breakdown" && (
          <>
            <View style={styles.chipRow}>
              {(
                [
                  ["customer", "Customer"] as const,
                  ["salesperson", "Salesperson"] as const,
                  showTerritory ? (["territory", "Territory"] as const) : null,
                ].filter(Boolean) as [Breakdown, string][]
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
                primary={formatCurrency(row.open_value, currency, {
                  compact: true,
                })}
                metrics={[
                  ...(row.open_count != null
                    ? [{ label: "Open SO", value: String(row.open_count) }]
                    : []),
                  currencyMetric(
                    "Pending delivery",
                    row.pending_delivery,
                    currency
                  ),
                  currencyMetric(
                    "Pending billing",
                    row.pending_billing,
                    currency
                  ),
                  currencyMetric("Backorder", row.backorder, currency),
                ]}
                onPress={
                  breakdown === "customer"
                    ? () =>
                        router.push({
                          pathname: "/customer-360",
                          params: { customer: row.id },
                        })
                    : undefined
                }
              />
            ))}
            {rows.length === 0 && (
              <Text style={styles.muted}>No breakdown for this period.</Text>
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
  tabActive: { borderBottomColor: "#7c3aed" },
  tabText: { fontSize: 13, fontWeight: "600", color: "#6b7280" },
  tabTextActive: { color: "#5b21b6", fontWeight: "800" },
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
  chipActive: { backgroundColor: "#ede9fe", borderColor: "#7c3aed" },
  chipText: { fontSize: 12, fontWeight: "700", color: "#6b7280" },
  chipTextActive: { color: "#5b21b6" },
  agingCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#ede9fe",
  },
  agingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e7eb",
  },
  agingLabel: { width: 64, fontWeight: "700", color: "#6b7280" },
  agingValue: { flex: 1, fontWeight: "800", color: "#111827" },
  agingCount: { fontSize: 12, color: "#9ca3af", fontWeight: "600" },
  trendCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#ede9fe",
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
    borderColor: "#ede9fe",
  },
  orderTop: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  orderId: { fontSize: 14, fontWeight: "800", color: "#111827" },
  orderCustomer: { fontSize: 13, color: "#7c3aed", fontWeight: "600", marginTop: 2 },
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
  link: { color: "#7c3aed", fontWeight: "700", marginTop: 12 },
  error: { color: "#dc2626", marginBottom: 12, fontWeight: "600" },
});
