import React, {
  useMemo,
  useState,
  useCallback,
  useRef,
  useEffect,
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
import { InventoryAppBar } from "../../components/inventory/InventoryAppBar";
import { InventoryFilterBar } from "../../components/inventory/InventoryFilterBar";
import type {
  CompareMode,
  InventoryFilterBarHandle,
} from "../../components/inventory/InventoryFilterBar";
import { InventoryKpiRowGrid } from "../../components/inventory/InventoryKpiRowGrid";
import { InventoryTrendChart } from "../../components/inventory/InventoryTrendChart";
import { InventoryWarehouseDonut } from "../../components/inventory/InventoryWarehouseDonut";
import { InventoryMovementInsights } from "../../components/inventory/InventoryMovementInsights";
import { InventoryAgingBar } from "../../components/inventory/InventoryAgingBar";
import { InventoryStockCoverDonut } from "../../components/inventory/InventoryStockCoverDonut";
import { InventoryHealthGauge } from "../../components/inventory/InventoryHealthGauge";
import { InventoryTopItemsList } from "../../components/inventory/InventoryTopItemsList";
import { InventoryAlertsList } from "../../components/inventory/InventoryAlertsList";
import { InventoryWidgetBlock } from "../../components/inventory/InventoryWidgetBlock";
import { buildInventoryLayout } from "./buildInventorySections";
import { filterOverviewKpisForTerritoryScope } from "./inventoryTerritoryScope";
import { useInventoryBoardWidgets } from "./useInventoryBoardWidgets";
import { useDashboardFreshness } from "../../hooks/useDashboardFreshness";
import { DashboardFreshnessFooter } from "../../components/dashboard/DashboardFreshnessFooter";
import { resolvePeriod, type PeriodPreset } from "../../utils/period";
import { INVENTORY } from "./inventoryTheme";
import { Fonts } from "../../theme/typography";
import { InventoryStockExplorerCard } from "../../components/inventory/InventoryStockExplorerCard";
import { useAuthStore } from "../../store/auth";
import { DashboardLoadingPanel } from "../../components/dashboard/DashboardLoadingPanel";
import { resolveDashboardLoadState } from "../../utils/dashboardLoadState";

type Props = {
  title?: string;
  subtitle?: string;
};

export function InventoryDashboardScreen({ title, subtitle }: Props) {
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
  const [refreshing, setRefreshing] = useState(false);
  const filterBarRef = useRef<InventoryFilterBarHandle>(null);

  const period = useMemo(() => resolvePeriod(periodPreset), [periodPreset]);
  const showLy = compareMode === "ly";

  const [queryPeriod, setQueryPeriod] = useState(period);
  const [queryShowLy, setQueryShowLy] = useState(showLy);

  useEffect(() => {
    const handle = setTimeout(() => {
      setQueryPeriod(period);
      setQueryShowLy(showLy);
    }, 400);
    return () => clearTimeout(handle);
  }, [period, showLy]);

  const {
    widgetDefs,
    widgetMap,
    isLoading,
    isFetching,
    refreshBoard,
    territoryScoped,
    territoryRollup,
    cachedAt,
    dataUpdatedAt,
    fallbackQueries,
    isOffline,
  } = useInventoryBoardWidgets({
    company,
    from_date: queryPeriod.from_date,
    to_date: queryPeriod.to_date,
    period: queryPeriod.preset,
    show_ly: queryShowLy,
    filters,
  });

  const freshness = useDashboardFreshness(
    { isFetching, dataUpdatedAt, cachedAt, offline: isOffline },
    { fallbackQueries }
  );

  const layout = useMemo(() => {
    const base = buildInventoryLayout(widgetDefs, widgetMap);
    const overviewKpis = filterOverviewKpisForTerritoryScope(
      base.overviewKpis,
      territoryRollup,
      territoryScoped
    );
    return { ...base, overviewKpis };
  }, [widgetDefs, widgetMap, territoryRollup, territoryScoped]);

  const mod = bootstrap?.modules?.find(
    (m) =>
      m.key === "inventory_overview" ||
      m.route_key === "inventory_overview" ||
      m.key === "inventory"
  );
  const screenTitle =
    title ||
    mod?.label ||
    bootstrap?.dashboards?.find((b) => b.key === "inventory_overview")?.title ||
    "Inventory Dashboard";
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

  const brandExplorerScope = useMemo(
    () => ({
      company,
      from_date: queryPeriod.from_date,
      to_date: queryPeriod.to_date,
      period: queryPeriod.preset,
      selectedTerritory,
    }),
    [
      company,
      queryPeriod.from_date,
      queryPeriod.to_date,
      queryPeriod.preset,
      selectedTerritory,
    ]
  );

  const hasContent =
    layout.overviewKpis.length > 0 ||
    layout.trend ||
    layout.warehouseDonut ||
    layout.movement ||
    layout.aging ||
    layout.stockCover ||
    layout.health ||
    layout.topItems ||
    layout.alerts ||
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
      boardName: "inventory dashboard",
      emptyHint: "No inventory widgets",
    }
  );

  return (
    <SafeScreen aboveTabBar includeTop={false} style={styles.container}>
      <InventoryAppBar
        title={screenTitle}
        subtitle={screenSubtitle}
        onFilterPress={() => filterBarRef.current?.openPeriodPicker()}
      />

      <View style={styles.filters}>
        <InventoryFilterBar
          ref={filterBarRef}
          territories={territoryOptions}
          selectedTerritory={selectedTerritory}
          periodPreset={periodPreset}
          compareMode={compareMode}
          onPeriodChange={setPeriodPreset}
          onCompareChange={setCompareMode}
          onTerritoryChange={setSelectedTerritory}
          onRefresh={onRefresh}
          refreshing={refreshing}
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
            tintColor={INVENTORY.link}
          />
        }
      >
        {loadState.showLoading ? (
          <DashboardLoadingPanel
            title={loadState.title}
            subtitle={loadState.subtitle}
            tintColor={INVENTORY.link}
          />
        ) : null}

        {loadState.showEmpty ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{loadState.title}</Text>
            <Text style={styles.emptySub}>{loadState.subtitle}</Text>
          </View>
        ) : null}

        {!loadState.showLoading && layout.overviewKpis.length > 0 ? (
          <InventoryKpiRowGrid
            items={layout.overviewKpis}
            showLy={showLy}
          />
        ) : null}

        <InventoryStockExplorerCard
          scope={brandExplorerScope}
          selectedTerritory={selectedTerritory}
        />

        {layout.trend ? <InventoryTrendChart entry={layout.trend} /> : null}

        {layout.warehouseDonut ? (
          <InventoryWarehouseDonut entry={layout.warehouseDonut} />
        ) : null}

        {layout.movement ? (
          <InventoryMovementInsights entry={layout.movement} />
        ) : null}

        {layout.aging ? (
          <InventoryAgingBar
            entry={layout.aging}
            detailScope={{
              widgetKey: String(
                layout.aging.payload.widget_key ||
                  layout.aging.key ||
                  "inventory_aging_bar"
              ),
              title: layout.aging.label,
              company,
              from_date: queryPeriod.from_date,
              to_date: queryPeriod.to_date,
              period: queryPeriod.preset,
              selectedTerritory,
            }}
          />
        ) : null}

        {layout.stockCover ? (
          <InventoryStockCoverDonut entry={layout.stockCover} />
        ) : null}

        {layout.health ? (
          <InventoryHealthGauge entry={layout.health} showLy={showLy} />
        ) : null}

        {layout.topItems || layout.alerts ? (
          <View style={styles.bottomStack}>
            {layout.topItems ? (
              <InventoryTopItemsList
                entry={layout.topItems}
                brandExplorerScope={brandExplorerScope}
              />
            ) : null}
            {layout.alerts ? (
              <InventoryAlertsList entry={layout.alerts} />
            ) : null}
          </View>
        ) : null}

        {layout.otherBlocks.map((block) => (
          <InventoryWidgetBlock
            key={block.key}
            entry={block}
            showLy={showLy}
          />
        ))}

        {!loadState.showLoading && freshness.label ? (
          <DashboardFreshnessFooter
            label={freshness.label}
            isFetching={freshness.isFetching}
            tintColor={INVENTORY.link}
            subtitleColor={INVENTORY.subtitle}
          />
        ) : null}
      </ScrollView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: INVENTORY.bg,
  },
  filters: {
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 2,
    backgroundColor: INVENTORY.bg,
  },
  body: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 96,
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
    color: INVENTORY.subtitle,
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
    color: INVENTORY.subtitle,
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
    color: INVENTORY.subtitle,
    fontFamily: Fonts.body,
  },
});
