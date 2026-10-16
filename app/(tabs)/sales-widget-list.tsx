import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import {
  SafeScreen,
  useSafeScreenInsets,
} from "../../src/components/SafeScreen";
import { ScreenHeaderNav } from "../../src/components/ScreenHeaderNav";
import { fetchDashboardWidgetData } from "../../src/api/dashboardWidgetData";
import type { DashboardWidgetDataResponse } from "../../src/api/dashboardWidgetData";
import type { AnalysisRow } from "../../src/api/genericAnalysisTypes";
import { OpenSalesOrdersListPanel } from "../../src/components/sales/OpenSalesOrdersListPanel";
import {
  drillFiltersForOpenSalesOrders,
  isOpenSalesOrdersListWidgetKey,
  openOpenSalesOrderItemsDrill,
} from "../../src/utils/salesNavigation";
import { SALES } from "../../src/screens/sales/salesTheme";
import { Fonts } from "../../src/theme/typography";

function rowsFromPayload(payload: DashboardWidgetDataResponse): AnalysisRow[] {
  if (payload.table?.rows?.length) return payload.table.rows;
  return payload.rows || [];
}

export default function SalesWidgetListScreen() {
  const { topInset, scrollPaddingBottom } = useSafeScreenInsets({
    aboveTabBar: true,
  });
  const params = useLocalSearchParams<{
    widget_key?: string;
    title?: string;
    company?: string;
    from_date?: string;
    to_date?: string;
    period?: string;
    territory?: string;
    view_all_sales?: string;
    drill_depth?: string;
    sales_order?: string;
  }>();

  const widgetKey = String(params.widget_key || "").trim();
  const title = String(params.title || "Open Sales Orders").trim();
  const company = String(params.company || "").trim() || undefined;
  const drillDepth = Math.max(
    0,
    Number.parseInt(String(params.drill_depth || "1"), 10) || 1
  );
  const salesOrder = String(params.sales_order || "").trim() || undefined;
  const viewAllSales: 0 | 1 | undefined =
    params.view_all_sales === "1" ? 1 : undefined;

  const filters = useMemo(
    () => drillFiltersForOpenSalesOrders(params.territory, salesOrder),
    [params.territory, salesOrder]
  );

  const mode = drillDepth >= 2 ? "items" : "orders";

  const [payload, setPayload] = useState<DashboardWidgetDataResponse | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listScope = useMemo(
    () => ({
      company,
      from_date: params.from_date || undefined,
      to_date: params.to_date || undefined,
      period: params.period || undefined,
      selectedTerritory: params.territory || undefined,
      view_all_sales: viewAllSales,
    }),
    [
      company,
      params.from_date,
      params.to_date,
      params.period,
      params.territory,
      viewAllSales,
    ]
  );

  const load = useCallback(
    async (isRefresh = false) => {
      if (!widgetKey) {
        setError("Missing widget");
        setLoading(false);
        return;
      }
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const data = await fetchDashboardWidgetData({
          widget_key: widgetKey,
          company,
          from_date: params.from_date || undefined,
          to_date: params.to_date || undefined,
          period: params.period || undefined,
          filters,
          drill_depth: drillDepth,
          limit: mode === "orders" ? 500 : 200,
          show_ly: false,
          view_all_sales: viewAllSales,
        });
        setPayload(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load list");
        setPayload(null);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      widgetKey,
      company,
      params.from_date,
      params.to_date,
      params.period,
      filters,
      drillDepth,
      mode,
      viewAllSales,
    ]
  );

  React.useEffect(() => {
    void load(false);
  }, [load]);

  const rows = payload ? rowsFromPayload(payload) : [];
  const currency = payload?.currency || payload?.meta?.currency || "SAR";
  const openSo = isOpenSalesOrdersListWidgetKey(widgetKey);

  const onRowPress = (row: AnalysisRow) => {
    if (mode === "orders" && openSo) {
      openOpenSalesOrderItemsDrill(row, listScope);
    }
  };

  return (
    <SafeScreen aboveTabBar includeTop={false} style={styles.container}>
      <View style={[styles.header, { paddingTop: topInset }]}>
        <ScreenHeaderNav />
        <Text style={styles.headerTitle} numberOfLines={2}>
          {title}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading && !payload ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={SALES.link} />
        </View>
      ) : null}

      {error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => load(false)}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {!loading && !error && openSo ? (
        <View style={styles.listWrap}>
          <OpenSalesOrdersListPanel
            rows={rows}
            currency={currency}
            mode={mode}
            summaryCount={
              Number(
                (payload?.meta as Record<string, unknown> | undefined)
                  ?.open_so_count
              ) ||
              rows.length ||
              undefined
            }
            onRowPress={onRowPress}
            refreshing={refreshing}
            onRefresh={() => load(true)}
            contentPaddingBottom={scrollPaddingBottom}
          />
        </View>
      ) : null}

      {!loading && !error && !openSo ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>Unsupported sales list widget.</Text>
        </View>
      ) : null}
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SALES.bg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: SALES.border,
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontFamily: Fonts.bodyBold,
    color: SALES.title,
    textAlign: "center",
  },
  headerSpacer: { width: 40 },
  listWrap: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  errorText: {
    color: SALES.red,
    fontFamily: Fonts.body,
    textAlign: "center",
    marginBottom: 12,
  },
  retryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: SALES.link,
  },
  retryText: {
    color: "#fff",
    fontFamily: Fonts.bodySemi,
  },
});
