import React from "react";
import { View, StyleSheet } from "react-native";
import { ReceivablesKpiCard } from "./ReceivablesKpiCard";
import type { ReceivablesWidgetEntry } from "../../screens/receivables/buildReceivablesSections";
import {
  kpiDrillWidgetKey,
  openReceivablesKpiDrill,
  type ReceivablesWidgetListScope,
} from "../../utils/receivablesNavigation";

type Props = {
  items: ReceivablesWidgetEntry[];
  columns?: number;
  variant?: "overview" | "collection";
  showLy?: boolean;
  listScope?: Omit<ReceivablesWidgetListScope, "widgetKey" | "title">;
};

export function KpiRowGrid({
  items,
  columns = 2,
  variant = "overview",
  showLy = true,
  listScope,
}: Props) {
  const rows: ReceivablesWidgetEntry[][] = [];
  for (let i = 0; i < items.length; i += columns) {
    rows.push(items.slice(i, i + columns));
  }
  return (
    <>
      {rows.map((row, ri) => (
        <View key={`kpi-row-${ri}`} style={styles.row}>
          {row.map((item) => (
            <ReceivablesKpiCard
              key={item.key}
              payload={item.payload}
              label={item.label}
              variant={variant}
              showLy={showLy}
              onPress={
                listScope &&
                (kpiDrillWidgetKey(item.key) ||
                  item.payload.config?.drill_widget_key)
                  ? () =>
                      openReceivablesKpiDrill(
                        item.key,
                        item.label,
                        listScope,
                        item.payload.config
                      )
                  : undefined
              }
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
  spacer: {
    flex: 1,
  },
});
