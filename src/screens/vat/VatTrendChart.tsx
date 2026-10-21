import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import type { VatMonthlyTrend } from "../../api/vatTypes";
import { AnalysisLineChart } from "../../components/analytics/AnalysisLineChart";
import type { DashboardWidgetDataResponse } from "../../api/dashboardWidgetData";
import {
  buildTrendCompareRows,
  trendHasLy,
  TREND_COMPARE_CHART_COLORS,
} from "../../utils/trendChartRows";
import { VAT, formatVatAmount } from "./vatTheme";
import { Fonts } from "../../theme/typography";

type Props = {
  trend: VatMonthlyTrend;
  currency?: string;
  title?: string;
  scopeHint?: string;
};

function defaultMonthIndex(trend: VatMonthlyTrend): number {
  for (let i = trend.net_current.length - 1; i >= 0; i--) {
    if (
      (trend.net_current[i] ?? 0) !== 0 ||
      (trend.output_current[i] ?? 0) !== 0
    ) {
      return i;
    }
  }
  return Math.max(0, trend.labels.length - 1);
}

function trendToWidgetPayload(
  trend: VatMonthlyTrend,
  currency: string
): DashboardWidgetDataResponse {
  return {
    widget_key: "vat_monthly_trend",
    currency,
    show_ly: trend.net_previous.some((v) => v > 0),
    monthly_trend: {
      labels: trend.labels,
      current: trend.net_current,
      previous: trend.net_previous,
    },
  } as DashboardWidgetDataResponse;
}

function monthMetrics(trend: VatMonthlyTrend, i: number) {
  const sales = trend.output_current[i] ?? 0;
  const purchase = trend.input_current[i] ?? 0;
  const payable = trend.net_current[i] ?? sales - purchase;
  const payableLy = trend.net_previous[i] ?? 0;
  return { sales, purchase, payable, payableLy };
}

export function VatTrendChart({
  trend,
  currency = "SAR",
  title = "Monthly VAT — sales, purchase & payable",
  scopeHint,
}: Props) {
  const payload = useMemo(
    () => trendToWidgetPayload(trend, currency),
    [trend, currency]
  );
  const rows = useMemo(
    () => buildTrendCompareRows(payload, { fillMonths: true }),
    [payload]
  );
  const hasLy = trendHasLy(rows);

  const [selectedIndex, setSelectedIndex] = useState(() =>
    defaultMonthIndex(trend)
  );

  const onPointSelect = useCallback((index: number) => {
    setSelectedIndex(index);
  }, []);

  const monthCount = Math.max(
    trend.labels.length,
    trend.output_current.length,
    rows.length
  );

  if (!rows.length && monthCount === 0) return null;

  const idx = Math.min(Math.max(0, selectedIndex), monthCount - 1);
  const monthLabel = trend.labels[idx] || rows[idx]?.label || "—";
  const selected = monthMetrics(trend, idx);

  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionTitle}>{title.toUpperCase()}</Text>
      <Text style={styles.tapHint}>
        Tap a month for full amounts — chart shows net payable trend
      </Text>

      <View style={styles.monthPanel}>
        <Text style={styles.monthTitle}>{monthLabel}</Text>
        <AmountRow
          label="Sales VAT (output)"
          value={formatVatAmount(selected.sales, currency)}
          color={VAT.output}
        />
        <AmountRow
          label="Purchase VAT (input)"
          value={formatVatAmount(selected.purchase, currency)}
          color={VAT.input}
        />
        <AmountRow
          label="VAT payable (net)"
          value={formatVatAmount(selected.payable, currency)}
          color={VAT.net}
          bold
        />
        {hasLy && selected.payableLy !== 0 ? (
          <Text style={styles.lyLine}>
            Last year payable {formatVatAmount(selected.payableLy, currency)}
          </Text>
        ) : null}
        {scopeHint ? <Text style={styles.scopeHint}>{scopeHint}</Text> : null}
      </View>

      <AnalysisLineChart
        rows={rows}
        currency={currency}
        title=""
        showValueCards={false}
        embedded
        forceShowLyLegend={hasLy}
        legendCurrentLabel="This year (payable)"
        legendLyLabel="Last year (payable)"
        chartColors={TREND_COMPARE_CHART_COLORS}
        selectedIndex={idx}
        onPointSelect={onPointSelect}
        amountDecimals={0}
      />

      <Text style={styles.gridTitle}>By month</Text>
      <View style={styles.monthGrid}>
        {Array.from({ length: monthCount }, (_, i) => {
          const label = trend.labels[i] || rows[i]?.label || `M${i + 1}`;
          const m = monthMetrics(trend, i);
          const isSelected = i === idx;
          const hasData =
            m.sales !== 0 || m.purchase !== 0 || m.payable !== 0;
          return (
            <TouchableOpacity
              key={`vat-m-${label}-${i}`}
              style={[styles.monthCard, isSelected && styles.monthCardSelected]}
              activeOpacity={0.85}
              onPress={() => setSelectedIndex(i)}
            >
              <Text style={[styles.monthCardTitle, isSelected && styles.monthCardTitleSel]}>
                {label}
              </Text>
              <Line
                label="Sales"
                value={formatVatAmount(m.sales, currency)}
                color={VAT.output}
                muted={!hasData}
              />
              <Line
                label="Purchase"
                value={formatVatAmount(m.purchase, currency)}
                color={VAT.input}
                muted={!hasData}
              />
              <Line
                label="Payable"
                value={formatVatAmount(m.payable, currency)}
                color={VAT.net}
                bold
                muted={!hasData}
              />
              {hasLy && m.payableLy !== 0 ? (
                <Text style={styles.monthLy}>
                  LY {formatVatAmount(m.payableLy, currency)}
                </Text>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function AmountRow({
  label,
  value,
  color,
  bold,
}: {
  label: string;
  value: string;
  color: string;
  bold?: boolean;
}) {
  return (
    <View style={styles.amountRow}>
      <Text style={styles.amountLabel}>{label}</Text>
      <Text
        style={[
          styles.amountValue,
          { color },
          bold && styles.amountValueBold,
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
      >
        {value}
      </Text>
    </View>
  );
}

function Line({
  label,
  value,
  color,
  bold,
  muted,
}: {
  label: string;
  value: string;
  color: string;
  bold?: boolean;
  muted?: boolean;
}) {
  return (
    <View style={styles.lineRow}>
      <Text style={[styles.lineLabel, muted && styles.lineMuted]}>{label}</Text>
      <Text
        style={[
          styles.lineValue,
          { color: muted ? VAT.muted : color },
          bold && styles.lineValueBold,
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: VAT.card,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: VAT.border,
    padding: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: Fonts.bodyBold,
    color: VAT.title,
    letterSpacing: 0.4,
  },
  tapHint: {
    fontSize: 11,
    color: VAT.muted,
    marginTop: 4,
    marginBottom: 10,
  },
  monthPanel: {
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: VAT.border,
  },
  monthTitle: {
    fontFamily: Fonts.display,
    fontSize: 18,
    color: VAT.title,
    marginBottom: 10,
  },
  amountRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  amountLabel: {
    flex: 1,
    fontSize: 12,
    color: VAT.subtitle,
    fontWeight: "600",
  },
  amountValue: {
    fontSize: 14,
    fontWeight: "700",
    maxWidth: "55%",
    textAlign: "right",
  },
  amountValueBold: {
    fontSize: 17,
    fontWeight: "800",
  },
  lyLine: {
    fontSize: 12,
    color: VAT.subtitle,
    marginTop: 6,
  },
  scopeHint: {
    fontSize: 11,
    color: VAT.muted,
    marginTop: 10,
    lineHeight: 15,
  },
  gridTitle: {
    fontSize: 12,
    fontFamily: Fonts.bodyBold,
    color: VAT.title,
    marginTop: 12,
    marginBottom: 8,
  },
  monthGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  monthCard: {
    width: "48%",
    flexGrow: 1,
    minWidth: "46%",
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: VAT.border,
  },
  monthCardSelected: {
    borderColor: VAT.output,
    borderWidth: 2,
    backgroundColor: "#eff6ff",
  },
  monthCardTitle: {
    fontFamily: Fonts.bodyBold,
    fontSize: 14,
    color: VAT.title,
    marginBottom: 8,
  },
  monthCardTitleSel: {
    color: VAT.output,
  },
  lineRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 4,
    marginBottom: 4,
  },
  lineLabel: {
    fontSize: 10,
    color: VAT.subtitle,
    fontWeight: "600",
  },
  lineMuted: { color: VAT.muted },
  lineValue: {
    fontSize: 11,
    fontWeight: "700",
    flexShrink: 1,
    textAlign: "right",
  },
  lineValueBold: {
    fontSize: 12,
    fontWeight: "800",
  },
  monthLy: {
    fontSize: 10,
    color: VAT.muted,
    marginTop: 4,
    textAlign: "right",
  },
});
