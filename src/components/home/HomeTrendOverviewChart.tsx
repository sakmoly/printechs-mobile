import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from "react-native-svg";
import type { HomeWidgetEntry } from "../../screens/home/buildHomeSections";
import { HOME, TREND_SERIES_COLORS } from "../../screens/home/homeTheme";
import { formatCurrency } from "../../utils/currency";
import { Fonts } from "../../theme/typography";

type Props = {
  entry: HomeWidgetEntry;
};

type SeriesLine = {
  key: string;
  label: string;
  color: string;
  values: number[];
};

const SCREEN_W = Dimensions.get("window").width;
const CHART_PAD = { top: 20, right: 12, bottom: 32, left: 40 };
const PLOT_H = 160;

function seriesColor(label: string, index: number): string {
  const k = label.toLowerCase();
  for (const [name, color] of Object.entries(TREND_SERIES_COLORS)) {
    if (k.includes(name)) return color;
  }
  const palette = ["#2563eb", "#ea580c", "#16a34a", "#dc2626", "#7c3aed"];
  return palette[index % palette.length];
}

function parseSeriesLines(entry: HomeWidgetEntry): { labels: string[]; lines: SeriesLine[] } {
  const payload = entry.payload;
  const chart = payload.chart as Record<string, unknown> | undefined;

  const labels = Array.isArray(chart?.labels)
    ? (chart!.labels as string[]).map(String)
    : Array.isArray(chart?.months)
      ? (chart!.months as string[]).map(String)
      : [];

  const rawSeries = (payload.chart?.series || []) as Array<Record<string, unknown>>;

  if (rawSeries.length >= 2) {
    const hasNested = rawSeries.some(
      (s) =>
        Array.isArray(s.points) ||
        Array.isArray(s.data) ||
        Array.isArray(s.values)
    );
    if (hasNested) {
      const lines: SeriesLine[] = rawSeries.map((s, i) => {
        const pts = (s.points || s.data || s.values || []) as Array<
          Record<string, unknown>
        >;
        const vals = pts.length
          ? pts.map((p) => Number(p.value ?? p.amount ?? 0) || 0)
          : Array.isArray(s.values)
            ? (s.values as number[]).map(Number)
            : [];
        const lbl = String(s.label || s.name || `Series ${i + 1}`);
        return {
          key: lbl,
          label: lbl,
          color: seriesColor(lbl, i),
          values: vals,
        };
      });
      const monthLabels =
        labels.length ||
        lines[0]?.values.length ||
        0
          ? labels.length
            ? labels
            : lines[0].values.map((_, i) => `M${i + 1}`)
          : [];
      return { labels: monthLabels, lines };
    }

    if (labels.length && rawSeries.every((s) => s.value != null)) {
      return {
        labels,
        lines: rawSeries.map((s, i) => ({
          key: String(s.label || `s-${i}`),
          label: String(s.label || `Series ${i + 1}`),
          color: seriesColor(String(s.label || ""), i),
          values: labels.map(() => Number(s.value) || 0),
        })),
      };
    }
  }

  const metricKeys = ["sales", "purchases", "receivables", "payables"] as const;
  const lines: SeriesLine[] = [];
  if (chart) {
    for (let i = 0; i < metricKeys.length; i++) {
      const key = metricKeys[i];
      const arr = chart[key] ?? chart[`${key}_values`];
      if (Array.isArray(arr) && arr.length) {
        lines.push({
          key,
          label: key.charAt(0).toUpperCase() + key.slice(1),
          color: TREND_SERIES_COLORS[key] || seriesColor(key, i),
          values: arr.map((v) => Number(v) || 0),
        });
      }
    }
  }

  if (lines.length) {
    const len = Math.max(...lines.map((l) => l.values.length));
    const monthLabels =
      labels.length >= len
        ? labels.slice(0, len)
        : Array.from({ length: len }, (_, i) => labels[i] || `M${i + 1}`);
    return { labels: monthLabels, lines };
  }

  if (rawSeries.length === 1 && labels.length) {
    return {
      labels,
      lines: [
        {
          key: "value",
          label: String(rawSeries[0].label || "Value"),
          color: TREND_SERIES_COLORS.sales,
          values: labels.map((_, i) => Number(rawSeries[0].value) || 0),
        },
      ],
    };
  }

  return { labels: [], lines: [] };
}

function smoothLinePath(points: { x: number; y: number }[]): string {
  if (!points.length) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpx = (prev.x + curr.x) / 2;
    d += ` C ${cpx} ${prev.y}, ${cpx} ${curr.y}, ${curr.x} ${curr.y}`;
  }
  return d;
}

const GRANULARITY_TABS = ["Weekly", "Monthly", "Quarterly"] as const;

export function HomeTrendOverviewChart({ entry }: Props) {
  const [granularity, setGranularity] = useState<(typeof GRANULARITY_TABS)[number]>("Monthly");
  const { labels, lines } = useMemo(() => parseSeriesLines(entry), [entry]);
  const currency = entry.payload.currency || "SAR";

  const layout = useMemo(() => {
    if (!labels.length || !lines.length) return null;
    const len = labels.length;
    const plotW = Math.max(SCREEN_W - 80, (len - 1) * 56 + 40);
    const allVals = lines.flatMap((l) => l.values.slice(0, len));
    const maxVal = Math.max(1, ...allVals);
    const toY = (v: number) =>
      CHART_PAD.top + PLOT_H - (Math.max(0, v) / maxVal) * PLOT_H;
    const toX = (i: number) =>
      CHART_PAD.left +
      (len <= 1 ? plotW / 2 : (i / (len - 1)) * plotW);

    const linePts = lines.map((line) => ({
      ...line,
      points: line.values.slice(0, len).map((v, i) => ({
        x: toX(i),
        y: toY(v),
      })),
    }));

    return { plotW, maxVal, linePts, len, toY, toX };
  }, [labels, lines]);

  if (!layout || !lines.length) return null;

  const { plotW, maxVal, linePts, len, toY } = layout;
  const chartW = CHART_PAD.left + plotW + CHART_PAD.right;
  const chartH = CHART_PAD.top + PLOT_H + CHART_PAD.bottom;
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * maxVal);

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>
          {(entry.label || "Trend Overview (SAR)").toUpperCase()}
        </Text>
      </View>

      <View style={styles.tabs}>
        {GRANULARITY_TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, granularity === tab && styles.tabActive]}
            onPress={() => setGranularity(tab)}
            activeOpacity={0.85}
          >
            <Text
              style={[
                styles.tabText,
                granularity === tab && styles.tabTextActive,
              ]}
            >
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.legendRow}>
        {linePts.map((line) => (
          <View key={line.key} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: line.color }]} />
            <Text style={styles.legendText}>{line.label}</Text>
          </View>
        ))}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Svg width={chartW} height={chartH}>
          <Rect
            x={CHART_PAD.left}
            y={CHART_PAD.top}
            width={plotW}
            height={PLOT_H}
            rx={10}
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
                  x={CHART_PAD.left - 4}
                  y={y + 3}
                  fill="#94a3b8"
                  fontSize="8"
                  fontFamily={Fonts.body}
                  textAnchor="end"
                >
                  {formatCurrency(tick, currency, { compact: true, hideCode: true })}
                </SvgText>
              </G>
            );
          })}
          {linePts.map((line) =>
            line.points.length > 1 ? (
              <Path
                key={`path-${line.key}`}
                d={smoothLinePath(line.points)}
                fill="none"
                stroke={line.color}
                strokeWidth={2}
                strokeLinecap="round"
              />
            ) : null
          )}
          {linePts[0]?.points.map((p, i) => (
            <SvgText
              key={`xl-${i}`}
              x={p.x}
              y={CHART_PAD.top + PLOT_H + 18}
              fill="#64748b"
              fontSize="9"
              fontFamily={Fonts.bodySemi}
              textAnchor="middle"
            >
              {String(labels[i] || "").slice(0, 3)}
            </SvgText>
          ))}
          {linePts.map((line) =>
            line.points.map((p, i) => (
              <Circle
                key={`${line.key}-dot-${i}`}
                cx={p.x}
                cy={p.y}
                r={3}
                fill="#fff"
                stroke={line.color}
                strokeWidth={2}
              />
            ))
          )}
        </Svg>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: HOME.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: HOME.border,
    padding: 12,
    marginBottom: 12,
  },
  headerRow: { marginBottom: 8 },
  sectionTitle: {
    fontSize: 12,
    fontFamily: Fonts.bodyBold,
    color: HOME.title,
    letterSpacing: 0.4,
  },
  tabs: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 10,
  },
  tab: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: HOME.border,
  },
  tabActive: {
    backgroundColor: HOME.title,
    borderColor: HOME.title,
  },
  tabText: {
    fontSize: 11,
    fontFamily: Fonts.bodySemi,
    color: HOME.subtitle,
  },
  tabTextActive: {
    color: "#fff",
  },
  legendRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 6,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 10,
    fontFamily: Fonts.body,
    color: HOME.subtitle,
  },
});
