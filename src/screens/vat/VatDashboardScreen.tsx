import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useBootstrapStore } from "../../store/bootstrap";
import { useAuthStore } from "../../store/auth";
import { SafeScreen, systemStatusBarClearance } from "../../components/SafeScreen";
import { ScreenHeaderNav } from "../../components/ScreenHeaderNav";
import {
  DashboardFilterBar,
  type DashboardFilterBarHandle,
} from "../../components/dashboard/DashboardFilterBar";
import { useDashboardScope } from "../../hooks/useDashboardScope";
import { resolvePeriod, type PeriodPreset } from "../../utils/period";
import { useVatDashboard } from "../../hooks/useVatDashboard";
import type { VatDrillBucket, VatDocumentRow } from "../../api/vatTypes";
import { VAT, formatVatAmount } from "./vatTheme";
import { registerVatDrillBuckets } from "./vatDrillStore";
import { VatTrendChart } from "./VatTrendChart";
import { ALL_TERRITORIES } from "../../utils/dashboardTerritory";
import { Fonts } from "../../theme/typography";
import { DashboardLoadingPanel } from "../../components/dashboard/DashboardLoadingPanel";

type Props = {
  title?: string;
  subtitle?: string;
};

function VatBucketCard({
  bucket,
  accent,
  onPress,
}: {
  bucket: VatDrillBucket;
  accent: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.bucketCard}
      activeOpacity={0.85}
      onPress={onPress}
    >
      <View style={[styles.bucketAccent, { backgroundColor: accent }]} />
      <View style={styles.bucketBody}>
        <Text style={styles.bucketTitle}>{bucket.title}</Text>
        {bucket.subtitle ? (
          <Text style={styles.bucketSub}>{bucket.subtitle}</Text>
        ) : null}
        <View style={styles.bucketRow}>
          <Text style={[styles.bucketAmount, { color: accent }]}>
            {formatVatAmount(bucket.vat_amount)}
          </Text>
          {bucket.count != null ? (
            <Text style={styles.bucketCount}>{bucket.count} doc(s)</Text>
          ) : null}
        </View>
        <Text style={styles.bucketTap}>View detail →</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={VAT.muted} />
    </TouchableOpacity>
  );
}

function SummaryTile({
  label,
  value,
  color,
  hint,
  onPress,
}: {
  label: string;
  value: string;
  color: string;
  hint?: string;
  onPress?: () => void;
}) {
  const inner = (
    <>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, { color }]}>{value}</Text>
      {hint ? <Text style={styles.summaryHint}>{hint}</Text> : null}
      {onPress ? <Text style={styles.bucketTap}>View detail →</Text> : null}
    </>
  );
  if (!onPress) {
    return <View style={styles.summaryTile}>{inner}</View>;
  }
  return (
    <TouchableOpacity
      style={styles.summaryTile}
      activeOpacity={0.85}
      onPress={onPress}
    >
      {inner}
    </TouchableOpacity>
  );
}

function aggregateSectionBucket(
  section: "output" | "input",
  categories: VatDrillBucket[],
  total: number,
  title: string,
  subtitle: string
): VatDrillBucket {
  const documents: VatDocumentRow[] = [];
  for (const c of categories) {
    for (const d of c.documents) {
      if (!documents.some((x) => x.id === d.id && x.name === d.name)) {
        documents.push(d);
      }
    }
  }
  const count =
    categories.reduce((s, c) => s + (c.count ?? c.documents.length), 0) ||
    documents.length ||
    undefined;
  return {
    key: `section.${section}`,
    title,
    subtitle,
    section,
    vat_amount: total,
    count,
    documents,
  };
}

function isSalesNotSubmitted(bucket: VatDrillBucket) {
  return bucket.key.startsWith("not_submitted.sales.");
}

function isPurchaseNotSubmitted(bucket: VatDrillBucket) {
  return bucket.key.startsWith("not_submitted.purchase.");
}

export function VatDashboardScreen({ title, subtitle }: Props) {
  const insets = useSafeAreaInsets();
  const bootstrap = useBootstrapStore((s) => s.bootstrap);
  const accessProfileLoaded = useAuthStore((s) => s.permissions.fetched);
  const {
    company,
    companyReady,
    companyShort,
    businessType,
    territoryOptions,
    selectedTerritory,
    setSelectedTerritory,
    filters,
  } = useDashboardScope();

  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("ytd");
  const [refreshing, setRefreshing] = useState(false);
  const filterBarRef = useRef<DashboardFilterBarHandle>(null);

  const period = useMemo(() => resolvePeriod(periodPreset), [periodPreset]);

  const territoryParam = useMemo(() => {
    const t = filters?.territory;
    if (Array.isArray(t) && t.length === 1) return String(t[0]);
    if (selectedTerritory && selectedTerritory !== ALL_TERRITORIES) {
      return selectedTerritory;
    }
    return undefined;
  }, [filters, selectedTerritory]);

  const apiPeriod =
    period.preset === "today" ||
    period.preset === "mtd" ||
    period.preset === "ytd"
      ? period.preset
      : "custom";

  const { data, isLoading, isFetching, isError, error, refetch } =
    useVatDashboard(
      {
        company,
        period: apiPeriod,
        from_date: period.from_date,
        to_date: period.to_date,
        territory: territoryParam,
      },
      companyReady && accessProfileLoaded
    );

  const screenTitle =
    title ||
    bootstrap?.modules?.find(
      (m) =>
        m.key === "vat" ||
        m.key === "vat_overview" ||
        m.route_key === "vat_overview"
    )?.label ||
    bootstrap?.dashboards?.find((b) => b.key === "vat_overview")?.title ||
    "VAT Report";

  const screenSubtitle =
    subtitle ||
    `${companyShort} • ${businessType} • ${period.label}`;

  const allBuckets = useMemo(() => {
    if (!data) return [];
    return [
      ...data.output_categories,
      ...data.input_categories,
      ...data.not_submitted,
    ];
  }, [data]);

  const drillQueryParams = useMemo(
    () => ({
      company,
      period: apiPeriod,
      from_date: period.from_date,
      to_date: period.to_date,
      territory: territoryParam,
    }),
    [
      company,
      apiPeriod,
      period.from_date,
      period.to_date,
      territoryParam,
    ]
  );

  const openBucket = useCallback(
    (bucket: VatDrillBucket, extraBuckets: VatDrillBucket[] = []) => {
      registerVatDrillBuckets(
        [...allBuckets, ...extraBuckets],
        drillQueryParams
      );
      router.push({
        pathname: "/(tabs)/vat-detail",
        params: {
          bucketKey: bucket.key,
          title: bucket.title,
          currency: data?.currency || "SAR",
        },
      });
    },
    [allBuckets, data?.currency, drillQueryParams]
  );

  const openSection = useCallback(
    (section: "output" | "input") => {
      if (!data) return;
      const categories =
        section === "output" ? data.output_categories : data.input_categories;
      const total =
        section === "output" ? data.output_vat_total : data.input_vat_total;
      const bucket = aggregateSectionBucket(
        section,
        categories,
        total,
        section === "output" ? "Output VAT (submitted)" : "Input VAT (submitted)",
        section === "output"
          ? "All ZATCA sales categories in period"
          : "All purchase categories — company-wide"
      );
      openBucket(bucket, [bucket]);
    },
    [data, openBucket]
  );

  const notSubmittedSales = useMemo(
    () => (data?.not_submitted ?? []).filter(isSalesNotSubmitted),
    [data?.not_submitted]
  );
  const notSubmittedPurchase = useMemo(
    () => (data?.not_submitted ?? []).filter(isPurchaseNotSubmitted),
    [data?.not_submitted]
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  const currency = data?.currency || "SAR";
  const loading = !companyReady || !accessProfileLoaded || isLoading;

  return (
    <SafeScreen aboveTabBar includeTop={false} style={styles.container}>
      <View
        style={[
          styles.appBar,
          {
            paddingTop: systemStatusBarClearance(
              insets.top,
              Platform.OS === "ios" ? 8 : 6
            ),
          },
        ]}
      >
        <View style={styles.appBarRow}>
          <ScreenHeaderNav
            color={VAT.title}
            buttonBackground="#f1f5f9"
            showHome={false}
          />
          <View style={styles.appBarText}>
            <Text style={styles.appBarTitle} numberOfLines={1}>
              {screenTitle}
            </Text>
            <Text style={styles.appBarSub} numberOfLines={2}>
              {screenSubtitle}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.filters}>
        <DashboardFilterBar
          ref={filterBarRef}
          theme={{
            card: VAT.card,
            border: VAT.border,
            title: VAT.title,
            subtitle: VAT.subtitle,
          }}
          territories={territoryOptions}
          selectedTerritory={selectedTerritory}
          periodPreset={periodPreset}
          compareMode="none"
          onPeriodChange={setPeriodPreset}
          onCompareChange={() => {}}
          onTerritoryChange={setSelectedTerritory}
          onRefresh={() => void onRefresh()}
          refreshing={refreshing || isFetching}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={VAT.link}
          />
        }
      >
        {loading ? (
          <DashboardLoadingPanel
            title="Loading VAT report"
            subtitle="Submitted and not-submitted buckets"
            tintColor={VAT.link}
          />
        ) : null}

        {isError && !data ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Could not load VAT report</Text>
            <Text style={styles.emptySub}>
              {(error as Error)?.message ||
                "Check Access Profile for erp_analysis.tax.get_vat_dashboard"}
            </Text>
          </View>
        ) : null}

        {data ? (
          <>
            <View style={styles.noteCard}>
              <Ionicons name="information-circle-outline" size={18} color={VAT.subtitle} />
              <Text style={styles.noteText}>
                Output VAT follows sales territory scope. Input VAT is company-wide
                for the period (Purchase Invoice has no territory).
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <SummaryTile
                label="Sales VAT"
                value={formatVatAmount(data.output_vat_total, currency)}
                color={VAT.output}
                hint="Output · submitted"
                onPress={() => openSection("output")}
              />
              <SummaryTile
                label="Purchase VAT"
                value={formatVatAmount(data.input_vat_total, currency)}
                color={VAT.input}
                hint="Input · submitted"
                onPress={() => openSection("input")}
              />
            </View>

            <View style={[styles.netCard, { borderColor: VAT.net }]}>
              <Text style={styles.netLabel}>VAT payable (submitted)</Text>
              <Text style={[styles.netValue, { color: VAT.net }]}>
                {formatVatAmount(data.net_vat_due, currency)}
              </Text>
              <Text style={styles.netDates}>
                {data.from_date || period.from_date} – {data.to_date || period.to_date}
              </Text>
            </View>

            {data.monthly_trend ? (
              <VatTrendChart
                trend={data.monthly_trend}
                currency={currency}
                scopeHint={
                  territoryParam
                    ? `Output VAT for ${territoryParam}; input VAT is company-wide. Month totals match your period filter.`
                    : "Output VAT by sales territory scope; input VAT company-wide. Month totals match your period filter."
                }
              />
            ) : null}

            <Text style={styles.sectionTitle}>Output VAT — by category</Text>
            {data.output_categories.length === 0 ? (
              <Text style={styles.sectionEmpty}>No submitted sales VAT in range.</Text>
            ) : (
              data.output_categories.map((b) => (
                <VatBucketCard
                  key={b.key}
                  bucket={b}
                  accent={VAT.output}
                  onPress={() => openBucket(b)}
                />
              ))
            )}

            <Text style={styles.sectionTitle}>Input VAT — by category</Text>
            {data.input_categories.length === 0 ? (
              <Text style={styles.sectionEmpty}>No submitted purchase VAT in range.</Text>
            ) : (
              data.input_categories.map((b) => (
                <VatBucketCard
                  key={b.key}
                  bucket={b}
                  accent={VAT.input}
                  onPress={() => openBucket(b)}
                />
              ))
            )}

            <Text style={styles.sectionTitle}>Not submitted</Text>
            <Text style={styles.sectionHint}>
              Excluded from filing totals — tap a card for invoice detail.
            </Text>
            {data.not_submitted.length === 0 ? (
              <Text style={styles.sectionEmpty}>No draft or pending buckets.</Text>
            ) : (
              <>
                {notSubmittedSales.length > 0 ? (
                  <>
                    <Text style={styles.subSectionTitle}>Sales</Text>
                    <Text style={styles.subSectionHint}>
                      Territory-scoped when a territory filter is applied.
                    </Text>
                    {notSubmittedSales.map((b) => (
                      <VatBucketCard
                        key={b.key}
                        bucket={b}
                        accent={VAT.warning}
                        onPress={() => openBucket(b)}
                      />
                    ))}
                  </>
                ) : null}
                {notSubmittedPurchase.length > 0 ? (
                  <>
                    <Text style={styles.subSectionTitle}>Purchase</Text>
                    <Text style={styles.subSectionHint}>
                      Company-wide (no territory on Purchase Invoice).
                    </Text>
                    {notSubmittedPurchase.map((b) => (
                      <VatBucketCard
                        key={b.key}
                        bucket={b}
                        accent={VAT.warning}
                        onPress={() => openBucket(b)}
                      />
                    ))}
                  </>
                ) : null}
              </>
            )}
          </>
        ) : null}
      </ScrollView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  appBar: {
    backgroundColor: VAT.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: VAT.border,
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  appBarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  appBarText: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 4,
  },
  appBarTitle: {
    fontFamily: Fonts.bodyBold,
    fontSize: 17,
    color: VAT.title,
    letterSpacing: -0.2,
  },
  appBarSub: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: VAT.subtitle,
    marginTop: 1,
  },
  filters: { paddingHorizontal: 12, paddingTop: 8 },
  body: { padding: 12, paddingBottom: 32 },
  noteCard: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#f1f5f9",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  noteText: {
    flex: 1,
    fontSize: 13,
    color: VAT.subtitle,
    lineHeight: 18,
  },
  summaryRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  summaryTile: {
    flex: 1,
    backgroundColor: VAT.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: VAT.border,
  },
  summaryLabel: {
    fontSize: 12,
    color: VAT.subtitle,
    fontWeight: "600",
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: "800",
    marginTop: 6,
  },
  summaryHint: {
    fontSize: 11,
    color: VAT.muted,
    marginTop: 4,
  },
  netCard: {
    backgroundColor: VAT.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 2,
    marginBottom: 20,
  },
  netLabel: {
    fontSize: 13,
    color: VAT.subtitle,
    fontWeight: "600",
  },
  netValue: {
    fontSize: 28,
    fontWeight: "800",
    marginTop: 6,
  },
  netDates: {
    fontSize: 12,
    color: VAT.muted,
    marginTop: 6,
  },
  sectionTitle: {
    fontFamily: Fonts.bodySemi,
    fontSize: 16,
    color: VAT.title,
    marginBottom: 8,
    marginTop: 4,
  },
  sectionHint: {
    fontSize: 12,
    color: VAT.subtitle,
    marginBottom: 10,
  },
  subSectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: VAT.title,
    marginBottom: 4,
    marginTop: 8,
  },
  subSectionHint: {
    fontSize: 11,
    color: VAT.muted,
    marginBottom: 8,
  },
  sectionEmpty: {
    fontSize: 13,
    color: VAT.muted,
    marginBottom: 16,
    fontStyle: "italic",
  },
  bucketCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: VAT.card,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: VAT.border,
    overflow: "hidden",
  },
  bucketAccent: { width: 4, alignSelf: "stretch" },
  bucketBody: { flex: 1, padding: 14 },
  bucketTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: VAT.title,
  },
  bucketSub: {
    fontSize: 11,
    color: VAT.muted,
    marginTop: 4,
  },
  bucketRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 10,
    marginTop: 8,
  },
  bucketAmount: {
    fontSize: 17,
    fontWeight: "800",
  },
  bucketCount: {
    fontSize: 12,
    color: VAT.subtitle,
  },
  bucketTap: {
    fontSize: 12,
    color: VAT.link,
    marginTop: 6,
    fontWeight: "600",
  },
  empty: { padding: 24, alignItems: "center" },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: VAT.title,
  },
  emptySub: {
    fontSize: 13,
    color: VAT.subtitle,
    textAlign: "center",
    marginTop: 8,
  },
});
