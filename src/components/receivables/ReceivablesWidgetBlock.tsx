import React, { useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ReceivablesWidgetEntry } from "../../screens/receivables/buildReceivablesSections";
import { AnalysisLineChart } from "../analytics/AnalysisLineChart";
import { RECEIVABLES } from "../../screens/receivables/receivablesTheme";
import {
  buildTrendCompareRows,
  trendHasLy,
  TREND_COMPARE_CHART_COLORS,
} from "../../utils/trendChartRows";
import { HorizontalAgingBar } from "./HorizontalAgingBar";
import { OverdueRankingList } from "./OverdueRankingList";
import { AttentionAlertList } from "./AttentionAlertList";
import { Fonts } from "../../theme/typography";
import type { ReceivablesWidgetListScope } from "../../utils/receivablesNavigation";

export function ReceivablesTrendChart({ entry }: { entry: ReceivablesWidgetEntry }) {
  const rows = useMemo(
    () => buildTrendCompareRows(entry.payload, { fillMonths: false }),
    [entry.payload]
  );
  const hasLy = trendHasLy(rows);
  if (!rows.length) return null;
  const title = entry.label || "Overdue Trend (SAR)";

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>
          {title.toUpperCase()}
        </Text>
        <TouchableOpacity style={styles.monthlyPill} activeOpacity={0.85}>
          <Text style={styles.monthlyText}>Monthly</Text>
          <Ionicons name="chevron-down" size={12} color={RECEIVABLES.subtitle} />
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

type Props = {
  entry: ReceivablesWidgetEntry;
  listScope?: Omit<
    ReceivablesWidgetListScope,
    "widgetKey" | "title" | "aging_bucket" | "aging_bucket_label"
  >;
};

export function ReceivablesWidgetBlock({ entry, listScope }: Props) {
  const { payload, label, widgetType, key } = entry;

  switch (widgetType) {
    case "BAR":
      return (
        <HorizontalAgingBar
          payload={payload}
          title={label || "Receivables Aging (SAR)"}
          listScope={listScope}
        />
      );
    case "LINE":
      return <ReceivablesTrendChart entry={entry} />;
    case "RANKING":
    case "TABLE":
      return (
        <OverdueRankingList
          payload={payload}
          title={label || "Top 5 Overdue Customers"}
          compact
        />
      );
    case "LIST":
      return (
        <AttentionAlertList
          payload={payload}
          title={label || "Attention Required"}
          compact
        />
      );
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: RECEIVABLES.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: RECEIVABLES.border,
    marginBottom: 12,
    shadowColor: "#0f172a",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
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
    color: RECEIVABLES.title,
    letterSpacing: 0.4,
  },
  monthlyPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    borderWidth: 1,
    borderColor: RECEIVABLES.border,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 2,
  },
  monthlyText: {
    fontSize: 11,
    fontFamily: Fonts.bodySemi,
    color: RECEIVABLES.subtitle,
  },
});
