import React, { useMemo, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from "react-native";
import { useBootstrapStore } from "../../store/bootstrap";
import { useDashboardScope } from "../../hooks/useDashboardScope";
import { SafeScreen } from "../../components/SafeScreen";
import { ReceivablesAppBar } from "../../components/receivables/ReceivablesAppBar";
import { ReceivablesFilterBar } from "../../components/receivables/ReceivablesFilterBar";
import type {
  CompareMode,
  ReceivablesFilterBarHandle,
} from "../../components/receivables/ReceivablesFilterBar";
import { KpiRowGrid } from "../../components/receivables/KpiRowGrid";
import { ReceivablesTerritoryBarChart } from "../../components/receivables/ReceivablesTerritoryBarChart";
import { partitionReceivablesTerritoryKpis } from "../../utils/receivablesTerritoryBreakdown";
import {
  ReceivablesWidgetBlock,
  ReceivablesTrendChart,
} from "../../components/receivables/ReceivablesWidgetBlock";
import { HorizontalAgingBar } from "../../components/receivables/HorizontalAgingBar";
import { OverdueRankingList } from "../../components/receivables/OverdueRankingList";
import { AttentionAlertList } from "../../components/receivables/AttentionAlertList";
import { ReceivablesSectionHeader } from "../../components/receivables/ReceivablesSectionHeader";
import {
  buildReceivablesSections,
  partitionReceivablesLayout,
} from "./buildReceivablesSections";
import { useReceivablesBoardWidgets } from "./useReceivablesBoardWidgets";
import { useDashboardFreshness } from "../../hooks/useDashboardFreshness";
import { DashboardFreshnessFooter } from "../../components/dashboard/DashboardFreshnessFooter";
import { DashboardRefreshBanner } from "../../components/dashboard/DashboardRefreshBanner";
import { DashboardRefreshControl } from "../../components/dashboard/DashboardRefreshControl";
import { useDashboardPullRefresh } from "../../hooks/useDashboardPullRefresh";
import { resolvePeriod, type PeriodPreset } from "../../utils/period";
import { RECEIVABLES, formatDateRangeLabel } from "./receivablesTheme";
import { Fonts } from "../../theme/typography";
import { useAuthStore } from "../../store/auth";
import { DashboardLoadingPanel } from "../../components/dashboard/DashboardLoadingPanel";
import { resolveDashboardLoadState } from "../../utils/dashboardLoadState";
import { ALL_TERRITORIES } from "../../utils/dashboardTerritory";

type Props = {
  title?: string;
  subtitle?: string;
};

export function ReceivablesDashboardScreen({ title, subtitle }: Props) {
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
  const [compareMode, setCompareMode] = useState<CompareMode>("ly");
  const filterBarRef = useRef<ReceivablesFilterBarHandle>(null);

  const period = useMemo(
    () => resolvePeriod(periodPreset),
    [periodPreset]
  );
  const showLy = compareMode === "ly";

  const listScope = useMemo(
    () => ({
      company,
      from_date: period.from_date,
      to_date: period.to_date,
      period: period.preset,
      selectedTerritory,
    }),
    [company, period, selectedTerritory]
  );

  const { widgetDefs, widgetMap, isLoading, isFetching, refreshBoard, cachedAt, dataUpdatedAt, fallbackQueries, isOffline } =
    useReceivablesBoardWidgets({
      company,
      from_date: period.from_date,
      to_date: period.to_date,
      period: period.preset,
      show_ly: showLy,
      filters,
    });

  const freshness = useDashboardFreshness(
    { isFetching, dataUpdatedAt, cachedAt, offline: isOffline },
    { fallbackQueries }
  );

  const layout = useMemo(() => {
    const sections = buildReceivablesSections(widgetDefs, widgetMap);
    return partitionReceivablesLayout(sections);
  }, [widgetDefs, widgetMap]);

  const permissionsScope = useAuthStore((s) => s.permissions.scope);

  const overviewSplit = useMemo(
    () =>
      partitionReceivablesTerritoryKpis(
        layout.overviewKpis,
        permissionsScope
      ),
    [layout.overviewKpis, permissionsScope]
  );

  const showTerritoryReceivablesBar =
    overviewSplit.territoryPoints.length >= 2 &&
    (!selectedTerritory || selectedTerritory === ALL_TERRITORIES);

  const overviewKpiGridItems = showTerritoryReceivablesBar
    ? overviewSplit.otherKpis
    : layout.overviewKpis;

  const mod = bootstrap?.modules?.find(
    (m) => m.key === "receivables" || m.route_key === "receivables"
  );
  const screenTitle =
    title ||
    mod?.label ||
    bootstrap?.dashboards?.find((b) => b.key === "receivables_overview")
      ?.title ||
    "Receivables Dashboard";
  const screenSubtitle =
    subtitle || `${companyShort} • ${businessType}`;

  const dateRangeLabel = formatDateRangeLabel(
    period.from_date,
    period.to_date
  );

  const { refreshing, onRefresh } = useDashboardPullRefresh(refreshBoard);

  const hasContent =
    layout.overviewKpis.length > 0 ||
    layout.collectionKpis.length > 0 ||
    layout.aging ||
    layout.trend ||
    layout.ranking ||
    layout.customerAdvancesRanking ||
    layout.attention;

  const loadState = resolveDashboardLoadState(
    {
      companyReady,
      accessProfileLoaded,
      isLoading,
      isFetching,
      hasContent,
    },
    {
      boardName: "receivables dashboard",
      emptyHint: "No receivables widgets",
    }
  );

  return (
    <SafeScreen aboveTabBar includeTop={false} style={styles.container}>
      <ReceivablesAppBar
        title={screenTitle}
        subtitle={screenSubtitle}
        onFilterPress={() => filterBarRef.current?.openPeriodPicker()}
      />

      <View style={styles.filters}>
        <ReceivablesFilterBar
          ref={filterBarRef}
          territories={territoryOptions}
          selectedTerritory={selectedTerritory}
          periodPreset={periodPreset}
          compareMode={compareMode}
          onPeriodChange={setPeriodPreset}
          onCompareChange={setCompareMode}
          onTerritoryChange={setSelectedTerritory}
        />
      </View>

      {refreshing ? (
        <DashboardRefreshBanner tintColor={RECEIVABLES.link} />
      ) : null}

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <DashboardRefreshControl
            refreshing={refreshing || isFetching}
            onRefresh={onRefresh}
            tintColor={RECEIVABLES.link}
          />
        }
      >
        {loadState.showLoading ? (
          <DashboardLoadingPanel
            title={loadState.title}
            subtitle={loadState.subtitle}
            tintColor={RECEIVABLES.link}
          />
        ) : null}

        {loadState.showEmpty ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{loadState.title}</Text>
            <Text style={styles.emptySub}>{loadState.subtitle}</Text>
          </View>
        ) : null}

        {!loadState.showLoading && overviewKpiGridItems.length > 0 ? (
          <KpiRowGrid
            items={overviewKpiGridItems}
            variant="overview"
            showLy={showLy}
            listScope={listScope}
          />
        ) : null}

        {!loadState.showLoading && showTerritoryReceivablesBar ? (
          <ReceivablesTerritoryBarChart
            points={overviewSplit.territoryPoints}
            currency={
              layout.overviewKpis[0]?.payload.currency ||
              layout.overviewKpis[0]?.payload.meta?.currency ||
              "SAR"
            }
            listScope={listScope}
          />
        ) : null}

        {layout.aging ? (
          <HorizontalAgingBar
            payload={layout.aging.payload}
            title={layout.aging.label || "Receivables Aging (SAR)"}
            listScope={listScope}
          />
        ) : null}

        {layout.trend ? <ReceivablesTrendChart entry={layout.trend} /> : null}

        {layout.collectionKpis.length > 0 ? (
          <View style={styles.section}>
            <ReceivablesSectionHeader
              title="Collection Summary"
              subtitle={dateRangeLabel}
            />
            <KpiRowGrid
              items={layout.collectionKpis}
              variant="collection"
              showLy={showLy}
            />
          </View>
        ) : null}

        {layout.ranking ||
        layout.customerAdvancesRanking ||
        layout.attention ? (
          <View style={styles.bottomStack}>
            {layout.ranking ? (
              <OverdueRankingList
                payload={layout.ranking.payload}
                title={layout.ranking.label || "Top 5 Overdue Customers"}
                widgetKey={layout.ranking.key}
                listScope={listScope}
              />
            ) : null}
            {layout.customerAdvancesRanking ? (
              <OverdueRankingList
                payload={layout.customerAdvancesRanking.payload}
                title={
                  layout.customerAdvancesRanking.label || "Customer Advances"
                }
                widgetKey={layout.customerAdvancesRanking.key}
                listScope={listScope}
              />
            ) : null}
            {layout.attention ? (
              <AttentionAlertList
                payload={layout.attention.payload}
                title={layout.attention.label || "Attention Required"}
                widgetKey={layout.attention.key}
                listScope={listScope}
              />
            ) : null}
          </View>
        ) : null}

        {layout.otherBlocks.map((block) => (
          <ReceivablesWidgetBlock
            key={block.key}
            entry={block}
            listScope={listScope}
          />
        ))}

        {!loadState.showLoading && (refreshing || freshness.label) ? (
          <DashboardFreshnessFooter
            label={
              refreshing ? "Refreshing dashboard…" : (freshness.label ?? "")
            }
            isFetching={refreshing || freshness.isFetching}
            tintColor={RECEIVABLES.link}
            subtitleColor={RECEIVABLES.subtitle}
          />
        ) : null}
      </ScrollView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: RECEIVABLES.bg,
  },
  filters: {
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 2,
    backgroundColor: RECEIVABLES.bg,
  },
  body: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 96,
  },
  section: {
    marginTop: 4,
    marginBottom: 4,
  },
  bottomStack: {
    gap: 12,
    marginBottom: 12,
  },
  loading: {
    alignItems: "center",
    paddingVertical: 48,
    gap: 12,
  },
  loadingText: {
    color: RECEIVABLES.subtitle,
    fontSize: 14,
    fontFamily: Fonts.body,
  },
  empty: {
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 15,
    fontFamily: Fonts.bodySemi,
    color: RECEIVABLES.subtitle,
  },
  emptySub: {
    marginTop: 8,
    fontSize: 13,
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: 19,
    fontFamily: Fonts.body,
  },
  loadingFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
  },
  loadingFooterText: {
    fontSize: 12,
    color: RECEIVABLES.subtitle,
    fontFamily: Fonts.body,
  },
});
