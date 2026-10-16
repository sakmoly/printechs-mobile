import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { DashboardWidgetDataResponse } from "../../api/dashboardWidgetData";
import { formatCurrency } from "../../utils/currency";
import {
  RECEIVABLES,
  resolveKpiVisual,
} from "../../screens/receivables/receivablesTheme";
import { Fonts } from "../../theme/typography";

type Props = {
  payload: DashboardWidgetDataResponse;
  label?: string;
  /** Collection summary uses slightly smaller cards */
  variant?: "overview" | "collection";
  showLy?: boolean;
  onPress?: () => void;
};

function formatKpiValue(
  value: number,
  format: string | undefined,
  currency: string,
  kpiId: string
): string {
  const fmt = String(format || "currency").toLowerCase();
  if (fmt === "percent" || fmt === "pct" || fmt === "percentage") {
    return `${Number(value).toLocaleString(undefined, {
      maximumFractionDigits: 2,
    })}%`;
  }
  if (/dso|collection_days|days/.test(kpiId) || fmt === "integer") {
    return `${Math.round(value).toLocaleString("en-US")} Days`;
  }
  if (fmt === "number") {
    return Number(value).toLocaleString("en-US", {
      maximumFractionDigits: 0,
    });
  }
  return formatCurrency(value, currency, { compact: true, hideCode: false });
}

function formatLyValue(
  value: number,
  format: string | undefined,
  currency: string,
  kpiId: string
): string {
  const fmt = String(format || "currency").toLowerCase();
  if (fmt === "percent" || fmt === "pct") {
    return `${Number(value).toFixed(2)}%`;
  }
  if (/dso|collection_days|days/.test(kpiId) || fmt === "integer") {
    return `${Math.round(value)} Days`;
  }
  if (fmt === "number") {
    return Number(value).toLocaleString("en-US");
  }
  return formatCurrency(value, currency, { compact: true, hideCode: false });
}

export function ReceivablesKpiCard({
  payload,
  label,
  variant = "overview",
  showLy = true,
  onPress,
}: Props) {
  const kpi = payload.kpis[0];
  const summary = payload.chart?.summary;
  const value =
    kpi?.value ??
    (summary?.value != null ? Number(summary.value) : null);
  const previous =
    kpi?.previous ??
    (summary?.value_ly != null ? Number(summary.value_ly) : null);
  const changePct =
    kpi?.change_pct ??
    (summary?.change_pct != null ? Number(summary.change_pct) : null);
  const fmt =
    kpi?.format ||
    (payload.config?.format as string | undefined) ||
    "currency";
  const currency = payload.currency || payload.meta.currency || "SAR";
  const kpiId = String(
    payload.meta?.kpi_id || payload.config?.kpi_id || payload.widget_key || kpi?.key || ""
  );
  const visual = resolveKpiVisual(payload.widget_key || "", kpiId);
  const title = label || payload.label || kpi?.label || "KPI";
  const compact = variant === "collection";

  const Wrapper = onPress ? TouchableOpacity : View;
  const wrapperProps = onPress
    ? { activeOpacity: 0.85, onPress }
    : ({} as object);

  if (value == null || !Number.isFinite(Number(value))) {
    return (
      <Wrapper style={[styles.card, compact && styles.cardCompact]} {...wrapperProps}>
        <View style={[styles.iconWrap, { backgroundColor: visual.iconBg }]}>
          <Ionicons name={visual.icon} size={compact ? 16 : 18} color={visual.iconColor} />
        </View>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        <Text style={styles.empty}>—</Text>
      </Wrapper>
    );
  }

  let trendColor: string = RECEIVABLES.subtitle;
  let arrow = "";
  if (changePct != null && Number.isFinite(Number(changePct))) {
    const up = Number(changePct) > 0;
    const bad = visual.increaseIsBad ? up : !up;
    trendColor = bad ? RECEIVABLES.red : RECEIVABLES.green;
    arrow = up ? "↑" : "↓";
  } else if (previous != null && value != null) {
    const diff = Number(value) - Number(previous);
    if (diff !== 0) {
      const up = diff > 0;
      const bad = visual.increaseIsBad ? up : !up;
      trendColor = bad ? RECEIVABLES.red : RECEIVABLES.green;
      arrow = up ? "↑" : "↓";
    }
  }

  const lyText =
    showLy &&
    previous != null &&
    Number.isFinite(Number(previous))
      ? `vs LY: ${formatLyValue(Number(previous), fmt, currency, kpiId)}`
      : null;
  const pctText =
    showLy &&
    changePct != null &&
    Number.isFinite(Number(changePct))
      ? `${Math.abs(Number(changePct)).toFixed(2)}%`
      : null;

  return (
    <Wrapper style={[styles.card, compact && styles.cardCompact]} {...wrapperProps}>
      <View style={[styles.iconWrap, { backgroundColor: visual.iconBg }]}>
        <Ionicons name={visual.icon} size={compact ? 16 : 18} color={visual.iconColor} />
      </View>
      <Text style={[styles.title, compact && styles.titleCompact]} numberOfLines={2}>
        {title}
      </Text>
      <Text style={[styles.value, compact && styles.valueCompact]}>
        {formatKpiValue(Number(value), fmt, currency, kpiId)}
      </Text>
      {lyText ? (
        <Text style={styles.lyRow} numberOfLines={2}>
          <Text style={styles.lyLabel}>{lyText}</Text>
          {pctText ? (
            <Text style={[styles.lyTrend, { color: trendColor }]}>
              {" "}
              {arrow} {pctText}
            </Text>
          ) : null}
        </Text>
      ) : null}
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: RECEIVABLES.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: RECEIVABLES.border,
    minHeight: 118,
    shadowColor: "#0f172a",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardCompact: {
    minHeight: 104,
    padding: 10,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  title: {
    fontSize: 11,
    color: RECEIVABLES.label,
    fontFamily: Fonts.bodySemi,
    marginBottom: 4,
    lineHeight: 14,
  },
  titleCompact: {
    fontSize: 10,
  },
  value: {
    fontSize: 18,
    fontFamily: Fonts.bodyBold,
    color: RECEIVABLES.value,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  valueCompact: {
    fontSize: 15,
  },
  lyRow: {
    fontSize: 10,
    lineHeight: 14,
  },
  lyLabel: {
    color: RECEIVABLES.subtitle,
    fontFamily: Fonts.body,
  },
  lyTrend: {
    fontFamily: Fonts.bodySemi,
  },
  empty: {
    fontSize: 16,
    color: "#cbd5e1",
    fontFamily: Fonts.bodySemi,
  },
});
