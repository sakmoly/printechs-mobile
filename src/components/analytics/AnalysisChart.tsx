import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { BarChart } from "react-native-chart-kit";
import { Fonts, Type } from "../../theme/typography";
import type { AnalysisRow } from "../../api/genericAnalysisTypes";
import {
  colorWithOpacity,
  resolveChartColors,
  type ResolvedChartColors,
} from "../../widgets/chartColors";

type Props = {
  rows: AnalysisRow[];
  currency?: string;
  title?: string;
  maxBars?: number;
  onPointPress?: (row: AnalysisRow) => void;
  /** From widgetData.config ?? widget.config */
  chartColors?: ResolvedChartColors;
  config?: Record<string, unknown> | null;
};

const chartWidth = Dimensions.get("window").width - 48;

export function AnalysisChart({
  rows,
  title = "Breakdown",
  maxBars = 8,
  onPointPress,
  chartColors,
  config,
}: Props) {
  const colors = chartColors || resolveChartColors(config);
  const slice = rows.slice(0, maxBars);
  if (!slice.length) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No chart data</Text>
      </View>
    );
  }

  const labels = slice.map((r) =>
    r.label.length > 8 ? `${r.label.slice(0, 7)}…` : r.label
  );
  const values = slice.map((r) => Math.max(0, Number(r.value) || 0));
  const lyValues = slice.map((r) =>
    r.previous != null ? Math.max(0, Number(r.previous) || 0) : 0
  );
  const hasLy = slice.some(
    (r) => r.previous != null && Number.isFinite(Number(r.previous))
  );

  const datasets = hasLy
    ? [
        {
          data: values.length ? values : [0],
          color: (opacity = 1) => colorWithOpacity(colors.current, opacity),
        },
        {
          data: lyValues.length ? lyValues : [0],
          color: (opacity = 1) => colorWithOpacity(colors.ly, opacity),
        },
      ]
    : [
        {
          data: values.length ? values : [0],
          color: (opacity = 1) => colorWithOpacity(colors.current, opacity),
        },
      ];

  return (
    <View style={styles.card}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {hasLy ? (
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View
              style={[styles.swatch, { backgroundColor: colors.current }]}
            />
            <Text style={styles.legendText}>Current</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: colors.ly }]} />
            <Text style={styles.legendText}>LY</Text>
          </View>
        </View>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <BarChart
          data={{
            labels,
            datasets,
          }}
          width={Math.max(chartWidth, labels.length * (hasLy ? 64 : 48))}
          height={220}
          yAxisLabel=""
          yAxisSuffix=""
          chartConfig={{
            backgroundColor: "#ffffff",
            backgroundGradientFrom: "#ffffff",
            backgroundGradientTo: "#ffffff",
            decimalPlaces: 0,
            color: (opacity = 1) => colorWithOpacity(colors.current, opacity),
            labelColor: (opacity = 1) => `rgba(71, 85, 105, ${opacity})`,
            propsForBackgroundLines: {
              stroke: "#e2e8f0",
            },
          }}
          style={styles.chart}
          fromZero
          showValuesOnTopOfBars={!hasLy}
        />
      </ScrollView>
      {onPointPress ? (
        <View style={styles.tapList}>
          {slice.map((r, i) => (
            <TouchableOpacity
              key={`${r.id}-${i}`}
              style={styles.tapRow}
              onPress={() => onPointPress(r)}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.swatch,
                  {
                    backgroundColor:
                      colors.sliceColors[i % colors.sliceColors.length],
                  },
                ]}
              />
              <Text style={styles.tapLabel} numberOfLines={1}>
                {r.label}
              </Text>
              <Text style={styles.tapHint}>Drill ›</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
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
    marginBottom: 8,
  },
  legendRow: {
    flexDirection: "row",
    gap: 14,
    marginBottom: 6,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  swatch: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  legendText: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: "#64748b",
  },
  chart: {
    borderRadius: 8,
    marginLeft: -8,
  },
  tapList: {
    marginTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e2e8f0",
    paddingTop: 6,
  },
  tapRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
    gap: 8,
  },
  tapLabel: {
    flex: 1,
    fontFamily: Fonts.bodySemi,
    fontSize: 12,
    color: "#334155",
  },
  tapHint: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: "#667eea",
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
