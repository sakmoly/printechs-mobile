import React, { useState, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Polyline, Circle, Line } from "react-native-svg";
import {
  useReceivablesSnapshot,
  useReceivablesPerformance,
  useReceivablesTrend,
} from "../src/hooks/useOptimizedApis";
import { ActivityIndicator } from "react-native";

const { width } = Dimensions.get("window");

type TabType = "overview" | "performance" | "trends";

// Mock Data
const MOCK_DATA = {
  snapshot: {
    totalUnpaid: 3456789,
    totalOverdue: 456789,
    overdue_0_30: 125000,
    overdue_31_60: 180000,
    overdue_61_90: 98000,
    overdue_over_90: 53789,
    overduePercentage: 13.2,
    dso: 45,
    averageCollectionPeriod: 38,
  },
  performance: {
    topOverdueCustomers: [
      { name: "Al-Sultan Trading", amount: 245000 },
      { name: "Tech Solutions Ltd", amount: 189000 },
      { name: "Industrial Supplies Co", amount: 156000 },
      { name: "Retail Group", amount: 134000 },
      { name: "ACME Corporation", amount: 125000 },
    ],
    topOverdueInvoices: [
      {
        invoice: "SI-00123",
        customer: "Al-Sultan Trading",
        amount: 85000,
        days: 45,
      },
      {
        invoice: "SI-00456",
        customer: "Tech Solutions Ltd",
        amount: 62000,
        days: 38,
      },
      {
        invoice: "SI-00789",
        customer: "Industrial Supplies Co",
        amount: 45000,
        days: 72,
      },
    ],
    monthlyPaidUnpaid: [
      { month: "Jan", paid: 1200000, unpaid: 450000 },
      { month: "Feb", paid: 1350000, unpaid: 420000 },
      { month: "Mar", paid: 1280000, unpaid: 480000 },
      { month: "Apr", paid: 1420000, unpaid: 390000 },
      { month: "May", paid: 1380000, unpaid: 510000 },
      { month: "Jun", paid: 1450000, unpaid: 420000 },
    ],
    agingBreakdown: [
      { period: "Current", amount: 2450000 },
      { period: "1-30 Days", amount: 1250000 },
      { period: "31-60 Days", amount: 450000 },
      { period: "61-90 Days", amount: 280000 },
      { period: "Over 90 Days", amount: 27089 },
    ],
    collectionEfficiency: 87.5,
  },
  trend: {
    arTrend: [
      { month: "Jul 2023", amount: 3200000 },
      { month: "Aug 2023", amount: 3350000 },
      { month: "Sep 2023", amount: 3180000 },
      { month: "Oct 2023", amount: 3420000 },
      { month: "Nov 2023", amount: 3560000 },
      { month: "Dec 2023", amount: 3380000 },
      { month: "Jan 2024", amount: 3650000 },
      { month: "Feb 2024", amount: 3450000 },
      { month: "Mar 2024", amount: 3580000 },
      { month: "Apr 2024", amount: 3720000 },
      { month: "May 2024", amount: 3456789 },
    ],
    receivableByTerritory: [
      { territory: "Riyadh", amount: 1856789, percentage: 53.7 },
      { territory: "Jeddah", amount: 980000, percentage: 28.4 },
      { territory: "Dammam", amount: 620000, percentage: 17.9 },
    ],
    overdueByTerritory: [
      { territory: "Riyadh", overdue: 245000 },
      { territory: "Jeddah", overdue: 156000 },
      { territory: "Dammam", overdue: 55789 },
    ],
    monthlyOverdueTrend: [
      { month: "Jan", overdue: 380000 },
      { month: "Feb", overdue: 340000 },
      { month: "Mar", overdue: 420000 },
      { month: "Apr", overdue: 360000 },
      { month: "May", overdue: 410000 },
      { month: "Jun", overdue: 456789 },
    ],
    monthlySalesVsCollection: [
      { month: "Jan", sales: 2200000, collection: 1950000 },
      { month: "Feb", sales: 2350000, collection: 2080000 },
      { month: "Mar", sales: 2280000, collection: 2010000 },
      { month: "Apr", sales: 2420000, collection: 2150000 },
      { month: "May", sales: 2380000, collection: 2100000 },
      { month: "Jun", sales: 2450000, collection: 2180000 },
    ],
  },
};

export default function ReceivablesDashboardScreen() {
  const [activeTab, setActiveTab] = useState<TabType>("overview");

  // Fetch real API data
  const {
    data: snapshotData,
    isLoading: snapshotLoading,
    error: snapshotError,
    refetch: refetchSnapshot,
  } = useReceivablesSnapshot();
  const {
    data: performanceData,
    isLoading: performanceLoading,
    error: performanceError,
    refetch: refetchPerformance,
  } = useReceivablesPerformance();
  const {
    data: trendData,
    isLoading: trendLoading,
    error: trendError,
    refetch: refetchTrend,
  } = useReceivablesTrend();

  const handleTabPress = (tab: TabType) => {
    setActiveTab(tab);
  };

  const handleRefresh = () => {
    // Refetch all data
    refetchSnapshot();
    refetchPerformance();
    refetchTrend();
  };

  // Helper function to format currency
  const formatCurrency = (value: number) => {
    return value.toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  // Snapshot Tab
  const renderOverviewTab = () => {
    // Use real API data or fallback to mock data
    const data = snapshotData || MOCK_DATA.snapshot;

    if (snapshotLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={styles.loadingText}>Loading receivables data...</Text>
        </View>
      );
    }

    if (snapshotError) {
      return (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#ef4444" />
          <Text style={styles.errorText}>Failed to load receivables data</Text>
          <Text style={styles.errorSubtext}>Please try again later</Text>
        </View>
      );
    }

    return (
      <View style={styles.tabContent}>
        {/* Total Receivable */}
        <View style={styles.kpiCard}>
          <View style={styles.kpiHeader}>
            <Ionicons name="document-text" size={24} color="#667eea" />
            <Text style={styles.kpiTitle}>Total Receivable</Text>
          </View>
          <Text style={styles.kpiValue}>
            {formatCurrency(data.totalUnpaid)}
          </Text>
        </View>

        {/* Aging Summary KPIs */}
        <View style={styles.summaryKpiContainer}>
          {performanceLoading ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                paddingVertical: 12,
              }}
            >
              <ActivityIndicator size="small" color="#667eea" />
              <Text style={styles.breakdownLabel}>Loading aging data...</Text>
            </View>
          ) : (
            (() => {
              const perf = performanceData || MOCK_DATA.performance;
              const raw = (perf.agingBreakdown || []) as Array<{
                period: string;
                amount: number;
              }>;
              const norm = new Map<string, number>();
              raw.forEach((b) => {
                const k = (b?.period || "").toString().trim().toLowerCase();
                norm.set(k, (b?.amount as number) || 0);
              });
              const get = (label: string) =>
                norm.get(label.trim().toLowerCase()) || 0;

              const currentBalance = get("Current") + get("1-30 Days");
              const overdue =
                get("31-60 Days") + get("61-90 Days") + get("91-120 Days");
              const oldBalance = get("Old Balance");

              const summaryMetrics = [
                {
                  label: "Current Balance",
                  value: currentBalance,
                  badgeColor: "#EEF2FF",
                  textColor: "#4F46E5",
                  icon: "cash",
                  accent: "#4F46E5",
                },
                {
                  label: "Overdue",
                  value: overdue,
                  badgeColor: "#FEE2E2",
                  textColor: "#B91C1C",
                  icon: "alert-circle",
                  accent: "#B91C1C",
                },
                {
                  label: "Old Balance",
                  value: oldBalance,
                  badgeColor: "#FEF08A",
                  textColor: "#B45309",
                  icon: "time",
                  accent: "#B45309",
                },
              ];

              return (
                <View style={styles.summaryKpiRow}>
                  {summaryMetrics.map((metric) => (
                    <View
                      key={metric.label}
                      style={[
                        styles.summaryKpiCard,
                        { borderLeftColor: metric.accent },
                      ]}
                    >
                      <View style={styles.summaryKpiHeader}>
                        <View
                          style={[
                            styles.summaryBadge,
                            { backgroundColor: metric.badgeColor },
                          ]}
                        >
                          <Ionicons
                            name={metric.icon as any}
                            size={18}
                            color={metric.textColor}
                          />
                        </View>
                        <Text
                          style={[
                            styles.summaryLabel,
                            { color: metric.textColor },
                          ]}
                          numberOfLines={1}
                        >
                          {metric.label}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.summaryValue,
                          { color: metric.accent || "#111827" },
                        ]}
                      >
                        {formatCurrency(metric.value)}
                      </Text>
                    </View>
                  ))}
                </View>
              );
            })()
          )}
        </View>

        {/* Overdue Breakdown */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Overdue Breakdown</Text>
          <View style={styles.breakdownContainer}>
            <View style={styles.breakdownItem}>
              <View
                style={[
                  styles.breakdownBar,
                  { width: "60%", backgroundColor: "#fbbf24" },
                ]}
              />
              <Text style={styles.breakdownLabel}>0-30 Days</Text>
              <Text style={styles.breakdownValue}>
                {formatCurrency(data.overdue_0_30)}
              </Text>
            </View>
            <View style={styles.breakdownItem}>
              <View
                style={[
                  styles.breakdownBar,
                  { width: "70%", backgroundColor: "#f97316" },
                ]}
              />
              <Text style={styles.breakdownLabel}>31-60 Days</Text>
              <Text style={styles.breakdownValue}>
                {formatCurrency(data.overdue_31_60)}
              </Text>
            </View>
            <View style={styles.breakdownItem}>
              <View
                style={[
                  styles.breakdownBar,
                  { width: "50%", backgroundColor: "#ef4444" },
                ]}
              />
              <Text style={styles.breakdownLabel}>61-90 Days</Text>
              <Text style={styles.breakdownValue}>
                {formatCurrency(data.overdue_61_90)}
              </Text>
            </View>
            <View style={styles.breakdownItem}>
              <View
                style={[
                  styles.breakdownBar,
                  { width: "30%", backgroundColor: "#dc2626" },
                ]}
              />
              <Text style={styles.breakdownLabel}>Over 90 Days</Text>
              <Text style={styles.breakdownValue}>
                {formatCurrency(data.overdue_over_90)}
              </Text>
            </View>
          </View>
        </View>

        {/* DSO & Average Collection */}
        <View style={styles.metricsRow}>
          <View style={styles.miniKpiCard}>
            <Ionicons name="calendar" size={20} color="#10b981" />
            <Text style={styles.miniKpiTitle}>DSO</Text>
            <Text style={styles.miniKpiValue}>{data.dso} days</Text>
          </View>
          <View style={styles.miniKpiCard}>
            <Ionicons name="time" size={20} color="#3b82f6" />
            <Text style={styles.miniKpiTitle}>Avg Collection</Text>
            <Text style={styles.miniKpiValue}>
              {data.averageCollectionPeriod} days
            </Text>
          </View>
        </View>

        {/* Overdue Percentage */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Overdue vs Total</Text>
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${data.overduePercentage}%` },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {data.overduePercentage}% Overdue
            </Text>
          </View>
        </View>
      </View>
    );
  };

  // Performance Tab
  const renderPerformanceTab = () => {
    // Use real API data or fallback to mock data
    const data = performanceData || MOCK_DATA.performance;

    if (performanceLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={styles.loadingText}>Loading receivables data...</Text>
        </View>
      );
    }

    if (performanceError) {
      return (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#ef4444" />
          <Text style={styles.errorText}>Failed to load receivables data</Text>
          <Text style={styles.errorSubtext}>Please try again later</Text>
        </View>
      );
    }

    // Calculate max amounts for proportional bars
    const maxCustomerAmount =
      data.topOverdueCustomers.length > 0
        ? Math.max(...data.topOverdueCustomers.map((c) => c.amount))
        : 100;
    const maxAgingAmount =
      data.agingBreakdown.length > 0
        ? Math.max(...data.agingBreakdown.map((a) => a.amount))
        : 100;

    return (
      <View style={styles.tabContent}>
        {/* Top Overdue Customers */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Top Overdue Customers</Text>
          {data.topOverdueCustomers.map((customer, index) => (
            <View key={index} style={styles.customerRow}>
              <View style={styles.customerBar}>
                <View
                  style={[
                    styles.customerBarFill,
                    {
                      width: `${(customer.amount / maxCustomerAmount) * 100}%`,
                    },
                  ]}
                />
              </View>
              <View style={styles.customerInfo}>
                <Text style={styles.customerName}>{customer.name}</Text>
                <Text style={styles.customerAmount}>
                  {formatCurrency(customer.amount)}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Top Overdue Invoices */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Top Overdue Invoices</Text>
          {data.topOverdueInvoices.map((invoice, index) => (
            <View key={index} style={styles.invoiceCard}>
              <View style={styles.invoiceHeader}>
                <Text style={styles.invoiceNumber}>{invoice.invoice}</Text>
                <Text style={styles.invoiceDays}>{invoice.days} days</Text>
              </View>
              <Text style={styles.invoiceCustomer}>{invoice.customer}</Text>
              <Text style={styles.invoiceAmount}>
                {formatCurrency(invoice.amount)}
              </Text>
            </View>
          ))}
        </View>

        {/* Collection Efficiency */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Collection Efficiency</Text>
          <View style={styles.efficiencyContainer}>
            <View style={styles.efficiencyCircle}>
              <Text style={styles.efficiencyValue}>
                {data.collectionEfficiency}%
              </Text>
            </View>
            <View style={styles.efficiencyBar}>
              <View
                style={[
                  styles.efficiencyFill,
                  { width: `${data.collectionEfficiency}%` },
                ]}
              />
            </View>
          </View>
        </View>

        {/* Aging Breakdown */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Aging Summary</Text>
          {data.agingBreakdown.map((item, index) => (
            <View key={index} style={styles.agingRow}>
              <View style={styles.agingLeft}>
                <Text style={styles.agingLabel}>{item.period}</Text>
                <View style={styles.agingBar}>
                  <View
                    style={[
                      styles.agingBarFill,
                      { width: `${(item.amount / maxAgingAmount) * 100}%` },
                    ]}
                  />
                </View>
              </View>
              <Text style={styles.agingAmount}>
                {formatCurrency(item.amount)}
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  // Trend Tab
  const renderTrendsTab = () => {
    // Use real API data or fallback to mock data
    const data = trendData || MOCK_DATA.trend;

    if (trendLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={styles.loadingText}>Loading trend data...</Text>
        </View>
      );
    }

    if (trendError) {
      return (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#ef4444" />
          <Text style={styles.errorText}>Failed to load trend data</Text>
          <Text style={styles.errorSubtext}>Please try again later</Text>
        </View>
      );
    }

    return (
      <View style={styles.tabContent}>
        {/* Receivable by Territory */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Receivable by Territory</Text>
          {data.receivableByTerritory.map((territory, index) => (
            <TouchableOpacity
              key={index}
              style={styles.territoryRow}
              onPress={() =>
                router.push(
                  `/territory-details?territory=${encodeURIComponent(
                    territory.territory
                  )}`
                )
              }
              activeOpacity={0.8}
            >
              <View style={styles.territoryLeft}>
                <Text style={styles.territoryName}>{territory.territory}</Text>
                <View style={styles.territoryBar}>
                  <View
                    style={[
                      styles.territoryBarFill,
                      { width: `${territory.percentage}%` },
                    ]}
                  />
                </View>
              </View>
              <View style={styles.territoryRight}>
                <Text style={styles.territoryPercentage}>
                  {territory.percentage}%
                </Text>
                <Text style={styles.territoryAmount}>
                  {formatCurrency(territory.amount)}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Overdue by Territory */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Overdue by Territory</Text>
          {data.overdueByTerritory.map((territory, index) => (
            <TouchableOpacity
              key={index}
              style={styles.overdueRow}
              onPress={() =>
                router.push(
                  `/territory-details?territory=${encodeURIComponent(
                    territory.territory
                  )}`
                )
              }
              activeOpacity={0.8}
            >
              <Text style={styles.overdueTerritory}>{territory.territory}</Text>
              <View style={styles.overdueBar}>
                <View
                  style={[
                    styles.overdueBarFill,
                    { width: `${(territory.overdue / 245000) * 100}%` },
                  ]}
                />
              </View>
              <Text style={styles.overdueAmount}>
                {formatCurrency(territory.overdue)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Monthly Overdue Trend */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Overdue Trend (Monthly)</Text>
          {(() => {
            // Calculate max overdue amount for proper scaling
            const maxOverdue = Math.max(
              ...data.monthlyOverdueTrend.map((item) => item.overdue),
              1
            );
            // Add 20% padding to max value for better visualization
            const chartMax = maxOverdue * 1.2;

            return (
              <View style={styles.trendChart}>
                {data.monthlyOverdueTrend.map((item, index) => {
                  // Calculate percentage relative to max value
                  const percentage = (item.overdue / chartMax) * 100;
                  // Cap at 100% to prevent overflow
                  const barHeight = Math.min(percentage, 100);

                  return (
                    <View key={index} style={styles.trendBar}>
                      <Text
                        style={[
                          styles.trendValueLabel,
                          { bottom: barHeight + 25 },
                        ]}
                      >
                        {formatCurrency(item.overdue)}
                      </Text>
                      <View
                        style={[
                          styles.trendBarFill,
                          {
                            height: `${barHeight}%`,
                            backgroundColor:
                              item.overdue > maxOverdue * 0.8
                                ? "#ef4444"
                                : "#f97316",
                          },
                        ]}
                      />
                      <Text style={styles.trendLabel}>{item.month}</Text>
                    </View>
                  );
                })}
              </View>
            );
          })()}
        </View>

        {/* Sales vs Collection Trend */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Sales vs Collection Trend</Text>
          <View style={styles.lineChartContainer}>
            {/* Legend */}
            <View style={styles.legendContainer}>
              <View style={styles.legendItem}>
                <View
                  style={[styles.legendDot, { backgroundColor: "#667eea" }]}
                />
                <Text style={styles.legendText}>Sales</Text>
              </View>
              <View style={styles.legendItem}>
                <View
                  style={[styles.legendDot, { backgroundColor: "#10b981" }]}
                />
                <Text style={styles.legendText}>Collection</Text>
              </View>
            </View>
            {/* Line Chart with SVG */}
            <View style={styles.svgChartContainer}>
              <Svg width={width - 80} height={200}>
                {(() => {
                  const chartData = data.monthlySalesVsCollection;
                  const maxValue = Math.max(
                    ...chartData.map((d) => Math.max(d.sales, d.collection))
                  );
                  const minValue = Math.min(
                    ...chartData.map((d) => Math.min(d.sales, d.collection))
                  );
                  const range = maxValue - minValue;
                  const padding = 20;
                  const chartWidth = width - 80 - padding * 2;
                  const chartHeight = 180;
                  const pointSpacing = chartWidth / (chartData.length - 1);

                  // Calculate points
                  const salesPoints = chartData.map(
                    (item, index) =>
                      `${padding + index * pointSpacing},${
                        padding +
                        chartHeight -
                        ((item.sales - minValue) / range) * chartHeight
                      }`
                  );
                  const collectionPoints = chartData.map(
                    (item, index) =>
                      `${padding + index * pointSpacing},${
                        padding +
                        chartHeight -
                        ((item.collection - minValue) / range) * chartHeight
                      }`
                  );

                  return (
                    <>
                      {/* Sales Line */}
                      <Polyline
                        points={salesPoints.join(" ")}
                        fill="none"
                        stroke="#667eea"
                        strokeWidth="3"
                      />
                      {/* Collection Line */}
                      <Polyline
                        points={collectionPoints.join(" ")}
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="3"
                      />
                      {/* Sales Dots */}
                      {chartData.map((item, index) => {
                        const x = padding + index * pointSpacing;
                        const y =
                          padding +
                          chartHeight -
                          ((item.sales - minValue) / range) * chartHeight;
                        return (
                          <Circle
                            key={`sales-${index}`}
                            cx={x}
                            cy={y}
                            r="5"
                            fill="#667eea"
                          />
                        );
                      })}
                      {/* Collection Dots */}
                      {chartData.map((item, index) => {
                        const x = padding + index * pointSpacing;
                        const y =
                          padding +
                          chartHeight -
                          ((item.collection - minValue) / range) * chartHeight;
                        return (
                          <Circle
                            key={`collection-${index}`}
                            cx={x}
                            cy={y}
                            r="5"
                            fill="#10b981"
                          />
                        );
                      })}
                    </>
                  );
                })()}
              </Svg>
              {/* Month Labels */}
              <View style={styles.lineChartLabels}>
                {data.monthlySalesVsCollection.map((item, index) => (
                  <Text key={index} style={styles.lineChartLabel}>
                    {item.month}
                  </Text>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* AR Trend Summary */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>AR Balance Trend</Text>
          <View style={styles.trendSummary}>
            {[
              { label: "Lowest", value: "3,180,000", date: "Sep 2023" },
              { label: "Highest", value: "3,720,000", date: "Apr 2024" },
              { label: "Current", value: "3,456,789", date: "Now" },
            ].map((metric) => (
              <View key={metric.label} style={styles.trendItem}>
                <Text style={styles.trendItemLabel} numberOfLines={1}>
                  {metric.label}
                </Text>
                <Text
                  style={styles.trendItemValue}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >
                  {metric.value}
                </Text>
                <Text style={styles.trendItemDate} numberOfLines={1}>
                  {metric.date}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={["#667eea", "#764ba2"]}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#ffffff" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Receivables</Text>
            <Text style={styles.headerSubtitle}>
              Accounts Receivable Dashboard
            </Text>
          </View>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={handleRefresh}
          >
            <Ionicons name="refresh-outline" size={24} color="#ffffff" />
          </TouchableOpacity>
        </View>

        {/* Tab Selector */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === "overview" && styles.activeTab]}
            onPress={() => handleTabPress("overview")}
          >
            <Ionicons
              name="pie-chart"
              size={18}
              color={activeTab === "overview" ? "#667eea" : "#ffffff"}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === "overview" && styles.activeTabText,
              ]}
            >
              Snapshot
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === "performance" && styles.activeTab,
            ]}
            onPress={() => handleTabPress("performance")}
          >
            <Ionicons
              name="bar-chart"
              size={18}
              color={activeTab === "performance" ? "#667eea" : "#ffffff"}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === "performance" && styles.activeTabText,
              ]}
            >
              Performance
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === "trends" && styles.activeTab]}
            onPress={() => handleTabPress("trends")}
          >
            <Ionicons
              name="trending-up"
              size={18}
              color={activeTab === "trends" ? "#667eea" : "#ffffff"}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === "trends" && styles.activeTabText,
              ]}
            >
              Trends
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Tab Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {activeTab === "overview" && renderOverviewTab()}
        {activeTab === "performance" && renderPerformanceTab()}
        {activeTab === "trends" && renderTrendsTab()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: "#667eea",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#ffffff",
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.85)",
    marginTop: 2,
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 16,
    padding: 4,
    gap: 6,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  activeTab: {
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  tabText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#ffffff",
  },
  activeTabText: {
    color: "#667eea",
  },
  content: {
    flex: 1,
  },
  tabContent: {
    padding: 20,
    paddingBottom: 40,
  },
  // KPI Card Styles
  kpiCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#667eea",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  kpiHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  kpiTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6b7280",
  },
  kpiValue: {
    fontSize: 28,
    fontWeight: "800",
    color: "#1f2937",
  },
  summaryKpiContainer: {
    marginBottom: 16,
  },
  summaryKpiRow: {
    gap: 12,
  },
  summaryKpiCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#4F46E5",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
    gap: 8,
    width: "100%",
  },
  summaryKpiHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  summaryBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#4F46E5",
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111827",
  },
  // Section Card
  sectionCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 16,
  },
  // Breakdown Styles
  breakdownContainer: {
    gap: 12,
  },
  breakdownItem: {
    gap: 8,
  },
  breakdownBar: {
    height: 8,
    borderRadius: 4,
  },
  breakdownLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6b7280",
  },
  breakdownValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1f2937",
  },
  // Metrics Row
  metricsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  miniKpiCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  miniKpiTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
    marginTop: 8,
  },
  miniKpiValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1f2937",
  },
  // Progress Styles
  progressContainer: {
    gap: 8,
  },
  progressBar: {
    height: 24,
    backgroundColor: "#e5e7eb",
    borderRadius: 12,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#ef4444",
    borderRadius: 12,
  },
  progressText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1f2937",
    textAlign: "center",
  },
  // Customer Row
  customerRow: {
    gap: 8,
    marginBottom: 12,
  },
  customerBar: {
    height: 8,
    backgroundColor: "#e5e7eb",
    borderRadius: 4,
    overflow: "hidden",
  },
  customerBarFill: {
    height: "100%",
    backgroundColor: "#f97316",
  },
  customerInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  customerName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1f2937",
  },
  customerAmount: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1f2937",
  },
  // Invoice Card
  invoiceCard: {
    padding: 16,
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: "#ef4444",
  },
  invoiceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  invoiceNumber: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1f2937",
  },
  invoiceDays: {
    fontSize: 12,
    fontWeight: "700",
    color: "#ef4444",
    backgroundColor: "#fee2e2",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  invoiceCustomer: {
    fontSize: 13,
    color: "#6b7280",
    marginBottom: 4,
  },
  invoiceAmount: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1f2937",
  },
  // Efficiency
  efficiencyContainer: {
    alignItems: "center",
    gap: 16,
  },
  efficiencyCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#10b981",
    justifyContent: "center",
    alignItems: "center",
  },
  efficiencyValue: {
    fontSize: 32,
    fontWeight: "800",
    color: "#ffffff",
  },
  efficiencyBar: {
    width: "100%",
    height: 12,
    backgroundColor: "#e5e7eb",
    borderRadius: 6,
    overflow: "hidden",
  },
  efficiencyFill: {
    height: "100%",
    backgroundColor: "#10b981",
  },
  // Aging
  agingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  agingLeft: {
    flex: 1,
    gap: 8,
  },
  agingLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6b7280",
  },
  agingBar: {
    height: 8,
    backgroundColor: "#e5e7eb",
    borderRadius: 4,
    overflow: "hidden",
  },
  agingBarFill: {
    height: "100%",
    backgroundColor: "#3b82f6",
  },
  agingAmount: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1f2937",
    marginLeft: 12,
  },
  // Territory
  territoryRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  territoryLeft: {
    flex: 1,
    gap: 8,
  },
  territoryName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f2937",
  },
  territoryBar: {
    height: 12,
    backgroundColor: "#e5e7eb",
    borderRadius: 6,
    overflow: "hidden",
  },
  territoryBarFill: {
    height: "100%",
    backgroundColor: "#667eea",
  },
  territoryRight: {
    alignItems: "flex-end",
    marginLeft: 12,
  },
  territoryPercentage: {
    fontSize: 16,
    fontWeight: "800",
    color: "#667eea",
  },
  territoryAmount: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
  },
  // Overdue
  overdueRow: {
    marginBottom: 16,
  },
  overdueTerritory: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 8,
  },
  overdueBar: {
    height: 12,
    backgroundColor: "#e5e7eb",
    borderRadius: 6,
    overflow: "hidden",
    marginBottom: 4,
  },
  overdueBarFill: {
    height: "100%",
    backgroundColor: "#ef4444",
  },
  overdueAmount: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ef4444",
  },
  // Trend Chart
  trendChart: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-around",
    height: 180,
    marginTop: 20,
    paddingTop: 20,
  },
  trendBar: {
    flex: 1,
    alignItems: "center",
    gap: 8,
    position: "relative",
  },
  trendBarFill: {
    width: "80%",
    borderRadius: 4,
  },
  trendLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6b7280",
  },
  trendValueLabel: {
    position: "absolute",
    fontSize: 9,
    fontWeight: "700",
    color: "#374151",
    textAlign: "center",
    width: "100%",
  },
  // Trend Summary
  trendSummary: {
    flexDirection: "row",
    gap: 12,
  },
  trendItem: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    padding: 16,
    backgroundColor: "#f9fafb",
    borderRadius: 12,
  },
  trendItemLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6b7280",
    marginBottom: 8,
  },
  trendItemValue: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1f2937",
    marginBottom: 4,
    width: "100%",
    textAlign: "center",
    lineHeight: 18,
  },
  trendItemDate: {
    fontSize: 10,
    fontWeight: "600",
    color: "#9ca3af",
  },
  // Line Chart
  lineChartContainer: {
    marginTop: 16,
  },
  legendContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 24,
    marginBottom: 20,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6b7280",
  },
  svgChartContainer: {
    alignItems: "center",
    marginTop: 10,
  },
  lineChartLabels: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    marginTop: 8,
  },
  lineChartLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6b7280",
  },
  // Loading & Error States
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 100,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: "600",
    color: "#6b7280",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 100,
  },
  errorText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: "700",
    color: "#ef4444",
    textAlign: "center",
  },
  errorSubtext: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "500",
    color: "#6b7280",
    textAlign: "center",
  },
  // Info Banner
  infoBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#eef2ff",
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: "#667eea",
  },
  infoBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: "#667eea",
  },
});
