import React, {
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from "react-native";
import { useBootstrapStore } from "../../store/bootstrap";
import { useAuthStore } from "../../store/auth";
import { getViewTerritories } from "../../api/accessScope";
import { useDashboardScope } from "../../hooks/useDashboardScope";
import { SafeScreen } from "../../components/SafeScreen";
import { SalesAppBar } from "../../components/sales/SalesAppBar";
import { SalesFilterBar } from "../../components/sales/SalesFilterBar";
import type {
  CompareMode,
  SalesFilterBarHandle,
} from "../../components/sales/SalesFilterBar";
import { SalesKpiRowGrid } from "../../components/sales/SalesKpiRowGrid";
import { SalesTrendChart } from "../../components/sales/SalesTrendChart";
import { SalesByTabs } from "../../components/sales/SalesByTabs";
import { ManagementAttentionStrip } from "../../components/sales/ManagementAttentionStrip";
import { SalesWidgetBlock } from "../../components/sales/SalesWidgetBlock";
import { buildSalesLayout } from "./buildSalesSections";
import { useSalesBoardWidgets } from "./useSalesBoardWidgets";
import { useDashboardFreshness } from "../../hooks/useDashboardFreshness";
import { DashboardFreshnessFooter } from "../../components/dashboard/DashboardFreshnessFooter";
import { resolvePeriod, type PeriodPreset } from "../../utils/period";
import { ALL_TERRITORIES } from "../../utils/dashboardTerritory";
import { SALES } from "./salesTheme";
import { Fonts } from "../../theme/typography";
import { useOpenSalesOrdersKpiReconcile } from "../../hooks/useOpenSalesOrdersKpiReconcile";
import { isOpenSalesOrdersKpiWidget } from "../../utils/openSalesOrdersKpi";
import { DashboardLoadingPanel } from "../../components/dashboard/DashboardLoadingPanel";
import { resolveDashboardLoadState } from "../../utils/dashboardLoadState";

type Props = {
  title?: string;
  subtitle?: string;
};

export function SalesDashboardScreen({ title, subtitle }: Props) {
  const bootstrap = useBootstrapStore((s) => s.bootstrap);
  const accessScope = useAuthStore((s) => s.permissions.scope);
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
    viewAllSalesRequest,
  } = useDashboardScope();
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("ytd");
  const [compareMode, setCompareMode] = useState<CompareMode>("ly");
  const [refreshing, setRefreshing] = useState(false);
  const filterBarRef = useRef<SalesFilterBarHandle>(null);

  const period = useMemo(() => resolvePeriod(periodPreset), [periodPreset]);
  const showLy = compareMode === "ly";

  const { widgetDefs, widgetMap, isLoading, isFetching, refreshBoard, cachedAt, dataUpdatedAt, fallbackQueries, isOffline } =
    useSalesBoardWidgets({
      company,
      companyReady,
      from_date: period.from_date,
      to_date: period.to_date,
      period: period.preset,
      show_ly: showLy,
      filters,
      view_all_sales: viewAllSalesRequest ? 1 : undefined,
    });

  const freshness = useDashboardFreshness(
    { isFetching, dataUpdatedAt, cachedAt, offline: isOffline },
    { fallbackQueries }
  );

  const layout = useMemo(
    () => buildSalesLayout(widgetDefs, widgetMap),
    [widgetDefs, widgetMap]
  );

  const hasOpenSoKpi = useMemo(
    () =>
      layout.overviewKpis.some((i) =>
        isOpenSalesOrdersKpiWidget(i.key, i.label)
      ),
    [layout.overviewKpis]
  );

  const { data: openSoKpiReconcile, isLoading: openSoKpiLoading } =
    useOpenSalesOrdersKpiReconcile({
      enabled: hasOpenSoKpi && companyReady,
      company,
      from_date: period.from_date,
      to_date: period.to_date,
      period: period.preset,
      filters,
      view_all_sales: viewAllSalesRequest ? 1 : undefined,
    });

  const kpiListScope = useMemo(
    () => ({
      company,
      from_date: period.from_date,
      to_date: period.to_date,
      period: period.preset,
      selectedTerritory,
      view_all_sales: viewAllSalesRequest ? (1 as const) : undefined,
    }),
    [
      company,
      period.from_date,
      period.to_date,
      period.preset,
      selectedTerritory,
      viewAllSalesRequest,
    ]
  );

  const salesByScope = useMemo(
    () => ({
      company,
      from_date: period.from_date,
      to_date: period.to_date,
      period: period.preset,
      territory:
        selectedTerritory && selectedTerritory !== ALL_TERRITORIES
          ? selectedTerritory
          : undefined,
      viewTerritories: getViewTerritories(accessScope),
      allowViewAllSales: Boolean(accessScope?.allow_view_all_sales),
      viewAllSalesRequest,
    }),
    [
      company,
      period.from_date,
      period.to_date,
      period.preset,
      selectedTerritory,
      accessScope,
      viewAllSalesRequest,
    ]
  );

  const mod = bootstrap?.modules?.find(
    (m) =>
      m.key === "sales_overview" ||
      m.route_key === "sales_overview" ||
      m.key === "sales"
  );
  const screenTitle =
    title ||
    mod?.label ||
    bootstrap?.dashboards?.find((b) => b.key === "sales_overview")?.title ||
    "Sales Dashboard";
  const screenSubtitle =
    subtitle || `${companyShort} • ${businessType}`;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshBoard();
    } finally {
      setRefreshing(false);
    }
  }, [refreshBoard]);

  const hasContent =
    layout.overviewKpis.length > 0 ||
    layout.trend ||
    layout.salesBy.length > 0 ||
    layout.attention ||
    layout.otherBlocks.length > 0;

  const loadState = resolveDashboardLoadState(
    {
      companyReady,
      accessProfileLoaded,
      isLoading,
      isFetching,
      hasContent,
    },
    {
      boardName: "sales dashboard",
      emptyHint: "No sales widgets",
    }
  );

  return (
    <SafeScreen aboveTabBar includeTop={false} style={styles.container}>
      <SalesAppBar
        title={screenTitle}
        subtitle={screenSubtitle}
        onFilterPress={() => filterBarRef.current?.openPeriodPicker()}
      />

      <View style={styles.filters}>
        <SalesFilterBar
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

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={SALES.link}
          />
        }
      >
        {loadState.showLoading ? (
          <DashboardLoadingPanel
            title={loadState.title}
            subtitle={loadState.subtitle}
            tintColor={SALES.link}
          />
        ) : null}

        {loadState.showEmpty ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{loadState.title}</Text>
            <Text style={styles.emptySub}>{loadState.subtitle}</Text>
          </View>
        ) : null}

        {!loadState.showLoading && layout.overviewKpis.length > 0 ? (
          <SalesKpiRowGrid
            items={layout.overviewKpis}
            showLy={showLy}
            listScope={kpiListScope}
            openSoKpi={openSoKpiReconcile}
            openSoKpiLoading={openSoKpiLoading}
          />
        ) : null}

        {layout.trend ? <SalesTrendChart entry={layout.trend} /> : null}

        {layout.salesBy.length > 0 ? (
          <SalesByTabs
            entries={layout.salesBy}
            scope={salesByScope}
            showLy={showLy}
          />
        ) : null}

        {layout.attention ? (
          <ManagementAttentionStrip entry={layout.attention} />
        ) : null}

        {layout.otherBlocks.map((block) => (
          <SalesWidgetBlock
            key={block.key}
            entry={block}
            showLy={showLy}
            salesByScope={salesByScope}
          />
        ))}

        {!loadState.showLoading && freshness.label ? (
          <DashboardFreshnessFooter
            label={freshness.label}
            isFetching={freshness.isFetching}
            tintColor={SALES.link}
            subtitleColor={SALES.subtitle}
          />
        ) : null}
      </ScrollView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SALES.bg,
  },
  filters: {
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 2,
    backgroundColor: SALES.bg,
  },
  body: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 96,
  },
  loading: {
    alignItems: "center",
    paddingVertical: 48,
    gap: 12,
  },
  loadingText: {
    color: SALES.subtitle,
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
    color: SALES.subtitle,
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
    color: SALES.subtitle,
    fontFamily: Fonts.body,
  },
});
