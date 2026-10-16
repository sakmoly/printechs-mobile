import React, { useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { InventoryWidgetEntry } from "../../screens/inventory/buildInventorySections";
import { AnalysisLineChart } from "../analytics/AnalysisLineChart";
import { INVENTORY } from "../../screens/inventory/inventoryTheme";
import {
  buildTrendCompareRows,
  trendHasLy,
  TREND_COMPARE_CHART_COLORS,
} from "../../utils/trendChartRows";
import { Fonts } from "../../theme/typography";

export function InventoryTrendChart({ entry }: { entry: InventoryWidgetEntry }) {
  const rows = useMemo(
    () => buildTrendCompareRows(entry.payload, { fillMonths: false }),
    [entry.payload]
  );
  const hasLy = trendHasLy(rows);

  if (!rows.length) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>
          {(entry.label || "Inventory Value Trend (SAR)").toUpperCase()}
        </Text>
        <TouchableOpacity style={styles.monthlyPill} activeOpacity={0.85}>
          <Text style={styles.monthlyText}>Monthly</Text>
          <Ionicons name="chevron-down" size={12} color={INVENTORY.subtitle} />
        </TouchableOpacity>
      </View>
      <AnalysisLineChart
        rows={rows}
        currency={entry.payload.currency || "SAR"}
        title=""
        showValueCards={false}
        embedded
        forceShowLyLegend={hasLy}
        legendCurrentLabel="This Year"
        legendLyLabel="Last Year"
        chartColors={TREND_COMPARE_CHART_COLORS}
        config={entry.payload.config}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: INVENTORY.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: INVENTORY.border,
    padding: 12,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 12,
    fontFamily: Fonts.bodyBold,
    color: INVENTORY.title,
    letterSpacing: 0.4,
  },
  monthlyPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: INVENTORY.border,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  monthlyText: {
    fontSize: 11,
    fontFamily: Fonts.bodySemi,
    color: INVENTORY.subtitle,
  },
});
