import React from "react";
import { View, StyleSheet } from "react-native";
import { InventoryKpiCard } from "./InventoryKpiCard";
import type { InventoryWidgetEntry } from "../../screens/inventory/buildInventorySections";

type Props = {
  items: InventoryWidgetEntry[];
  columns?: number;
  showLy?: boolean;
};

export function InventoryKpiRowGrid({
  items,
  columns = 2,
  showLy = true,
}: Props) {
  const rows: InventoryWidgetEntry[][] = [];
  for (let i = 0; i < items.length; i += columns) {
    rows.push(items.slice(i, i + columns));
  }
  return (
    <>
      {rows.map((row, ri) => (
        <View key={`inv-kpi-row-${ri}`} style={styles.row}>
          {row.map((item) => (
            <InventoryKpiCard
              key={item.key}
              payload={item.payload}
              label={item.label}
              showLy={showLy}
            />
          ))}
          {row.length < columns
            ? Array.from({ length: columns - row.length }).map((_, si) => (
                <View key={`spacer-${si}`} style={styles.spacer} />
              ))
            : null}
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },
  spacer: { flex: 1 },
});
