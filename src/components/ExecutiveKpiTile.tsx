import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  changeDirection,
  formatCurrency,
  formatPercent,
} from "../utils/currency";
import { Fonts, Type } from "../theme/typography";

type Props = {
  title: string;
  value: number | null | undefined;
  previous?: number | null;
  changePct?: number | null;
  format?: "currency" | "number" | "percent";
  currency?: string;
  subtitle?: string;
  onPress?: () => void;
  compact?: boolean;
  valueColor?: string;
};

export function ExecutiveKpiTile({
  title,
  value,
  previous,
  changePct,
  format = "currency",
  currency = "SAR",
  subtitle,
  onPress,
  compact,
  valueColor,
}: Props) {
  const dir = changeDirection(changePct);
  const display =
    format === "percent"
      ? value == null
        ? "—"
        : `${Number(value).toFixed(1)}%`
      : format === "number"
        ? value == null
          ? "—"
          : Number(value).toLocaleString("en-US")
        : formatCurrency(value, currency, { compact: true });

  const body = (
    <View style={[styles.card, compact && styles.cardCompact]}>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <Text
        style={[
          compact ? styles.valueCompact : styles.value,
          valueColor ? { color: valueColor } : null,
        ]}
        numberOfLines={1}
      >
        {display}
      </Text>
      {(changePct != null || previous != null) && (
        <View style={styles.deltaRow}>
          {changePct != null && (
            <>
              <Ionicons
                name={
                  dir === "up"
                    ? "trending-up"
                    : dir === "down"
                      ? "trending-down"
                      : "remove"
                }
                size={14}
                color={
                  dir === "up"
                    ? "#059669"
                    : dir === "down"
                      ? "#dc2626"
                      : "#6b7280"
                }
              />
              <Text
                style={[
                  styles.delta,
                  dir === "up" && styles.up,
                  dir === "down" && styles.down,
                ]}
              >
                {formatPercent(changePct)}
              </Text>
            </>
          )}
          {previous != null && format === "currency" && (
            <Text style={styles.prev} numberOfLines={1}>
              vs {formatCurrency(previous, currency, { compact: true })}
            </Text>
          )}
        </View>
      )}
      {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        style={styles.flex}
        onPress={onPress}
        activeOpacity={0.85}
      >
        {body}
      </TouchableOpacity>
    );
  }
  return <View style={styles.flex}>{body}</View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: "46%" },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#eef2ff",
    shadowColor: "#667eea",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    minHeight: 96,
  },
  cardCompact: {
    minHeight: 80,
    padding: 12,
  },
  title: {
    ...Type.label,
    color: "#6b7280",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  value: {
    ...Type.kpi,
    color: "#111827",
    marginBottom: 6,
  },
  valueCompact: {
    ...Type.kpiCompact,
    color: "#111827",
    marginBottom: 6,
  },
  deltaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexWrap: "wrap",
  },
  delta: {
    ...Type.caption,
    fontFamily: Fonts.bodyBold,
    color: "#6b7280",
  },
  up: { color: "#059669" },
  down: { color: "#dc2626" },
  prev: {
    ...Type.caption,
    color: "#9ca3af",
    marginLeft: 4,
  },
  sub: {
    marginTop: 4,
    ...Type.caption,
    color: "#9ca3af",
  },
});
