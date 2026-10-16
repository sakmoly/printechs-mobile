import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { DashboardWidgetDataResponse } from "../../api/dashboardWidgetData";
import { formatCurrency } from "../../utils/currency";
import {
  inferKpiFormat,
  isSalesTotalWidget,
  normalizeKpiCurrencyValue,
  pickWidgetKpiMetrics,
  sanitizeKpiDisplayValue,
} from "../../utils/kpiFormat";
import { HOME, resolveKpiVisual } from "../../screens/home/homeTheme";
import { Fonts } from "../../theme/typography";
import { sanitizeKpiLyDisplay, territoryFilterActive } from "../../utils/kpiLyDisplay";

type Props = {
  payload: DashboardWidgetDataResponse;
  label?: string;
  showLy?: boolean;
  compact?: boolean;
  selectedTerritory?: string;
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
  if (fmt === "ratio" || fmt === "multiple" || fmt === "days") {
    return Number(value).toLocaleString(undefined, {
      maximumFractionDigits: 2,
    });
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
  if (fmt === "ratio" || fmt === "multiple") return Number(value).toFixed(2);
  if (fmt === "number" || fmt === "integer") {
    return Number(value).toLocaleString("en-US");
  }
  return formatCurrency(value, currency, { compact: true, hideCode: false });
}

export function HomeKpiCard({
  payload,
  label,
  showLy = true,
  compact = false,
  selectedTerritory,
}: Props) {
  const kpi = payload.kpis[0];
  const picked = pickWidgetKpiMetrics(
    {
      ...(payload as unknown as Record<string, unknown>),
      label: payload.label,
      title: payload.label,
      config: payload.config,
    },
    (kpi as unknown as Record<string, unknown>) || null,
    payload.widget_key,
    payload.label || kpi?.label
  );
  const summary = payload.chart?.summary;
  const kpiId = String(
    payload.meta?.kpi_id ||
      payload.config?.kpi_id ||
      payload.widget_key ||
      kpi?.key ||
      ""
  );
  const widgetKey = String(payload.widget_key || kpiId);
  const useSummaryFallback = isSalesTotalWidget(widgetKey);
  const changePct =
    picked?.changePct ??
    kpi?.change_pct ??
    (useSummaryFallback && summary?.change_pct != null
      ? Number(summary.change_pct)
      : null);
  const title = label || payload.label || kpi?.label || "KPI";
  const metaFormat = (payload.meta as { format?: string } | undefined)?.format;
  const formatHint = String(kpi?.format || payload.config?.format || metaFormat || "");
  const fmt = inferKpiFormat(widgetKey, {
    label: title,
    kpiFormat: kpi?.format,
    configFormat: payload.config?.format as string | undefined,
  });
  const rawValue =
    picked?.value ??
    kpi?.value ??
    (useSummaryFallback && summary?.value != null
      ? Number(summary.value)
      : null);
  const rawPrevious =
    picked?.previous ??
    kpi?.previous ??
    (useSummaryFallback && summary?.value_ly != null
      ? Number(summary.value_ly)
      : null);
  const value = sanitizeKpiDisplayValue(
    widgetKey,
    title,
    normalizeKpiCurrencyValue(widgetKey, title, rawValue, formatHint),
    fmt
  );
  let previous = sanitizeKpiDisplayValue(
    widgetKey,
    title,
    normalizeKpiCurrencyValue(widgetKey, title, rawPrevious, formatHint),
    fmt
  );
  let changePctResolved = changePct;
  const ly = sanitizeKpiLyDisplay({
    showLy,
    territoryFiltered: territoryFilterActive(selectedTerritory),
    widgetKey,
    label: title,
    value: value != null ? Number(value) : null,
    previous: previous != null ? Number(previous) : null,
    changePct: changePctResolved != null ? Number(changePctResolved) : null,
    meta: payload.meta as Record<string, unknown> | undefined,
  });
  previous = ly.previous;
  changePctResolved = ly.changePct;
  const currency = payload.currency || payload.meta?.currency || "SAR";
  const visual = resolveKpiVisual(payload.widget_key || "", kpiId);

  if (value == null || !Number.isFinite(Number(value))) {
    return (
      <View style={[styles.card, compact && styles.cardCompact]}>
        <View style={[styles.iconWrap, { backgroundColor: visual.iconBg }]}>
          <Ionicons name={visual.icon} size={compact ? 14 : 18} color={visual.iconColor} />
        </View>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        <Text style={styles.empty}>—</Text>
      </View>
    );
  }

  let trendColor: string = HOME.subtitle;
  let arrow = "";
  if (changePctResolved != null && Number.isFinite(Number(changePctResolved))) {
    const up = Number(changePctResolved) > 0;
    trendColor = up ? HOME.green : HOME.red;
    arrow = up ? "↑" : "↓";
  }

  const lyText =
    showLy && previous != null && Number.isFinite(Number(previous))
      ? `vs LY: ${formatLyValue(Number(previous), fmt, currency)}`
      : null;
  const pctText =
    showLy &&
    changePctResolved != null &&
    Number.isFinite(Number(changePctResolved))
      ? `${Math.abs(Number(changePctResolved)).toFixed(2)}%`
      : null;

  return (
    <View style={[styles.card, compact && styles.cardCompact]}>
      <View style={[styles.iconWrap, { backgroundColor: visual.iconBg }]}>
        <Ionicons name={visual.icon} size={compact ? 14 : 18} color={visual.iconColor} />
      </View>
      <Text style={styles.title} numberOfLines={2}>
        {title}
      </Text>
      <Text style={[styles.value, compact && styles.valueCompact]}>
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
    backgroundColor: HOME.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: HOME.border,
    minHeight: 118,
    shadowColor: "#0f172a",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardCompact: {
    minHeight: 100,
    width: 148,
    flex: 0,
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
    color: HOME.label,
    fontFamily: Fonts.bodySemi,
    marginBottom: 4,
    lineHeight: 14,
  },
  value: {
    fontSize: 18,
    fontFamily: Fonts.bodyBold,
    color: HOME.value,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  valueCompact: {
    fontSize: 16,
  },
  lyRow: { fontSize: 10, lineHeight: 14 },
  lyLabel: { color: HOME.subtitle, fontFamily: Fonts.body },
  lyTrend: { fontFamily: Fonts.bodySemi },
  empty: {
    fontSize: 16,
    color: "#cbd5e1",
    fontFamily: Fonts.bodySemi,
  },
});
