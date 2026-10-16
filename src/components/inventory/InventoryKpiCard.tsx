import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { DashboardWidgetDataResponse } from "../../api/dashboardWidgetData";
import { formatCurrency } from "../../utils/currency";
import { inferKpiFormat, pickWidgetKpiMetrics, sanitizeKpiDisplayValue } from "../../utils/kpiFormat";
import { INVENTORY, resolveKpiVisual } from "../../screens/inventory/inventoryTheme";
import { Fonts } from "../../theme/typography";

type Props = {
  payload: DashboardWidgetDataResponse;
  label?: string;
  showLy?: boolean;
};

function formatKpiValue(
  value: number,
  format: string | undefined,
  currency: string
): string {
  const fmt = String(format || "currency").toLowerCase();
  if (fmt === "percent" || fmt === "pct" || fmt === "percentage") {
    return `${Number(value).toLocaleString(undefined, {
      maximumFractionDigits: 2,
    })}%`;
  }
  if (fmt === "number" || fmt === "integer") {
    return Number(value).toLocaleString("en-US", { maximumFractionDigits: 0 });
  }
  if (fmt === "ratio" || fmt === "multiple") {
    return `${Number(value).toFixed(2)}x`;
  }
  if (fmt === "days") {
    return `${Math.round(value)} Days`;
  }
  return formatCurrency(value, currency, { compact: true, hideCode: false });
}

function formatLyValue(
  value: number,
  format: string | undefined,
  currency: string
): string {
  const fmt = String(format || "currency").toLowerCase();
  if (fmt === "percent" || fmt === "pct") return `${Number(value).toFixed(2)}%`;
  if (fmt === "number" || fmt === "integer") {
    return Number(value).toLocaleString("en-US");
  }
  if (fmt === "ratio" || fmt === "multiple") return `${Number(value).toFixed(2)}x`;
  if (fmt === "days") return `${Math.round(value)} Days`;
  return formatCurrency(value, currency, { compact: true, hideCode: false });
}

export function InventoryKpiCard({ payload, label, showLy = true }: Props) {
  const kpi = payload.kpis[0];
  const kpiId = String(
    payload.meta?.kpi_id ||
      payload.config?.kpi_id ||
      payload.widget_key ||
      kpi?.key ||
      ""
  );
  const widgetKey = String(payload.widget_key || kpiId);
  const title = label || payload.label || kpi?.label || "KPI";
  const fmt = inferKpiFormat(widgetKey, {
    label: title,
    kpiFormat: kpi?.format,
    configFormat: payload.config?.format as string | undefined,
  });
  const picked = pickWidgetKpiMetrics(
    {
      ...(payload as unknown as Record<string, unknown>),
      label: payload.label,
      title: payload.label,
      config: payload.config,
    },
    (kpi as unknown as Record<string, unknown>) || null,
    widgetKey,
    title
  );
  const useSummaryFallback =
    /inventory.*value|stock_value|total_inventory/.test(
      `${widgetKey} ${title}`.toLowerCase()
    ) && !/qty|quantity|turnover|days/.test(`${widgetKey} ${title}`.toLowerCase());
  const rawValue =
    picked?.value ??
    kpi?.value ??
    (useSummaryFallback && payload.chart?.summary?.value != null
      ? Number(payload.chart.summary.value)
      : null);
  const rawPrevious =
    picked?.previous ??
    kpi?.previous ??
    (useSummaryFallback && payload.chart?.summary?.value_ly != null
      ? Number(payload.chart.summary.value_ly)
      : null);
  const value = sanitizeKpiDisplayValue(widgetKey, title, rawValue, fmt);
  const previous = sanitizeKpiDisplayValue(widgetKey, title, rawPrevious, fmt);
  const changePct =
    picked?.changePct ??
    kpi?.change_pct ??
    (useSummaryFallback && payload.chart?.summary?.change_pct != null
      ? Number(payload.chart.summary.change_pct)
      : null);
  const currency = payload.currency || payload.meta?.currency || "SAR";
  const visual = resolveKpiVisual(payload.widget_key || "", kpiId);
  const increaseIsBad =
    visual.increaseIsBad || Boolean(payload.config?.increase_is_bad);

  if (value == null || !Number.isFinite(Number(value))) {
    return (
      <View style={styles.card}>
        <View style={[styles.iconWrap, { backgroundColor: visual.iconBg }]}>
          <Ionicons name={visual.icon} size={18} color={visual.iconColor} />
        </View>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        <Text style={styles.empty}>—</Text>
      </View>
    );
  }

  let trendColor: string = INVENTORY.subtitle;
  let arrow = "";
  if (changePct != null && Number.isFinite(Number(changePct))) {
    const up = Number(changePct) > 0;
    const bad = increaseIsBad ? up : !up;
    trendColor = bad ? INVENTORY.red : INVENTORY.green;
    arrow = up ? "↑" : "↓";
  }

  const lyText =
    showLy && previous != null && Number.isFinite(Number(previous))
      ? `vs LY: ${formatLyValue(Number(previous), fmt, currency)}`
      : null;
  const pctText =
    showLy && changePct != null && Number.isFinite(Number(changePct))
      ? `${Math.abs(Number(changePct)).toFixed(2)}%`
      : null;

  return (
    <View style={styles.card}>
      <View style={[styles.iconWrap, { backgroundColor: visual.iconBg }]}>
        <Ionicons name={visual.icon} size={18} color={visual.iconColor} />
      </View>
      <Text style={styles.title} numberOfLines={2}>
        {title}
      </Text>
      <Text style={styles.value}>
        {formatKpiValue(Number(value), fmt, currency)}
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
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: INVENTORY.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: INVENTORY.border,
    minHeight: 118,
    shadowColor: "#0f172a",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
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
    color: INVENTORY.label,
    fontFamily: Fonts.bodySemi,
    marginBottom: 4,
    lineHeight: 14,
  },
  value: {
    fontSize: 18,
    fontFamily: Fonts.bodyBold,
    color: INVENTORY.value,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  lyRow: { fontSize: 10, lineHeight: 14 },
  lyLabel: { color: INVENTORY.subtitle, fontFamily: Fonts.body },
  lyTrend: { fontFamily: Fonts.bodySemi },
  empty: {
    fontSize: 16,
    color: "#cbd5e1",
    fontFamily: Fonts.bodySemi,
  },
});
