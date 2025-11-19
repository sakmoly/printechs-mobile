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

type TabType = "snapshot" | "performance" | "trend" | "analysis";

// Mock Data
const MOCK_DATA = {
  snapshot: {
    purchaseMTD: 1890000,
    purchaseYTD: 22500000,
    purchaseToday: 85000,
    vendorCount: 45,
    poCount: 280,
    avgOrderValue: 6750,
    topCategories: [
      { category: "Raw Materials", amount: 850000, percentage: 45.0 },
      { category: "Equipment", amount: 650000, percentage: 34.4 },
      { category: "Office Supplies", amount: 390000, percentage: 20.6 },
    ],
    purchaseByStatus: [
      { status: "Draft", count: 25, amount: 150000 },
      { status: "To Bill", count: 45, amount: 450000 },
      { status: "To Receive", count: 120, amount: 1050000 },
      { status: "Completed", count: 90, amount: 240000 },
    ],
  },
  performance: {
    topVendors: [
      {
        vendor: "ABC Suppliers",
        amount: 285000,
        poCount: 35,
        avgOrderValue: 8143,
      },
      {
        vendor: "XYZ Manufacturing",
        amount: 245000,
        poCount: 28,
        avgOrderValue: 8750,
      },
      {
        vendor: "Global Materials Co",
        amount: 220000,
        poCount: 32,
        avgOrderValue: 6875,
      },
      {
        vendor: "Prime Trading",
        amount: 195000,
        poCount: 25,
        avgOrderValue: 7800,
      },
      {
        vendor: "Tech Solutions Ltd",
        amount: 165000,
        poCount: 20,
        avgOrderValue: 8250,
      },
    ],
    categoryPerformance: [
      {
        category: "Raw Materials",
        purchases: 850000,
        poCount: 125,
        avgLeadTime: 14,
      },
      {
        category: "Equipment",
        purchases: 650000,
        poCount: 85,
        avgLeadTime: 21,
      },
      {
        category: "Office Supplies",
        purchases: 390000,
        poCount: 70,
        avgLeadTime: 7,
      },
    ],
    vendorRating: [
      {
        vendor: "ABC Suppliers",
        onTimeDelivery: 95.0,
        qualityScore: 4.5,
        totalOrders: 35,
      },
      {
        vendor: "XYZ Manufacturing",
        onTimeDelivery: 92.0,
        qualityScore: 4.7,
        totalOrders: 28,
      },
      {
        vendor: "Global Materials Co",
        onTimeDelivery: 88.0,
        qualityScore: 4.2,
        totalOrders: 32,
      },
    ],
    pendingReceipts: [
      {
        vendor: "ABC Suppliers",
        poNumber: "PO-00125",
        amount: 45000,
        daysOverdue: 5,
      },
      {
        vendor: "XYZ Manufacturing",
        poNumber: "PO-00130",
        amount: 38000,
        daysOverdue: 2,
      },
      {
        vendor: "Global Materials Co",
        poNumber: "PO-00135",
        amount: 32000,
        daysOverdue: 0,
      },
    ],
  },
  trend: {
    purchaseTrend: [
      { month: "Jan", amount: 1700000, poCount: 185 },
      { month: "Feb", amount: 1750000, poCount: 192 },
      { month: "Mar", amount: 1800000, poCount: 198 },
      { month: "Apr", amount: 1750000, poCount: 190 },
      { month: "May", amount: 1820000, poCount: 205 },
      { month: "Jun", amount: 1890000, poCount: 210 },
    ],
    categoryTrend: [
      {
        month: "Jan",
        rawMaterials: 750000,
        equipment: 600000,
        officeSupplies: 350000,
      },
      {
        month: "Feb",
        rawMaterials: 780000,
        equipment: 610000,
        officeSupplies: 360000,
      },
      {
        month: "Mar",
        rawMaterials: 800000,
        equipment: 620000,
        officeSupplies: 380000,
      },
      {
        month: "Apr",
        rawMaterials: 770000,
        equipment: 630000,
        officeSupplies: 350000,
      },
      {
        month: "May",
        rawMaterials: 810000,
        equipment: 640000,
        officeSupplies: 370000,
      },
      {
        month: "Jun",
        rawMaterials: 850000,
        equipment: 650000,
        officeSupplies: 390000,
      },
    ],
    vendorComparison: [
      { vendor: "ABC Suppliers", q1: 120000, q2: 285000 },
      { vendor: "XYZ Manufacturing", q1: 110000, q2: 245000 },
      { vendor: "Global Materials Co", q1: 100000, q2: 220000 },
    ],
  },
  analysis: {
    costSavings: [
      { source: "Bulk Purchasing", savings: 125000, percentage: 45.0 },
      { source: "Vendor Negotiation", savings: 85000, percentage: 30.5 },
      { source: "Early Payment Discount", savings: 68000, percentage: 24.5 },
    ],
    budgetComparison: [
      {
        category: "Raw Materials",
        budget: 800000,
        actual: 850000,
        variance: -50000,
      },
      {
        category: "Equipment",
        budget: 700000,
        actual: 650000,
        variance: 50000,
      },
      {
        category: "Office Supplies",
        budget: 400000,
        actual: 390000,
        variance: 10000,
      },
    ],
    paymentTerms: [
      { terms: "Net 30", count: 120, amount: 850000 },
      { terms: "Net 45", count: 95, amount: 650000 },
      { terms: "Net 60", count: 65, amount: 390000 },
    ],
    approvalPending: [
      {
        poNumber: "PO-00201",
        vendor: "New Supplier Co",
        amount: 125000,
        daysPending: 3,
      },
      {
        poNumber: "PO-00202",
        vendor: "Tech Solutions Ltd",
        amount: 98000,
        daysPending: 2,
      },
      {
        poNumber: "PO-00203",
        vendor: "Prime Trading",
        amount: 85000,
        daysPending: 1,
      },
    ],
  },
};

export default function PurchasePerformanceDashboardScreen() {
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
        {/* Purchase MTD */}
        <View style={styles.kpiCard}>
          <View style={styles.kpiHeader}>
            <Ionicons name="cart" size={24} color="#667eea" />
            <Text style={styles.kpiTitle}>Purchase MTD</Text>
          </View>
          <Text style={[styles.kpiValue, { color: "#667eea" }]}>
            {formatCurrency(data.purchaseMTD)} SAR
          </Text>
        </View>

        {/* Purchase YTD */}
        <View style={styles.kpiCard}>
          <View style={styles.kpiHeader}>
            <Ionicons name="trending-up" size={24} color="#10b981" />
            <Text style={styles.kpiTitle}>Purchase YTD</Text>
          </View>
          <Text style={[styles.kpiValue, { color: "#10b981" }]}>
            {formatCurrency(data.purchaseYTD)} SAR
          </Text>
        </View>

        {/* Mini KPIs */}
        <View style={styles.metricsRow}>
          <View style={styles.miniKpiCard}>
            <Ionicons name="today" size={20} color="#f59e0b" />
            <Text style={styles.miniKpiTitle}>Purchase Today</Text>
            <Text style={styles.miniKpiValue}>
              {formatCurrency(data.purchaseToday)}
            </Text>
          </View>
          <View style={styles.miniKpiCard}>
            <Ionicons name="business" size={20} color="#3b82f6" />
            <Text style={styles.miniKpiTitle}>Active Vendors</Text>
            <Text style={styles.miniKpiValue}>{data.vendorCount}</Text>
          </View>
        </View>

        {/* Purchase by Category */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Purchase by Category</Text>
          {data.topCategories.map((item, index) => (
            <View key={index} style={styles.categoryRow}>
              <View style={styles.categoryLeft}>
                <Text style={styles.categoryName}>{item.category}</Text>
                <View style={styles.categoryBar}>
                  <View
                    style={[
                      styles.categoryBarFill,
                      { width: `${item.percentage}%` },
                    ]}
                  />
                </View>
              </View>
              <Text style={styles.categoryAmount}>
                {formatCurrency(item.amount)}
              </Text>
            </View>
          ))}
        </View>

        {/* Purchase by Status */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Purchase Orders by Status</Text>
          {data.purchaseByStatus.map((item, index) => (
            <View key={index} style={styles.statusRow}>
              <View style={styles.statusLeft}>
                <View style={styles.statusInfo}>
                  <Text style={styles.statusLabel}>{item.status}</Text>
                  <Text style={styles.statusCount}>{item.count} POs</Text>
                </View>
                <View style={styles.statusBar}>
                  <View
                    style={[
                      styles.statusBarFill,
                      {
                        width: `${(item.amount / 1890000) * 100}%`,
                        backgroundColor:
                          item.status === "Completed"
                            ? "#10b981"
                            : item.status === "To Bill"
                            ? "#f59e0b"
                            : item.status === "Draft"
                            ? "#6b7280"
                            : "#3b82f6",
                      },
                    ]}
                  />
                </View>
              </View>
              <Text style={styles.statusAmount}>
                {formatCurrency(item.amount)}
              </Text>
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
            Top 5 Vendors by Purchase Amount
          </Text>
          {data.topVendors.map((item, index) => (
            <View key={index} style={styles.vendorRow}>
              <View style={styles.vendorBar}>
                <View
                  style={[
                    styles.vendorBarFill,
                    { width: `${(item.amount / 285000) * 100}%` },
                  ]}
                />
              </View>
              <View style={styles.vendorInfo}>
                <Text style={styles.vendorName}>{item.vendor}</Text>
                <Text style={styles.vendorDetails}>
                  {formatCurrency(item.amount)} SAR • {item.poCount} POs • Avg:{" "}
                  {formatCurrency(item.avgOrderValue)}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Category Performance */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Category Performance</Text>
          {data.categoryPerformance.map((item, index) => (
            <View key={index} style={styles.performanceRow}>
              <View style={styles.performanceLeft}>
                <Text style={styles.performanceCategory}>{item.category}</Text>
                <Text style={styles.performanceDetails}>
                  {item.poCount} POs • Avg Lead Time: {item.avgLeadTime} days
                </Text>
                <View style={styles.performanceBar}>
                  <View
                    style={[
                      styles.performanceBarFill,
                      { width: `${(item.purchases / 850000) * 100}%` },
                    ]}
                  />
                </View>
              </View>
              <Text style={styles.performanceAmount}>
                {formatCurrency(item.purchases)}
              </Text>
            </View>
          ))}
        </View>

        {/* Vendor Rating */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Vendor Performance Rating</Text>
          {data.vendorRating.map((item, index) => (
            <View key={index} style={styles.ratingCard}>
              <View style={styles.ratingHeader}>
                <Text style={styles.ratingVendor}>{item.vendor}</Text>
                <View style={styles.ratingStars}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Ionicons
                      key={star}
                      name={star <= item.qualityScore ? "star" : "star-outline"}
                      size={16}
                      color="#f59e0b"
                    />
                  ))}
                </View>
              </View>
              <View style={styles.ratingMetrics}>
                <View style={styles.ratingMetric}>
                  <Text style={styles.ratingMetricLabel}>On-Time Delivery</Text>
                  <Text style={styles.ratingMetricValue}>
                    {item.onTimeDelivery}%
                  </Text>
                </View>
                <View style={styles.ratingMetric}>
                  <Text style={styles.ratingMetricLabel}>Total Orders</Text>
                  <Text style={styles.ratingMetricValue}>
                    {item.totalOrders}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Pending Receipts */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Pending Receipts</Text>
          {data.pendingReceipts.map((item, index) => (
            <View key={index} style={styles.pendingReceiptCard}>
              <View style={styles.pendingReceiptHeader}>
                <Text style={styles.pendingReceiptVendor}>{item.vendor}</Text>
                {item.daysOverdue > 0 && (
                  <View style={styles.overdueBadge}>
                    <Text style={styles.overdueBadgeText}>
                      {item.daysOverdue} days
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.pendingReceiptPO}>
                {item.poNumber} • {formatCurrency(item.amount)} SAR
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
        {/* Purchase Trend */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>
            Purchase Trend (Last 6 Months)
          </Text>
          <View style={styles.trendChart}>
            {data.purchaseTrend.map((item, index) => (
              <View key={index} style={styles.trendBarContainer}>
                <View
                  style={[
                    styles.trendBar,
                    {
                      height: `${(item.amount / 2000000) * 100}%`,
                      backgroundColor: "#667eea",
                    },
                  ]}
                />
                <Text style={styles.trendLabel}>{item.month}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Category Trend */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Category Trend Comparison</Text>
          <View style={styles.trendChart}>
            {data.categoryTrend.map((item, index) => (
              <View key={index} style={styles.trendBarContainer}>
                <View style={styles.trendStackedContainer}>
                  <View
                    style={[
                      styles.trendStackedItem,
                      {
                        height: `${(item.rawMaterials / 900000) * 100}%`,
                        backgroundColor: "#3b82f6",
                      },
                    ]}
                  />
                  <View
                    style={[
                      styles.trendStackedItem,
                      {
                        height: `${(item.equipment / 900000) * 100}%`,
                        backgroundColor: "#10b981",
                      },
                    ]}
                  />
                  <View
                    style={[
                      styles.trendStackedItem,
                      {
                        height: `${(item.officeSupplies / 900000) * 100}%`,
                        backgroundColor: "#f59e0b",
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
                style={[styles.legendDot, { backgroundColor: "#3b82f6" }]}
              />
              <Text style={styles.legendText}>Raw Materials</Text>
            </View>
            <View style={styles.legendItem}>
              <View
                style={[styles.legendDot, { backgroundColor: "#10b981" }]}
              />
              <Text style={styles.legendText}>Equipment</Text>
            </View>
            <View style={styles.legendItem}>
              <View
                style={[styles.legendDot, { backgroundColor: "#f59e0b" }]}
              />
              <Text style={styles.legendText}>Office Supplies</Text>
            </View>
          </View>
        </View>

        {/* Vendor Comparison */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>
            Quarter Comparison (Top Vendors)
          </Text>
          {data.vendorComparison.map((item, index) => (
            <View key={index} style={styles.comparisonRow}>
              <View style={styles.comparisonLeft}>
                <Text style={styles.comparisonVendor}>{item.vendor}</Text>
                <View style={styles.comparisonBars}>
                  <View style={styles.comparisonBarGroup}>
                    <Text style={styles.comparisonBarLabel}>Q1</Text>
                    <View style={styles.comparisonBar}>
                      <View
                        style={[
                          styles.comparisonBarFill,
                          {
                            width: `${(item.q1 / 300000) * 100}%`,
                            backgroundColor: "#6b7280",
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.comparisonBarValue}>
                      {formatCurrency(item.q1)}
                    </Text>
                  </View>
                  <View style={styles.comparisonBarGroup}>
                    <Text style={styles.comparisonBarLabel}>Q2</Text>
                    <View style={styles.comparisonBar}>
                      <View
                        style={[
                          styles.comparisonBarFill,
                          {
                            width: `${(item.q2 / 300000) * 100}%`,
                            backgroundColor: "#667eea",
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.comparisonBarValue}>
                      {formatCurrency(item.q2)}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  };

  // Analysis Tab
  const renderAnalysisTab = () => {
    const data = MOCK_DATA.analysis;
    return (
      <View style={styles.tabContent}>
        {/* Cost Savings */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Cost Savings Analysis</Text>
          {data.costSavings.map((item, index) => (
            <View key={index} style={styles.savingsRow}>
              <View style={styles.savingsLeft}>
                <Text style={styles.savingsSource}>{item.source}</Text>
                <View style={styles.savingsBar}>
                  <View
                    style={[
                      styles.savingsBarFill,
                      { width: `${item.percentage}%` },
                    ]}
                  />
                </View>
              </View>
              <Text style={styles.savingsAmount}>
                {formatCurrency(item.savings)}
              </Text>
            </View>
          ))}
        </View>

        {/* Budget Comparison */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Budget vs Actual</Text>
          {data.budgetComparison.map((item, index) => (
            <View key={index} style={styles.budgetRow}>
              <View style={styles.budgetLeft}>
                <Text style={styles.budgetCategory}>{item.category}</Text>
                <View style={styles.budgetBarContainer}>
                  <View style={styles.budgetBar}>
                    <View
                      style={[
                        styles.budgetBarFill,
                        {
                          width: `${(item.actual / 900000) * 100}%`,
                          backgroundColor:
                            item.variance < 0 ? "#ef4444" : "#10b981",
                        },
                      ]}
                    />
                  </View>
                </View>
              </View>
              <View style={styles.budgetRight}>
                <Text style={styles.budgetValue}>
                  {formatCurrency(item.actual)}
                </Text>
                <Text
                  style={[
                    styles.budgetVariance,
                    { color: item.variance < 0 ? "#ef4444" : "#10b981" },
                  ]}
                >
                  {item.variance > 0 ? "+" : ""}
                  {formatCurrency(item.variance)}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Payment Terms */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Purchase by Payment Terms</Text>
          {data.paymentTerms.map((item, index) => (
            <View key={index} style={styles.termsRow}>
              <View style={styles.termsLeft}>
                <Text style={styles.termsLabel}>{item.terms}</Text>
                <Text style={styles.termsCount}>{item.count} POs</Text>
              </View>
              <Text style={styles.termsAmount}>
                {formatCurrency(item.amount)}
              </Text>
            </View>
          ))}
        </View>

        {/* Approval Pending */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Pending Approvals</Text>
          {data.approvalPending.map((item, index) => (
            <View key={index} style={styles.approvalCard}>
              <View style={styles.approvalHeader}>
                <Text style={styles.approvalPO}>{item.poNumber}</Text>
                <View
                  style={[
                    styles.pendingBadge,
                    {
                      backgroundColor:
                        item.daysPending >= 3
                          ? "#fee2e2"
                          : item.daysPending >= 2
                          ? "#fef3c7"
                          : "#dbeafe",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.pendingBadgeText,
                      {
                        color:
                          item.daysPending >= 3
                            ? "#dc2626"
                            : item.daysPending >= 2
                            ? "#f59e0b"
                            : "#3b82f6",
                      },
                    ]}
                  >
                    {item.daysPending} day{item.daysPending > 1 ? "s" : ""}
                  </Text>
                </View>
              </View>
              <Text style={styles.approvalVendor}>{item.vendor}</Text>
              <Text style={styles.approvalAmount}>
                {formatCurrency(item.amount)} SAR
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
            <Text style={styles.headerTitle}>Purchase Performance</Text>
            <Text style={styles.headerSubtitle}>Purchasing Dashboard</Text>
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
            style={[styles.tab, activeTab === "analysis" && styles.activeTab]}
            onPress={() => handleTabPress("analysis")}
          >
            <Ionicons
              name="analytics"
              size={18}
              color={activeTab === "analysis" ? "#667eea" : "#ffffff"}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === "analysis" && styles.activeTabText,
              ]}
            >
              Analysis
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Tab Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {activeTab === "snapshot" && renderSnapshotTab()}
        {activeTab === "performance" && renderPerformanceTab()}
        {activeTab === "trend" && renderTrendTab()}
        {activeTab === "analysis" && renderAnalysisTab()}
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
    textAlign: "center",
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
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  categoryLeft: {
    flex: 1,
    gap: 8,
  },
  categoryName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1f2937",
  },
  categoryBar: {
    height: 8,
    backgroundColor: "#e5e7eb",
    borderRadius: 4,
    overflow: "hidden",
  },
  categoryBarFill: {
    height: "100%",
    backgroundColor: "#667eea",
  },
  categoryAmount: {
    fontSize: 14,
    fontWeight: "700",
    color: "#667eea",
    marginLeft: 12,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  statusLeft: {
    flex: 1,
    gap: 8,
  },
  statusInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1f2937",
  },
  statusCount: {
    fontSize: 12,
    color: "#6b7280",
  },
  statusBar: {
    height: 8,
    backgroundColor: "#e5e7eb",
    borderRadius: 4,
    overflow: "hidden",
  },
  statusBarFill: {
    height: "100%",
  },
  statusAmount: {
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
  vendorDetails: {
    fontSize: 12,
    color: "#6b7280",
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
  performanceCategory: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1f2937",
  },
  performanceDetails: {
    fontSize: 12,
    color: "#6b7280",
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
  performanceAmount: {
    fontSize: 14,
    fontWeight: "700",
    color: "#3b82f6",
    marginLeft: 12,
  },
  ratingCard: {
    padding: 16,
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    marginBottom: 12,
  },
  ratingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  ratingVendor: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f2937",
  },
  ratingStars: {
    flexDirection: "row",
    gap: 2,
  },
  ratingMetrics: {
    flexDirection: "row",
    gap: 16,
  },
  ratingMetric: {
    gap: 4,
  },
  ratingMetricLabel: {
    fontSize: 12,
    color: "#6b7280",
  },
  ratingMetricValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1f2937",
  },
  pendingReceiptCard: {
    padding: 16,
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    marginBottom: 12,
  },
  pendingReceiptHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  pendingReceiptVendor: {
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
  pendingReceiptPO: {
    fontSize: 12,
    color: "#6b7280",
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
  trendStackedItem: {
    width: "100%",
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
    gap: 16,
    marginTop: 12,
    flexWrap: "wrap",
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
  comparisonRow: {
    marginBottom: 20,
  },
  comparisonLeft: {
    gap: 8,
  },
  comparisonVendor: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 8,
  },
  comparisonBars: {
    gap: 8,
  },
  comparisonBarGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  comparisonBarLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
    width: 30,
  },
  comparisonBar: {
    flex: 1,
    height: 8,
    backgroundColor: "#e5e7eb",
    borderRadius: 4,
    overflow: "hidden",
  },
  comparisonBarFill: {
    height: "100%",
  },
  comparisonBarValue: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1f2937",
    width: 80,
    textAlign: "right",
  },
  savingsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  savingsLeft: {
    flex: 1,
    gap: 8,
  },
  savingsSource: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1f2937",
  },
  savingsBar: {
    height: 8,
    backgroundColor: "#e5e7eb",
    borderRadius: 4,
    overflow: "hidden",
  },
  savingsBarFill: {
    height: "100%",
    backgroundColor: "#10b981",
  },
  savingsAmount: {
    fontSize: 14,
    fontWeight: "700",
    color: "#10b981",
    marginLeft: 12,
  },
  budgetRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  budgetLeft: {
    flex: 1,
    gap: 8,
  },
  budgetCategory: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1f2937",
  },
  budgetBarContainer: {
    gap: 4,
  },
  budgetBar: {
    height: 8,
    backgroundColor: "#e5e7eb",
    borderRadius: 4,
    overflow: "hidden",
  },
  budgetBarFill: {
    height: "100%",
  },
  budgetRight: {
    alignItems: "flex-end",
    marginLeft: 12,
  },
  budgetValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1f2937",
  },
  budgetVariance: {
    fontSize: 12,
    fontWeight: "600",
  },
  termsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  termsLeft: {
    flex: 1,
  },
  termsLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f2937",
  },
  termsCount: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },
  termsAmount: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1f2937",
  },
  approvalCard: {
    padding: 16,
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    marginBottom: 12,
  },
  approvalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  approvalPO: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f2937",
  },
  pendingBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  pendingBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  approvalVendor: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 4,
  },
  approvalAmount: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1f2937",
  },
});
