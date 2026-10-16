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
  Defs,
  LinearGradient as SvgGradient,
  Stop,
  Rect,
  G,
  Text as SvgText,
  Line,
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
  maxBars?: number;
  onPointPress?: (row: AnalysisRow) => void;
  chartColors?: ResolvedChartColors;
  config?: Record<string, unknown> | null;
};

const SCREEN_W = Dimensions.get("window").width;

function compactVal(n: number, currency: string): string {
  return formatCurrency(n, currency, { compact: true, hideCode: true });
}

function shortLabel(label: string, max = 10): string {
  const t = String(label || "").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/**
 * Mobile-polished BAR chart (SVG). Backend only supplies values / optional colors —
 * layout, spacing, gradients, and labels are entirely client-side.
 */
export function AnalysisChart({
  rows,
  currency = "SAR",
  title = "",
  maxBars = 8,
  onPointPress,
  chartColors,
  config,
}: Props) {
  const colors = chartColors || resolveChartColors(config);
  const slice = useMemo(() => rows.slice(0, maxBars), [rows, maxBars]);

  const hasLy = slice.some(
    (r) => r.previous != null && Number.isFinite(Number(r.previous))
  );

  const values = slice.map((r) => Math.max(0, Number(r.value) || 0));
  const lyValues = slice.map((r) =>
    r.previous != null ? Math.max(0, Number(r.previous) || 0) : 0
  );
  const maxVal = Math.max(1, ...values, ...(hasLy ? lyValues : [0]));

  const chartPad = { top: 28, right: 12, bottom: 42, left: 8 };
  const barAreaH = 160;
  const groupGap = hasLy ? 18 : 14;
  const barW = hasLy ? 14 : 22;
  const pairGap = 5;
  const groupW = hasLy ? barW * 2 + pairGap : barW;
  const plotW = Math.max(
    SCREEN_W - 64,
    slice.length * (groupW + groupGap) + groupGap
  );
  const chartH = chartPad.top + barAreaH + chartPad.bottom;
  const chartW = chartPad.left + plotW + chartPad.right;

  if (!slice.length) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No chart data</Text>
      </View>
    );
  }

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * maxVal);

  return (
    <View style={styles.card}>
      {title ? <Text style={styles.title}>{title}</Text> : null}

      {hasLy ? (
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: colors.current }]} />
            <Text style={styles.legendText}>Current</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: colors.ly }]} />
            <Text style={styles.legendText}>Last year</Text>
          </View>
        </View>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollInner}
      >
        <Svg width={chartW} height={chartH}>
          <Defs>
            <SvgGradient id="barCurrent" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.current} stopOpacity="1" />
              <Stop offset="1" stopColor={colors.current} stopOpacity="0.72" />
            </SvgGradient>
            <SvgGradient id="barLy" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.ly} stopOpacity="0.95" />
              <Stop offset="1" stopColor={colors.ly} stopOpacity="0.55" />
            </SvgGradient>
            {slice.map((_, i) => {
              const c = colors.sliceColors[i % colors.sliceColors.length];
              return (
                <SvgGradient
                  key={`grad-${i}`}
                  id={`barSlice${i}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <Stop offset="0" stopColor={c} stopOpacity="1" />
                  <Stop offset="1" stopColor={c} stopOpacity="0.7" />
                </SvgGradient>
              );
            })}
          </Defs>

          {/* Soft plot background */}
          <Rect
            x={chartPad.left}
            y={chartPad.top}
            width={plotW}
            height={barAreaH}
            rx={12}
            fill="#f8fafc"
          />

          {/* Grid + Y labels */}
          {yTicks.map((tick, ti) => {
            const y =
              chartPad.top + barAreaH - (tick / maxVal) * barAreaH;
            return (
              <G key={`yt-${ti}`}>
                <Line
                  x1={chartPad.left + 4}
                  y1={y}
                  x2={chartPad.left + plotW - 4}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeWidth={1}
                  strokeDasharray={ti === 0 ? undefined : "4 4"}
                />
                {ti > 0 ? (
                  <SvgText
                    x={chartPad.left + 6}
                    y={y - 4}
                    fill="#94a3b8"
                    fontSize="9"
                    fontFamily={Fonts.body}
                  >
                    {compactVal(tick, currency)}
                  </SvgText>
                ) : null}
              </G>
            );
          })}

          {slice.map((row, i) => {
            const groupX =
              chartPad.left +
              groupGap / 2 +
              i * (groupW + groupGap) +
              (plotW - slice.length * (groupW + groupGap)) / 2;
            const v = values[i];
            const ly = lyValues[i];
            const h = Math.max(4, (v / maxVal) * barAreaH);
            const lyH = Math.max(ly > 0 ? 4 : 0, (ly / maxVal) * barAreaH);
            const baseY = chartPad.top + barAreaH;
            const fill = hasLy
              ? "url(#barCurrent)"
              : `url(#barSlice${i})`;

            const currentX = hasLy ? groupX : groupX + (groupW - barW) / 2;
            const lyX = groupX + barW + pairGap;

            return (
              <G key={`${row.id}-${i}`}>
                {/* Current */}
                <Rect
                  x={currentX}
                  y={baseY - h}
                  width={barW}
                  height={h}
                  rx={Math.min(8, barW / 2)}
                  ry={Math.min(8, barW / 2)}
                  fill={fill}
                />
                {/* Cap highlight */}
                <Rect
                  x={currentX + 2}
                  y={baseY - h}
                  width={Math.max(2, barW - 4)}
                  height={Math.min(6, h * 0.15)}
                  rx={3}
                  fill="#ffffff"
                  opacity={0.28}
                />
                {!hasLy && h > 22 ? (
                  <SvgText
                    x={currentX + barW / 2}
                    y={baseY - h - 6}
                    fill="#334155"
                    fontSize="9"
                    fontFamily={Fonts.bodySemi}
                    textAnchor="middle"
                  >
                    {compactVal(v, currency)}
                  </SvgText>
                ) : null}

                {hasLy ? (
                  <>
                    <Rect
                      x={lyX}
                      y={baseY - lyH}
                      width={barW}
                      height={lyH || 0}
                      rx={Math.min(8, barW / 2)}
                      ry={Math.min(8, barW / 2)}
                      fill="url(#barLy)"
                    />
                    <Rect
                      x={lyX + 2}
                      y={baseY - lyH}
                      width={Math.max(2, barW - 4)}
                      height={Math.min(6, lyH * 0.15)}
                      rx={3}
                      fill="#ffffff"
                      opacity={0.2}
                    />
                  </>
                ) : null}

                <SvgText
                  x={groupX + groupW / 2}
                  y={baseY + 14}
                  fill="#64748b"
                  fontSize="10"
                  fontFamily={Fonts.bodySemi}
                  textAnchor="middle"
                >
                  {shortLabel(row.label, hasLy ? 8 : 10)}
                </SvgText>
              </G>
            );
          })}
        </Svg>
      </ScrollView>

      {/* Value cards under chart — clearer than cramped on-bar labels for LY */}
      <View style={styles.valueGrid}>
        {slice.map((r, i) => {
          const v = values[i];
          const ly = lyValues[i];
          const c = colors.sliceColors[i % colors.sliceColors.length];
          const body = (
            <View style={styles.valueCard}>
              <View style={styles.valueTop}>
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: hasLy ? colors.current : c },
                  ]}
                />
                <Text style={styles.valueLabel} numberOfLines={1}>
                  {r.label}
                </Text>
              </View>
              <Text style={styles.valuePrimary}>
                {compactVal(v, currency)}
              </Text>
              {hasLy ? (
                <Text style={styles.valueLy}>
                  LY {compactVal(ly, currency)}
                </Text>
              ) : null}
            </View>
          );
          if (onPointPress) {
            return (
              <TouchableOpacity
                key={`vc-${r.id}-${i}`}
                activeOpacity={0.85}
                onPress={() => onPointPress(r)}
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
  swatch: {
    width: 10,
    height: 10,
    borderRadius: 3,
  },
  legendText: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: "#64748b",
  },
  scrollInner: {
    paddingVertical: 4,
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
