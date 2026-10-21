import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  SafeScreen,
  useSafeScreenInsets,
} from "../../src/components/SafeScreen";
import { ScreenHeaderNav } from "../../src/components/ScreenHeaderNav";
import { fetchDashboardWidgetData } from "../../src/api/dashboardWidgetData";
import type { DashboardWidgetDataResponse } from "../../src/api/dashboardWidgetData";
import type { AnalysisRow } from "../../src/api/genericAnalysisTypes";
import {
  isCustomerAdvancesWidgetKey,
  openCustomerAdvancePaymentsDrill,
  openCustomerFromRow,
  openCollectionDashboard,
} from "../../src/utils/receivablesNavigation";
import {
  filterReceivablesRankingRows,
  filterTerritoryReceivableCustomerRows,
} from "../../src/utils/receivablesRankingRows";
import {
  fetchReceivablesAgingBucketCustomers,
  fetchReceivablesTerritoryCustomers,
  RECEIVABLES_TERRITORY_CUSTOMERS_WIDGET,
  filterAgingBucketCustomerRows,
  isReceivablesAgingBarWidgetKey,
  filterRowsForBucketDisplay,
  receivablesTerritoryOnlyFilters,
} from "../../src/utils/receivablesAgingUtils";
import { useAuthStore } from "../../src/store/auth";
import { useDashboardFiltersStore } from "../../src/store/dashboardFilters";
import { resolveBoardTerritoryFilters } from "../../src/utils/dashboardTerritory";
import { RECEIVABLES } from "../../src/screens/receivables/receivablesTheme";
import { CustomerAdvancesListPanel } from "../../src/components/receivables/CustomerAdvancesListPanel";
import { OverdueCustomersListPanel } from "../../src/components/receivables/OverdueCustomersListPanel";
import { TerritoryReceivablesListPanel } from "../../src/components/receivables/TerritoryReceivablesListPanel";
import { Fonts } from "../../src/theme/typography";

function rowsFromPayload(payload: DashboardWidgetDataResponse): AnalysisRow[] {
  if (payload.table?.rows?.length) return payload.table.rows;
  return payload.rows || [];
}

function numParam(v: string | undefined): number | undefined {
  const n = Number(String(v || "").replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function isRankingWidget(widgetKey: string): boolean {
  return (
    /overdue|customer|ranking|table/i.test(widgetKey) ||
    isCustomerAdvancesWidgetKey(widgetKey) ||
    widgetKey === RECEIVABLES_TERRITORY_CUSTOMERS_WIDGET
  );
}

export default function ReceivablesWidgetListScreen() {
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
    aging_bucket?: string;
    aging_bucket_label?: string;
    bucket_card_total?: string;
    territory_card_total?: string;
  }>();

  const widgetKey = String(params.widget_key || "").trim();
  const title = String(params.title || "Receivables").trim() || "Receivables";
  const company = String(params.company || "").trim() || undefined;
  const agingBucket = String(params.aging_bucket || "").trim();
  const agingBucketLabel = String(params.aging_bucket_label || "").trim();
  const bucketCardTotal = numParam(params.bucket_card_total);
  const territoryCardTotal = numParam(params.territory_card_total);
  const isTerritoryCustomerList =
    widgetKey === RECEIVABLES_TERRITORY_CUSTOMERS_WIDGET;
  /** Territory from bar-chart drill — fixed for this screen (not global filter). */
  const drillTerritory = useMemo(
    () => String(params.territory || "").trim(),
    [params.territory]
  );
  const selectedTerritory = useDashboardFiltersStore((s) => s.selectedTerritory);
  const permissionsScope = useAuthStore((s) => s.permissions.scope);

  const filters = useMemo(() => {
    if (isTerritoryCustomerList && drillTerritory) {
      return { territory: [drillTerritory] };
    }
    const fromStore = resolveBoardTerritoryFilters(
      selectedTerritory,
      permissionsScope
    );
    if (fromStore?.territory?.length) return fromStore;
    if (drillTerritory && drillTerritory !== "__all__") {
      return { territory: [drillTerritory] };
    }
    return fromStore;
  }, [
    isTerritoryCustomerList,
    drillTerritory,
    selectedTerritory,
    permissionsScope,
  ]);

  const apiFilters = useMemo(
    () =>
      agingBucket ? receivablesTerritoryOnlyFilters(filters) : filters,
    [filters, agingBucket]
  );

  const [payload, setPayload] = useState<DashboardWidgetDataResponse | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadTerritoryDrill = useCallback(
    async (isRefresh = false) => {
      if (!drillTerritory) {
        setError("Missing territory");
        setLoading(false);
        return;
      }
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const data = await fetchReceivablesTerritoryCustomers({
          company,
          territory: drillTerritory,
          from_date: params.from_date || undefined,
          to_date: params.to_date || undefined,
          period: params.period || undefined,
          limit: 200,
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
    [drillTerritory, company, params.from_date, params.to_date, params.period]
  );

  const loadGenericList = useCallback(
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
        let data: DashboardWidgetDataResponse;
        if (agingBucket) {
          data = await fetchReceivablesAgingBucketCustomers({
            agingWidgetKey: isReceivablesAgingBarWidgetKey(widgetKey)
              ? widgetKey
              : undefined,
            company,
            from_date: params.from_date || undefined,
            to_date: params.to_date || undefined,
            period: params.period || undefined,
            filters: apiFilters,
            bucketValue: agingBucket,
            bucketLabel: agingBucketLabel || agingBucket,
            bucketCardTotal,
            limit: 500,
          });
        } else {
          data = await fetchDashboardWidgetData({
            widget_key: widgetKey,
            company,
            from_date: params.from_date || undefined,
            to_date: params.to_date || undefined,
            period: params.period || undefined,
            filters: apiFilters,
            limit: isRankingWidget(widgetKey) ? 100 : 50,
            show_ly: false,
          });
        }
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
      apiFilters,
      agingBucket,
      agingBucketLabel,
      bucketCardTotal,
    ]
  );

  useEffect(() => {
    if (!widgetKey) return;
    if (isTerritoryCustomerList) {
      void loadTerritoryDrill(false);
    } else {
      void loadGenericList(false);
    }
  }, [
    widgetKey,
    isTerritoryCustomerList,
    loadTerritoryDrill,
    loadGenericList,
  ]);

  const load = isTerritoryCustomerList ? loadTerritoryDrill : loadGenericList;

  const rawRows = payload ? rowsFromPayload(payload) : [];
  const ranking =
    isRankingWidget(widgetKey) ||
    Boolean(agingBucket) ||
    isReceivablesAgingBarWidgetKey(widgetKey);
  const rows = useMemo(() => {
    if (agingBucket) {
      const customers = filterAgingBucketCustomerRows(rawRows);
      return filterRowsForBucketDisplay(
        customers,
        agingBucketLabel || agingBucket,
        bucketCardTotal
      );
    }
    if (isTerritoryCustomerList) {
      return filterTerritoryReceivableCustomerRows(rawRows);
    }
    return ranking
      ? filterReceivablesRankingRows(widgetKey, rawRows)
      : rawRows;
  }, [
    ranking,
    widgetKey,
    rawRows,
    agingBucket,
    agingBucketLabel,
    bucketCardTotal,
    isTerritoryCustomerList,
  ]);
  const advances = isCustomerAdvancesWidgetKey(widgetKey);
  const currency = payload?.currency || payload?.meta?.currency || "SAR";
  const territoryListMode =
    payload?.meta?.territory_list_mode === "overdue_only"
      ? "overdue_only"
      : "full";

  const onRowPress = (row: AnalysisRow) => {
    if (ranking && advances) {
      void openCustomerAdvancePaymentsDrill(row, {
        company,
        territory: params.territory,
      });
      return;
    }
    if (ranking) {
      openCustomerFromRow(row, {
        widgetKey,
        title,
        company,
        from_date: params.from_date,
        to_date: params.to_date,
        period: params.period,
        drillTerritory,
        aging_bucket: agingBucket,
        aging_bucket_label: agingBucketLabel,
        bucket_card_total: params.bucket_card_total,
        territory_card_total: params.territory_card_total,
      });
      return;
    }
    openCollectionDashboard();
  };

  return (
    <SafeScreen aboveTabBar includeTop={false} style={styles.container}>
      <View style={[styles.header, { paddingTop: topInset }]}>
        <ScreenHeaderNav
          color={RECEIVABLES.title}
          buttonBackground="#f1f5f9"
        />
        <Text style={styles.headerTitle} numberOfLines={2}>
          {title}
        </Text>
      </View>

      {error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => load(false)}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {!error && advances && ranking ? (
        <View style={styles.listWrap}>
          <CustomerAdvancesListPanel
            rows={rows}
            currency={currency}
            widgetKey={widgetKey}
            onRowPress={onRowPress}
            refreshing={refreshing}
            onRefresh={() => load(true)}
            contentPaddingBottom={scrollPaddingBottom}
          />
        </View>
      ) : null}

      {!error && isTerritoryCustomerList ? (
        <View style={styles.listWrap}>
          <TerritoryReceivablesListPanel
            rows={rows}
            currency={currency}
            onRowPress={onRowPress}
            loading={loading && !payload}
            refreshing={refreshing}
            onRefresh={() => load(true)}
            contentPaddingBottom={scrollPaddingBottom}
            territoryCardTotal={territoryCardTotal}
            listMode={territoryListMode}
          />
        </View>
      ) : null}

      {!error && ranking && !advances && !isTerritoryCustomerList ? (
        <View style={styles.listWrap}>
          <OverdueCustomersListPanel
            rows={rows}
            currency={currency}
            widgetKey={widgetKey}
            onRowPress={onRowPress}
            loading={loading && !payload}
            refreshing={refreshing}
            onRefresh={() => load(true)}
            contentPaddingBottom={scrollPaddingBottom}
            summaryLabel={
              agingBucketLabel
                ? `Balance in ${agingBucketLabel}`
                : undefined
            }
            emptyTitle={
              agingBucketLabel
                ? `No customers in ${agingBucketLabel}`
                : undefined
            }
            dashboardBucketTotal={bucketCardTotal}
            selectedAgingBucketLabel={agingBucketLabel || agingBucket}
          />
        </View>
      ) : null}

      {!error && !ranking ? (
        <ScrollView
          contentContainerStyle={[
            styles.body,
            { paddingBottom: scrollPaddingBottom },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor={RECEIVABLES.link}
            />
          }
        >
          {!rows.length && !loading ? (
            <Text style={styles.empty}>No items to show</Text>
          ) : (
            rows.map((row, i) => {
              const count = Number(row.value) || 0;
              return (
                <TouchableOpacity
                  key={`${row.id}-${i}`}
                  style={styles.row}
                  activeOpacity={0.85}
                  onPress={() => onRowPress(row)}
                >
                  <Ionicons
                    name="warning-outline"
                    size={18}
                    color={RECEIVABLES.amber}
                  />
                  <Text style={styles.rowTitle} numberOfLines={2}>
                    {row.label}
                  </Text>
                  <Text style={styles.count}>
                    {count.toLocaleString("en-US")}
                  </Text>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      ) : null}
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: RECEIVABLES.bg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: RECEIVABLES.border,
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontFamily: Fonts.bodyBold,
    color: RECEIVABLES.title,
    textAlign: "left",
    marginLeft: 4,
    paddingRight: 8,
  },
  listWrap: {
    flex: 1,
  },
  body: {
    padding: 16,
    paddingBottom: 96,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  errorText: {
    color: RECEIVABLES.red,
    fontFamily: Fonts.body,
    textAlign: "center",
    marginBottom: 12,
  },
  retryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: RECEIVABLES.link,
  },
  retryText: {
    color: "#fff",
    fontFamily: Fonts.bodySemi,
  },
  empty: {
    color: RECEIVABLES.subtitle,
    fontFamily: Fonts.body,
    textAlign: "center",
    paddingVertical: 24,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: RECEIVABLES.card,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: RECEIVABLES.border,
  },
  rank: {
    width: 20,
    fontSize: 13,
    fontFamily: Fonts.bodyBold,
    color: RECEIVABLES.subtitle,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    flex: 1,
    fontSize: 13,
    fontFamily: Fonts.bodySemi,
    color: RECEIVABLES.value,
  },
  rowSub: {
    fontSize: 12,
    fontFamily: Fonts.body,
    color: RECEIVABLES.subtitle,
    marginTop: 2,
  },
  count: {
    fontSize: 15,
    fontFamily: Fonts.bodyBold,
    color: RECEIVABLES.red,
  },
});
