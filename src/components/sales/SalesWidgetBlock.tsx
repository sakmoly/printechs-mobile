import React from "react";
import { View, StyleSheet } from "react-native";
import type { SalesWidgetEntry } from "../../screens/sales/buildSalesSections";
import type { SalesByDrillScope } from "../../utils/salesByDivisionDrill";
import { SalesTrendChart } from "./SalesTrendChart";
import { SalesByTabs } from "./SalesByTabs";
import { ManagementAttentionStrip } from "./ManagementAttentionStrip";
import { SalesKpiCard } from "./SalesKpiCard";

type Props = {
  entry: SalesWidgetEntry;
  showLy?: boolean;
  salesByScope?: SalesByDrillScope;
};

export function SalesWidgetBlock({ entry, showLy = true, salesByScope }: Props) {
  const { widgetType, layout } = entry;

  switch (widgetType) {
    case "LINE":
      return <SalesTrendChart entry={entry} />;
    case "DONUT":
    case "PIE":
      if (layout === "summary_donut") return null;
      return (
        <SalesByTabs
          entries={[entry]}
          scope={salesByScope}
          showLy={showLy}
        />
      );
    case "RANKING":
    case "TABLE":
      return (
        <SalesByTabs
          entries={[entry]}
          scope={salesByScope}
          showLy={showLy}
        />
      );
    case "LIST":
      return <ManagementAttentionStrip entry={entry} />;
    case "KPI":
      return (
        <View style={styles.kpiWrap}>
          <SalesKpiCard
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
