import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import Svg, {
  Circle,
  G,
  Line,
  Path,
  Rect,
  Text as SvgText,
} from "react-native-svg";
import { Fonts, Type } from "../../theme/typography";
import type { AnalysisRow } from "../../api/genericAnalysisTypes";
import { formatCurrency } from "../../utils/currency";
import {
  resolveChartColors,
  type ResolvedChartColors,
} from "../../widgets/chartColors";

type Props = {
  rows: AnalysisRow[];
  currency?: string;
  title?: string;
  maxPoints?: number;
  onPointPress?: (row: AnalysisRow) => void;
  chartColors?: ResolvedChartColors;
  config?: Record<string, unknown> | null;
  /** Hide month value cards under the chart (receivables trend mockup). */
  showValueCards?: boolean;
  /** Skip outer card chrome when nested inside another panel */
  embedded?: boolean;
  legendCurrentLabel?: string;
  legendLyLabel?: string;
  /** Always show TY/LY legend when compare mode is on (even if LY values are zero). */
  forceShowLyLegend?: boolean;
  /** Highlight a month (sync with value cards / detail panel). */
  selectedIndex?: number | null;
  /** Tap a point on the line or a value card. */
  onPointSelect?: (index: number, row: AnalysisRow) => void;
  /** 0 = whole numbers on axis and month chips (e.g. VAT dashboard). */
  amountDecimals?: number;
};

/** Smooth line through points (no area fill). */
function smoothLinePath(points: { x: number; y: number }[]): string {
  if (!points.length) return "";
  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y}`;
  }
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpx = (prev.x + curr.x) / 2;
    d += ` C ${cpx} ${prev.y}, ${cpx} ${curr.y}, ${curr.x} ${curr.y}`;
  }
  return d;
}

const SCREEN_W = Dimensions.get("window").width;
const CHART_PAD = { top: 24, right: 16, bottom: 36, left: 44 };
const PLOT_H = 168;
const POINT_STEP = 72;

function compactVal(
  n: number,
  currency: string,
  amountDecimals?: number
): string {
  if (amountDecimals === 0) {
    const r = Math.round(n);
    const abs = Math.abs(r);
    if (abs >= 1_000_000) {
      return `${(r / 1_000_000).toFixed(0)}M`;
    }
    if (abs >= 1_000) {
      return `${(r / 1_000).toFixed(0)}K`;
    }
    return formatCurrency(r, currency, { hideCode: true, decimals: 0 });
  }
  return formatCurrency(n, currency, { compact: true, hideCode: true });
}

function shortLabel(label: string, max = 10): string {
  const t = String(label || "").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/**
 * Mobile-polished LINE chart (SVG). Backend supplies series values only —
 * stroke, dots, grid, and compact labels are client-side.
 */
export function AnalysisLineChart({
  rows,
  currency = "SAR",
  title = "",
  maxPoints = 12,
  onPointPress,
  chartColors,
  config,
  showValueCards = true,
  embedded = false,
  legendCurrentLabel = "Current",
  legendLyLabel = "Last year",
  forceShowLyLegend = false,
  selectedIndex = null,
  onPointSelect,
  amountDecimals,
}: Props) {
  const colors = useMemo(() => {
    const fromConfig = resolveChartColors(config);
    if (!chartColors) return fromConfig;
    return {
      ...fromConfig,
      ...chartColors,
      sliceColors: chartColors.sliceColors?.length
        ? chartColors.sliceColors
        : fromConfig.sliceColors,
    };
  }, [chartColors, config]);
  const slice = useMemo(() => rows.slice(0, maxPoints), [rows, maxPoints]);

  const hasLyData = slice.some(
    (r) => r.previous != null && Number.isFinite(Number(r.previous))
  );
  const hasLy = hasLyData || forceShowLyLegend;

  const values = slice.map((r) => Math.max(0, Number(r.value) || 0));
  const lyValues = slice.map((r) =>
    r.previous != null && Number.isFinite(Number(r.previous))
      ? Math.max(0, Number(r.previous) || 0)
      : 0
  );
  const maxVal = Math.max(
    1,
    ...values,
    ...(hasLyData ? lyValues : [0])
  );

  const layout = useMemo(() => {
    const plotW = Math.max(
      SCREEN_W - 72,
      Math.max(1, slice.length - 1) * POINT_STEP + POINT_STEP
    );
    const toY = (v: number) =>
      CHART_PAD.top + PLOT_H - (Math.max(0, v) / maxVal) * PLOT_H;
    const toX = (i: number) => {
      if (slice.length <= 1) return CHART_PAD.left + plotW / 2;
      return CHART_PAD.left + (i / (slice.length - 1)) * plotW;
    };
    const currentPts = values.map((v, i) => ({ x: toX(i), y: toY(v) }));
    const lyPts = lyValues.map((v, i) => ({ x: toX(i), y: toY(v) }));
    return { plotW, currentPts, lyPts };
  }, [slice.length, values, lyValues, maxVal]);

  const { plotW, currentPts, lyPts } = layout;
  const chartH = CHART_PAD.top + PLOT_H + CHART_PAD.bottom;
  const chartW = CHART_PAD.left + plotW + CHART_PAD.right;
  const toY = (v: number) =>
    CHART_PAD.top + PLOT_H - (Math.max(0, v) / maxVal) * PLOT_H;

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * maxVal);

  if (!slice.length) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No line data</Text>
      </View>
    );
  }

  return (
    <View style={embedded ? styles.embedded : styles.card}>
      {title ? <Text style={styles.title}>{title}</Text> : null}

      {hasLy ? (
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.lineSwatch, { backgroundColor: colors.current }]} />
            <Text style={styles.legendText}>{legendCurrentLabel}</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.lineSwatchLy, { backgroundColor: colors.ly }]} />
            <Text style={styles.legendText}>{legendLyLabel}</Text>
          </View>
        </View>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollInner}
      >
        <Svg width={chartW} height={chartH}>
          <Rect
            x={CHART_PAD.left}
            y={CHART_PAD.top}
            width={plotW}
            height={PLOT_H}
            rx={12}
            fill="#f8fafc"
          />

          {yTicks.map((tick, ti) => {
            const y = toY(tick);
            return (
              <G key={`yt-${ti}`}>
                <Line
                  x1={CHART_PAD.left + 4}
                  y1={y}
                  x2={CHART_PAD.left + plotW - 4}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeWidth={1}
                  strokeDasharray={ti === 0 ? undefined : "4 4"}
                />
                <SvgText
                  x={CHART_PAD.left - 6}
                  y={y + 3}
                  fill="#94a3b8"
                  fontSize="9"
                  fontFamily={Fonts.body}
                  textAnchor="end"
                >
                  {compactVal(tick, currency, amountDecimals)}
                </SvgText>
              </G>
            );
          })}

          {hasLy && lyPts.length > 1 && hasLyData ? (
            <Path
              d={smoothLinePath(lyPts)}
              fill="none"
              stroke={colors.ly}
              strokeWidth={2}
              strokeDasharray="6 4"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.85}
            />
          ) : null}

          {currentPts.length > 1 ? (
            <Path
              d={smoothLinePath(currentPts)}
              fill="none"
              stroke={colors.current}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}

          {hasLyData
            ? lyPts.map((p, i) => (
                <Circle
                  key={`ly-dot-${i}`}
                  cx={p.x}
                  cy={p.y}
                  r={4}
                  fill="#fff"
                  stroke={colors.ly}
                  strokeWidth={2}
                />
              ))
            : null}

          {currentPts.map((p, i) => {
            const isFirst = i === 0;
            const isLast = i === slice.length - 1;
            const anchor = isFirst ? "start" : isLast ? "end" : "middle";
            const labelX = isFirst ? p.x + 2 : isLast ? p.x - 2 : p.x;
            const selected = selectedIndex === i;
            const pickPoint = () => onPointSelect?.(i, slice[i]);
            return (
            <G key={`pt-${i}`}>
              <Circle
                cx={p.x}
                cy={p.y}
                r={16}
                fill="transparent"
                onPress={onPointSelect ? pickPoint : undefined}
              />
              <Circle
                cx={p.x}
                cy={p.y}
                r={selected ? 9 : 6}
                fill="#fff"
                stroke={colors.current}
                strokeWidth={selected ? 3 : 2.5}
              />
              <Circle
                cx={p.x}
                cy={p.y}
                r={selected ? 4 : 3}
                fill={colors.current}
              />
              <SvgText
                x={labelX}
                y={CHART_PAD.top + PLOT_H + 16}
                fill={selected ? colors.current : "#64748b"}
                fontSize="10"
                fontFamily={Fonts.bodySemi}
                textAnchor={anchor}
                onPress={onPointSelect ? pickPoint : undefined}
              >
                {shortLabel(slice[i].label, 9)}
              </SvgText>
            </G>
          );
          })}
        </Svg>
      </ScrollView>

      {showValueCards ? (
      <View style={styles.valueGrid}>
        {slice.map((r, i) => {
          const v = values[i];
          const ly = lyValues[i];
          const selected = selectedIndex === i;
          const body = (
            <View
              style={[
                styles.valueCard,
                selected && styles.valueCardSelected,
              ]}
            >
              <View style={styles.valueTop}>
                <View
                  style={[styles.dot, { backgroundColor: colors.current }]}
                />
                <Text style={styles.valueLabel} numberOfLines={1}>
                  {r.label}
                </Text>
              </View>
              <Text style={styles.valuePrimary}>
                {compactVal(v, currency, amountDecimals)}
              </Text>
              {hasLy ? (
                <Text style={styles.valueLy}>
                  LY {compactVal(ly, currency, amountDecimals)}
                </Text>
              ) : null}
            </View>
          );
          if (onPointPress || onPointSelect) {
            return (
              <TouchableOpacity
                key={`vc-${r.id}-${i}`}
                activeOpacity={0.85}
                onPress={() => {
                  onPointSelect?.(i, r);
                  onPointPress?.(r);
                }}
                style={styles.valueCardWrap}
              >
                {body}
              </TouchableOpacity>
            );
          }
          return (
            <View key={`vc-${r.id}-${i}`} style={styles.valueCardWrap}>
              {body}
            </View>
          );
        })}
      </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingTop: 10,
    paddingBottom: 12,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#eef2ff",
    marginBottom: 12,
    overflow: "hidden",
  },
  embedded: {
    backgroundColor: "transparent",
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: 0,
    marginBottom: 0,
    overflow: "visible",
  },
  title: {
    ...Type.cardTitle,
    color: "#1f2937",
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  legendRow: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 4,
    paddingHorizontal: 6,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  lineSwatch: {
    width: 18,
    height: 3,
    borderRadius: 2,
  },
  lineSwatchLy: {
    width: 18,
    height: 3,
    borderRadius: 2,
    opacity: 0.65,
  },
  legendText: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: "#64748b",
  },
  scrollInner: {
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  valueGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
    paddingHorizontal: 2,
  },
  valueCardWrap: {
    width: "47%",
    flexGrow: 1,
    maxWidth: "48.5%",
    minWidth: "45%",
  },
  valueCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#eef2ff",
  },
  valueCardSelected: {
    borderColor: "#2563eb",
    borderWidth: 2,
    backgroundColor: "#eff6ff",
  },
  valueTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  valueLabel: {
    flex: 1,
    fontFamily: Fonts.bodySemi,
    fontSize: 11,
    color: "#64748b",
  },
  valuePrimary: {
    fontFamily: Fonts.display,
    fontSize: 16,
    color: "#0f172a",
  },
  valueLy: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: "#94a3b8",
    marginTop: 2,
  },
  empty: {
    padding: 24,
    alignItems: "center",
  },
  emptyText: {
    fontFamily: Fonts.body,
    color: "#94a3b8",
  },
});
