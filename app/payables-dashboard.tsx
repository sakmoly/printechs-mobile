import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

const { width } = Dimensions.get("window");

type TabType = "snapshot" | "performance" | "trend" | "risk";

// Mock Data
const MOCK_DATA = {
  snapshot: {
    totalPayables: 5678900,
    totalOverdue: 678900,
    overduePercentage: 12.0,
    averageDaysToPay: 45,
    agingBreakdown: [
      { period: "0-30 Days", value: 3500000, percentage: 61.6 },
      { period: "31-60 Days", value: 1500000, percentage: 26.4 },
      { period: "61-90 Days", value: 500000, percentage: 8.8 },
      { period: "Over 90 Days", value: 178900, percentage: 3.2 },
    ],
    topVendors: [
      { vendor: "Al-Rashid Trading Co", amount: 450000 },
      { vendor: "Tech Solutions Ltd", amount: 380000 },
      { vendor: "Industrial Supplies", amount: 320000 },
      { vendor: "Office Equipment Corp", amount: 280000 },
      { vendor: "Material Works Co", amount: 250000 },
    ],
  },
  performance: {
    topVendors: [
      { vendor: "Al-Rashid Trading Co", amount: 450000, invoiceCount: 12 },
      { vendor: "Tech Solutions Ltd", amount: 380000, invoiceCount: 8 },
      { vendor: "Industrial Supplies", amount: 320000, invoiceCount: 15 },
      { vendor: "Office Equipment Corp", amount: 280000, invoiceCount: 6 },
      { vendor: "Material Works Co", amount: 250000, invoiceCount: 10 },
    ],
    topOverdueVendors: [
      { vendor: "ABC Suppliers", amount: 125000, days: 45 },
      { vendor: "XYZ Corporation", amount: 98000, days: 60 },
      { vendor: "Global Materials", amount: 87000, days: 75 },
      { vendor: "Prime Trading Co", amount: 65000, days: 90 },
      { vendor: "Best Supplies", amount: 45000, days: 105 },
    ],
    vendorPerformance: [
      { vendor: "Al-Rashid Trading Co", avgDaysToPay: 30 },
      { vendor: "Tech Solutions Ltd", avgDaysToPay: 35 },
      { vendor: "Industrial Supplies", avgDaysToPay: 42 },
      { vendor: "Office Equipment Corp", avgDaysToPay: 38 },
      { vendor: "Material Works Co", avgDaysToPay: 45 },
    ],
    overdueBuckets: [
      { bucket: "31-60 Days", amount: 250000 },
      { bucket: "61-90 Days", amount: 180000 },
      { bucket: "Over 90 Days", amount: 248900 },
    ],
  },
  trend: {
    payablesTrend: [
      { month: "Jan", invoiced: 4500000, paid: 4200000 },
      { month: "Feb", invoiced: 4800000, paid: 4450000 },
      { month: "Mar", invoiced: 5200000, paid: 4800000 },
      { month: "Apr", invoiced: 5500000, paid: 5100000 },
      { month: "May", invoiced: 5600000, paid: 5300000 },
      { month: "Jun", invoiced: 5900000, paid: 5400000 },
    ],
    overdueTrend: [
      { month: "Jan", overdue: 450000 },
      { month: "Feb", overdue: 480000 },
      { month: "Mar", overdue: 520000 },
      { month: "Apr", overdue: 580000 },
      { month: "May", overdue: 620000 },
      { month: "Jun", overdue: 678900 },
    ],
    payablesByRegion: [
      { region: "Riyadh", amount: 2800000, percentage: 49.3 },
      { region: "Jeddah", amount: 1800000, percentage: 31.7 },
      { region: "Dammam", amount: 1078900, percentage: 19.0 },
    ],
    dpoTrend: [
      { month: "Jan", dpo: 42 },
      { month: "Feb", dpo: 43 },
      { month: "Mar", dpo: 44 },
      { month: "Apr", dpo: 45 },
      { month: "May", dpo: 45 },
      { month: "Jun", dpo: 45 },
    ],
  },
  risk: {
    overduePayables: [
      { bucket: "31-60 Days", amount: 250000, vendorCount: 15 },
      { bucket: "61-90 Days", amount: 180000, vendorCount: 10 },
      { bucket: "Over 90 Days", amount: 248900, vendorCount: 8 },
    ],
    upcomingPayments: [
      {
        vendor: "Al-Rashid Trading Co",
        invoice: "PI-12345",
        amount: 125000,
        dueDate: "2024-06-30",
        daysRemaining: 5,
      },
      {
        vendor: "Tech Solutions Ltd",
        invoice: "PI-12346",
        amount: 95000,
        dueDate: "2024-07-02",
        daysRemaining: 7,
      },
      {
        vendor: "Industrial Supplies",
        invoice: "PI-12347",
        amount: 85000,
        dueDate: "2024-07-05",
        daysRemaining: 10,
      },
      {
        vendor: "Office Equipment Corp",
        invoice: "PI-12348",
        amount: 65000,
        dueDate: "2024-07-08",
        daysRemaining: 13,
      },
      {
        vendor: "Material Works Co",
        invoice: "PI-12349",
        amount: 55000,
        dueDate: "2024-07-10",
        daysRemaining: 15,
      },
    ],
    problemVendors: [
      { vendor: "ABC Suppliers", overdue: 125000, days: 45, invoiceCount: 5 },
      { vendor: "XYZ Corporation", overdue: 98000, days: 60, invoiceCount: 3 },
      { vendor: "Global Materials", overdue: 87000, days: 75, invoiceCount: 4 },
    ],
    regionalRisk: [
      { region: "Riyadh", overdue: 340000, percentage: 50.0 },
      { region: "Jeddah", amount: 220000, percentage: 32.4 },
      { region: "Dammam", amount: 118900, percentage: 17.6 },
    ],
  },
};

export default function PayablesDashboardScreen() {
  const [activeTab, setActiveTab] = useState<TabType>("snapshot");

  const handleTabPress = (tab: TabType) => {
    setActiveTab(tab);
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  // Snapshot Tab
  const renderSnapshotTab = () => {
    const data = MOCK_DATA.snapshot;
    return (
      <View style={styles.tabContent}>
        {/* Total Payables */}
        <View style={styles.kpiCard}>
          <View style={styles.kpiHeader}>
            <Ionicons name="wallet" size={24} color="#667eea" />
            <Text style={styles.kpiTitle}>Total Payables</Text>
          </View>
          <Text style={[styles.kpiValue, { color: "#667eea" }]}>
            {formatCurrency(data.totalPayables)} SAR
          </Text>
        </View>

        {/* Total Overdue */}
        <View style={[styles.kpiCard, { borderLeftColor: "#ef4444" }]}>
          <View style={styles.kpiHeader}>
            <Ionicons name="alert-circle" size={24} color="#ef4444" />
            <Text style={styles.kpiTitle}>Total Overdue</Text>
          </View>
          <Text style={[styles.kpiValue, { color: "#ef4444" }]}>
            {formatCurrency(data.totalOverdue)} SAR
          </Text>
        </View>

        {/* Avg Days to Pay */}
        <View style={styles.metricsRow}>
          <View style={styles.miniKpiCard}>
            <Ionicons name="calendar" size={20} color="#f59e0b" />
            <Text style={styles.miniKpiTitle}>Avg Days to Pay</Text>
            <Text style={styles.miniKpiValue}>{data.averageDaysToPay}</Text>
          </View>
          <View style={styles.miniKpiCard}>
            <Ionicons name="trending-down" size={20} color="#10b981" />
            <Text style={styles.miniKpiTitle}>% Overdue</Text>
            <Text style={[styles.miniKpiValue, { color: "#ef4444" }]}>
              {data.overduePercentage}%
            </Text>
          </View>
        </View>

        {/* Aging Breakdown */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>AP Aging Breakdown</Text>
          {data.agingBreakdown.map((item, index) => (
            <View key={index} style={styles.agingRow}>
              <View style={styles.agingLeft}>
                <Text style={styles.agingLabel}>{item.period}</Text>
                <View style={styles.agingBar}>
                  <View
                    style={[
                      styles.agingBarFill,
                      {
                        width: `${item.percentage}%`,
                        backgroundColor:
                          item.period === "Over 90 Days"
                            ? "#dc2626"
                            : item.period === "61-90 Days"
                            ? "#f97316"
                            : item.period === "31-60 Days"
                            ? "#f59e0b"
                            : "#10b981",
                      },
                    ]}
                  />
                </View>
              </View>
              <Text style={styles.agingAmount}>
                {formatCurrency(item.value)}
              </Text>
            </View>
          ))}
        </View>

        {/* Top 5 Vendors */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Top 5 Vendors by Amount</Text>
          {data.topVendors.map((item, index) => (
            <View key={index} style={styles.vendorRow}>
              <View style={styles.vendorBar}>
                <View
                  style={[
                    styles.vendorBarFill,
                    { width: `${(item.amount / 450000) * 100}%` },
                  ]}
                />
              </View>
              <View style={styles.vendorInfo}>
                <Text style={styles.vendorName}>{item.vendor}</Text>
                <Text style={styles.vendorAmount}>
                  {formatCurrency(item.amount)} SAR
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  };

  // Performance Tab
  const renderPerformanceTab = () => {
    const data = MOCK_DATA.performance;
    return (
      <View style={styles.tabContent}>
        {/* Top Vendors */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>
            Top 5 Vendors by Payable Amount
          </Text>
          {data.topVendors.map((item, index) => (
            <View key={index} style={styles.vendorRow}>
              <View style={styles.vendorBar}>
                <View
                  style={[
                    styles.vendorBarFill,
                    { width: `${(item.amount / 450000) * 100}%` },
                  ]}
                />
              </View>
              <View style={styles.vendorInfo}>
                <Text style={styles.vendorName}>{item.vendor}</Text>
                <Text style={styles.vendorDetails}>
                  {formatCurrency(item.amount)} SAR • {item.invoiceCount}{" "}
                  Invoices
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Top Overdue Vendors */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Top 5 Overdue Vendors</Text>
          {data.topOverdueVendors.map((item, index) => (
            <View key={index} style={styles.overdueVendorCard}>
              <View style={styles.overdueVendorHeader}>
                <Text style={styles.overdueVendorName}>{item.vendor}</Text>
                <View style={styles.overdueBadge}>
                  <Text style={styles.overdueBadgeText}>{item.days} days</Text>
                </View>
              </View>
              <Text style={styles.overdueVendorAmount}>
                {formatCurrency(item.amount)} SAR
              </Text>
            </View>
          ))}
        </View>

        {/* Vendor Payment Performance */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>
            Vendor Payment Performance (DPO)
          </Text>
          {data.vendorPerformance.map((item, index) => (
            <View key={index} style={styles.performanceRow}>
              <View style={styles.performanceLeft}>
                <Text style={styles.performanceVendor}>{item.vendor}</Text>
                <View style={styles.performanceBar}>
                  <View
                    style={[
                      styles.performanceBarFill,
                      { width: `${(item.avgDaysToPay / 60) * 100}%` },
                    ]}
                  />
                </View>
              </View>
              <Text style={styles.performanceDays}>
                {item.avgDaysToPay} days
              </Text>
            </View>
          ))}
        </View>

        {/* Overdue Buckets */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Overdue Buckets</Text>
          {data.overdueBuckets.map((item, index) => (
            <View key={index} style={styles.bucketRow}>
              <View style={styles.bucketLeft}>
                <Text style={styles.bucketLabel}>{item.bucket}</Text>
                <View style={styles.bucketBar}>
                  <View
                    style={[
                      styles.bucketBarFill,
                      {
                        width: `${(item.amount / 678900) * 100}%`,
                        backgroundColor:
                          item.bucket === "Over 90 Days"
                            ? "#dc2626"
                            : item.bucket === "61-90 Days"
                            ? "#f97316"
                            : "#f59e0b",
                      },
                    ]}
                  />
                </View>
              </View>
              <Text style={styles.bucketAmount}>
                {formatCurrency(item.amount)}
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  // Trend Tab
  const renderTrendTab = () => {
    const data = MOCK_DATA.trend;
    return (
      <View style={styles.tabContent}>
        {/* Invoiced vs Paid Trend */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>
            Payables Trend (Invoiced vs Paid)
          </Text>
          <View style={styles.trendChart}>
            {data.payablesTrend.map((item, index) => (
              <View key={index} style={styles.trendBarContainer}>
                <View style={styles.trendStackedContainer}>
                  <View
                    style={[
                      styles.trendStackedPaid,
                      {
                        height: `${(item.paid / 6000000) * 100}%`,
                      },
                    ]}
                  />
                  <View
                    style={[
                      styles.trendStackedInvoiced,
                      {
                        height: `${
                          ((item.invoiced - item.paid) / 6000000) * 100
                        }%`,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.trendLabel}>{item.month}</Text>
              </View>
            ))}
          </View>
          <View style={styles.legendContainer}>
            <View style={styles.legendItem}>
              <View
                style={[styles.legendDot, { backgroundColor: "#10b981" }]}
              />
              <Text style={styles.legendText}>Paid</Text>
            </View>
            <View style={styles.legendItem}>
              <View
                style={[styles.legendDot, { backgroundColor: "#3b82f6" }]}
              />
              <Text style={styles.legendText}>Outstanding</Text>
            </View>
          </View>
        </View>

        {/* Overdue Trend */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Overdue Trend</Text>
          <View style={styles.trendChart}>
            {data.overdueTrend.map((item, index) => (
              <View key={index} style={styles.trendBarContainer}>
                <View
                  style={[
                    styles.trendBar,
                    {
                      height: `${(item.overdue / 700000) * 100}%`,
                      backgroundColor: "#ef4444",
                    },
                  ]}
                />
                <Text style={styles.trendLabel}>{item.month}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Payables by Region */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Payables by Region</Text>
          {data.payablesByRegion.map((region, index) => (
            <View key={index} style={styles.regionRow}>
              <View style={styles.regionLeft}>
                <Text style={styles.regionName}>{region.region}</Text>
                <View style={styles.regionBar}>
                  <View
                    style={[
                      styles.regionBarFill,
                      { width: `${region.percentage}%` },
                    ]}
                  />
                </View>
              </View>
              <View style={styles.regionRight}>
                <Text style={styles.regionPercentage}>
                  {region.percentage}%
                </Text>
                <Text style={styles.regionAmount}>
                  {formatCurrency(region.amount)}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* DPO Trend */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>
            Days Payable Outstanding (DPO) Trend
          </Text>
          <View style={styles.trendChart}>
            {data.dpoTrend.map((item, index) => (
              <View key={index} style={styles.trendBarContainer}>
                <View
                  style={[
                    styles.trendBar,
                    {
                      height: `${((item.dpo - 40) / 10) * 80 + 20}%`,
                      backgroundColor: "#3b82f6",
                    },
                  ]}
                />
                <Text style={styles.trendLabel}>{item.month}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  };

  // Risk Tab
  const renderRiskTab = () => {
    const data = MOCK_DATA.risk;
    return (
      <View style={styles.tabContent}>
        {/* Overdue Payables */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Overdue Payables Summary</Text>
          {data.overduePayables.map((item, index) => (
            <View key={index} style={styles.overdueSummaryRow}>
              <View style={styles.overdueSummaryLeft}>
                <Text style={styles.overdueSummaryBucket}>{item.bucket}</Text>
                <Text style={styles.overdueSummaryCount}>
                  {item.vendorCount} vendors
                </Text>
              </View>
              <Text style={styles.overdueSummaryAmount}>
                {formatCurrency(item.amount)}
              </Text>
            </View>
          ))}
        </View>

        {/* Upcoming Payments */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>
            Upcoming Payments (Next 15 Days)
          </Text>
          {data.upcomingPayments.map((item, index) => (
            <View key={index} style={styles.upcomingPaymentCard}>
              <View style={styles.upcomingPaymentHeader}>
                <Text style={styles.upcomingPaymentVendor}>{item.vendor}</Text>
                <View
                  style={[
                    styles.upcomingPaymentBadge,
                    {
                      backgroundColor:
                        item.daysRemaining <= 7
                          ? "#fee2e2"
                          : item.daysRemaining <= 14
                          ? "#fef3c7"
                          : "#dbeafe",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.upcomingPaymentDays,
                      {
                        color:
                          item.daysRemaining <= 7
                            ? "#dc2626"
                            : item.daysRemaining <= 14
                            ? "#f59e0b"
                            : "#3b82f6",
                      },
                    ]}
                  >
                    {item.daysRemaining} days
                  </Text>
                </View>
              </View>
              <Text style={styles.upcomingPaymentInvoice}>
                {item.invoice} • Due: {item.dueDate}
              </Text>
              <Text style={styles.upcomingPaymentAmount}>
                {formatCurrency(item.amount)} SAR
              </Text>
            </View>
          ))}
        </View>

        {/* Problem Vendors */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>
            Problem Vendors (High Overdue)
          </Text>
          {data.problemVendors.map((item, index) => (
            <View key={index} style={styles.problemVendorCard}>
              <View style={styles.problemVendorHeader}>
                <Text style={styles.problemVendorName}>{item.vendor}</Text>
                <View style={styles.problemBadge}>
                  <Text style={styles.problemBadgeText}>
                    {item.days} days overdue
                  </Text>
                </View>
              </View>
              <View style={styles.problemVendorDetails}>
                <Text style={styles.problemVendorAmount}>
                  {formatCurrency(item.overdue)} SAR
                </Text>
                <Text style={styles.problemVendorInvoices}>
                  {item.invoiceCount} invoices
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Regional Risk */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Regional Risk Breakdown</Text>
          {data.regionalRisk.map((region, index) => (
            <View key={index} style={styles.regionRiskRow}>
              <View style={styles.regionRiskLeft}>
                <Text style={styles.regionRiskName}>{region.region}</Text>
                <View style={styles.regionRiskBar}>
                  <View
                    style={[
                      styles.regionRiskBarFill,
                      { width: `${region.percentage}%` },
                    ]}
                  />
                </View>
              </View>
              <Text style={styles.regionRiskAmount}>
                {formatCurrency((region as any).overdue || region.amount)}
              </Text>
            </View>
          ))}
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
            <Text style={styles.headerTitle}>Payables</Text>
            <Text style={styles.headerSubtitle}>
              Accounts Payable Dashboard
            </Text>
          </View>
          <TouchableOpacity style={styles.refreshButton}>
            <Ionicons name="refresh-outline" size={24} color="#ffffff" />
          </TouchableOpacity>
        </View>

        {/* Tab Selector */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === "snapshot" && styles.activeTab]}
            onPress={() => handleTabPress("snapshot")}
          >
            <Ionicons
              name="pie-chart"
              size={18}
              color={activeTab === "snapshot" ? "#667eea" : "#ffffff"}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === "snapshot" && styles.activeTabText,
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
            style={[styles.tab, activeTab === "trend" && styles.activeTab]}
            onPress={() => handleTabPress("trend")}
          >
            <Ionicons
              name="trending-up"
              size={18}
              color={activeTab === "trend" ? "#667eea" : "#ffffff"}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === "trend" && styles.activeTabText,
              ]}
            >
              Trend
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === "risk" && styles.activeTab]}
            onPress={() => handleTabPress("risk")}
          >
            <Ionicons
              name="warning"
              size={18}
              color={activeTab === "risk" ? "#667eea" : "#ffffff"}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === "risk" && styles.activeTabText,
              ]}
            >
              Risk
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Tab Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {activeTab === "snapshot" && renderSnapshotTab()}
        {activeTab === "performance" && renderPerformanceTab()}
        {activeTab === "trend" && renderTrendTab()}
        {activeTab === "risk" && renderRiskTab()}
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
    gap: 4,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 12,
  },
  activeTab: {
    backgroundColor: "#ffffff",
  },
  tabText: {
    fontSize: 10,
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
  },
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
  },
  agingAmount: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1f2937",
    marginLeft: 12,
  },
  vendorRow: {
    gap: 8,
    marginBottom: 12,
  },
  vendorBar: {
    height: 8,
    backgroundColor: "#e5e7eb",
    borderRadius: 4,
    overflow: "hidden",
  },
  vendorBarFill: {
    height: "100%",
    backgroundColor: "#667eea",
  },
  vendorInfo: {
    gap: 4,
  },
  vendorName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f2937",
  },
  vendorAmount: {
    fontSize: 14,
    fontWeight: "700",
    color: "#667eea",
  },
  vendorDetails: {
    fontSize: 12,
    color: "#6b7280",
  },
  overdueVendorCard: {
    padding: 16,
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: "#ef4444",
  },
  overdueVendorHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  overdueVendorName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f2937",
  },
  overdueBadge: {
    backgroundColor: "#fee2e2",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  overdueBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#ef4444",
  },
  overdueVendorAmount: {
    fontSize: 16,
    fontWeight: "800",
    color: "#ef4444",
  },
  performanceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  performanceLeft: {
    flex: 1,
    gap: 8,
  },
  performanceVendor: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1f2937",
  },
  performanceBar: {
    height: 8,
    backgroundColor: "#e5e7eb",
    borderRadius: 4,
    overflow: "hidden",
  },
  performanceBarFill: {
    height: "100%",
    backgroundColor: "#3b82f6",
  },
  performanceDays: {
    fontSize: 14,
    fontWeight: "700",
    color: "#3b82f6",
    marginLeft: 12,
  },
  bucketRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  bucketLeft: {
    flex: 1,
    gap: 8,
  },
  bucketLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6b7280",
  },
  bucketBar: {
    height: 8,
    backgroundColor: "#e5e7eb",
    borderRadius: 4,
    overflow: "hidden",
  },
  bucketBarFill: {
    height: "100%",
  },
  bucketAmount: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1f2937",
    marginLeft: 12,
  },
  trendChart: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-around",
    height: 150,
    marginTop: 20,
  },
  trendBarContainer: {
    flex: 1,
    alignItems: "center",
    gap: 8,
  },
  trendStackedContainer: {
    width: "80%",
    height: "100%",
    gap: 2,
  },
  trendStackedPaid: {
    width: "100%",
    backgroundColor: "#10b981",
    borderRadius: 4,
  },
  trendStackedInvoiced: {
    width: "100%",
    backgroundColor: "#3b82f6",
    borderRadius: 4,
  },
  trendBar: {
    width: "80%",
    borderRadius: 4,
  },
  trendLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6b7280",
  },
  legendContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 24,
    marginTop: 12,
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
  regionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  regionLeft: {
    flex: 1,
    gap: 8,
  },
  regionName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f2937",
  },
  regionBar: {
    height: 12,
    backgroundColor: "#e5e7eb",
    borderRadius: 6,
    overflow: "hidden",
  },
  regionBarFill: {
    height: "100%",
    backgroundColor: "#667eea",
  },
  regionRight: {
    alignItems: "flex-end",
    marginLeft: 12,
  },
  regionPercentage: {
    fontSize: 16,
    fontWeight: "800",
    color: "#667eea",
  },
  regionAmount: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
  },
  overdueSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  overdueSummaryLeft: {
    flex: 1,
  },
  overdueSummaryBucket: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f2937",
  },
  overdueSummaryCount: {
    fontSize: 12,
    color: "#6b7280",
  },
  overdueSummaryAmount: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ef4444",
  },
  upcomingPaymentCard: {
    padding: 16,
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    marginBottom: 12,
  },
  upcomingPaymentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  upcomingPaymentVendor: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f2937",
  },
  upcomingPaymentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  upcomingPaymentDays: {
    fontSize: 11,
    fontWeight: "700",
  },
  upcomingPaymentInvoice: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 4,
  },
  upcomingPaymentAmount: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1f2937",
  },
  problemVendorCard: {
    padding: 16,
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: "#ef4444",
  },
  problemVendorHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  problemVendorName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f2937",
  },
  problemBadge: {
    backgroundColor: "#fee2e2",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  problemBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#ef4444",
  },
  problemVendorDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  problemVendorAmount: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ef4444",
  },
  problemVendorInvoices: {
    fontSize: 12,
    color: "#6b7280",
  },
  regionRiskRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  regionRiskLeft: {
    flex: 1,
    gap: 8,
  },
  regionRiskName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1f2937",
  },
  regionRiskBar: {
    height: 8,
    backgroundColor: "#e5e7eb",
    borderRadius: 4,
    overflow: "hidden",
  },
  regionRiskBarFill: {
    height: "100%",
    backgroundColor: "#ef4444",
  },
  regionRiskAmount: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ef4444",
    marginLeft: 12,
  },
});
