import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
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

const ACTIVITY_ICONS: Record<string, { icon: IonIcon; color: string }> = {
  sales: { icon: "receipt-outline", color: HOME.green },
  invoice: { icon: "receipt-outline", color: HOME.green },
  purchase: { icon: "cart-outline", color: HOME.orange },
  grn: { icon: "cube-outline", color: HOME.purple },
  receipt: { icon: "cube-outline", color: HOME.purple },
  payment: { icon: "wallet-outline", color: HOME.red },
};

const ACTIVITY_BGS: Record<string, string> = {
  sales: "#f0fdf4",
  invoice: "#f0fdf4",
  purchase: "#fff7ed",
  grn: "#f5f3ff",
  receipt: "#f5f3ff",
  payment: "#fef2f2",
};

function activityBg(label: string): string {
  const k = label.toLowerCase();
  for (const [key, bg] of Object.entries(ACTIVITY_BGS)) {
    if (k.includes(key)) return bg;
  }
  return "#f8fafc";
}

function activityVisual(label: string): { icon: IonIcon; color: string } {
  const k = label.toLowerCase();
  for (const [key, visual] of Object.entries(ACTIVITY_ICONS)) {
    if (k.includes(key)) return visual;
  }
  return { icon: "document-text-outline", color: HOME.subtitle };
}

function timeAgo(row: AnalysisRow): string {
  const cells = row.meta?.cells as Record<string, unknown> | undefined;
  const raw =
    cells?.time_ago ??
    cells?.ago ??
    row.meta?.time_ago ??
    row.meta?.timestamp;
  if (raw != null) return String(raw);
  return "";
}

function customerName(row: AnalysisRow): string {
  const cells = row.meta?.cells as Record<string, unknown> | undefined;
  return String(
    cells?.customer ??
      cells?.party ??
      cells?.subtitle ??
      row.meta?.customer ??
      ""
  ).trim();
}

export function HomeRecentActivities({ entry }: Props) {
  const rows = entry.payload.rows?.length ? entry.payload.rows : [];
  const currency = entry.payload.currency || "SAR";

  if (!rows.length) return null;

  return (
    <View style={styles.wrap}>
      <HomeSectionHeader title={entry.label || "Recent Activities"} />
      {rows.slice(0, 6).map((row, i) => {
        const visual = activityVisual(row.label);
        const party = customerName(row);
        const ago = timeAgo(row);
        const amount = Number(row.value) || 0;
        return (
          <TouchableOpacity
            key={`${row.id}-${i}`}
            style={styles.row}
            activeOpacity={0.85}
          >
            <View
              style={[styles.iconWrap, { backgroundColor: activityBg(row.label) }]}
            >
              <Ionicons name={visual.icon} size={16} color={visual.color} />
            </View>
            <View style={styles.body}>
              <Text style={styles.type} numberOfLines={1}>
                {row.label}
              </Text>
              {party ? (
                <Text style={styles.party} numberOfLines={1}>
                  {party}
                </Text>
              ) : null}
            </View>
            <View style={styles.right}>
              {amount > 0 ? (
                <Text style={styles.amount}>
                  {formatCurrency(amount, currency, {
                    compact: false,
                    hideCode: false,
                    decimals: 0,
                  })}
                </Text>
              ) : null}
              {ago ? <Text style={styles.ago}>{ago}</Text> : null}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: HOME.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: HOME.border,
    padding: 12,
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f1f5f9",
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1, minWidth: 0 },
  type: {
    fontSize: 12,
    fontFamily: Fonts.bodySemi,
    color: HOME.value,
  },
  party: {
    fontSize: 11,
    fontFamily: Fonts.body,
    color: HOME.subtitle,
    marginTop: 2,
  },
  right: { alignItems: "flex-end" },
  amount: {
    fontSize: 12,
    fontFamily: Fonts.bodyBold,
    color: HOME.value,
  },
  ago: {
    fontSize: 10,
    fontFamily: Fonts.body,
    color: HOME.subtitle,
    marginTop: 2,
  },
});
