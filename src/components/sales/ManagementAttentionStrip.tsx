import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import type { SalesWidgetEntry } from "../../screens/sales/buildSalesSections";
import type { AnalysisRow } from "../../api/genericAnalysisTypes";
import { formatCurrency } from "../../utils/currency";
import { SALES } from "../../screens/sales/salesTheme";
import { SalesSectionHeader } from "./SalesSectionHeader";
import { Fonts } from "../../theme/typography";

type IonIcon = ComponentProps<typeof Ionicons>["name"];

type Props = {
  entry: SalesWidgetEntry;
};

const CARD_W = 168;

function cardVisual(label: string): { icon: IonIcon; color: string; bg: string } {
  const l = label.toLowerCase();
  if (/overdue/.test(l)) {
    return { icon: "alert-circle", color: "#dc2626", bg: "#fef2f2" };
  }
  if (/ship/.test(l)) {
    return { icon: "warning", color: "#ea580c", bg: "#fff7ed" };
  }
  if (/margin|low/.test(l)) {
    return { icon: "information-circle", color: "#2563eb", bg: "#eff6ff" };
  }
  if (/return/.test(l)) {
    return { icon: "refresh", color: "#7c3aed", bg: "#f5f3ff" };
  }
  if (/stock|out of/.test(l)) {
    return { icon: "cube-outline", color: "#ca8a04", bg: "#fefce8" };
  }
  return { icon: "flag-outline", color: SALES.link, bg: "#eef2ff" };
}

function rowsFromEntry(entry: SalesWidgetEntry): AnalysisRow[] {
  if (entry.payload.rows?.length) return entry.payload.rows;
  if (entry.payload.table?.rows?.length) return entry.payload.table.rows;
  return [];
}

function rowAmount(row: AnalysisRow, currency: string): string | null {
  const cells = row.meta?.cells as Record<string, unknown> | undefined;
  const raw =
    cells?.amount ??
    cells?.value_sar ??
    cells?.total ??
    row.meta?.amount;
  if (raw == null || !Number.isFinite(Number(raw))) return null;
  return formatCurrency(Number(raw), currency, {
    compact: true,
    hideCode: false,
  });
}

export function ManagementAttentionStrip({ entry }: Props) {
  const rows = rowsFromEntry(entry);
  const currency = entry.payload.currency || "SAR";

  return (
    <View style={styles.wrap}>
      <SalesSectionHeader
        title={entry.label || "Management Attention"}
        rightLabel="View All"
      />
      {!rows.length ? (
        <Text style={styles.empty}>No attention items</Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        >
          {rows.map((row, i) => {
            const visual = cardVisual(row.label);
            const value = Number(row.value) || 0;
            const amount = rowAmount(row, currency);
            const displayValue = amount
              ? value.toLocaleString("en-US", { maximumFractionDigits: 0 })
              : formatCurrency(value, currency, {
                  compact: true,
                  hideCode: false,
                });
            return (
              <TouchableOpacity
                key={`${row.id}-${i}`}
                style={styles.card}
                activeOpacity={0.88}
              >
                <View style={[styles.iconWrap, { backgroundColor: visual.bg }]}>
                  <Ionicons name={visual.icon} size={18} color={visual.color} />
                </View>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {row.label}
                </Text>
                <Text style={[styles.count, { color: visual.color }]}>
                  {displayValue}
                </Text>
                {amount ? (
                  <Text style={styles.amount}>{amount}</Text>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  scroll: { gap: 10, paddingRight: 4 },
  card: {
    width: CARD_W,
    backgroundColor: SALES.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SALES.border,
    padding: 12,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 11,
    fontFamily: Fonts.bodySemi,
    color: SALES.value,
    minHeight: 30,
    lineHeight: 14,
  },
  count: {
    fontSize: 22,
    fontFamily: Fonts.bodyBold,
    marginTop: 4,
  },
  amount: {
    fontSize: 11,
    fontFamily: Fonts.body,
    color: SALES.subtitle,
    marginTop: 2,
  },
  empty: {
    color: SALES.subtitle,
    fontSize: 12,
    fontFamily: Fonts.body,
    paddingVertical: 8,
  },
});
