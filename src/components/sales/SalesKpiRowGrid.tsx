import React from "react";
import { View, StyleSheet } from "react-native";
import { SalesKpiCard } from "./SalesKpiCard";
import type { SalesWidgetEntry } from "../../screens/sales/buildSalesSections";
import {
  openSalesKpiDrill,
  salesKpiDrillWidgetKey,
  type SalesWidgetListScope,
} from "../../utils/salesNavigation";
import {
  isOpenSalesOrdersKpiWidget,
  type OpenSalesOrdersKpiDisplay,
} from "../../utils/openSalesOrdersKpi";

type Props = {
  items: SalesWidgetEntry[];
  columns?: number;
  showLy?: boolean;
  listScope?: Omit<SalesWidgetListScope, "widgetKey" | "title">;
  openSoKpi?: OpenSalesOrdersKpiDisplay | null;
  openSoKpiLoading?: boolean;
};

export function SalesKpiRowGrid({
  items,
  columns = 2,
  showLy = true,
  listScope,
  openSoKpi,
  openSoKpiLoading,
}: Props) {
  const rows: SalesWidgetEntry[][] = [];
  for (let i = 0; i < items.length; i += columns) {
    rows.push(items.slice(i, i + columns));
  }
  return (
    <>
      {rows.map((row, ri) => (
        <View key={`sales-kpi-row-${ri}`} style={styles.row}>
          {row.map((item) => (
            <SalesKpiCard
              key={item.key}
              payload={item.payload}
              label={item.label}
              showLy={showLy}
              onPress={
                listScope &&
                (salesKpiDrillWidgetKey(item.key) ||
                  item.payload.config?.drill_widget_key)
                  ? () =>
                      openSalesKpiDrill(
                        item.key,
                        item.label,
                        listScope,
                        item.payload.config
                      )
                  : undefined
              }
              openSoKpi={
                isOpenSalesOrdersKpiWidget(item.key, item.label)
                  ? openSoKpi
                  : undefined
              }
              openSoKpiLoading={
                isOpenSalesOrdersKpiWidget(item.key, item.label)
                  ? openSoKpiLoading
                  : undefined
              }
              selectedTerritory={listScope?.selectedTerritory}
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
