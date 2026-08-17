import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  changeDirection,
  formatCurrency,
  formatPercent,
} from "../utils/currency";
import { Fonts, Type } from "../theme/typography";

type Metric = {
  label: string;
  value: string;
  tone?: "default" | "up" | "down";
};

type Props = {
  rank?: number;
  title: string;
  subtitle?: string;
  primary: string;
  changePct?: number | null;
  metrics?: Metric[];
  expanded?: boolean;
  onPress?: () => void;
};

export function RankingCard({
  rank,
  title,
  subtitle,
  primary,
  changePct,
  metrics = [],
  expanded,
  onPress,
}: Props) {
  const dir = changeDirection(changePct);
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={onPress ? 0.85 : 1}
      disabled={!onPress}
    >
      <View style={styles.top}>
        {rank != null && (
          <View style={styles.rankBadge}>
            <Text style={styles.rankText}>#{rank}</Text>
          </View>
        )}
        <View style={styles.titleBlock}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <View style={styles.primaryBlock}>
          <Text style={styles.primary}>{primary}</Text>
          {changePct != null && (
            <View style={styles.deltaRow}>
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
            </View>
          )}
        </View>
        {onPress && (
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-forward"}
            size={18}
            color="#9ca3af"
          />
        )}
      </View>
      {metrics.length > 0 && (
        <View style={styles.metrics}>
          {metrics.map((m) => (
            <View key={m.label} style={styles.metric}>
              <Text style={styles.metricLabel}>{m.label}</Text>
              <Text
                style={[
                  styles.metricValue,
                  m.tone === "up" && styles.up,
                  m.tone === "down" && styles.down,
                ]}
              >
                {m.value}
              </Text>
            </View>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}

export function currencyMetric(
  label: string,
  value: number | null | undefined,
  currency: string
) {
  return {
    label,
    value:
      value == null ? "—" : formatCurrency(value, currency, { compact: true }),
  };
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#eef2ff",
  },
  top: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  rankBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#eef2ff",
    alignItems: "center",
    justifyContent: "center",
  },
  rankText: {
    fontFamily: Fonts.display,
    fontSize: 12,
    color: "#667eea",
  },
  titleBlock: { flex: 1, minWidth: 0 },
  title: { ...Type.cardTitle, color: "#111827" },
  subtitle: { ...Type.caption, color: "#6b7280", marginTop: 2 },
  primaryBlock: { alignItems: "flex-end" },
  primary: { ...Type.kpiCompact, color: "#111827" },
  deltaRow: { flexDirection: "row", alignItems: "center", gap: 2, marginTop: 2 },
  delta: { ...Type.caption, fontFamily: Fonts.bodyBold, color: "#6b7280" },
  up: { color: "#059669" },
  down: { color: "#dc2626" },
  metrics: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 12,
    gap: 8,
  },
  metric: {
    minWidth: "30%",
    flexGrow: 1,
    backgroundColor: "#f9fafb",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  metricLabel: { ...Type.micro, color: "#9ca3af", textTransform: "uppercase" },
  metricValue: {
    ...Type.caption,
    fontFamily: Fonts.displaySemi,
    color: "#374151",
    marginTop: 2,
  },
});
