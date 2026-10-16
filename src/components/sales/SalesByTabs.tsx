import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { SalesWidgetEntry } from "../../screens/sales/buildSalesSections";
import type { AnalysisRow } from "../../api/genericAnalysisTypes";
import { normalizeDrillDimensionKey } from "../../api/dashboardWidgetData";
import { formatCurrency } from "../../utils/currency";
import { SALES, initialsFromLabel } from "../../screens/sales/salesTheme";
import {
  formatSalesRowGpPct,
  readSalesRowGpPct,
} from "../../utils/salesRowGpPct";
import { SalesSectionHeader } from "./SalesSectionHeader";
import { Fonts } from "../../theme/typography";
import {
  parseRawRowSubGroup,
  salesDrillRowMetaFromRaw,
} from "../../utils/salesDrillSubGroup";
import {
  clearDivisionDrillCache,
  displaySalesDrillRowLabel,
  drillSubGroupFilterValue,
  drillRowAvatarInitials,
  canDrillDeeper,
  canDrillSalesByRow,
  divisionDrillEmptyMessage,
  fetchDivisionDrillRows,
  formatSalesDrillError,
  isDivisionSalesByEntry,
  readCachedDivisionDrillRows,
  readDrillListDimension,
  resolveDivisionDrillPath,
  type DivisionDrillFrame,
  type SalesByDrillScope,
} from "../../utils/salesByDivisionDrill";

type Props = {
  entries: SalesWidgetEntry[];
  scope?: SalesByDrillScope;
  /** When true, show YoY Δ% from row.change_pct (filter bar “Last Year”). */
  showLy?: boolean;
};

function rowsFromEntry(entry: SalesWidgetEntry): AnalysisRow[] {
  if (entry.payload.table?.rows?.length) {
    return entry.payload.table.rows;
  }
  if (entry.payload.rows?.length) return entry.payload.rows;
  const series = entry.payload.chart?.series || [];
  return series.map((p, i) => {
    const pt = p as Record<string, unknown>;
    const meta = salesDrillRowMetaFromRaw(pt);
    const subGroup = parseRawRowSubGroup(pt);
    const label = String(pt.label || `Item ${i + 1}`).trim();
    return {
      id: subGroup || label || `r-${i}`,
      label,
      value: Number(pt.value) || 0,
      change_pct: (pt.change_pct as number | null | undefined) ?? null,
      meta: Object.keys(meta).length ? meta : undefined,
    };
  });
}

function tabLabel(entry: SalesWidgetEntry): string {
  return (
    entry.salesByTab ||
    entry.label.replace(/^sales by\s*/i, "").trim() ||
    entry.label
  );
}

const SALES_BY_TOP_N = 10;

export function SalesByTabs({ entries, scope, showLy = true }: Props) {
  const tabs = useMemo(
    () =>
      entries.map((e) => ({
        id: e.key,
        label: tabLabel(e),
        entry: e,
      })),
    [entries]
  );
  const [activeId, setActiveId] = useState(() => tabs[0]?.id || "");
  const [drillStack, setDrillStack] = useState<DivisionDrillFrame[]>([]);
  const [drillRows, setDrillRows] = useState<AnalysisRow[]>([]);
  const [drillLoading, setDrillLoading] = useState(false);
  const [drillError, setDrillError] = useState<string | null>(null);
  const drillFetchGen = useRef(0);

  const active =
    tabs.find((t) => t.id === activeId) || tabs[0] || null;
  const divisionDrillEnabled =
    Boolean(scope?.company) && active && isDivisionSalesByEntry(active.entry);

  const divisionDrillPath = useMemo(
    () => (active ? resolveDivisionDrillPath(active.entry) : []),
    [active]
  );

  const widgetRows = active ? rowsFromEntry(active.entry) : [];
  const inDrill = divisionDrillEnabled && drillStack.length > 0;
  const rows = inDrill ? drillRows : widgetRows;
  const currency =
    active?.entry.payload.currency ||
    active?.entry.payload.meta?.currency ||
    "SAR";
  const maxValue = Math.max(...rows.map((r) => Number(r.value) || 0), 1);

  useEffect(() => {
    setDrillStack([]);
    setDrillRows([]);
    setDrillError(null);
    clearDivisionDrillCache();
  }, [activeId]);

  useEffect(() => {
    clearDivisionDrillCache();
  }, [
    scope?.company,
    scope?.from_date,
    scope?.to_date,
    scope?.period,
    scope?.territory,
    scope?.viewTerritories?.join("|"),
    scope?.allowViewAllSales,
  ]);

  useEffect(() => {
    if (!divisionDrillEnabled || !scope || drillStack.length === 0) {
      setDrillRows([]);
      setDrillLoading(false);
      setDrillError(null);
      return;
    }

    let cancelled = false;
    const gen = ++drillFetchGen.current;
    setDrillError(null);

    const widgetKey = active?.entry.key || "";
    if (!widgetKey) {
      setDrillLoading(false);
      setDrillError("Missing widget key for drill.");
      return () => {
        cancelled = true;
      };
    }

    const cached = readCachedDivisionDrillRows(
      widgetKey,
      drillStack,
      scope,
      divisionDrillPath
    );
    if (cached) {
      setDrillRows(cached);
      setDrillLoading(false);
      setDrillError(null);
      return () => {
        cancelled = true;
      };
    }

    setDrillLoading(true);

    void fetchDivisionDrillRows(
      widgetKey,
      drillStack,
      scope,
      divisionDrillPath
    )
      .then((rows) => {
        if (cancelled || gen !== drillFetchGen.current) return;
        setDrillRows(rows);
        if (!rows.length) {
          setDrillError(
            divisionDrillEmptyMessage(drillStack.length, scope)
          );
        }
      })
      .catch((err: unknown) => {
        if (cancelled || gen !== drillFetchGen.current) return;
        setDrillError(formatSalesDrillError(err));
      })
      .finally(() => {
        if (!cancelled && gen === drillFetchGen.current) {
          setDrillLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    drillStack,
    divisionDrillEnabled,
    divisionDrillPath,
    scope?.company,
    scope?.from_date,
    scope?.to_date,
    scope?.period,
    scope?.territory,
    scope?.viewTerritories?.join("|"),
    scope?.allowViewAllSales,
    scope?.viewAllSalesRequest,
    active?.entry.key,
  ]);

  const drillSubtitle = useMemo(() => {
    if (!drillStack.length) return null;
    const parts = ["Division", ...drillStack.map((f) => f.title)];
    return parts.join(" › ");
  }, [drillStack]);

  const onDrillBack = () => {
    drillFetchGen.current += 1;
    setDrillError(null);
    setDrillLoading(false);
    setDrillRows([]);
    setDrillStack((s) => s.slice(0, -1));
  };

  const onRowPress = (row: AnalysisRow) => {
    if (!divisionDrillEnabled || drillLoading) return;
    const depth = drillStack.length;
    const widgetKeyForDrill = active?.entry.key || "";
    if (
      !canDrillSalesByRow(
        depth,
        widgetKeyForDrill,
        drillStack,
        scope,
        divisionDrillPath
      )
    ) {
      return;
    }

    const filterValue = drillSubGroupFilterValue(row);
    const rawTitle = String(row.label || row.id || filterValue).trim();
    if (!filterValue) return;

    const widgetKey = active?.entry.key || "";

    if (depth === 0) {
      setDrillStack([
        {
          division: filterValue,
          title: rawTitle || filterValue,
          filterDimension: "division",
        },
      ]);
      return;
    }
    if (depth === 1) {
      const division = drillStack[0]?.division || "";
      const listDim =
        readDrillListDimension(
          widgetKey,
          drillStack,
          scope!,
          divisionDrillPath
        ) ||
        normalizeDrillDimensionKey(divisionDrillPath[1]) ||
        "sub_group";
      const shortTitle =
        displaySalesDrillRowLabel(rawTitle, drillStack) || rawTitle;
      if (
        __DEV__ &&
        division &&
        filterValue &&
        !filterValue.toLowerCase().includes(division.toLowerCase())
      ) {
        console.warn(
          "[sales-drill] mismatch: item-group tap may use short sub_group (need full name + division in filters)",
          { division, sub_group: filterValue, label: rawTitle }
        );
      }
      setDrillStack((s) => [
        ...s,
        {
          division,
          sub_group: filterValue,
          item_group: filterValue,
          group_sales_total: Number(row.value) || undefined,
          title: shortTitle,
          filterDimension: listDim,
        },
      ]);
    }
  };

  if (!tabs.length) return null;

  const rowDrillable = () => {
    if (!divisionDrillEnabled || drillLoading) return false;
    const widgetKey = active?.entry.key || "";
    if (inDrill) {
      return canDrillSalesByRow(
        drillStack.length,
        widgetKey,
        drillStack,
        scope,
        divisionDrillPath
      );
    }
    return canDrillDeeper(0, divisionDrillPath);
  };

  return (
    <View style={styles.wrap}>
      <SalesSectionHeader title="Sales By" rightLabel={`Top ${SALES_BY_TOP_N}`} />
      <View style={styles.segment}>
        {tabs.map((tab) => {
          const on = tab.id === (active?.id || "");
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tab, on && styles.tabActive]}
              onPress={() => setActiveId(tab.id)}
              activeOpacity={0.85}
            >
              <Text style={[styles.tabText, on && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {inDrill ? (
        <View style={styles.drillBar}>
          <TouchableOpacity
            onPress={onDrillBack}
            style={styles.backBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-back" size={18} color={SALES.link} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.drillPath} numberOfLines={2}>
            {drillSubtitle}
          </Text>
        </View>
      ) : null}

      {inDrill && drillLoading && !drillRows.length ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={SALES.link} />
          <Text style={styles.loadingText}>
            {drillStack.length === 1
              ? "Loading item groups…"
              : "Loading brands…"}
          </Text>
        </View>
      ) : null}

      {inDrill && drillError && !drillLoading ? (
        <Text style={styles.errorText}>{drillError}</Text>
      ) : null}

      {!inDrill && !rows.length ? (
        <Text style={styles.empty}>No breakdown data</Text>
      ) : null}

      {rows.length > 0
        ? rows.slice(0, SALES_BY_TOP_N).map((row, i) => {
          const val = Number(row.value) || 0;
          const pct = Math.max(4, (val / maxValue) * 100);
          const gpPct = readSalesRowGpPct(row);
          const gpLabel = formatSalesRowGpPct(gpPct);
          const change =
            showLy &&
            row.change_pct != null &&
            Number.isFinite(Number(row.change_pct))
              ? Number(row.change_pct)
              : null;
          const changeColor =
            change == null
              ? SALES.subtitle
              : change >= 0
                ? SALES.green
                : SALES.red;
          const canDrill = rowDrillable();
          const RowWrap = canDrill ? TouchableOpacity : View;
          const rawLabel = String(row.label || row.id || "");
          const rowLabel = inDrill
            ? displaySalesDrillRowLabel(rawLabel, drillStack)
            : rawLabel;
          const avatarText = inDrill
            ? drillRowAvatarInitials(rawLabel, rowLabel)
            : initialsFromLabel(rawLabel);
          return (
            <RowWrap
              key={`${row.id}-${i}`}
              style={styles.row}
              {...(canDrill
                ? {
                    activeOpacity: 0.85,
                    onPress: () => onRowPress(row),
                  }
                : {})}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{avatarText}</Text>
              </View>
              <View style={styles.rowBody}>
                <View style={styles.rowTop}>
                  <Text style={styles.rowLabel} numberOfLines={1}>
                    {rowLabel}
                  </Text>
                  <Text style={styles.rowValue}>
                    {formatCurrency(val, currency, {
                      compact: true,
                      hideCode: false,
                    })}
                  </Text>
                </View>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${pct}%` }]} />
                </View>
              </View>
              {gpLabel || change != null ? (
                <View style={styles.metricsCol}>
                  {gpLabel ? (
                    <Text style={styles.gpPct}>{gpLabel}</Text>
                  ) : null}
                  {change != null ? (
                    <Text style={[styles.lyPct, { color: changeColor }]}>
                      {change >= 0 ? "+" : ""}
                      {change.toFixed(1)}% LY
                    </Text>
                  ) : null}
                </View>
              ) : null}
              {canDrill ? (
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={SALES.subtitle}
                />
              ) : null}
            </RowWrap>
          );
        })
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: SALES.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SALES.border,
    padding: 12,
    marginBottom: 12,
  },
  segment: {
    flexDirection: "row",
    flexWrap: "wrap",
    backgroundColor: "#f1f5f9",
    borderRadius: 10,
    padding: 4,
    gap: 4,
    marginBottom: 10,
  },
  tab: {
    flexGrow: 1,
    flexBasis: "22%",
    alignItems: "center",
    paddingVertical: 7,
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: SALES.link,
  },
  tabText: {
    fontSize: 10,
    fontFamily: Fonts.bodySemi,
    color: SALES.subtitle,
    textAlign: "center",
  },
  tabTextActive: {
    color: "#fff",
  },
  drillBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: SALES.border,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  backText: {
    fontSize: 12,
    fontFamily: Fonts.bodySemi,
    color: SALES.link,
  },
  drillPath: {
    flex: 1,
    fontSize: 10,
    fontFamily: Fonts.body,
    color: SALES.subtitle,
    lineHeight: 14,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
  },
  loadingText: {
    fontSize: 12,
    color: SALES.subtitle,
    fontFamily: Fonts.body,
  },
  errorText: {
    fontSize: 12,
    color: SALES.red,
    fontFamily: Fonts.body,
    paddingVertical: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f1f5f9",
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#e0e7ff",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 11,
    fontFamily: Fonts.bodyBold,
    color: SALES.link,
  },
  rowBody: { flex: 1, minWidth: 0 },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 4,
  },
  rowLabel: {
    flex: 1,
    fontSize: 12,
    fontFamily: Fonts.bodySemi,
    color: SALES.value,
  },
  rowValue: {
    fontSize: 11,
    fontFamily: Fonts.bodyBold,
    color: SALES.value,
  },
  barTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: "#eef2ff",
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: SALES.link,
  },
  metricsCol: {
    minWidth: 56,
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 2,
  },
  gpPct: {
    fontSize: 10,
    fontFamily: Fonts.bodySemi,
    color: SALES.subtitle,
    textAlign: "right",
  },
  lyPct: {
    fontSize: 10,
    fontFamily: Fonts.bodySemi,
    textAlign: "right",
  },
  empty: {
    color: SALES.subtitle,
    fontSize: 12,
    fontFamily: Fonts.body,
    paddingVertical: 8,
  },
});
