import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Pressable,
} from "react-native";
import Svg, { G, Path, Circle, Line, Text as SvgText } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { Fonts, Type } from "../../theme/typography";
import type { AnalysisRow } from "../../api/genericAnalysisTypes";
import { changeDirection, formatCurrency } from "../../utils/currency";
import {
  resolveChartColors,
  type ResolvedChartColors,
} from "../../widgets/chartColors";

type Props = {
  rows: AnalysisRow[];
  currency?: string;
  title?: string;
  maxSlices?: number;
  donut?: boolean;
  /** Desk Show LY Comparison — compact LY list under callouts */
  showLy?: boolean;
  onSlicePress?: (row: AnalysisRow) => void;
  chartColors?: ResolvedChartColors;
  config?: Record<string, unknown> | null;
};

type Slice = AnalysisRow & { color: string; pct: number };

type Arc = {
  slice: Slice;
  start: number;
  end: number;
  mid: number;
  d: string;
};

const SCREEN_W = Dimensions.get("window").width;

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

/** Pie wedge path from startAngle → endAngle (degrees, 0 = top). */
function wedgePath(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startAngle: number,
  endAngle: number
): string {
  const sweep = endAngle - startAngle;
  if (sweep <= 0.01) return "";

  if (sweep >= 359.99) {
    if (innerR <= 0) {
      return [
        `M ${cx} ${cy - outerR}`,
        `A ${outerR} ${outerR} 0 1 1 ${cx - 0.01} ${cy - outerR}`,
        "Z",
      ].join(" ");
    }
    return [
      `M ${cx} ${cy - outerR}`,
      `A ${outerR} ${outerR} 0 1 1 ${cx - 0.01} ${cy - outerR}`,
      `L ${cx - 0.01} ${cy - innerR}`,
      `A ${innerR} ${innerR} 0 1 0 ${cx} ${cy - innerR}`,
      "Z",
    ].join(" ");
  }

  const large = sweep > 180 ? 1 : 0;
  const oStart = polar(cx, cy, outerR, startAngle);
  const oEnd = polar(cx, cy, outerR, endAngle);

  if (innerR <= 0) {
    return [
      `M ${cx} ${cy}`,
      `L ${oStart.x} ${oStart.y}`,
      `A ${outerR} ${outerR} 0 ${large} 1 ${oEnd.x} ${oEnd.y}`,
      "Z",
    ].join(" ");
  }

  const iStart = polar(cx, cy, innerR, endAngle);
  const iEnd = polar(cx, cy, innerR, startAngle);
  return [
    `M ${oStart.x} ${oStart.y}`,
    `A ${outerR} ${outerR} 0 ${large} 1 ${oEnd.x} ${oEnd.y}`,
    `L ${iStart.x} ${iStart.y}`,
    `A ${innerR} ${innerR} 0 ${large} 0 ${iEnd.x} ${iEnd.y}`,
    "Z",
  ].join(" ");
}

function sliceChangePct(row: AnalysisRow): number | null {
  if (row.change_pct != null && Number.isFinite(Number(row.change_pct))) {
    return Number(row.change_pct);
  }
  if (
    row.previous != null &&
    Number.isFinite(Number(row.previous)) &&
    Number(row.previous) !== 0
  ) {
    return (
      ((Number(row.value) - Number(row.previous)) /
        Math.abs(Number(row.previous))) *
      100
    );
  }
  return null;
}

function LyMeta({
  row,
  currency,
}: {
  row: AnalysisRow;
  currency: string;
}) {
  if (row.previous == null || !Number.isFinite(Number(row.previous))) {
    return null;
  }
  const pct = sliceChangePct(row);
  const dir = changeDirection(pct);
  const color =
    dir === "up" ? "#16a34a" : dir === "down" ? "#dc2626" : "#94a3b8";
  const icon =
    dir === "up" ? "arrow-up" : dir === "down" ? "arrow-down" : "remove";

  return (
    <View style={styles.lyRow}>
      <Text style={styles.lyText} numberOfLines={1}>
        vs LY{" "}
        {formatCurrency(row.previous, currency, {
          compact: true,
          hideCode: true,
        })}
      </Text>
      {pct != null ? (
        <View style={styles.lyPct}>
          <Ionicons name={icon} size={10} color={color} />
          <Text style={[styles.lyPctText, { color }]}>
            {Math.abs(pct).toFixed(1)}%
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function truncateLabel(label: string, max = 10): string {
  const t = String(label || "").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/** Leader line + name · % outside the ring (Option C callouts). */
function CalloutLayer({
  arcs,
  cx,
  cy,
  outerR,
}: {
  arcs: Arc[];
  cx: number;
  cy: number;
  outerR: number;
}) {
  return (
    <G>
      {arcs.map(({ slice, start, end, mid }, idx) => {
        const sweep = end - start;
        // Tiny slices: line only, skip text to reduce overlap
        if (sweep < 6) return null;

        const rim = polar(cx, cy, outerR + 2, mid);
        const elbow = polar(cx, cy, outerR + 14, mid);
        const onRight = rim.x >= cx;
        const labelX = onRight ? elbow.x + 10 : elbow.x - 10;
        const labelY = elbow.y;
        const tipX = onRight ? labelX + 2 : labelX - 2;

        const name = truncateLabel(slice.label, sweep < 25 ? 8 : 11);
        const pct = `${slice.pct.toFixed(0)}%`;
        const line1 = name;
        const line2 = pct;

        return (
          <G key={`callout-${slice.id}-${idx}`}>
            <Line
              x1={rim.x}
              y1={rim.y}
              x2={elbow.x}
              y2={elbow.y}
              stroke={slice.color}
              strokeWidth={1.25}
              strokeLinecap="round"
            />
            <Line
              x1={elbow.x}
              y1={elbow.y}
              x2={tipX}
              y2={labelY}
              stroke={slice.color}
              strokeWidth={1.25}
              strokeLinecap="round"
            />
            <Circle cx={rim.x} cy={rim.y} r={2.2} fill={slice.color} />
            <SvgText
              x={labelX}
              y={labelY - 4}
              fill="#334155"
              fontSize={10}
              fontFamily={Fonts.bodySemi}
              fontWeight="600"
              textAnchor={onRight ? "start" : "end"}
            >
              {line1}
            </SvgText>
            <SvgText
              x={labelX}
              y={labelY + 8}
              fill="#64748b"
              fontSize={9}
              fontFamily={Fonts.body}
              textAnchor={onRight ? "start" : "end"}
            >
              {line2}
            </SvgText>
          </G>
        );
      })}
    </G>
  );
}

export function AnalysisPieChart({
  rows,
  currency = "SAR",
  title = "Breakdown",
  maxSlices = 6,
  donut = false,
  showLy = false,
  onSlicePress,
  chartColors,
  config,
}: Props) {
  const colors = chartColors || resolveChartColors(config);
  const palette = colors.sliceColors;
  const [focusedId, setFocusedId] = useState<string | null>(null);

  const slices: Slice[] = useMemo(() => {
    const positive = rows
      .map((r) => ({ ...r, value: Math.max(0, Number(r.value) || 0) }))
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value);

    const top = positive.slice(0, maxSlices);
    const rest = positive.slice(maxSlices);
    const restSum = rest.reduce((s, r) => s + r.value, 0);
    const restLy = rest.reduce(
      (s, r) => s + (r.previous != null ? Number(r.previous) || 0 : 0),
      0
    );
    const restHasLy = rest.some((r) => r.previous != null);
    const list =
      restSum > 0
        ? [
            ...top,
            {
              id: "_other",
              label: "Other",
              value: restSum,
              previous: restHasLy ? restLy : null,
              change_pct: null,
            } as AnalysisRow,
          ]
        : top;
    const total = list.reduce((s, r) => s + r.value, 0) || 1;
    return list.map((r, i) => ({
      ...r,
      color: palette[i % palette.length],
      pct: (r.value / total) * 100,
    }));
  }, [rows, maxSlices, palette]);

  if (!slices.length) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No pie data</Text>
      </View>
    );
  }

  const total = slices.reduce((s, r) => s + r.value, 0);

  // Pad SVG for leader-line callouts (pie + donut)
  const labelPad = 54;
  const ringSize = Math.min(188, SCREEN_W - 48 - labelPad * 2);
  const svgW = ringSize + labelPad * 2;
  const svgH = ringSize + labelPad * 1.55;
  const cx = svgW / 2;
  const cy = svgH / 2;
  const outerR = ringSize / 2 - 4;
  const innerR = donut ? outerR * 0.58 : 0;

  let angle = 0;
  const arcs: Arc[] = slices.map((slice) => {
    const sweep = (slice.value / total) * 360;
    const start = angle;
    const end = angle + sweep;
    const mid = start + sweep / 2;
    angle = end;
    return {
      slice,
      start,
      end,
      mid,
      d: wedgePath(cx, cy, outerR, innerR, start, end),
    };
  });

  const handlePress = (slice: Slice) => {
    if (slice.id === "_other") return;
    setFocusedId(slice.id);
    onSlicePress?.(slice);
  };

  /** Option C — compact LY-only list under callouts (no duplicate value · %). */
  const lyCompactList = showLy ? (
    <View style={styles.lyList}>
      {slices.map((r, idx) => {
        if (r.previous == null) return null;
        const row = (
          <View style={styles.lyListRow}>
            <View style={[styles.swatch, { backgroundColor: r.color }]} />
            <Text style={styles.lyListName} numberOfLines={1}>
              {r.label}
            </Text>
            <View style={styles.lyListMeta}>
              <LyMeta row={r} currency={currency} />
            </View>
          </View>
        );
        if (onSlicePress && r.id !== "_other") {
          return (
            <Pressable
              key={`ly-${r.id}-${idx}`}
              onPress={() => handlePress(r)}
              style={({ pressed }) => [
                styles.lyListPressable,
                pressed && styles.legendPressed,
                focusedId === r.id && styles.legendFocused,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Drill into ${r.label}`}
            >
              {row}
            </Pressable>
          );
        }
        return (
          <View
            key={`ly-${r.id}-${idx}`}
            style={[
              styles.lyListPressable,
              focusedId === r.id && styles.legendFocused,
            ]}
          >
            {row}
          </View>
        );
      })}
    </View>
  ) : null;

  return (
    <View style={styles.card}>
      {title ? <Text style={styles.title}>{title}</Text> : null}

      <View style={styles.bodyStack}>
        <View style={[styles.chartWrap, { width: svgW, height: svgH }]}>
          <Svg width={svgW} height={svgH}>
            <G>
              {arcs.map(({ slice, d }, idx) =>
                d ? (
                  <Path
                    key={`${slice.id}-${idx}`}
                    d={d}
                    fill={slice.color}
                    stroke="#fff"
                    strokeWidth={1.5}
                    opacity={
                      focusedId && focusedId !== slice.id ? 0.55 : 1
                    }
                    onPress={() => handlePress(slice)}
                    {...(onSlicePress && slice.id !== "_other"
                      ? { accessibilityRole: "button" as const }
                      : {})}
                  />
                ) : null
              )}
              {donut ? (
                <Circle cx={cx} cy={cy} r={innerR - 1} fill="#fff" />
              ) : (
                // Soft center disc so Total stays readable on pie
                <Circle cx={cx} cy={cy} r={outerR * 0.34} fill="#fff" />
              )}
              <CalloutLayer arcs={arcs} cx={cx} cy={cy} outerR={outerR} />
            </G>
          </Svg>
          <View
            style={[
              styles.donutHole,
              {
                width: ringSize,
                height: ringSize,
                left: (svgW - ringSize) / 2,
                top: (svgH - ringSize) / 2,
              },
            ]}
            pointerEvents="none"
          >
            <Text style={styles.donutLabel}>Total</Text>
            <Text style={styles.donutValue}>
              {formatCurrency(total, currency, {
                compact: true,
                hideCode: true,
              })}
            </Text>
          </View>
        </View>

        {lyCompactList}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#eef2ff",
    marginBottom: 12,
  },
  title: {
    ...Type.cardTitle,
    color: "#1f2937",
    marginBottom: 4,
  },
  total: {
    fontFamily: Fonts.bodySemi,
    fontSize: 12,
    color: "#64748b",
    marginBottom: 8,
  },
  bodyStack: {
    flexDirection: "column",
    alignItems: "center",
    width: "100%",
  },
  chartWrap: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  donutHole: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  donutLabel: {
    fontFamily: Fonts.body,
    fontSize: 10,
    color: "#94a3b8",
  },
  donutValue: {
    fontFamily: Fonts.bodyBold,
    fontSize: 13,
    color: "#4338ca",
  },
  legend: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  legendBelow: {
    alignSelf: "stretch",
    marginTop: 10,
  },
  legendPressable: {
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  legendPressed: {
    backgroundColor: "#f1f5f9",
  },
  legendFocused: {
    backgroundColor: "#eef2ff",
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  swatch: {
    width: 10,
    height: 10,
    borderRadius: 2,
    marginTop: 3,
  },
  legendCopy: {
    flex: 1,
    minWidth: 0,
  },
  legendText: {
    fontFamily: Fonts.bodySemi,
    fontSize: 12,
    color: "#334155",
  },
  legendMeta: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: "#94a3b8",
    marginTop: 1,
  },
  lyList: {
    alignSelf: "stretch",
    marginTop: 8,
    gap: 2,
  },
  lyListPressable: {
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  lyListRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  lyListName: {
    fontFamily: Fonts.bodySemi,
    fontSize: 12,
    color: "#334155",
    flexShrink: 1,
    maxWidth: "34%",
  },
  lyListMeta: {
    flex: 1,
    minWidth: 0,
    alignItems: "flex-end",
  },
  lyRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 0,
  },
  lyText: {
    fontFamily: Fonts.body,
    fontSize: 10,
    color: "#94a3b8",
  },
  lyPct: {
    flexDirection: "row",
    alignItems: "center",
    gap: 1,
  },
  lyPctText: {
    fontFamily: Fonts.bodySemi,
    fontSize: 10,
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
