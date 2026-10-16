import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { DashboardWidgetDataResponse } from "../../api/dashboardWidgetData";
import { formatCurrency } from "../../utils/currency";
import {
  inferKpiFormat,
  isSalesTotalWidget,
  normalizeWidgetKey,
  pickWidgetKpiMetrics,
  sanitizeKpiDisplayValue,
} from "../../utils/kpiFormat";
import { SALES, resolveKpiVisual } from "../../screens/sales/salesTheme";
import { Fonts } from "../../theme/typography";
import {
  isOpenSalesOrdersKpiWidget,
  resolveOpenSalesOrdersKpiDisplay,
  type OpenSalesOrdersKpiDisplay,
} from "../../utils/openSalesOrdersKpi";
import {
  sanitizeKpiLyDisplay,
  territoryFilterActive,
} from "../../utils/kpiLyDisplay";

type Props = {
  payload: DashboardWidgetDataResponse;
  label?: string;
  showLy?: boolean;
  onPress?: () => void;
  openSoKpi?: OpenSalesOrdersKpiDisplay | null;
  openSoKpiLoading?: boolean;
  selectedTerritory?: string;
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
  if (fmt === "number" || fmt === "integer") {
    return Number(value).toLocaleString("en-US", { maximumFractionDigits: 0 });
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
  if (fmt === "percent" || fmt === "pct") return `${Number(value).toFixed(2)}%`;
  if (fmt === "number" || fmt === "integer") {
    return Number(value).toLocaleString("en-US");
  }
  return formatCurrency(value, currency, { compact: true, hideCode: false });
}

export function SalesKpiCard({
  payload,
  label,
  showLy = true,
  onPress,
  openSoKpi,
  openSoKpiLoading,
  selectedTerritory,
}: Props) {
  const kpi = payload.kpis[0];
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
  const currency = payload.currency || payload.meta?.currency || "SAR";
  const title = label || payload.label || kpi?.label || "KPI";
  const fmt = inferKpiFormat(payload.widget_key || kpiId, {
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
  const kpiValueFinite =
    kpi?.value != null && Number.isFinite(Number(kpi.value))
      ? Number(kpi.value)
      : null;
  const rawValue =
    picked?.value ??
    kpiValueFinite ??
    (useSummaryFallback && summary?.value != null
      ? Number(summary.value)
      : null);
  const rawPrevious =
    picked?.previous ??
    (kpi?.previous != null && Number.isFinite(Number(kpi.previous))
      ? Number(kpi.previous)
      : null) ??
    (useSummaryFallback && summary?.value_ly != null
      ? Number(summary.value_ly)
      : null);
  let changePct =
    picked?.changePct ??
    kpi?.change_pct ??
    (useSummaryFallback && summary?.change_pct != null
      ? Number(summary.change_pct)
      : null);
  let value = sanitizeKpiDisplayValue(widgetKey, title, rawValue, fmt);
  let previous = sanitizeKpiDisplayValue(widgetKey, title, rawPrevious, fmt);
  const kNorm = normalizeWidgetKey(widgetKey);
  if (/cogs|cost_of_goods/.test(kNorm) && value === 0) {
    value = null;
    if (previous === 0) previous = null;
  }

  const ly = sanitizeKpiLyDisplay({
    showLy,
    territoryFiltered: territoryFilterActive(selectedTerritory),
    widgetKey,
    label: title,
    value: value != null ? Number(value) : null,
    previous: previous != null ? Number(previous) : null,
    changePct: changePct != null ? Number(changePct) : null,
    meta: payload.meta as Record<string, unknown> | undefined,
  });
  previous = ly.previous;
  changePct = ly.changePct;

  const isOpenSo = isOpenSalesOrdersKpiWidget(widgetKey, title);
  if (isOpenSo) {
    previous = null;
    changePct = null;
  }
  const batchOpenSo = isOpenSo
    ? resolveOpenSalesOrdersKpiDisplay(payload)
    : null;
  const openSoResolved = openSoKpi ?? batchOpenSo;
  const openSoActive =
    isOpenSo &&
    openSoResolved != null &&
    (openSoResolved.orderCount > 0 || openSoResolved.totalValue > 0);
  const visual = resolveKpiVisual(payload.widget_key || "", kpiId);
  const increaseIsBad =
    visual.increaseIsBad ||
    Boolean(payload.config?.increase_is_bad);

  const CardWrap = onPress ? TouchableOpacity : View;
  const cardProps = onPress
    ? { activeOpacity: 0.88, onPress, accessibilityRole: "button" as const }
    : {};

  if (
    !openSoActive &&
    (value == null || !Number.isFinite(Number(value)))
  ) {
    return (
      <CardWrap style={styles.card} {...cardProps}>
        <View style={[styles.iconWrap, { backgroundColor: visual.iconBg }]}>
          <Ionicons name={visual.icon} size={18} color={visual.iconColor} />
        </View>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        <Text style={styles.empty}>—</Text>
      </CardWrap>
    );
  }

  let trendColor: string = SALES.subtitle;
  let arrow = "";
  if (changePct != null && Number.isFinite(Number(changePct))) {
    const up = Number(changePct) > 0;
    const bad = increaseIsBad ? up : !up;
    trendColor = bad ? SALES.red : SALES.green;
    arrow = up ? "↑" : "↓";
  }

  const lyText =
    showLy && previous != null && Number.isFinite(Number(previous))
      ? `vs LY: ${formatLyValue(Number(previous), fmt, currency, kpiId)}`
      : null;
  const pctText =
    showLy && changePct != null && Number.isFinite(Number(changePct))
      ? `${Math.abs(Number(changePct)).toFixed(2)}%`
      : null;

  return (
    <CardWrap style={styles.card} {...cardProps}>
      <View style={[styles.iconWrap, { backgroundColor: visual.iconBg }]}>
        <Ionicons name={visual.icon} size={18} color={visual.iconColor} />
      </View>
      <Text style={styles.title} numberOfLines={2}>
        {title}
      </Text>
      {openSoActive && openSoResolved ? (
        <>
          <Text style={styles.value}>
            {formatCurrency(openSoResolved.totalValue, openSoResolved.currency, {
              compact: true,
              hideCode: false,
            })}
          </Text>
          <Text style={styles.openSoCount}>
            {openSoResolved.orderCount.toLocaleString("en-US")} order
            {openSoResolved.orderCount === 1 ? "" : "s"}
            {openSoKpiLoading ? " · updating…" : ""}
          </Text>
        </>
      ) : (
        <Text style={styles.value}>
          {formatKpiValue(Number(value), fmt, currency, kpiId)}
        </Text>
      )}
      {lyText && !openSoActive ? (
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
      {onPress ? (
        <Ionicons
          name="chevron-forward"
          size={14}
          color="#94a3b8"
          style={styles.drillHint}
        />
      ) : null}
    </CardWrap>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: SALES.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: SALES.border,
    minHeight: 118,
    shadowColor: "#0f172a",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  drillHint: {
    position: "absolute",
    right: 10,
    top: 12,
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
    color: SALES.label,
    fontFamily: Fonts.bodySemi,
    marginBottom: 4,
    lineHeight: 14,
  },
  value: {
    fontSize: 18,
    fontFamily: Fonts.bodyBold,
    color: SALES.value,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  openSoCount: {
    fontSize: 12,
    fontFamily: Fonts.bodySemi,
    color: SALES.subtitle,
    marginBottom: 4,
  },
  lyRow: { fontSize: 10, lineHeight: 14 },
  lyLabel: { color: SALES.subtitle, fontFamily: Fonts.body },
  lyTrend: { fontFamily: Fonts.bodySemi },
  empty: {
    fontSize: 16,
    color: "#cbd5e1",
    fontFamily: Fonts.bodySemi,
  },
});
