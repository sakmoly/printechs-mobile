import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Linking,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { PeriodSelector } from "../src/components/PeriodSelector";
import { ExecutiveKpiTile } from "../src/components/ExecutiveKpiTile";
import { RankingCard, currencyMetric } from "../src/components/RankingCard";
import { LoadingScreen } from "../src/components/LoadingScreen";
import {
  useCollectionAttention,
  useCollectionDashboard,
} from "../src/hooks/useCollection";
import { useAuthStore } from "../src/store/auth";
import { isModuleEnabled } from "../src/api/mobileConfig";
import { useDimensionEnabled } from "../src/hooks/useBootstrap";
import { resolveCompanyName } from "../src/api/apiResilience";
import { getTerritoryFilterOptions } from "../src/api/accessScope";
import {
  DynamicFilterBar,
  dimensionFiltersToParams,
  type DimensionFilterMap,
} from "../src/components/analytics";
import {
  defaultPeriod,
  resolvePeriod,
  type DateRange,
  type PeriodPreset,
} from "../src/utils/period";
import { formatCurrency } from "../src/utils/currency";
import { SafeScreen } from "../src/components/SafeScreen";
import type {
  AttentionItem,
  AttentionPriority,
  CollectionRow,
} from "../src/api/collectionTypes";

type Tab = "overview" | "breakdown" | "attention";
type Breakdown = "territory" | "salesperson" | "customer";

const PRIORITY_COLOR: Record<AttentionPriority, string> = {
  high: "#dc2626",
  medium: "#d97706",
  low: "#6b7280",
};

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

function AttentionCard({
  item,
  currency,
}: {
  item: AttentionItem;
  currency: string;
}) {
  const priority = item.priority || "medium";
  const openCall = () => {
    if (item.mobile) Linking.openURL(`tel:${item.mobile}`);
  };
  const openCustomer = () => {
    router.push({
      pathname: "/customer-360",
      params: { customer: item.customer_id || item.customer },
    });
  };

  return (
    <View style={styles.attCard}>
      <View style={styles.attTop}>
        <View
          style={[
            styles.priorityDot,
            { backgroundColor: PRIORITY_COLOR[priority] },
          ]}
        />
        <View style={{ flex: 1 }}>
          <TouchableOpacity onPress={openCustomer}>
            <Text style={styles.attName}>{item.customer}</Text>
          </TouchableOpacity>
          <Text style={styles.attMeta}>
            {[item.territory, item.salesperson, item.reason]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        </View>
        <Text style={styles.attAmount}>
          {formatCurrency(item.overdue ?? item.outstanding, currency, {
            compact: true,
          })}
        </Text>
      </View>
      <View style={styles.attStats}>
        <Text style={styles.attStat}>
          Outstanding{" "}
          {formatCurrency(item.outstanding, currency, { compact: true })}
        </Text>
        {item.days_overdue != null && (
          <Text style={styles.attStat}>{item.days_overdue}d overdue</Text>
        )}
        {item.last_payment && (
          <Text style={styles.attStat}>Paid {item.last_payment}</Text>
        )}
      </View>
      <View style={styles.attActions}>
        <TouchableOpacity style={styles.attBtn} onPress={openCustomer}>
          <Ionicons name="person-circle" size={14} color="#667eea" />
          <Text style={styles.attBtnText}>360</Text>
        </TouchableOpacity>
        {item.mobile ? (
          <TouchableOpacity style={styles.attBtn} onPress={openCall}>
            <Ionicons name="call" size={14} color="#667eea" />
            <Text style={styles.attBtnText}>Call</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          style={styles.attBtn}
          onPress={() =>
            router.push({
              pathname: "/customer-statement",
              params: { customer: item.customer_id || item.customer },
            })
          }
        >
          <Ionicons name="document-text" size={14} color="#667eea" />
          <Text style={styles.attBtnText}>Statement</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function CollectionDashboardScreen() {
  const mobileConfig = useAuthStore((s) => s.mobileConfig);
  const permissions = useAuthStore((s) => s.permissions);
  const user = useAuthStore((s) => s.user);
  const enabled = isModuleEnabled(mobileConfig, "collection");
  const showTerritory = useDimensionEnabled("territory");

  const company = resolveCompanyName(
    permissions.scope?.company,
    user?.company
  );

  const [period, setPeriod] = useState<DateRange>(() => defaultPeriod());
  const [tab, setTab] = useState<Tab>("overview");
  const [breakdown, setBreakdown] = useState<Breakdown>(
    showTerritory ? "territory" : "salesperson"
  );
  const [refreshing, setRefreshing] = useState(false);
  const [dimFilters, setDimFilters] = useState<DimensionFilterMap>({});

  const territoryOptions = useMemo(
    () =>
      getTerritoryFilterOptions(permissions.scope).map((t) => ({
        value: t,
        label: t,
      })),
    [permissions.scope]
  );

  const params = useMemo(
    () => ({
      company,
      from_date: period.from_date,
      to_date: period.to_date,
      period: period.preset,
      ...dimensionFiltersToParams(dimFilters),
    }),
    [company, period, dimFilters]
  );

  const dash = useCollectionDashboard(params, { enabled });
  const attn = useCollectionAttention(params, { enabled });

  const currency = dash.data?.meta.currency || attn.data?.meta.currency || "SAR";
  const kpis = dash.data?.kpis;

  const rows: CollectionRow[] = useMemo(() => {
    const d = dash.data;
    if (!d) return [];
    if (breakdown === "territory") return d.by_territory || [];
    if (breakdown === "salesperson") return d.by_salesperson || [];
    return d.by_customer || [];
  }, [dash.data, breakdown]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        dash.refetch(),
        tab === "attention" ? attn.refetch() : Promise.resolve(),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  if (!enabled) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Collection is disabled for this site.</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.link}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (dash.isLoading && !dash.data) {
    return <LoadingScreen message="Loading collection…" />;
  }

  return (
    <SafeScreen style={styles.container}>
      <LinearGradient colors={["#0ea5e9", "#0369a1"]} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Collection</Text>
            <Text style={styles.headerSub}>
              Performance & attention · actuals
            </Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.tabRow}>
        {(
          [
            ["overview", "Overview"],
            ["breakdown", "Breakdown"],
            ["attention", "Attention"],
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
            {id === "attention" && (attn.data?.summary?.count || 0) > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {attn.data?.summary?.count}
                </Text>
              </View>
            ) : null}
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

        {showTerritory && (
          <DynamicFilterBar
            value={dimFilters}
            onChange={setDimFilters}
            keys={["territory"]}
            company={company}
            staticOptions={{ territory: territoryOptions }}
            title="Filters"
          />
        )}

        {(dash.error || (tab === "attention" && attn.error)) && (
          <Text style={styles.error}>
            {((tab === "attention" ? attn.error : dash.error) as Error)
              ?.message || "Failed to load"}
          </Text>
        )}

        {tab === "overview" && (
          <>
            <Section title="Collected">
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
                  title="Payments"
                  value={kpis?.payment_count}
                  format="number"
                  compact
                />
                <ExecutiveKpiTile
                  title="Avg payment"
                  value={kpis?.avg_payment}
                  currency={currency}
                  compact
                />
              </View>
            </Section>

            {dash.data?.charts?.months && dash.data.charts.collection && (
              <Section title="Recent months">
                <View style={styles.trendCard}>
                  {dash.data.charts.months.slice(-6).map((m, i) => {
                    const idx = dash.data!.charts!.months!.length - 6 + i;
                    const coll = dash.data!.charts!.collection?.[idx];
                    const sales = dash.data!.charts!.sales?.[idx];
                    return (
                      <View key={`${m}-${i}`} style={styles.trendRow}>
                        <Text style={styles.trendMonth}>{m}</Text>
                        <Text style={styles.trendVal}>
                          Collected{" "}
                          {coll == null
                            ? "—"
                            : formatCurrency(coll, currency, {
                                compact: true,
                              })}
                        </Text>
                        {sales != null && (
                          <Text style={styles.trendValMuted}>
                            Sales{" "}
                            {formatCurrency(sales, currency, {
                              compact: true,
                            })}
                          </Text>
                        )}
                      </View>
                    );
                  })}
                </View>
              </Section>
            )}

            <TouchableOpacity
              style={styles.cta}
              onPress={() => setTab("attention")}
            >
              <Ionicons name="alert-circle" size={18} color="#0369a1" />
              <Text style={styles.ctaText}>Review attention list</Text>
              <Ionicons name="chevron-forward" size={18} color="#0369a1" />
            </TouchableOpacity>
          </>
        )}

        {tab === "breakdown" && (
          <>
            <View style={styles.chipRow}>
              {(
                [
                  showTerritory ? (["territory", "Territory"] as const) : null,
                  ["salesperson", "Salesperson"] as const,
                  ["customer", "Customer"] as const,
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
                primary={formatCurrency(row.collected, currency, {
                  compact: true,
                })}
                changePct={row.growth_pct}
                metrics={[
                  currencyMetric("Outstanding", row.outstanding, currency),
                  currencyMetric("Overdue", row.overdue, currency),
                  ...(row.payment_count != null
                    ? [
                        {
                          label: "Payments",
                          value: String(row.payment_count),
                        },
                      ]
                    : []),
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
              <Text style={styles.muted}>No breakdown rows for this period.</Text>
            )}
          </>
        )}

        {tab === "attention" && (
          <>
            {attn.isLoading && !attn.data ? (
              <Text style={styles.muted}>Loading attention…</Text>
            ) : (
              <>
                {attn.data?.summary && (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryText}>
                      {attn.data.summary.count ?? attn.data.items.length}{" "}
                      accounts
                    </Text>
                    {attn.data.summary.overdue_total != null && (
                      <Text style={styles.summaryText}>
                        Overdue{" "}
                        {formatCurrency(
                          attn.data.summary.overdue_total,
                          currency,
                          { compact: true }
                        )}
                      </Text>
                    )}
                    {attn.data.summary.high_priority != null && (
                      <Text style={[styles.summaryText, { color: "#dc2626" }]}>
                        {attn.data.summary.high_priority} high
                      </Text>
                    )}
                  </View>
                )}
                {(attn.data?.items || []).map((item) => (
                  <AttentionCard
                    key={item.id}
                    item={item}
                    currency={currency}
                  />
                ))}
                {(attn.data?.items || []).length === 0 && (
                  <Text style={styles.muted}>
                    No customers need attention right now.
                  </Text>
                )}
              </>
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: { borderBottomColor: "#0ea5e9" },
  tabText: { fontSize: 13, fontWeight: "600", color: "#6b7280" },
  tabTextActive: { color: "#0369a1", fontWeight: "800" },
  badge: {
    backgroundColor: "#dc2626",
    borderRadius: 8,
    minWidth: 16,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
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
  chipActive: { backgroundColor: "#e0f2fe", borderColor: "#0ea5e9" },
  chipText: { fontSize: 12, fontWeight: "700", color: "#6b7280" },
  chipTextActive: { color: "#0369a1" },
  trendCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e0f2fe",
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
  cta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#e0f2fe",
    padding: 14,
    borderRadius: 12,
    marginTop: 4,
  },
  ctaText: { flex: 1, fontWeight: "700", color: "#0369a1" },
  summaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 12,
  },
  summaryText: { fontSize: 13, fontWeight: "700", color: "#374151" },
  attCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e0f2fe",
  },
  attTop: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  priorityDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  attName: { fontSize: 15, fontWeight: "800", color: "#111827" },
  attMeta: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  attAmount: { fontSize: 14, fontWeight: "800", color: "#dc2626" },
  attStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 8,
  },
  attStat: { fontSize: 11, color: "#6b7280", fontWeight: "600" },
  attActions: { flexDirection: "row", gap: 8, marginTop: 10 },
  attBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  attBtnText: { fontSize: 11, fontWeight: "700", color: "#374151" },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#f8fafc",
  },
  muted: { color: "#6b7280", textAlign: "center", marginTop: 24 },
  link: { color: "#0ea5e9", fontWeight: "700", marginTop: 12 },
  error: { color: "#dc2626", marginBottom: 12, fontWeight: "600" },
});
