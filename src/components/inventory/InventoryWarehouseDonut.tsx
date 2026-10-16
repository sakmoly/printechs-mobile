import React from "react";
import { View, Text, StyleSheet } from "react-native";
import type { InventoryWidgetEntry } from "../../screens/inventory/buildInventorySections";
import type { AnalysisRow } from "../../api/genericAnalysisTypes";
import { AnalysisPieChart } from "../analytics/AnalysisPieChart";
import { formatCurrency } from "../../utils/currency";
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
      id: String(p.dimension_value || p.label || `s-${i}`),
      label: String(p.label || `Slice ${i + 1}`),
      value: Number(p.value) || 0,
    }));
  }
  return entry.payload.rows || entry.payload.table?.rows || [];
}

function totalFromRows(rows: AnalysisRow[]): number {
  return rows.reduce((s, r) => s + (Number(r.value) || 0), 0);
}

export function InventoryWarehouseDonut({ entry }: Props) {
  const rows = rowsFromEntry(entry);
  const currency = entry.payload.currency || "SAR";
  const total = totalFromRows(rows);

  if (!rows.length) return null;

  return (
    <View style={styles.wrap}>
      <InventorySectionHeader
        title={entry.label || "Inventory Value by Warehouse"}
        rightLabel="View All"
      />
      {rows.length ? (
        <AnalysisPieChart
          rows={rows}
          currency={currency}
          title=""
          donut
          maxSlices={8}
          config={entry.payload.config}
        />
      ) : (
        <Text style={styles.empty}>No chart data</Text>
      )}
      {total > 0 ? (
        <Text style={styles.total}>
          {formatCurrency(total, currency, {
            compact: true,
            hideCode: false,
          })}{" "}
          Total
        </Text>
      ) : null}
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
  empty: {
    fontSize: 13,
    color: INVENTORY.subtitle,
    fontFamily: Fonts.body,
    textAlign: "center",
    paddingVertical: 24,
  },
  total: {
    marginTop: 8,
    textAlign: "center",
    fontSize: 13,
    fontFamily: Fonts.bodySemi,
    color: INVENTORY.subtitle,
  },
});
