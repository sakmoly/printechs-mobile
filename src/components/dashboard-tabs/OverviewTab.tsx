import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Fonts, Type } from "../../theme/typography";

interface YTDMetrics {
  netSales: {
    current: number;
    previous: number;
    change: number;
    changePercent: number;
  };
  totalInvoices: {
    current: number;
    previous: number;
    change: number;
    changePercent: number;
  };
  avgInvoice: {
    current: number;
    previous: number;
    change: number;
    changePercent: number;
  };
  grossProfitMargin: {
    current: number;
    previous: number;
    change: number;
    changePercent: number;
  };
  costOfGoods: {
    current: number;
    previous: number;
    change: number;
    changePercent: number;
  };
  grossProfit: {
    current: number;
    previous: number;
    change: number;
    changePercent: number;
  };
}

interface OverviewTabProps {
  ytdMetrics: YTDMetrics | null;
  formatCurrency: (value: number) => string;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  ytdMetrics,
  formatCurrency,
}) => {
  if (!ytdMetrics) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>No YTD metrics available</Text>
        <Text style={styles.subText}>
          Year-to-date data is not available for comparison
        </Text>
      </View>
    );
  }

  const getChangeIcon = (changePercent: number) => {
    if (changePercent > 0) return "trending-up";
    if (changePercent < 0) return "trending-down";
    return "remove";
  };

  const getChangeColor = (changePercent: number) => {
    if (changePercent > 0) return "#059669";
    if (changePercent < 0) return "#dc2626";
    return "#6b7280";
  };

  const MetricRow = ({
    title,
    current,
    previous,
    changePercent,
    format = "currency",
  }: {
    title: string;
    current: number;
    previous: number;
    changePercent: number;
    format?: "currency" | "number" | "percent";
  }) => (
    <View style={styles.metricCard}>
      <View style={styles.metricHeader}>
        <Text style={styles.metricTitle}>{title}</Text>
        <View style={styles.changeContainer}>
          <Ionicons
            name={getChangeIcon(changePercent)}
            size={14}
            color={getChangeColor(changePercent)}
          />
          <Text
            style={[styles.changeText, { color: getChangeColor(changePercent) }]}
          >
            {Math.abs(changePercent).toFixed(1)}%
          </Text>
        </View>
      </View>
      <View style={styles.metricValues}>
        <View style={styles.valueColumn}>
          <Text style={styles.valueLabel}>Current YTD</Text>
          <Text style={styles.valueNumber}>
            {format === "percent"
              ? `${current.toFixed(1)}%`
              : format === "number"
                ? current.toLocaleString()
                : formatCurrency(current)}
          </Text>
        </View>
        <View style={styles.valueColumn}>
          <Text style={styles.valueLabel}>Last Year</Text>
          <Text style={styles.valueNumberSecondary}>
            {format === "percent"
              ? `${previous.toFixed(1)}%`
              : format === "number"
                ? previous.toLocaleString()
                : formatCurrency(previous)}
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.headerSection}>
        <Text style={styles.headerTitle}>Year-to-Date vs Last Year</Text>
        <Text style={styles.headerSubtitle}>Performance comparison</Text>
      </View>

      <View style={styles.heroCard}>
        <View style={styles.metricHeader}>
          <Text style={styles.heroEyebrow}>Net Sales</Text>
          <View style={styles.changeContainer}>
            <Ionicons
              name={getChangeIcon(ytdMetrics.netSales.changePercent)}
              size={16}
              color={getChangeColor(ytdMetrics.netSales.changePercent)}
            />
            <Text
              style={[
                styles.changeText,
                { color: getChangeColor(ytdMetrics.netSales.changePercent) },
              ]}
            >
              {Math.abs(ytdMetrics.netSales.changePercent).toFixed(1)}% YoY
            </Text>
          </View>
        </View>
        <Text style={styles.heroValue}>
          {formatCurrency(ytdMetrics.netSales.current)}
        </Text>
        <Text style={styles.heroPrev}>
          Last year {formatCurrency(ytdMetrics.netSales.previous)}
        </Text>
      </View>

      <MetricRow
        title="Total Invoices"
        current={ytdMetrics.totalInvoices.current}
        previous={ytdMetrics.totalInvoices.previous}
        changePercent={ytdMetrics.totalInvoices.changePercent}
        format="number"
      />
      <MetricRow
        title="Average Invoice"
        current={ytdMetrics.avgInvoice.current}
        previous={ytdMetrics.avgInvoice.previous}
        changePercent={ytdMetrics.avgInvoice.changePercent}
      />
      <MetricRow
        title="Gross Profit Margin"
        current={ytdMetrics.grossProfitMargin.current}
        previous={ytdMetrics.grossProfitMargin.previous}
        changePercent={ytdMetrics.grossProfitMargin.changePercent}
        format="percent"
      />
      <MetricRow
        title="Cost of Goods"
        current={ytdMetrics.costOfGoods.current}
        previous={ytdMetrics.costOfGoods.previous}
        changePercent={ytdMetrics.costOfGoods.changePercent}
      />
      <MetricRow
        title="Gross Profit"
        current={ytdMetrics.grossProfit.current}
        previous={ytdMetrics.grossProfit.previous}
        changePercent={ytdMetrics.grossProfit.changePercent}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#f8fafc",
  },
  headerSection: {
    marginBottom: 20,
  },
  headerTitle: {
    ...Type.sectionTitle,
    color: "#111827",
    marginBottom: 4,
  },
  headerSubtitle: {
    ...Type.body,
    color: "#6b7280",
  },
  heroCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#e0e7ff",
  },
  heroEyebrow: {
    ...Type.label,
    color: "#667eea",
    textTransform: "uppercase",
  },
  heroValue: {
    ...Type.hero,
    color: "#111827",
    marginTop: 8,
  },
  heroPrev: {
    ...Type.caption,
    color: "#6b7280",
    marginTop: 8,
  },
  metricCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#eef2ff",
  },
  metricHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  metricTitle: {
    ...Type.cardTitle,
    color: "#1f2937",
  },
  changeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  changeText: {
    ...Type.caption,
    fontFamily: Fonts.bodyBold,
  },
  metricValues: {
    flexDirection: "row",
    gap: 16,
  },
  valueColumn: {
    flex: 1,
  },
  valueLabel: {
    ...Type.micro,
    color: "#9ca3af",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  valueNumber: {
    ...Type.kpiCompact,
    color: "#111827",
  },
  valueNumberSecondary: {
    ...Type.kpiCompact,
    fontFamily: Fonts.displaySemi,
    color: "#6b7280",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  loadingText: {
    ...Type.sectionTitle,
    color: "#6b7280",
    textAlign: "center",
  },
  subText: {
    ...Type.body,
    color: "#9ca3af",
    textAlign: "center",
    marginTop: 8,
  },
});
