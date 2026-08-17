/**
 * Phase H — reusable analysis screen driven by logical dimension + metric.
 * One screen for sales-by-brand / season / color / etc.
 */

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
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { PeriodSelector } from "../../components/PeriodSelector";
import { ExecutiveKpiTile } from "../../components/ExecutiveKpiTile";
import { RankingCard } from "../../components/RankingCard";
import { LoadingScreen } from "../../components/LoadingScreen";
import { SafeScreen } from "../../components/SafeScreen";
import {
  DynamicFilterBar,
  dimensionFiltersToParams,
  type DimensionFilterMap,
} from "../../components/analytics";
import { AnalysisChart } from "../../components/analytics/AnalysisChart";
import { AnalysisTable } from "../../components/analytics/AnalysisTable";
import { useGenericAnalysis } from "./useGenericAnalysis";
import { useAuthStore } from "../../store/auth";
import { resolveCompanyName } from "../../api/apiResilience";
import { getTerritoryFilterOptions } from "../../api/accessScope";
import { useFilterableDimensions } from "../../hooks/useBootstrap";
import { humanizeDimensionKey } from "../../dimensions/logicalKeys";
import {
  defaultPeriod,
  resolvePeriod,
  type DateRange,
  type PeriodPreset,
} from "../../utils/period";
import { formatCurrency } from "../../utils/currency";
import type { AnalysisViewType } from "../../api/genericAnalysisTypes";
import { Fonts, Type } from "../../theme/typography";

const VIEW_TABS: { id: AnalysisViewType; label: string }[] = [
  { id: "kpi", label: "KPI" },
  { id: "chart", label: "Chart" },
  { id: "ranking", label: "Ranking" },
  { id: "table", label: "Table" },
];

const METRIC_OPTIONS = [
  { id: "net_sales", label: "Net sales" },
  { id: "gross_profit", label: "Gross profit" },
  { id: "qty", label: "Qty" },
];

export function GenericAnalysisScreen() {
  const params = useLocalSearchParams<{
    dimension?: string;
    metric?: string;
    title?: string;
  }>();

  const permissions = useAuthStore((s) => s.permissions);
  const user = useAuthStore((s) => s.user);
  const company = resolveCompanyName(
    permissions.scope?.company,
    user?.company
  );

  const filterable = useFilterableDimensions();
  const groupableDims = useMemo(
    () =>
      filterable.filter(
        (d) =>
          d.groupable &&
          d.key !== "company" &&
          !["cost_center"].includes(d.key)
      ),
    [filterable]
  );

  const initialDimension =
    (typeof params.dimension === "string" && params.dimension) ||
    groupableDims.find((d) => d.key === "brand")?.key ||
    groupableDims[0]?.key ||
    "brand";

  const [period, setPeriod] = useState<DateRange>(() => defaultPeriod());
  const [dimension, setDimension] = useState(initialDimension);
  const [metric, setMetric] = useState(
    (typeof params.metric === "string" && params.metric) || "net_sales"
  );
  const [view, setView] = useState<AnalysisViewType>("ranking");
  const [dimFilters, setDimFilters] = useState<DimensionFilterMap>({});
  const [refreshing, setRefreshing] = useState(false);

  const title =
    (typeof params.title === "string" && params.title) ||
    `By ${humanizeDimensionKey(dimension)}`;

  const request = useMemo(
    () => ({
      company,
      from_date: period.from_date,
      to_date: period.to_date,
      period: period.preset,
      dimension,
      metric,
      filters: dimensionFiltersToParams(dimFilters) as Record<
        string,
        string | number | boolean
      >,
      limit: 50,
    }),
    [company, period, dimension, metric, dimFilters]
  );

  const { data, isLoading, error, refetch } = useGenericAnalysis(request);

  const territoryOptions = useMemo(
    () =>
      getTerritoryFilterOptions(permissions.scope).map((t) => ({
        value: t,
        label: t,
      })),
    [permissions.scope]
  );

  const currency = data?.meta.currency || "SAR";
  const rows = data?.rows || [];
  const kpis = data?.kpis || [];

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  if (isLoading && !data) {
    return <LoadingScreen message="Loading analysis…" />;
  }

  return (
    <SafeScreen style={styles.container}>
      <LinearGradient colors={["#667eea", "#4f46e5"]} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>{title}</Text>
            <Text style={styles.headerSub}>
              {humanizeDimensionKey(dimension)} · {metric.replace(/_/g, " ")}
              {data?.meta.source === "product_performance"
                ? " · legacy fallback"
                : ""}
            </Text>
          </View>
        </View>
      </LinearGradient>

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

        {/* Dimension selector */}
        <Text style={styles.sectionLabel}>Group by</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {(groupableDims.length
            ? groupableDims
            : [
                { key: "brand", label: "Brand" },
                { key: "division", label: "Division" },
                { key: "territory", label: "Territory" },
              ]
          ).map((d) => {
            const active = dimension === d.key;
            return (
              <TouchableOpacity
                key={d.key}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setDimension(d.key)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {d.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Metric selector */}
        <Text style={styles.sectionLabel}>Metric</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {METRIC_OPTIONS.map((m) => {
            const active = metric === m.id;
            return (
              <TouchableOpacity
                key={m.id}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setMetric(m.id)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {m.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <DynamicFilterBar
          value={dimFilters}
          onChange={setDimFilters}
          keys={["territory", "brand", "division", "season"].filter(
            (k) => k !== dimension
          )}
          company={company}
          staticOptions={{ territory: territoryOptions }}
          title="Filters"
        />

        {/* View tabs */}
        <View style={styles.tabRow}>
          {VIEW_TABS.map((t) => (
            <TouchableOpacity
              key={t.id}
              style={[styles.tab, view === t.id && styles.tabActive]}
              onPress={() => setView(t.id)}
            >
              <Text
                style={[styles.tabText, view === t.id && styles.tabTextActive]}
              >
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {error ? (
          <Text style={styles.error}>
            {(error as Error).message || "Failed to load analysis"}
          </Text>
        ) : null}

        {!rows.length && !isLoading ? (
          <View style={styles.emptyBox}>
            <Ionicons name="analytics-outline" size={36} color="#94a3b8" />
            <Text style={styles.emptyTitle}>No analysis data</Text>
            <Text style={styles.emptySub}>
              Generic analysis API is not on this server yet for this
              dimension, or there is no data in range.
            </Text>
          </View>
        ) : null}

        {view === "kpi" && kpis.length > 0 && (
          <View style={styles.grid}>
            {kpis.map((k) => (
              <ExecutiveKpiTile
                key={k.key}
                title={k.label}
                value={k.value}
                previous={k.previous}
                changePct={k.change_pct}
                currency={currency}
                format={k.format || "currency"}
                compact
              />
            ))}
          </View>
        )}

        {view === "chart" && (
          <AnalysisChart
            rows={rows}
            currency={currency}
            title={`${humanizeDimensionKey(dimension)} chart`}
          />
        )}

        {view === "ranking" &&
          rows.map((r, i) => (
            <RankingCard
              key={r.id}
              rank={i + 1}
              title={r.label}
              primary={formatCurrency(r.value, currency, { compact: true })}
              changePct={r.change_pct}
              metrics={
                r.secondary != null
                  ? [
                      {
                        label: "Secondary",
                        value: formatCurrency(r.secondary, currency, {
                          compact: true,
                        }),
                      },
                    ]
                  : []
              }
            />
          ))}

        {view === "table" && (
          <AnalysisTable rows={rows} currency={currency} valueLabel="Value" />
        )}
      </ScrollView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  header: {
    paddingTop: Platform.OS === "ios" ? 56 : 40,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  headerRow: { flexDirection: "row", alignItems: "center" },
  backBtn: { marginRight: 10, padding: 4 },
  headerTitle: {
    ...Type.screenTitle,
    color: "#fff",
  },
  headerSub: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: "rgba(255,255,255,0.88)",
    marginTop: 2,
    textTransform: "capitalize",
  },
  body: { padding: 16, paddingBottom: 40 },
  sectionLabel: {
    ...Type.label,
    color: "#64748b",
    textTransform: "uppercase",
    marginBottom: 8,
    marginTop: 4,
  },
  chipRow: { gap: 8, paddingRight: 8, marginBottom: 12 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginRight: 8,
  },
  chipActive: { backgroundColor: "#667eea", borderColor: "#667eea" },
  chipText: { fontFamily: Fonts.bodySemi, fontSize: 13, color: "#475569" },
  chipTextActive: { color: "#fff" },
  tabRow: {
    flexDirection: "row",
    backgroundColor: "#e2e8f0",
    borderRadius: 12,
    padding: 4,
    marginBottom: 14,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 10,
  },
  tabActive: { backgroundColor: "#fff" },
  tabText: { fontFamily: Fonts.bodySemi, fontSize: 12, color: "#64748b" },
  tabTextActive: { color: "#4f46e5" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12 },
  error: { color: "#dc2626", marginBottom: 12, fontFamily: Fonts.body },
  emptyBox: {
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    marginTop: 10,
    fontFamily: Fonts.bodyBold,
    fontSize: 16,
    color: "#334155",
  },
  emptySub: {
    marginTop: 6,
    textAlign: "center",
    fontFamily: Fonts.body,
    fontSize: 13,
    color: "#64748b",
    lineHeight: 18,
  },
});

export default GenericAnalysisScreen;
