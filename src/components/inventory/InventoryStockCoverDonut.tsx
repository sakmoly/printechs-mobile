import React from "react";
import { View, Text, StyleSheet } from "react-native";
import type { InventoryWidgetEntry } from "../../screens/inventory/buildInventorySections";
import type { AnalysisRow } from "../../api/genericAnalysisTypes";
import { AnalysisPieChart } from "../analytics/AnalysisPieChart";
import { INVENTORY } from "../../screens/inventory/inventoryTheme";
import { InventorySectionHeader } from "./InventorySectionHeader";
import { Fonts } from "../../theme/typography";

type Props = {
  entry: InventoryWidgetEntry;
};

function rowsFromEntry(entry: InventoryWidgetEntry): AnalysisRow[] {
  const series = entry.payload.chart?.series || [];
  if (series.length) {
    return series.map((p, i) => ({
      id: String(p.dimension_value || p.label || `c-${i}`),
      label: String(p.label || `Bucket ${i + 1}`),
      value: Number(p.value) || 0,
    }));
  }
  return entry.payload.rows || [];
}

export function InventoryStockCoverDonut({ entry }: Props) {
  const rows = rowsFromEntry(entry);
  const currency = entry.payload.currency || "SAR";

  if (!rows.length) return null;

  return (
    <View style={styles.wrap}>
      <InventorySectionHeader
        title={entry.label || "Stock Cover (By Value)"}
        rightLabel="View All"
      />
      <AnalysisPieChart
        rows={rows}
        currency={currency}
        title=""
        donut
        maxSlices={8}
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
});
