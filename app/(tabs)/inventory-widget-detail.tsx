import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  SafeScreen,
  useSafeScreenInsets,
} from "../../src/components/SafeScreen";
import { ScreenHeaderNav } from "../../src/components/ScreenHeaderNav";
import {
  fetchDashboardWidgetData,
  type DashboardWidgetDataResponse,
  type DrillStackEntry,
} from "../../src/api/dashboardWidgetData";
import type { AnalysisRow } from "../../src/api/genericAnalysisTypes";
import type { ChartSeriesPoint } from "../../src/api/dashboardWidgetData";
import { AGING_COLORS, INVENTORY } from "../../src/screens/inventory/inventoryTheme";
import { formatCurrency } from "../../src/utils/currency";
import { Fonts } from "../../src/theme/typography";
import {
  bucketPointValue,
  filterNonBucketRows,
  mergeTerritoryIntoFilters,
  resolveInventoryAgingDrillPath,
  rowDrillValue,
  sortAgingSeries,
  sortDrillRows,
} from "../../src/utils/inventoryAgingUtils";
import { territoryLabel } from "../../src/utils/dashboardTerritory";

function rowsFromPayload(payload: DashboardWidgetDataResponse): AnalysisRow[] {
  if (payload.table?.rows?.length) return payload.table.rows;
  return payload.rows || [];
}

export default function InventoryWidgetDetailScreen() {
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
  }>();

  const widgetKey = String(params.widget_key || "").trim();
  const title = String(params.title || "Stock Aging").trim() || "Stock Aging";
  const company = String(params.company || "").trim() || undefined;
  const territoryParam = String(params.territory || "").trim();

  const baseFilters = useMemo(
    () => mergeTerritoryIntoFilters(territoryParam),
    [territoryParam]
  );

  const territorySubtitle = useMemo(() => {
    if (!territoryParam || territoryParam === "__all__") return null;
    return territoryLabel(territoryParam, []);
  }, [territoryParam]);

  const [rootPayload, setRootPayload] =
    useState<DashboardWidgetDataResponse | null>(null);
  const [drillPayload, setDrillPayload] =
    useState<DashboardWidgetDataResponse | null>(null);
  const [stack, setStack] = useState<DrillStackEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [drillLoading, setDrillLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const drillPath = useMemo(
    () => resolveInventoryAgingDrillPath(rootPayload),
    [rootPayload]
  );

  const drillFilters = useMemo(() => {
    const f = mergeTerritoryIntoFilters(territoryParam);
    for (const entry of stack) {
      f[entry.dimension] = [entry.value];
    }
    return f;
  }, [territoryParam, stack]);

  const fetchWidget = useCallback(
    async (opts: {
      drill_depth?: number;
      dimension?: string;
      filters: typeof drillFilters;
    }) => {
      return fetchDashboardWidgetData({
        widget_key: widgetKey,
        company,
        from_date: params.from_date || undefined,
        to_date: params.to_date || undefined,
        period: params.period || undefined,
        filters: opts.filters,
        drill_depth: opts.drill_depth,
        dimension: opts.dimension,
        limit: 200,
        show_ly: false,
      });
    },
    [
      widgetKey,
      company,
      params.from_date,
      params.to_date,
      params.period,
    ]
  );

  const loadDrillLevel = useCallback(async () => {
    setDrillLoading(true);
    const depth = stack.length;
    const dimension = drillPath[depth];
    let data = await fetchWidget({
      drill_depth: depth,
      dimension,
      filters: drillFilters,
    });

    let rows = filterNonBucketRows(rowsFromPayload(data));
    if (!rows.length && depth >= 1) {
      const altDim = depth === 1 ? "brand" : depth === 2 ? "item" : dimension;
      if (altDim && altDim !== dimension) {
        data = await fetchWidget({
          drill_depth: depth,
          dimension: altDim,
          filters: drillFilters,
        });
        rows = filterNonBucketRows(rowsFromPayload(data));
      }
    }
    setDrillPayload(data);
    setDrillLoading(false);
  }, [stack.length, drillPath, drillFilters, fetchWidget]);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!widgetKey) {
        setError("Missing widget");
        setLoading(false);
        return;
      }
      if (isRefresh) setRefreshing(true);
      else if (!stack.length) setLoading(true);
      setError(null);
      try {
        if (!stack.length) {
          const root = await fetchWidget({
            filters: baseFilters,
          });
          setRootPayload(root);
          setDrillPayload(null);
        } else {
          await loadDrillLevel();
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load details");
        if (!stack.length) {
          setRootPayload(null);
        }
        setDrillPayload(null);
        setDrillLoading(false);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [widgetKey, stack.length, baseFilters, fetchWidget, loadDrillLevel]
  );

  React.useEffect(() => {
    void load(false);
  }, [load]);

  const currency =
    drillPayload?.currency ||
    drillPayload?.meta?.currency ||
    rootPayload?.currency ||
    rootPayload?.meta?.currency ||
    "SAR";

  const sortedSeries = useMemo(() => {
    const series = rootPayload?.chart?.series || [];
    return sortAgingSeries(series);
  }, [rootPayload]);

  const total = useMemo(
    () => sortedSeries.reduce((s, p) => s + (Number(p.value) || 0), 0),
    [sortedSeries]
  );

  const drillRows = useMemo(() => {
    if (!drillPayload) return [];
    const raw = filterNonBucketRows(rowsFromPayload(drillPayload));
    if (stack.length === 1) return sortDrillRows(raw, "brand");
    if (stack.length >= 2) return sortDrillRows(raw, "item");
    return raw;
  }, [drillPayload, stack.length]);

  const listSectionTitle = useMemo(() => {
    if (stack.length === 0) return "By aging bucket";
    if (stack.length === 1) {
      return `Brands · ${stack[0].label}`;
    }
    return `Items · ${stack[1]?.label || stack[stack.length - 1]?.label}`;
  }, [stack]);

  const canDrillDeeper = stack.length < drillPath.length - 1;

  const onBucketPress = (point: ChartSeriesPoint) => {
    const bucketDim = drillPath[0] || "aging_bucket";
    const value = bucketPointValue(point);
    if (!value) return;
    setStack([{ dimension: bucketDim, label: point.label, value }]);
  };

  const onDrillRowPress = (row: AnalysisRow) => {
    if (!canDrillDeeper) return;
    const dim = drillPath[stack.length];
    if (!dim) return;
    const value = rowDrillValue(row);
    if (!value) return;
    setStack((s) => [
      ...s,
      { dimension: dim, label: String(row.label || value), value },
    ]);
  };

  const handleBack = () => {
    if (stack.length) {
      setStack((s) => s.slice(0, -1));
    }
  };

  const breadcrumb = useMemo(() => {
    if (!stack.length) return null;
    return ["Stock Aging", ...stack.map((s) => s.label)].join(" › ");
  }, [stack]);

  return (
    <SafeScreen aboveTabBar includeTop={false} style={styles.container}>
      <View style={[styles.header, { paddingTop: topInset }]}>
        <ScreenHeaderNav
          color={INVENTORY.title}
          buttonBackground="rgba(15, 23, 42, 0.06)"
          onBack={stack.length ? handleBack : undefined}
        />
        <View style={styles.headerText}>
          <Text style={styles.headerTitle} numberOfLines={2}>
            {title}
          </Text>
          {territorySubtitle ? (
            <Text style={styles.territoryChip}>{territorySubtitle}</Text>
          ) : null}
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {breadcrumb ? (
        <Text style={styles.breadcrumb} numberOfLines={2}>
          {breadcrumb}
        </Text>
      ) : null}

      {loading && !rootPayload && !drillPayload ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={INVENTORY.link} />
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

      {!error && (rootPayload || drillPayload) ? (
        <ScrollView
          contentContainerStyle={[
            styles.body,
            { paddingBottom: scrollPaddingBottom },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor={INVENTORY.link}
            />
          }
        >
          {stack.length === 0 && sortedSeries.length ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>{listSectionTitle}</Text>
              <Text style={styles.hint}>
                Tap a bucket to view brands, then items.
              </Text>
              {sortedSeries.map((point, i) => {
                const val = Number(point.value) || 0;
                const pct = total > 0 ? (val / total) * 100 : 0;
                return (
                  <TouchableOpacity
                    key={`${point.label}-${i}`}
                    style={styles.bucketRow}
                    activeOpacity={0.85}
                    onPress={() => onBucketPress(point)}
                  >
                    <View
                      style={[
                        styles.bucketDot,
                        {
                          backgroundColor: AGING_COLORS[i % AGING_COLORS.length],
                        },
                      ]}
                    />
                    <Text style={styles.bucketLabel} numberOfLines={2}>
                      {point.label}
                    </Text>
                    <View style={styles.bucketValues}>
                      <Text style={styles.bucketValue}>
                        {formatCurrency(val, currency, {
                          compact: false,
                          hideCode: true,
                        })}
                      </Text>
                      <Text style={styles.bucketPct}>{pct.toFixed(1)}%</Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color={INVENTORY.subtitle}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null}

          {stack.length > 0 ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>{listSectionTitle}</Text>
              {drillLoading && !drillRows.length ? (
                <ActivityIndicator
                  style={styles.inlineLoader}
                  color={INVENTORY.link}
                />
              ) : null}
              {!drillLoading && !drillRows.length ? (
                <Text style={styles.empty}>
                  No {stack.length === 1 ? "brands" : "items"} for this bucket
                  {territorySubtitle ? ` in ${territorySubtitle}` : ""}.
                </Text>
              ) : null}
              {drillRows.map((row, i) => {
                const val = Number(row.value) || 0;
                const drillable = canDrillDeeper && stack.length === 1;
                return (
                  <TouchableOpacity
                    key={`${row.id}-${i}`}
                    style={[
                      styles.itemRow,
                      i === drillRows.length - 1 && styles.itemRowLast,
                    ]}
                    activeOpacity={drillable ? 0.85 : 1}
                    disabled={!drillable}
                    onPress={() => onDrillRowPress(row)}
                  >
                    <Text style={styles.itemLabel} numberOfLines={2}>
                      {row.label}
                    </Text>
                    <Text style={styles.itemValue}>
                      {formatCurrency(val, currency, {
                        compact: false,
                        hideCode: true,
                      })}
                    </Text>
                    {drillable ? (
                      <Ionicons
                        name="chevron-forward"
                        size={16}
                        color={INVENTORY.subtitle}
                      />
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null}

          {!sortedSeries.length && !drillRows.length && !loading ? (
            <Text style={styles.empty}>No aging details available.</Text>
          ) : null}
        </ScrollView>
      ) : null}
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: INVENTORY.bg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: INVENTORY.border,
  },
  headerText: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: Fonts.bodyBold,
    color: INVENTORY.title,
    textAlign: "center",
  },
  territoryChip: {
    marginTop: 4,
    fontSize: 11,
    fontFamily: Fonts.bodySemi,
    color: INVENTORY.link,
  },
  headerSpacer: { width: 40 },
  breadcrumb: {
    fontSize: 11,
    fontFamily: Fonts.body,
    color: INVENTORY.subtitle,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  errorText: {
    fontSize: 14,
    fontFamily: Fonts.body,
    color: INVENTORY.red,
    textAlign: "center",
    marginBottom: 12,
  },
  retryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: INVENTORY.link,
  },
  retryText: {
    fontSize: 14,
    fontFamily: Fonts.bodySemi,
    color: "#fff",
  },
  body: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: INVENTORY.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: INVENTORY.border,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: Fonts.bodyBold,
    color: INVENTORY.title,
    letterSpacing: 0.3,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  hint: {
    fontSize: 11,
    fontFamily: Fonts.body,
    color: INVENTORY.subtitle,
    marginBottom: 10,
  },
  bucketRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: INVENTORY.border,
  },
  bucketDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  bucketLabel: {
    flex: 1,
    fontSize: 13,
    fontFamily: Fonts.body,
    color: INVENTORY.value,
  },
  bucketValues: {
    alignItems: "flex-end",
    minWidth: 88,
  },
  bucketValue: {
    fontSize: 13,
    fontFamily: Fonts.bodyBold,
    color: INVENTORY.value,
  },
  bucketPct: {
    fontSize: 11,
    fontFamily: Fonts.body,
    color: INVENTORY.subtitle,
    marginTop: 2,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: INVENTORY.border,
  },
  itemRowLast: {
    borderBottomWidth: 0,
  },
  itemLabel: {
    flex: 1,
    fontSize: 13,
    fontFamily: Fonts.body,
    color: INVENTORY.value,
  },
  itemValue: {
    fontSize: 13,
    fontFamily: Fonts.bodyBold,
    color: INVENTORY.value,
    textAlign: "right",
  },
  inlineLoader: {
    marginVertical: 16,
  },
  empty: {
    fontSize: 14,
    fontFamily: Fonts.body,
    color: INVENTORY.subtitle,
    textAlign: "center",
    marginTop: 12,
    marginBottom: 8,
  },
});
