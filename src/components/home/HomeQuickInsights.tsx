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
import type { HomeWidgetEntry } from "../../screens/home/buildHomeSections";
import type { AnalysisRow } from "../../api/genericAnalysisTypes";
import { formatCurrency } from "../../utils/currency";
import { HOME } from "../../screens/home/homeTheme";
import { HomeSectionHeader } from "./HomeSectionHeader";
import { Fonts } from "../../theme/typography";

type IonIcon = ComponentProps<typeof Ionicons>["name"];

type Props = {
  entry: HomeWidgetEntry;
};

const INSIGHT_ICONS: IonIcon[] = [
  "alert-circle",
  "cube-outline",
  "layers-outline",
  "airplane-outline",
  "document-text-outline",
];

const INSIGHT_BGS = ["#fef2f2", "#fffbeb", "#f5f3ff", "#f0fdf4", "#eff6ff"] as const;

const INSIGHT_COLORS = [
  HOME.red,
  HOME.amber,
  HOME.purple,
  HOME.green,
  HOME.link,
];

function rowsFromEntry(entry: HomeWidgetEntry): AnalysisRow[] {
  if (entry.payload.rows?.length) return entry.payload.rows;
  const series = entry.payload.chart?.series || [];
  return series.map((p, i) => ({
    id: String(p.dimension_value || p.label || `q-${i}`),
    label: String(p.label || `Insight ${i + 1}`),
    value: Number(p.value) || 0,
  }));
}

function subtitleForRow(row: AnalysisRow, currency: string): string {
  const cells = row.meta?.cells as Record<string, unknown> | undefined;
  const amount =
    cells?.amount ??
    cells?.value_amount ??
    row.meta?.amount;
  if (amount != null && Number.isFinite(Number(amount))) {
    return formatCurrency(Number(amount), currency, {
      compact: true,
      hideCode: false,
    });
  }
  if (/stock|movement|ship|grn/i.test(row.label)) {
    return "View Details";
  }
  return "";
}

export function HomeQuickInsights({ entry }: Props) {
  const rows = rowsFromEntry(entry);
  const currency = entry.payload.currency || "SAR";

  if (!rows.length) return null;

  return (
    <View style={styles.wrap}>
      <HomeSectionHeader title={entry.label || "Quick Insights"} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {rows.map((row, i) => {
          const count = Number(row.value) || 0;
          const icon = INSIGHT_ICONS[i % INSIGHT_ICONS.length];
          const color = INSIGHT_COLORS[i % INSIGHT_COLORS.length];
          const sub = subtitleForRow(row, currency);
          return (
            <TouchableOpacity
              key={`${row.id}-${i}`}
              style={styles.card}
              activeOpacity={0.85}
            >
              <View style={[styles.iconWrap, { backgroundColor: INSIGHT_BGS[i % INSIGHT_BGS.length] }]}>
                <Ionicons name={icon} size={18} color={color} />
              </View>
              <Text style={styles.label} numberOfLines={2}>
                {row.label}
              </Text>
              <Text style={styles.count}>{count.toLocaleString("en-US")}</Text>
              {sub ? (
                <Text style={[styles.sub, /view/i.test(sub) && styles.link]}>
                  {sub}
                </Text>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  scroll: { gap: 10, paddingRight: 4 },
  card: {
    width: 120,
    backgroundColor: HOME.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: HOME.border,
    padding: 12,
    alignItems: "center",
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  label: {
    fontSize: 10,
    fontFamily: Fonts.bodySemi,
    color: HOME.label,
    textAlign: "center",
    minHeight: 26,
    marginBottom: 4,
  },
  count: {
    fontSize: 20,
    fontFamily: Fonts.bodyBold,
    color: HOME.value,
  },
  sub: {
    marginTop: 4,
    fontSize: 10,
    fontFamily: Fonts.body,
    color: HOME.subtitle,
    textAlign: "center",
  },
  link: {
    color: HOME.link,
    fontFamily: Fonts.bodySemi,
  },
});
