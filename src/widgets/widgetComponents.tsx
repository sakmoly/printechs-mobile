import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { ExecutiveKpiTile } from "../components/ExecutiveKpiTile";
import { AnalysisChart } from "../components/analytics/AnalysisChart";
import { AnalysisLineChart } from "../components/analytics/AnalysisLineChart";
import { AnalysisPieChart } from "../components/analytics/AnalysisPieChart";
import { AnalysisTable } from "../components/analytics/AnalysisTable";
import { AnalysisMatrix } from "../components/analytics/AnalysisMatrix";
import { RankingCard } from "../components/RankingCard";
import { formatCurrency } from "../utils/currency";
import { Fonts, Type } from "../theme/typography";
import { navigateToModule } from "../modules/navigateToModule";
import type { WidgetRenderProps } from "./types";
import { resolveChartColors } from "./chartColors";
import { LySummaryBanner } from "./LySummaryBanner";
import { resolveWidgetLy } from "./resolveWidgetLy";
import { resolveKpiChrome } from "../types/bootstrap";
import { resolveTableColumns, mergeTableColumnLayout } from "../api/dashboardWidgetData";
import type { AnalysisRow } from "../api/genericAnalysisTypes";

function isPlaceholderWidgetTitle(title: string): boolean {
  return /^widget_\d+(__\d+)?$/i.test(title.trim());
}

/** Prefer payload.chart.series for chart widgets (drill_views L0 donut). */
function chartRowsFromData(data: WidgetRenderProps["data"]): AnalysisRow[] | undefined {
  const series = data.chart?.series;
  if (Array.isArray(series) && series.length) {
    return series.map((p, i) => ({
      id: String((p as { id?: string }).id || p.label || `p-${i}`),
      label: String(p.label || `Item ${i + 1}`),
      value: Number(p.value) || 0,
      previous:
        p.previous != null && Number.isFinite(Number(p.previous))
          ? Number(p.previous)
          : null,
    }));
  }
  return data.rows?.length ? data.rows : undefined;
}

function pickLinkConfigString(
  config: Record<string, unknown> | null | undefined,
  ...keys: string[]
): string | null {
  if (!config) return null;
  for (const k of keys) {
    const v = config[k];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return null;
}

function resolveLinkTarget(props: WidgetRenderProps): {
  kind: "module" | "dashboard" | "report_list" | "route" | "none";
  target: string;
} {
  const action =
    props.data?.action && typeof props.data.action === "object"
      ? props.data.action
      : null;
  const cfg = {
    ...(props.config || {}),
    ...(props.data?.config || {}),
    ...(action || {}),
  };
  const dashboardId = pickLinkConfigString(
    cfg,
    "dashboard_id",
    "dashboard",
    "board_key",
    "board"
  );
  if (dashboardId) return { kind: "dashboard", target: dashboardId };

  const reportModule = pickLinkConfigString(
    cfg,
    "report_module",
    "report_list_key"
  );
  if (reportModule) return { kind: "report_list", target: reportModule };

  const moduleKey = pickLinkConfigString(
    cfg,
    "module_key",
    "module",
    "route_key",
    "target",
    "link",
    "href"
  );
  if (moduleKey) {
    if (moduleKey.startsWith("/") && !moduleKey.startsWith("//")) {
      return { kind: "route", target: moduleKey };
    }
    return { kind: "module", target: moduleKey };
  }

  const fromKey = String(props.widgetKey || "")
    .replace(/^goto_/i, "")
    .replace(/^link_/i, "")
    .replace(/__\d+$/i, "")
    .trim();
  if (fromKey) {
    // Built-in tool or backend board by key
    return { kind: "module", target: fromKey };
  }

  return { kind: "none", target: "" };
}

function Shell({
  label,
  children,
  drillStack,
  onDrillBack,
  drillable,
  fetching,
  hideTitle,
  compact,
}: {
  label: string;
  children: React.ReactNode;
  drillStack?: WidgetRenderProps["drillStack"];
  onDrillBack?: () => void;
  drillable?: boolean;
  fetching?: boolean;
  /** Hide outer title (e.g. section already shown; KPI card has its own title). */
  hideTitle?: boolean;
  compact?: boolean;
}) {
  const crumb =
    drillStack && drillStack.length
      ? drillStack.map((s) => s.label).join(" › ")
      : null;

  return (
    <View style={[styles.shell, compact && styles.shellCompact]}>
      {!hideTitle || crumb || drillable || fetching || onDrillBack ? (
        <View style={styles.shellHeader}>
          <View style={styles.shellTitleBlock}>
            {!hideTitle ? (
              <Text style={styles.shellTitle}>{label}</Text>
            ) : null}
            {crumb ? (
              <Text style={styles.crumb} numberOfLines={1}>
                {crumb}
              </Text>
            ) : null}
          </View>
          <View style={styles.shellActions}>
            {fetching ? (
              <ActivityIndicator
                size="small"
                color="#667eea"
                style={styles.fetchSpin}
              />
            ) : null}
            {onDrillBack ? (
              <TouchableOpacity
                onPress={onDrillBack}
                hitSlop={8}
                style={styles.backBtn}
              >
                <Ionicons name="arrow-back" size={16} color="#667eea" />
                <Text style={styles.backText}>Back</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      ) : null}
      {children}
    </View>
  );
}

function LoadingOrEmpty({
  data,
  empty,
}: {
  data: WidgetRenderProps["data"];
  empty: string;
}) {
  const hasRows = Boolean(
    data.rows?.length ||
      data.table?.rows?.length ||
      data.kpis?.length ||
      data.chart?.series?.length
  );
  // Only block UI on first load — drill keeps previous chart
  if (data.loading && !hasRows) {
    return <Text style={styles.hint}>Loading…</Text>;
  }
  if (data.error) {
    return <Text style={styles.error}>{data.error}</Text>;
  }
  const ly = resolveWidgetLy(data);
  const hasSummary =
    data.chart?.summary?.value != null &&
    Number.isFinite(Number(data.chart.summary.value));
  if (!hasRows && !hasSummary && !(ly.showLy && ly.summary)) {
    return <Text style={styles.hint}>{empty}</Text>;
  }
  return null;
}

function LyHeader({
  data,
  inline,
  titleAlign,
  compact,
  /** When Shell already shows the widget title, skip repeating it here */
  hideMetricLabel,
}: {
  data: WidgetRenderProps["data"];
  inline?: boolean;
  titleAlign?: "left" | "right" | "center";
  compact?: boolean;
  hideMetricLabel?: boolean;
}) {
  const ly = resolveWidgetLy(data);
  if (!ly.showLy || !ly.summary) return null;
  const metricLabel = hideMetricLabel
    ? undefined
    : String(data.preferred_label || "").trim() || ly.metricLabel;
  return (
    <LySummaryBanner
      summary={ly.summary}
      showLy
      currency={data.currency || "SAR"}
      metricLabel={metricLabel}
      layout={inline ? "inline" : "stack"}
      titleAlign={titleAlign || "left"}
      compact={compact}
    />
  );
}

function drillShellProps(props: WidgetRenderProps) {
  return {
    drillStack: props.drillStack,
    onDrillBack: props.onDrillBack,
    drillable: props.drillable,
    fetching: props.data.fetching,
  };
}

/** Prefer Desk widget.label over generic API sales labels. */
function kpiDisplayTitle(
  widgetLabel: string,
  kpiLabel?: string | null,
  preferred?: string | null
): string {
  const generic = /^(total(\s+sales)?|net\s+sales|sales|kpi)$/i;
  const pick = (v?: string | null) => {
    const s = String(v || "").trim();
    return s && !generic.test(s) ? s : null;
  };
  return (
    pick(preferred) ||
    pick(widgetLabel) ||
    pick(kpiLabel) ||
    widgetLabel ||
    "KPI"
  );
}

export function KpiWidget(props: WidgetRenderProps) {
  const { label, data, metricKey, compact, config } = props;
  const fromApi = data.kpis || [];
  const ly = resolveWidgetLy(data);
  const hasLySummary = Boolean(ly.showLy && ly.summary?.value_ly != null);
  const summaryVal = data.chart?.summary?.value;
  const hasSummary =
    summaryVal != null && Number.isFinite(Number(summaryVal));

  // Hide only true empties — never leave a blank flex shell (breaks 2-col grids)
  const hasAny =
    fromApi.length > 0 ||
    hasLySummary ||
    hasSummary ||
    Boolean(data.rows?.length);
  if (!data.loading && !data.error && !hasAny) {
    return null;
  }

  const chrome = resolveKpiChrome({
    ...(config || {}),
    ...(data.config || {}),
  });
  // Title left | value right on one line (full-width column when Layout = header)
  const inlineHeader = chrome.inlineHeader;

  const totalFromRows = data.rows?.length
    ? data.rows.reduce((s, r) => s + (Number(r.value) || 0), 0)
    : null;

  const primary =
    fromApi.find((k) => k.key === metricKey) ||
    fromApi.find((k) => k.key === "total") ||
    fromApi[0] ||
    (totalFromRows != null
      ? {
          key: "total",
          label,
          value: totalFromRows,
          format: "currency" as const,
        }
      : null) ||
    (hasSummary
      ? {
          key: "summary",
          label,
          value: Number(summaryVal),
          format:
            (data.chart?.summary as { format?: string } | undefined)?.format ||
            (data.config?.format as string | undefined) ||
            "number",
          previous: ly.showLy ? data.chart?.summary?.value_ly ?? null : null,
          change_pct: ly.showLy ? data.chart?.summary?.change_pct ?? null : null,
        }
      : null);

  const displayTitle = kpiDisplayTitle(
    label,
    primary?.label,
    data.preferred_label
  );

  // Only surface LY numbers when Desk Show LY is on
  const primaryPrevious = ly.showLy
    ? primary?.previous ??
      (hasLySummary ? ly.summary?.value_ly ?? null : null)
    : null;
  const primaryChange = ly.showLy
    ? primary?.change_pct ??
      (hasLySummary ? ly.summary?.change_pct ?? null : null)
    : null;

  const extras = fromApi
    .filter((k) => k.key !== primary?.key)
    .slice(0, 3);

  const status = <LoadingOrEmpty data={data} empty="No KPI data" />;

  // Side-by-side row cell → true column: title on top, value below (left | right cards)
  if (compact && (hasLySummary || primary)) {
    const value = hasLySummary
      ? ly.summary!.value
      : primary!.value;
    const prev = hasLySummary
      ? ly.summary!.value_ly
      : primaryPrevious;
    const change = hasLySummary
      ? ly.summary!.change_pct
      : primaryChange;
    const color =
      (hasLySummary && ly.summary?.display?.color) ||
      (change != null && change < 0 ? "#dc2626" : change != null && change > 0 ? "#16a34a" : "#64748b");
    const fmt =
      (primary as { format?: string } | null)?.format ||
      (data.config?.format as string | undefined) ||
      "currency";
    return (
      <Shell label={displayTitle} hideTitle compact {...drillShellProps(props)}>
        {status}
        <View style={[styles.kpiCard, styles.kpiCardCompact, styles.kpiColumn]}>
          <Text style={styles.columnTitle} numberOfLines={2}>
            {displayTitle}
          </Text>
          <Text style={styles.columnValue}>
            {fmt === "percent" || fmt === "pct" || /%/.test(displayTitle)
              ? `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`
              : formatCurrency(value, data.currency || "SAR", {
                  compact: true,
                  hideCode: true,
                })}
          </Text>
          {(prev != null || change != null) && (
            <View style={styles.columnMeta}>
              {prev != null ? (
                <Text style={styles.columnLy}>
                  vs LY{" "}
                  {formatCurrency(prev, data.currency || "SAR", {
                    compact: true,
                    hideCode: true,
                  })}
                </Text>
              ) : null}
              {change != null ? (
                <Text style={[styles.columnPct, { color }]}>
                  {change >= 0 ? "↑" : "↓"}
                  {Math.abs(Number(change)).toFixed(1)}%
                </Text>
              ) : null}
            </View>
          )}
        </View>
      </Shell>
    );
  }

  // Compact slot with nothing to draw → omit (avoid empty flex column)
  if (compact && !data.loading && !data.error) {
    return null;
  }

  // Full-width header layout: one line — title then value
  if (inlineHeader && (hasLySummary || primary)) {
    return (
      <Shell
        label={label || displayTitle}
        hideTitle
        compact
        {...drillShellProps(props)}
      >
        {status}
        <View style={[styles.kpiCard, styles.kpiCardCompact, styles.kpiCardInline]}>
          {hasLySummary ? (
            <LyHeader
              data={{ ...data, preferred_label: displayTitle }}
              inline
              titleAlign={chrome.headerAlign}
              compact={chrome.headerCompact || compact}
            />
          ) : primary ? (
            <View
              style={[
                styles.inlineKpiRow,
                chrome.headerAlign === "right" && styles.inlineKpiRowEnd,
                chrome.headerAlign === "center" && styles.inlineKpiRowCenter,
              ]}
            >
              <Text style={styles.inlineKpiTitle} numberOfLines={1}>
                {displayTitle}
              </Text>
              <View style={styles.inlineKpiValues}>
                <Text style={styles.inlineKpiValue}>
                  {formatCurrency(primary.value, data.currency || "SAR", {
                    compact: true,
                    hideCode: true,
                  })}
                </Text>
                {primaryPrevious != null ? (
                  <Text style={styles.inlineKpiLy}>
                    {" "}
                    vs LY{" "}
                    {formatCurrency(primaryPrevious, data.currency || "SAR", {
                      compact: true,
                      hideCode: true,
                    })}
                  </Text>
                ) : null}
                {primaryChange != null ? (
                  <Text
                    style={[
                      styles.inlineKpiPct,
                      primaryChange >= 0 ? styles.up : styles.down,
                    ]}
                  >
                    {" "}
                    {primaryChange >= 0 ? "↑" : "↓"}
                    {Math.abs(primaryChange).toFixed(1)}%
                  </Text>
                ) : null}
              </View>
            </View>
          ) : null}
        </View>
      </Shell>
    );
  }

  return (
    <Shell
      label={label || displayTitle}
      hideTitle={compact || Boolean(hasLySummary) || Boolean(props.hideTitle)}
      compact={compact}
      {...drillShellProps(props)}
    >
      {status}
      {hasLySummary ? (
        <View style={[styles.kpiCard, compact && styles.kpiCardCompact]}>
          <LyHeader data={{ ...data, preferred_label: displayTitle }} />
          {extras.length ? (
            <View style={styles.kpiWrap}>
              {extras.map((k) => (
                <ExecutiveKpiTile
                  key={k.key}
                  title={k.label}
                  value={k.value}
                  previous={ly.showLy ? k.previous : null}
                  changePct={ly.showLy ? k.change_pct : null}
                  currency={data.currency || "SAR"}
                  format={k.format || "number"}
                  compact
                />
              ))}
            </View>
          ) : null}
        </View>
      ) : primary ? (
        <View style={styles.kpiWrap}>
          <ExecutiveKpiTile
            title={displayTitle}
            value={primary.value}
            previous={primaryPrevious}
            changePct={primaryChange}
            currency={data.currency || "SAR"}
            format={primary.format || "currency"}
            compact
          />
          {extras.map((k) => (
            <ExecutiveKpiTile
              key={k.key}
              title={k.label}
              value={k.value}
              previous={ly.showLy ? k.previous : null}
              changePct={ly.showLy ? k.change_pct : null}
              currency={data.currency || "SAR"}
              format={k.format || "number"}
              compact
            />
          ))}
        </View>
      ) : null}
    </Shell>
  );
}

function chartCfg(props: WidgetRenderProps) {
  return resolveChartColors(props.data.config, props.config);
}

export function BarWidget(props: WidgetRenderProps) {
  const { label, data, onSliceTap, drillable, hideTitle } = props;
  const rows = chartRowsFromData(data);
  const status = <LoadingOrEmpty data={data} empty="No chart data" />;
  return (
    <Shell label={label} hideTitle={hideTitle} {...drillShellProps(props)}>
      {status}
      <LyHeader data={data} hideMetricLabel />
      {rows?.length ? (
        <AnalysisChart
          rows={rows}
          currency={data.currency}
          title=""
          chartColors={chartCfg(props)}
          config={data.config ?? props.config}
          onPointPress={
            drillable && onSliceTap
              ? (r) =>
                  onSliceTap({
                    label: r.label,
                    id: r.id,
                    dimension_value: r.id,
                  })
              : undefined
          }
        />
      ) : null}
    </Shell>
  );
}

export function LineWidget(props: WidgetRenderProps) {
  const { label, data, onSliceTap, drillable, hideTitle } = props;
  const rows = chartRowsFromData(data);
  const status = <LoadingOrEmpty data={data} empty="No line data" />;
  return (
    <Shell label={label} hideTitle={hideTitle} {...drillShellProps(props)}>
      {status}
      <LyHeader data={data} hideMetricLabel />
      {rows?.length ? (
        <AnalysisLineChart
          rows={rows}
          currency={data.currency}
          title=""
          chartColors={chartCfg(props)}
          config={data.config ?? props.config}
          onPointPress={
            drillable && onSliceTap
              ? (r) =>
                  onSliceTap({
                    label: r.label,
                    id: r.id,
                    dimension_value: r.id,
                  })
              : undefined
          }
        />
      ) : null}
    </Shell>
  );
}

export function PieWidget(props: WidgetRenderProps) {
  const { label, data, onSliceTap, drillable, hideTitle } = props;
  const ly = resolveWidgetLy(data);
  const rows = chartRowsFromData(data);
  const status = <LoadingOrEmpty data={data} empty="No pie data" />;
  return (
    <Shell label={label} hideTitle={hideTitle} {...drillShellProps(props)}>
      {status}
      <LyHeader data={data} hideMetricLabel />
      {rows?.length ? (
        <AnalysisPieChart
          rows={rows}
          currency={data.currency}
          title=""
          showLy={ly.showLy}
          chartColors={chartCfg(props)}
          config={data.config ?? props.config}
          onSlicePress={
            drillable && onSliceTap
              ? (r) =>
                  onSliceTap({
                    label: r.label,
                    id: r.id,
                    dimension_value: r.id,
                  })
              : undefined
          }
        />
      ) : null}
    </Shell>
  );
}

export function DonutWidget(props: WidgetRenderProps) {
  const { label, data, onSliceTap, drillable, hideTitle } = props;
  const ly = resolveWidgetLy(data);
  const rows = chartRowsFromData(data);
  const status = <LoadingOrEmpty data={data} empty="No donut data" />;
  return (
    <Shell label={label} hideTitle={hideTitle} {...drillShellProps(props)}>
      {status}
      <LyHeader data={data} hideMetricLabel />
      {rows?.length ? (
        <AnalysisPieChart
          rows={rows}
          currency={data.currency}
          title=""
          donut
          showLy={ly.showLy}
          chartColors={chartCfg(props)}
          config={data.config ?? props.config}
          onSlicePress={
            drillable && onSliceTap
              ? (r) =>
                  onSliceTap({
                    label: r.label,
                    id: r.id,
                    dimension_value: r.id,
                  })
              : undefined
          }
        />
      ) : null}
    </Shell>
  );
}

export function TableWidget(props: WidgetRenderProps) {
  const { label, data, onSliceTap, drillable, config, hideTitle } = props;
  const rows = data.table?.rows?.length ? data.table.rows : data.rows;
  // Board API columns = structure; Desk config.columns / table_columns = layout overlay
  const fromApi = resolveTableColumns(data.table?.columns, data.table);
  const fromDesk = resolveTableColumns(
    config,
    (config as any)?.table_columns,
    (config as any)?.columns,
    data.config,
    (data.config as any)?.table_columns,
    (config as any)?.table,
    (data.config as any)?.table
  );
  const columns = mergeTableColumnLayout(fromApi, fromDesk) || fromApi || fromDesk;
  const status = <LoadingOrEmpty data={data} empty="No table rows" />;
  return (
    <Shell label={label} hideTitle={hideTitle} {...drillShellProps(props)}>
      {status}
      {rows?.length ? (
        <AnalysisTable
          rows={rows}
          currency={
            data.table?.currency_display?.currency || data.currency
          }
          columns={columns}
          total={data.table?.total}
          currency_display={data.table?.currency_display}
          onRowPress={
            drillable && onSliceTap
              ? (r) =>
                  onSliceTap({
                    label: r.label,
                    id: r.id,
                    dimension_value: r.id,
                  })
              : undefined
          }
        />
      ) : null}
    </Shell>
  );
}

export function RankingWidget(props: WidgetRenderProps) {
  const { label, data, onSliceTap, drillable } = props;
  const status = <LoadingOrEmpty data={data} empty="No ranking data" />;
  const currency = data.currency || "SAR";
  const rows = data.table?.rows?.length ? data.table.rows : data.rows || [];
  return (
    <Shell label={label} {...drillShellProps(props)}>
      {status}
      {rows.slice(0, 8).map((r, i) => (
        <RankingCard
          key={`${r.id}-${i}`}
          rank={i + 1}
          title={r.label}
          primary={formatCurrency(r.value, currency, { compact: true })}
          changePct={r.change_pct}
          onPress={
            drillable && onSliceTap
              ? () =>
                  onSliceTap({
                    label: r.label,
                    id: r.id,
                    dimension_value: r.id,
                  })
              : undefined
          }
        />
      ))}
    </Shell>
  );
}

export function ListWidget(props: WidgetRenderProps) {
  const { label, data, onSliceTap, drillable } = props;
  const status = <LoadingOrEmpty data={data} empty="No items" />;
  const currency = data.currency || "SAR";
  return (
    <Shell label={label} {...drillShellProps(props)}>
      {status}
      {(data.rows || []).slice(0, 12).map((r, i) => {
        const rowKey = `${r.id}-${i}`;
        const row = (
          <View style={styles.listRow}>
            <Text style={styles.listLabel} numberOfLines={1}>
              {r.label}
            </Text>
            <View style={styles.listRight}>
              <Text style={styles.listValue}>
                {formatCurrency(r.value, currency, { compact: true })}
              </Text>
              {r.change_pct != null ? (
                <Text
                  style={[
                    styles.listDelta,
                    r.change_pct >= 0 ? styles.up : styles.down,
                  ]}
                >
                  {r.change_pct >= 0 ? "+" : ""}
                  {r.change_pct.toFixed(1)}%
                </Text>
              ) : null}
            </View>
          </View>
        );
        if (drillable && onSliceTap) {
          return (
            <TouchableOpacity
              key={rowKey}
              activeOpacity={0.85}
              onPress={() =>
                onSliceTap({
                  label: r.label,
                  id: r.id,
                  dimension_value: r.id,
                })
              }
            >
              {row}
            </TouchableOpacity>
          );
        }
        return <View key={rowKey}>{row}</View>;
      })}
    </Shell>
  );
}

export function MatrixWidget(props: WidgetRenderProps) {
  const { label, data, onSliceTap, drillable } = props;
  const status = <LoadingOrEmpty data={data} empty="No matrix data" />;
  return (
    <Shell label={label} {...drillShellProps(props)}>
      {status}
      {data.rows?.length ? (
        <AnalysisMatrix
          rows={data.rows}
          currency={data.currency}
          onCellPress={
            drillable && onSliceTap
              ? (r) =>
                  onSliceTap({
                    label: r.label,
                    id: r.id,
                    dimension_value: r.id,
                  })
              : undefined
          }
        />
      ) : null}
    </Shell>
  );
}

export function ExpandableWidget(props: WidgetRenderProps) {
  return <RankingWidget {...props} />;
}

/** Desk type "header" / section — title only, no data. */
export function HeaderWidget(props: WidgetRenderProps) {
  const title = (props.label || props.widgetKey || "").trim();
  // Skip Desk placeholders (empty / widget_0 / widget_0__1)
  if (!title || isPlaceholderWidgetTitle(title)) return null;
  return <Text style={styles.headerTitle}>{title}</Text>;
}

/** Desk LINK — navigate to module / dashboard board (no data fetch). */
export function LinkWidget(props: WidgetRenderProps) {
  const rawTitle = (props.label || props.widgetKey || "Open").trim();
  const title = isPlaceholderWidgetTitle(rawTitle) ? "Open" : rawTitle;
  const { kind, target } = resolveLinkTarget(props);
  const disabled = kind === "none" || !target;

  const onPress = () => {
    if (disabled) return;
    if (kind === "dashboard") {
      router.push(`/dashboard-board/${encodeURIComponent(target)}` as any);
      return;
    }
    if (kind === "report_list") {
      router.push(`/report-list/${encodeURIComponent(target)}` as any);
      return;
    }
    if (kind === "route") {
      router.push(target as any);
      return;
    }
    navigateToModule(target);
  };

  return (
    <TouchableOpacity
      style={[styles.linkCard, disabled && styles.linkCardDisabled]}
      activeOpacity={0.85}
      disabled={disabled}
      onPress={onPress}
    >
      <View style={styles.linkIconWrap}>
        <Ionicons name="open-outline" size={18} color="#667eea" />
      </View>
      <Text style={styles.linkTitle} numberOfLines={2}>
        {title}
      </Text>
      <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
    </TouchableOpacity>
  );
}

export function UnknownWidget(props: WidgetRenderProps) {
  const label = (props.label || props.widgetKey || "").trim();
  const shellLabel = isPlaceholderWidgetTitle(label) ? props.type : label;
  return (
    <Shell label={shellLabel || props.type || "Widget"}>
      <View style={styles.unknown}>
        <Ionicons name="construct-outline" size={22} color="#94a3b8" />
        <Text style={styles.hint}>
          Widget type “{props.type}” is not supported in this app version.
        </Text>
      </View>
    </Shell>
  );
}

const styles = StyleSheet.create({
  shell: {
    marginBottom: 14,
  },
  shellCompact: {
    marginBottom: 0,
    flex: 1,
    width: "100%",
  },
  shellHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 8,
    gap: 8,
  },
  shellTitleBlock: {
    flex: 1,
  },
  shellTitle: {
    ...Type.sectionTitle,
    color: "#1f2937",
  },
  crumb: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: "#667eea",
    marginTop: 2,
  },
  drillHint: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: "#94a3b8",
    marginTop: 2,
  },
  shellActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  fetchSpin: {
    marginRight: 2,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#eef2ff",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  backText: {
    fontFamily: Fonts.bodySemi,
    fontSize: 12,
    color: "#667eea",
  },
  hint: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: "#94a3b8",
    lineHeight: 18,
  },
  error: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: "#dc2626",
  },
  kpiWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  kpiCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#eef2ff",
    marginBottom: 4,
  },
  kpiCardCompact: {
    padding: 10,
    borderRadius: 12,
  },
  kpiCardInline: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  kpiColumn: {
    flex: 1,
    width: "100%",
    minHeight: 88,
    justifyContent: "flex-start",
  },
  columnTitle: {
    fontFamily: Fonts.bodySemi,
    fontSize: 11,
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 6,
    minHeight: 28,
  },
  columnValue: {
    fontFamily: Fonts.bodyBold,
    fontSize: 20,
    color: "#0f172a",
    marginBottom: 4,
  },
  columnMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
  },
  columnLy: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: "#64748b",
  },
  columnPct: {
    fontFamily: Fonts.bodySemi,
    fontSize: 11,
  },
  inlineKpiRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "nowrap",
    gap: 10,
    justifyContent: "flex-start",
  },
  inlineKpiRowEnd: {
    justifyContent: "flex-end",
  },
  inlineKpiRowCenter: {
    justifyContent: "center",
  },
  inlineKpiRowReverse: {
    flexDirection: "row-reverse",
  },
  inlineKpiTitle: {
    fontFamily: Fonts.bodySemi,
    fontSize: 11,
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    flexShrink: 1,
  },
  inlineSpacer: {
    flex: 1,
    minWidth: 8,
  },
  inlineKpiValues: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
  },
  inlineKpiValue: {
    fontFamily: Fonts.bodyBold,
    fontSize: 16,
    color: "#0f172a",
  },
  inlineKpiLy: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: "#64748b",
  },
  inlineKpiPct: {
    fontFamily: Fonts.bodySemi,
    fontSize: 12,
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "#eef2ff",
  },
  listLabel: {
    flex: 1,
    fontFamily: Fonts.bodySemi,
    fontSize: 14,
    color: "#334155",
    marginRight: 8,
  },
  listRight: {
    alignItems: "flex-end",
  },
  listValue: {
    fontFamily: Fonts.bodyBold,
    fontSize: 13,
    color: "#4f46e5",
  },
  listDelta: {
    fontFamily: Fonts.body,
    fontSize: 11,
    marginTop: 2,
  },
  up: { color: "#059669" },
  down: { color: "#dc2626" },
  headerTitle: {
    ...Type.label,
    fontFamily: Fonts.bodyBold,
    color: "#334155",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 6,
    marginBottom: 8,
  },
  linkCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#eef2ff",
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  linkCardDisabled: {
    opacity: 0.55,
  },
  linkIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#eef2ff",
    alignItems: "center",
    justifyContent: "center",
  },
  linkTitle: {
    ...Type.cardTitle,
    flex: 1,
    color: "#0f172a",
    fontFamily: Fonts.bodyBold,
  },
  unknown: {
    alignItems: "center",
    paddingVertical: 16,
    gap: 8,
  },
});
