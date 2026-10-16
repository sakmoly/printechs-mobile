import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { DashboardWidgetDataResponse } from "../../api/dashboardWidgetData";
import { formatCurrency } from "../../utils/currency";
import { AGING_COLORS, RECEIVABLES } from "../../screens/receivables/receivablesTheme";
import { ReceivablesSectionHeader } from "./ReceivablesSectionHeader";
import { Fonts } from "../../theme/typography";
import { sortAgingSeries } from "../../utils/inventoryAgingUtils";
import {
  openReceivablesAgingBucketList,
  openReceivablesWidgetList,
  type ReceivablesWidgetListScope,
} from "../../utils/receivablesNavigation";
import {
  receivablesBucketDrillValue,
  resolveReceivablesAgingDrillWidgetKey,
} from "../../utils/receivablesAgingUtils";

type Props = {
  payload: DashboardWidgetDataResponse;
  title?: string;
  listScope?: Omit<
    ReceivablesWidgetListScope,
    "widgetKey" | "title" | "aging_bucket" | "aging_bucket_label"
  >;
};

export function HorizontalAgingBar({
  payload,
  title,
  listScope,
}: Props) {
  const currency = payload.currency || payload.meta.currency || "SAR";
  const sortedSeries = useMemo(
    () => sortAgingSeries(payload.chart?.series || []),
    [payload.chart?.series]
  );
  const total = useMemo(
    () => sortedSeries.reduce((s, p) => s + (Number(p.value) || 0), 0),
    [sortedSeries]
  );
  const drillWidgetKey = resolveReceivablesAgingDrillWidgetKey(payload);

  const openAllCustomers = () => {
    if (!listScope) return;
    openReceivablesWidgetList({
      widgetKey: "receivables_overdue_customers_table",
      title: "Top Overdue Customers",
      ...listScope,
    });
  };

  const onBucketPress = (point: (typeof sortedSeries)[number]) => {
    if (!listScope) return;
    const val = Number(point.value) || 0;
    if (val <= 0) return;
    const bucket = receivablesBucketDrillValue(point);
    openReceivablesAgingBucketList(drillWidgetKey, {
      ...bucket,
      cardTotal: val,
    }, listScope);
  };

  if (!sortedSeries.length) {
    return (
      <View style={styles.wrap}>
        <ReceivablesSectionHeader title={title || "Receivables Aging (SAR)"} />
        <Text style={styles.empty}>No aging data</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <ReceivablesSectionHeader
        title={title || "Receivables Aging (SAR)"}
        rightLabel={listScope ? "View All" : undefined}
        rightAction={listScope ? openAllCustomers : undefined}
      />
      <View style={styles.segmentTrack}>
        {sortedSeries.map((point, i) => {
          const val = Number(point.value) || 0;
          const pct = total > 0 ? (val / total) * 100 : 0;
          if (pct <= 0) return null;
          return (
            <View
              key={`seg-${point.label}-${i}`}
              style={[
                styles.segment,
                {
                  flex: pct,
                  backgroundColor: AGING_COLORS[i % AGING_COLORS.length],
                },
              ]}
            />
          );
        })}
      </View>
      <Text style={styles.hint}>Tap a bucket to see customers in that age range.</Text>
      <View style={styles.bucketList}>
        {sortedSeries.map((point, i) => {
          const val = Number(point.value) || 0;
          const pct = total > 0 ? (val / total) * 100 : 0;
          const tappable = Boolean(listScope && val > 0);
          const color = AGING_COLORS[i % AGING_COLORS.length];
          return (
            <TouchableOpacity
              key={`${point.label}-${i}`}
              style={[styles.bucketCard, !tappable && styles.bucketCardMuted]}
              activeOpacity={tappable ? 0.85 : 1}
              disabled={!tappable}
              onPress={() => onBucketPress(point)}
            >
              <View style={[styles.bucketAccent, { backgroundColor: color }]} />
              <View style={styles.bucketBody}>
                <Text style={styles.bucketLabel} numberOfLines={2}>
                  {point.label}
                </Text>
                <Text style={styles.bucketAmount}>
                  {formatCurrency(val, currency, {
                    compact: false,
                    hideCode: true,
                    decimals: 0,
                  })}
                </Text>
                <Text style={styles.bucketPct}>{pct.toFixed(1)}% of total</Text>
              </View>
              {tappable ? (
                <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: RECEIVABLES.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: RECEIVABLES.border,
    marginBottom: 12,
    shadowColor: "#0f172a",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  segmentTrack: {
    flexDirection: "row",
    height: 10,
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: "#f1f5f9",
    marginBottom: 8,
  },
  segment: {
    height: "100%",
    minWidth: 2,
  },
  hint: {
    fontSize: 11,
    fontFamily: Fonts.body,
    color: RECEIVABLES.subtitle,
    marginBottom: 10,
  },
  bucketList: {
    gap: 8,
  },
  bucketCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#eef2f6",
    overflow: "hidden",
    minHeight: 72,
  },
  bucketCardMuted: {
    opacity: 0.65,
  },
  bucketAccent: {
    width: 4,
    alignSelf: "stretch",
  },
  bucketBody: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    minWidth: 0,
  },
  bucketLabel: {
    fontSize: 13,
    fontFamily: Fonts.bodySemi,
    color: RECEIVABLES.title,
    lineHeight: 17,
    marginBottom: 4,
  },
  bucketAmount: {
    fontSize: 16,
    fontFamily: Fonts.bodyBold,
    color: RECEIVABLES.value,
  },
  bucketPct: {
    fontSize: 11,
    fontFamily: Fonts.body,
    color: RECEIVABLES.subtitle,
    marginTop: 2,
  },
  empty: {
    color: RECEIVABLES.subtitle,
    fontSize: 13,
    fontFamily: Fonts.body,
  },
});
