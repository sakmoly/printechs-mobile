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
import { useProfitabilityDashboard } from "../src/hooks/useProfitability";
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
import { formatCurrency, formatPercent } from "../src/utils/currency";
import type { ProfitRow } from "../src/api/profitabilityTypes";
import { SafeScreen } from "../src/components/SafeScreen";

type Tab = "overview" | "breakdown";
type Breakdown =
  | "customer"
  | "product"
  | "salesperson"
  | "territory"
  | "brand";

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

export default function ProfitabilityDashboardScreen() {
  const mobileConfig = useAuthStore((s) => s.mobileConfig);
  const permissions = useAuthStore((s) => s.permissions);
  const user = useAuthStore((s) => s.user);
  const enabled = isModuleEnabled(mobileConfig, "profitability");
  const showTerritory = useDimensionEnabled("territory");
  const showBrand = useDimensionEnabled("brand");

  const company = resolveCompanyName(
    permissions.scope?.company,
    user?.company
  );

  const [period, setPeriod] = useState<DateRange>(() => defaultPeriod());
  const [tab, setTab] = useState<Tab>("overview");
  const [breakdown, setBreakdown] = useState<Breakdown>("customer");
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

  const filterKeys = useMemo(() => {
    const keys: string[] = [];
    if (showTerritory) keys.push("territory");
    if (showBrand) keys.push("brand");
    return keys;
  }, [showTerritory, showBrand]);

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

  const { data, isLoading, error, refetch } = useProfitabilityDashboard(
    params,
    { enabled }
  );

  const currency = data?.meta.currency || "SAR";
  const kpis = data?.kpis;

  const rows: ProfitRow[] = useMemo(() => {
    if (!data) return [];
    if (breakdown === "product") return data.by_product || [];
    if (breakdown === "salesperson") return data.by_salesperson || [];
    if (breakdown === "territory") return data.by_territory || [];
    if (breakdown === "brand") return data.by_brand || [];
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
          Profitability is disabled for this site.
        </Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.link}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isLoading && !data) {
    return <LoadingScreen message="Loading profitability…" />;
  }

  const breakdownChips = (
    [
      ["customer", "Customer"],
      ["product", "Product"],
      ["salesperson", "Salesperson"],
      showTerritory ? ["territory", "Territory"] : null,
      showBrand ? ["brand", "Brand"] : null,
    ].filter(Boolean) as [Breakdown, string][]
  );

  return (
    <SafeScreen style={styles.container}>
      <LinearGradient colors={["#059669", "#065f46"]} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Profitability</Text>
            <Text style={styles.headerSub}>Gross profit & margins</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.tabRow}>
        {(
          [
            ["overview", "Overview"],
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

        {filterKeys.length > 0 && (
          <DynamicFilterBar
            value={dimFilters}
            onChange={setDimFilters}
            keys={filterKeys}
            company={company}
            staticOptions={{
              territory: territoryOptions,
            }}
            title="Filters"
          />
        )}

        {error && (
          <Text style={styles.error}>
            {(error as Error).message || "Failed to load"}
          </Text>
        )}

        {tab === "overview" && (
          <>
            <Section title="Gross profit">
              <View style={styles.grid}>
                <ExecutiveKpiTile
                  title="Sales"
                  value={kpis?.sales}
                  previous={kpis?.sales_ly}
                  changePct={kpis?.growth_pct}
                  currency={currency}
                  compact
                />
                <ExecutiveKpiTile
                  title="COGS"
                  value={kpis?.cogs}
                  currency={currency}
                  compact
                />
                <ExecutiveKpiTile
                  title="Gross profit"
                  value={kpis?.gp}
                  previous={kpis?.gp_ly}
                  changePct={kpis?.gp_growth_pct}
                  currency={currency}
                  compact
                />
                <ExecutiveKpiTile
                  title="GP %"
                  value={kpis?.gp_pct}
                  previous={kpis?.gp_pct_ly}
                  format="percent"
                  compact
                />
                <ExecutiveKpiTile
                  title="Invoices"
                  value={kpis?.invoice_count}
                  format="number"
                  compact
                />
              </View>
            </Section>

            {data?.charts?.months && data.charts.gp && (
              <Section title="Monthly GP">
                <View style={styles.trendCard}>
                  {data.charts.months.slice(-6).map((m, i) => {
                    const idx = data.charts!.months!.length - 6 + i;
                    const sales = data.charts!.sales?.[idx];
                    const gp = data.charts!.gp?.[idx];
                    const gpPct = data.charts!.gp_pct?.[idx];
                    return (
                      <View key={`${m}-${i}`} style={styles.trendRow}>
                        <Text style={styles.trendMonth}>{m}</Text>
                        <Text style={styles.trendVal}>
                          GP{" "}
                          {gp == null
                            ? "—"
                            : formatCurrency(gp, currency, { compact: true })}
                        </Text>
                        <Text style={styles.trendValMuted}>
                          {sales == null
                            ? ""
                            : formatCurrency(sales, currency, {
                                compact: true,
                              })}
                          {gpPct != null ? ` · ${formatPercent(gpPct)}` : ""}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </Section>
            )}

            <TouchableOpacity
              style={styles.cta}
              onPress={() => setTab("breakdown")}
            >
              <Ionicons name="pie-chart" size={18} color="#065f46" />
              <Text style={styles.ctaText}>View GP breakdown</Text>
              <Ionicons name="chevron-forward" size={18} color="#065f46" />
            </TouchableOpacity>
          </>
        )}

        {tab === "breakdown" && (
          <>
            <View style={styles.chipRow}>
              {breakdownChips.map(([id, label]) => (
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
                primary={formatCurrency(row.gp ?? 0, currency, {
                  compact: true,
                })}
                changePct={row.growth_pct}
                subtitle={
                  row.gp_pct != null ? `GP ${formatPercent(row.gp_pct)}` : undefined
                }
                metrics={[
                  currencyMetric("Sales", row.sales, currency),
                  currencyMetric("COGS", row.cogs, currency),
                  ...(row.gp_pct != null
                    ? [
                        {
                          label: "GP %",
                          value: formatPercent(row.gp_pct),
                        },
                      ]
                    : []),
                  ...(row.invoice_count != null
                    ? [
                        {
                          label: "Invoices",
                          value: String(row.invoice_count),
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
  tabActive: { borderBottomColor: "#059669" },
  tabText: { fontSize: 13, fontWeight: "600", color: "#6b7280" },
  tabTextActive: { color: "#065f46", fontWeight: "800" },
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
  chipActive: { backgroundColor: "#d1fae5", borderColor: "#059669" },
  chipText: { fontSize: 12, fontWeight: "700", color: "#6b7280" },
  chipTextActive: { color: "#065f46" },
  trendCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#d1fae5",
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
    backgroundColor: "#d1fae5",
    padding: 14,
    borderRadius: 12,
    marginTop: 4,
  },
  ctaText: { flex: 1, fontWeight: "700", color: "#065f46" },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#f8fafc",
  },
  muted: { color: "#6b7280", textAlign: "center", marginTop: 24 },
  link: { color: "#059669", fontWeight: "700", marginTop: 12 },
  error: { color: "#dc2626", marginBottom: 12, fontWeight: "600" },
});
