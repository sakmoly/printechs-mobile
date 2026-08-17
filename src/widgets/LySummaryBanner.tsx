/**
 * LY comparison summary banner — uses BA chart.summary.display hints.
 * Desk Layout Mode "header" + Header Compact → title | values on one line.
 */

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatCurrency } from "../utils/currency";
import { Fonts } from "../theme/typography";
import type { ChartLySummary } from "../api/dashboardWidgetData";

export type LyBannerLayout = "stack" | "inline";
export type LyBannerAlign = "left" | "right" | "center";

type Props = {
  summary?: ChartLySummary | null;
  showLy?: boolean;
  currency?: string;
  /** Optional metric label (Desk widget Label) */
  metricLabel?: string;
  /**
   * stack = title above values (default)
   * inline = title left, values right (Desk layout mode "header")
   */
  layout?: LyBannerLayout;
  /** Where the title sits in inline mode */
  titleAlign?: LyBannerAlign;
  compact?: boolean;
};

function iconName(
  icon?: string | null
): keyof typeof Ionicons.glyphMap {
  const k = String(icon || "").toLowerCase();
  if (k === "arrow-up" || k === "up" || k === "trending-up") {
    return "arrow-up";
  }
  if (k === "arrow-down" || k === "down" || k === "trending-down") {
    return "arrow-down";
  }
  if (k === "minus" || k === "flat" || k === "remove") {
    return "remove";
  }
  return "remove";
}

export function LySummaryBanner({
  summary,
  showLy,
  currency = "SAR",
  metricLabel,
  layout = "stack",
  titleAlign = "left",
  compact,
}: Props) {
  if (!showLy || !summary) return null;

  const display = summary.display || {};
  const color = display.color || "#64748b";
  const showValue = display.show_value !== false;
  const showPct =
    display.show_percentage !== false && summary.change_pct != null;
  const pct =
    summary.change_pct != null ? Math.abs(Number(summary.change_pct)) : null;

  const values = (
    <View
      style={[
        styles.valuesRow,
        layout === "inline" && titleAlign === "right" && styles.valuesRowStart,
      ]}
    >
      <Text style={[styles.value, compact && styles.valueCompact]}>
        {formatCurrency(summary.value, currency, {
          compact: true,
          hideCode: true,
        })}
      </Text>
      {showValue && summary.value_ly != null ? (
        <Text style={styles.vsLy}>
          {" "}
          vs LY{" "}
          {formatCurrency(summary.value_ly, currency, {
            compact: true,
            hideCode: true,
          })}
        </Text>
      ) : null}
      {showPct && pct != null ? (
        <View style={styles.pctRow}>
          <Ionicons name={iconName(display.icon)} size={14} color={color} />
          <Text style={[styles.pct, { color }]}>{pct.toFixed(1)}%</Text>
        </View>
      ) : null}
    </View>
  );

  const titleEl =
    metricLabel && String(metricLabel).trim() ? (
      <Text
        style={[
          styles.metric,
          layout === "inline" && styles.metricInline,
          compact && styles.metricCompact,
        ]}
        numberOfLines={1}
      >
        {metricLabel}
      </Text>
    ) : null;

  if (layout === "inline") {
    // One compact column-group: title then values (no stretch to opposite edges).
    // headerAlign places that group left / center / right on the card.
    const justify =
      titleAlign === "right"
        ? "flex-end"
        : titleAlign === "center"
          ? "center"
          : "flex-start";
    return (
      <View
        style={[
          styles.inlineWrap,
          compact && styles.inlineWrapCompact,
          { justifyContent: justify },
        ]}
      >
        {titleEl}
        {values}
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {titleEl}
      {values}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 0,
  },
  inlineWrap: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "nowrap",
    gap: 8,
  },
  inlineWrapCompact: {
    minHeight: 28,
  },
  inlineWrapReverse: {
    flexDirection: "row-reverse",
  },
  inlineSpacer: {
    flex: 1,
    minWidth: 8,
  },
  metric: {
    fontFamily: Fonts.bodySemi,
    fontSize: 11,
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  metricInline: {
    marginBottom: 0,
    flexShrink: 1,
    marginRight: 10,
  },
  metricCompact: {
    fontSize: 10,
    letterSpacing: 0.3,
  },
  valuesRow: {
    flexDirection: "row",
    flexWrap: "nowrap",
    alignItems: "center",
    flexShrink: 1,
  },
  valuesRowStart: {
    justifyContent: "flex-start",
  },
  value: {
    fontFamily: Fonts.bodyBold,
    fontSize: 18,
    color: "#0f172a",
  },
  valueCompact: {
    fontSize: 16,
  },
  vsLy: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: "#64748b",
  },
  pctRow: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 6,
    gap: 2,
  },
  pct: {
    fontFamily: Fonts.bodySemi,
    fontSize: 12,
  },
});
