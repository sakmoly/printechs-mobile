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
import { useDashboardScope } from "../../hooks/useDashboardScope";
import { SafeScreen } from "../../components/SafeScreen";
import { HomeAppBar } from "../../components/home/HomeAppBar";
import { HomeFilterBar } from "../../components/home/HomeFilterBar";
import type {
  CompareMode,
  HomeFilterBarHandle,
} from "../../components/home/HomeFilterBar";
import {
  HomeKpiRowGrid,
  HomeKeyIndicatorsStrip,
} from "../../components/home/HomeKpiRowGrid";
import { HomeSectionHeader } from "../../components/home/HomeSectionHeader";
import { HomeHealthGauges } from "../../components/home/HomeHealthGauges";
import { HomeTrendOverviewChart } from "../../components/home/HomeTrendOverviewChart";
import { HomeQuickInsights } from "../../components/home/HomeQuickInsights";
import { HomeRecentActivities } from "../../components/home/HomeRecentActivities";
import { buildHomeLayout } from "./buildHomeSections";
import { useHomeBoardWidgets } from "./useHomeBoardWidgets";
import { useDashboardFreshness } from "../../hooks/useDashboardFreshness";
import { DashboardFreshnessFooter } from "../../components/dashboard/DashboardFreshnessFooter";
import { resolvePeriod, type PeriodPreset } from "../../utils/period";
import { HOME } from "./homeTheme";
import { Fonts } from "../../theme/typography";
import { navigateToModule } from "../../modules/navigateToModule";
import { useAuthStore } from "../../store/auth";
import { DashboardLoadingPanel } from "../../components/dashboard/DashboardLoadingPanel";
import { resolveDashboardLoadState } from "../../utils/dashboardLoadState";

type Props = {
  title?: string;
  subtitle?: string;
  notificationCount?: number;
  onRefreshExtra?: () => Promise<void>;
};

export function HomeDashboardScreen({
  title,
  subtitle,
  notificationCount = 0,
  onRefreshExtra,
}: Props) {
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
    viewAllSalesRequest,
  } = useDashboardScope();
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("ytd");
  const [compareMode, setCompareMode] = useState<CompareMode>("ly");
  const [refreshing, setRefreshing] = useState(false);
  const filterBarRef = useRef<HomeFilterBarHandle>(null);

  const period = useMemo(() => resolvePeriod(periodPreset), [periodPreset]);
  const showLy = compareMode === "ly";

  const { widgetDefs, widgetMap, isLoading, isFetching, refreshBoard, cachedAt, dataUpdatedAt, fallbackQueries, isOffline } =
    useHomeBoardWidgets({
      company,
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
    () =>
      buildHomeLayout(widgetDefs, widgetMap, {
        selectedTerritory,
      }),
    [widgetDefs, widgetMap, selectedTerritory]
  );

  const businessKpiSections = useMemo(() => {
    const groups = new Map<string, typeof layout.businessKpis>();
    for (const item of layout.businessKpis) {
      const title = item.sectionTitle?.trim() || "Business Overview";
      const list = groups.get(title) || [];
      list.push(item);
      groups.set(title, list);
    }
    return [...groups.entries()].map(([title, items]) => ({ title, items }));
  }, [layout.businessKpis]);

  const screenTitle =
    title ||
    bootstrap?.dashboards?.find((b) => b.key === "home")?.title ||
    "Home Dashboard";
  const screenSubtitle = subtitle || `${companyShort} • ${businessType}`;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refreshBoard(),
        onRefreshExtra?.() ?? Promise.resolve(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [refreshBoard, onRefreshExtra]);

  const hasContent =
    layout.businessKpis.length > 0 ||
    layout.keyIndicators.length > 0 ||
    layout.healthGauges.length > 0 ||
    layout.trend ||
    layout.quickInsights ||
    layout.recentActivities ||
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
      boardName: "home dashboard",
      emptyHint: "No home widgets",
    }
  );

  return (
    <SafeScreen aboveTabBar includeTop={false} style={styles.container}>
      <HomeAppBar
        title={screenTitle}
        subtitle={screenSubtitle}
        onFilterPress={() => filterBarRef.current?.openPeriodPicker()}
        onNotificationsPress={() => navigateToModule("approvals")}
        notificationCount={notificationCount}
      />

      <View style={styles.filters}>
        <HomeFilterBar
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
            tintColor={HOME.link}
          />
        }
      >
        {loadState.showLoading ? (
          <DashboardLoadingPanel
            title={loadState.title}
            subtitle={loadState.subtitle}
            tintColor={HOME.link}
          />
        ) : null}

        {loadState.showEmpty ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{loadState.title}</Text>
            <Text style={styles.emptySub}>{loadState.subtitle}</Text>
          </View>
        ) : null}

        {!loadState.showLoading
          ? businessKpiSections.map(({ title, items }) => (
              <View key={title} style={styles.section}>
                <HomeSectionHeader title={title} />
                <HomeKpiRowGrid
                  items={items}
                  showLy={showLy}
                  selectedTerritory={selectedTerritory}
                />
              </View>
            ))
          : null}

        {layout.keyIndicators.length > 0 ? (
          <HomeKeyIndicatorsStrip
            items={layout.keyIndicators}
            showLy={showLy}
            selectedTerritory={selectedTerritory}
          />
        ) : null}

        {layout.healthGauges.length > 0 ? (
          <HomeHealthGauges entries={layout.healthGauges} />
        ) : null}

        {layout.trend ? <HomeTrendOverviewChart entry={layout.trend} /> : null}

        {layout.quickInsights ? (
          <HomeQuickInsights entry={layout.quickInsights} />
        ) : null}

        {layout.recentActivities ? (
          <HomeRecentActivities entry={layout.recentActivities} />
        ) : null}

        {!loadState.showLoading && freshness.label ? (
          <DashboardFreshnessFooter
            label={freshness.label}
            isFetching={freshness.isFetching}
            tintColor={HOME.link}
            subtitleColor={HOME.subtitle}
          />
        ) : null}
      </ScrollView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: HOME.bg,
  },
  filters: {
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 8,
    backgroundColor: HOME.bg,
  },
  body: {
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 96,
  },
  section: {
    marginBottom: 4,
  },
  loading: {
    alignItems: "center",
    paddingVertical: 48,
    gap: 12,
  },
  loadingText: {
    color: HOME.subtitle,
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
    color: HOME.subtitle,
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
    color: HOME.subtitle,
    fontFamily: Fonts.body,
  },
});
