import React, { useMemo } from "react";
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
const DEFAULT_METRIC_LABEL = "Net Sales";

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

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function rowMoneyAmount(row: AnalysisRow): number {
  const cells = row.meta?.cells as Record<string, unknown> | undefined;
  const raw =
    cells?.net_sales ??
    cells?.amount ??
    cells?.value_sar ??
    cells?.total ??
    row.meta?.net_sales ??
    row.meta?.amount ??
    row.value;
  return Math.abs(num(raw) ?? 0);
}

function humanizeMetricKey(raw: string): string {
  const s = raw.trim();
  if (!s) return DEFAULT_METRIC_LABEL;
  if (/^net[_\s-]?sales?$/i.test(s)) return DEFAULT_METRIC_LABEL;
  if (/^total[_\s-]?sales?$/i.test(s)) return "Total Sales";
  if (/^gross[_\s-]?profit$/i.test(s)) return "Gross Profit";
  if (s.includes("_")) {
    return s
      .split("_")
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  }
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function metricLabelForEntry(entry: SalesWidgetEntry): string {
  const root = entry.payload as unknown as Record<string, unknown>;
  const meta = (root.meta || {}) as Record<string, unknown>;
  const chart = root.chart as Record<string, unknown> | undefined;
  const config = (entry.payload.config || {}) as Record<string, unknown>;

  for (const v of [
    meta.metric_label,
    meta.value_label,
    config.metric_label,
    chart?.metric_label,
    meta.metric,
    chart?.metric,
  ]) {
    if (v == null || v === "") continue;
    return humanizeMetricKey(String(v));
  }
  return DEFAULT_METRIC_LABEL;
}

export function ManagementAttentionStrip({ entry }: Props) {
  const rows = rowsFromEntry(entry);
  const currency = entry.payload.currency || "SAR";
  const metricLabel = useMemo(() => metricLabelForEntry(entry), [entry]);

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
            const amountNum = rowMoneyAmount(row);
            const displayAmount = formatCurrency(amountNum, currency, {
              compact: true,
              hideCode: false,
            });
            return (
              <TouchableOpacity
                key={`${row.id}-${i}`}
                style={styles.card}
                activeOpacity={0.88}
              >
                <Text style={styles.metricLabel}>{metricLabel}</Text>
                <View style={[styles.iconWrap, { backgroundColor: visual.bg }]}>
                  <Ionicons name={visual.icon} size={18} color={visual.color} />
                </View>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {row.label}
                </Text>
                <Text style={[styles.count, { color: visual.color }]}>
                  {displayAmount}
                </Text>
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
  metricLabel: {
    fontSize: 10,
    fontFamily: Fonts.bodySemi,
    color: SALES.subtitle,
    letterSpacing: 0.35,
    textTransform: "uppercase",
    marginBottom: 8,
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
  empty: {
    color: SALES.subtitle,
    fontSize: 12,
    fontFamily: Fonts.body,
    paddingVertical: 8,
  },
});
