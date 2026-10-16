import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import type { InventoryWidgetEntry } from "../../screens/inventory/buildInventorySections";
import type { AnalysisRow } from "../../api/genericAnalysisTypes";
import { formatCurrency } from "../../utils/currency";
import { INVENTORY, MOVEMENT_COLORS } from "../../screens/inventory/inventoryTheme";
import { InventorySectionHeader } from "./InventorySectionHeader";
import { Fonts } from "../../theme/typography";

type IonIcon = ComponentProps<typeof Ionicons>["name"];

type Props = {
  entry: InventoryWidgetEntry;
};

const MOVEMENT_BG = ["#f0fdf4", "#eff6ff", "#fffbeb", "#f5f3ff", "#fef2f2"] as const;

const MOVEMENT_ICONS: IonIcon[] = [
  "trending-up",
  "pulse-outline",
  "analytics-outline",
  "remove-outline",
  "close-circle-outline",
];

function rowsFromEntry(entry: InventoryWidgetEntry): AnalysisRow[] {
  if (entry.payload.rows?.length) return entry.payload.rows;
  const series = entry.payload.chart?.series || [];
  if (series.length) {
    return series.map((p, i) => ({
      id: String(p.dimension_value || p.label || `m-${i}`),
      label: String(p.label || `Category ${i + 1}`),
      value: Number(p.value) || 0,
      change_pct: p.change_pct ?? null,
    }));
  }
  return entry.payload.kpis?.map((k, i) => ({
    id: String(k.key || `kpi-${i}`),
    label: String(k.label || k.key || `KPI ${i + 1}`),
    value: Number(k.value) || 0,
    change_pct: k.change_pct ?? null,
  })) || [];
}

export function InventoryMovementInsights({ entry }: Props) {
  const rows = useMemo(() => rowsFromEntry(entry), [entry]);
  const currency = entry.payload.currency || "SAR";
  const total = useMemo(
    () => rows.reduce((s, r) => s + (Number(r.value) || 0), 0),
    [rows]
  );

  if (!rows.length) return null;

  return (
    <View style={styles.wrap}>
      <InventorySectionHeader title={entry.label || "Movement Insights"} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {rows.map((row, i) => {
          const val = Number(row.value) || 0;
          const pct = total > 0 ? (val / total) * 100 : 0;
          const color = MOVEMENT_COLORS[i % MOVEMENT_COLORS.length];
          const icon = MOVEMENT_ICONS[i % MOVEMENT_ICONS.length];
          return (
            <View key={`${row.id}-${i}`} style={styles.card}>
              <View style={[styles.iconWrap, { backgroundColor: MOVEMENT_BG[i % MOVEMENT_BG.length] }]}>
                <Ionicons name={icon} size={16} color={color} />
              </View>
              <Text style={styles.label} numberOfLines={2}>
                {row.label}
              </Text>
              <Text style={styles.value}>
                {formatCurrency(val, currency, {
                  compact: true,
                  hideCode: true,
                })}
              </Text>
              <Text style={[styles.pct, { color }]}>{pct.toFixed(0)}%</Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: INVENTORY.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: INVENTORY.border,
    padding: 12,
    marginBottom: 12,
  },
  scroll: { gap: 8, paddingRight: 4 },
  card: {
    width: 112,
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: INVENTORY.border,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  label: {
    fontSize: 10,
    fontFamily: Fonts.bodySemi,
    color: INVENTORY.label,
    lineHeight: 13,
    minHeight: 26,
    marginBottom: 4,
  },
  value: {
    fontSize: 14,
    fontFamily: Fonts.bodyBold,
    color: INVENTORY.value,
  },
  pct: {
    marginTop: 2,
    fontSize: 11,
    fontFamily: Fonts.bodySemi,
  },
});
