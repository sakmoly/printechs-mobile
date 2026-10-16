import React from "react";
import type { InventoryWidgetEntry } from "../../screens/inventory/buildInventorySections";
import { InventoryTrendChart } from "./InventoryTrendChart";
import { InventoryWarehouseDonut } from "./InventoryWarehouseDonut";
import { InventoryMovementInsights } from "./InventoryMovementInsights";
import { InventoryAgingBar } from "./InventoryAgingBar";
import { InventoryStockCoverDonut } from "./InventoryStockCoverDonut";
import { InventoryHealthGauge } from "./InventoryHealthGauge";
import { InventoryTopItemsList } from "./InventoryTopItemsList";
import { InventoryAlertsList } from "./InventoryAlertsList";
import { InventoryKpiCard } from "./InventoryKpiCard";
import { View, StyleSheet } from "react-native";

type Props = {
  entry: InventoryWidgetEntry;
  showLy?: boolean;
};

export function InventoryWidgetBlock({ entry, showLy = true }: Props) {
  const { widgetType } = entry;

  switch (widgetType) {
    case "LINE":
      return <InventoryTrendChart entry={entry} />;
    case "DONUT":
    case "PIE":
      return <InventoryWarehouseDonut entry={entry} />;
    case "BAR":
      return <InventoryAgingBar entry={entry} />;
    case "LIST":
      return <InventoryAlertsList entry={entry} />;
    case "RANKING":
    case "TABLE":
      return <InventoryTopItemsList entry={entry} />;
    case "KPI":
      return (
        <View style={styles.kpiWrap}>
          <InventoryKpiCard
            payload={entry.payload}
            label={entry.label}
            showLy={showLy}
          />
        </View>
      );
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  kpiWrap: { marginBottom: 10 },
});
