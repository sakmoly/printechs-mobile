import React from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { optimizedApis } from "../src/api/optimized-apis";
import { useQuery } from "@tanstack/react-query";

const formatCurrency = (value: number) => {
  return (value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
};

const CUSTOMER_COLUMN_WIDTH = 240;
const NUMERIC_COLUMN_WIDTH = 120;
const GRID_MIN_WIDTH =
  CUSTOMER_COLUMN_WIDTH + NUMERIC_COLUMN_WIDTH * 7;

export default function TerritoryDetailsScreen() {
  const params = useLocalSearchParams<{ territory?: string }>();
  const territory = params.territory || "";

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["territory-receivables", territory],
    queryFn: async () => {
      if (!territory) return null as any;
      return optimizedApis.getTerritoryReceivables({
        territory: String(territory),
        limit: 50,
        offset: 0,
        sort: "amount_desc",
      });
    },
    enabled: !!territory,
    staleTime: 60 * 1000,
  });

  const summary = data?.summary;
  const customers = data?.customers || [];

  const isIOS = Platform.OS === "ios";

  return (
    <SafeAreaView
      style={isIOS ? styles.safeArea : styles.safeAreaAndroid}
      edges={isIOS ? ["top"] : undefined}
    >
      <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{territory || "Territory"}</Text>
        <TouchableOpacity
          onPress={() => refetch()}
          style={styles.refreshButton}
        >
          <Ionicons name="refresh" size={20} color="#111827" />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={styles.loadingText}>Loading territory details...</Text>
        </View>
      ) : isError || !data ? (
        <View style={styles.error}>
          <Ionicons name="alert-circle" size={40} color="#ef4444" />
          <Text style={styles.errorText}>Failed to load details</Text>
        </View>
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* KPIs */}
          <View style={styles.kpiRow}>
            <View style={[styles.kpiCard, { borderLeftColor: "#667eea" }]}>
              <Text style={styles.kpiLabel}>Total Receivable</Text>
              <Text style={styles.kpiValue}>
                {formatCurrency(summary?.totalUnpaid || 0)}
              </Text>
            </View>
            <View style={[styles.kpiCard, { borderLeftColor: "#ef4444" }]}>
              <Text style={styles.kpiLabel}>Total Overdue</Text>
              <Text style={[styles.kpiValue, { color: "#ef4444" }]}>
                {formatCurrency(summary?.totalOverdue || 0)}
              </Text>
            </View>
          </View>

          {/* Aging */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Aging Breakdown</Text>
            {[
              "Current",
              "1-30 Days",
              "31-60 Days",
              "61-90 Days",
              "91-120 Days",
              "Old Balance",
            ].map((label) => (
              <View key={label} style={styles.agingRow}>
                <Text style={styles.agingLabel}>{label}</Text>
                <Text style={styles.agingAmount}>
                  {formatCurrency(summary?.aging?.[label] || 0)}
                </Text>
              </View>
            ))}
          </View>

          {/* Customers - grid format */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Customers</Text>
            <View style={styles.tableContainer}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.tableScrollContent}
              >
                <View style={styles.tableInner}>
                  <View style={[styles.tableRow, styles.tableHeaderRow]}>
                    <View style={[styles.tableColumn, styles.customerColumn]}>
                      <Text
                        style={[styles.tableHeaderText, styles.tableHeaderLeft]}
                      >
                        CUSTOMER NAME
                      </Text>
                    </View>
                    <View style={[styles.tableColumn, styles.numericColumn]}>
                      <Text style={styles.tableHeaderText}>OUTSTANDING</Text>
                    </View>
                    <View style={[styles.tableColumn, styles.numericColumn]}>
                      <Text style={styles.tableHeaderText}>CURRENT</Text>
                    </View>
                    <View style={[styles.tableColumn, styles.numericColumn]}>
                      <Text style={styles.tableHeaderText}>30</Text>
                    </View>
                    <View style={[styles.tableColumn, styles.numericColumn]}>
                      <Text style={styles.tableHeaderText}>60</Text>
                    </View>
                    <View style={[styles.tableColumn, styles.numericColumn]}>
                      <Text style={styles.tableHeaderText}>90</Text>
                    </View>
                    <View style={[styles.tableColumn, styles.numericColumn]}>
                      <Text style={styles.tableHeaderText}>120</Text>
                    </View>
                    <View style={[styles.tableColumn, styles.numericColumn]}>
                      <Text style={styles.tableHeaderText}>OLD</Text>
                    </View>
                  </View>

                  {customers
                    .filter((c: any) => (c?.outstanding_amount || 0) >= 100)
                    .map((c: any, index: number) => (
                      <TouchableOpacity
                        key={c.customer}
                        style={[
                          styles.tableRow,
                          index % 2 === 0 && styles.tableRowEven,
                        ]}
                        activeOpacity={0.8}
                        onPress={() =>
                          router.push(
                            `/customer-statement?customer=${encodeURIComponent(
                              c.customer
                            )}`
                          )
                        }
                      >
                        <View
                          style={[styles.tableColumn, styles.customerColumn]}
                        >
                          <Text
                            style={styles.customerNameText}
                            numberOfLines={2}
                          >
                            {c.customer_name || c.customer}
                          </Text>
                        </View>
                        <View
                          style={[styles.tableColumn, styles.numericColumn]}
                        >
                          <Text style={styles.numericValue}>
                            {formatCurrency(c.outstanding_amount)}
                          </Text>
                        </View>
                        <View
                          style={[styles.tableColumn, styles.numericColumn]}
                        >
                          <Text style={styles.numericValue}>
                            {formatCurrency(c.aging["Current"] || 0)}
                          </Text>
                        </View>
                        <View
                          style={[styles.tableColumn, styles.numericColumn]}
                        >
                          <Text style={styles.numericValue}>
                            {formatCurrency(c.aging["1-30 Days"] || 0)}
                          </Text>
                        </View>
                        <View
                          style={[styles.tableColumn, styles.numericColumn]}
                        >
                          <Text style={styles.numericValue}>
                            {formatCurrency(c.aging["31-60 Days"] || 0)}
                          </Text>
                        </View>
                        <View
                          style={[styles.tableColumn, styles.numericColumn]}
                        >
                          <Text style={styles.numericValue}>
                            {formatCurrency(c.aging["61-90 Days"] || 0)}
                          </Text>
                        </View>
                        <View
                          style={[styles.tableColumn, styles.numericColumn]}
                        >
                          <Text style={styles.numericValue}>
                            {formatCurrency(c.aging["91-120 Days"] || 0)}
                          </Text>
                        </View>
                        <View
                          style={[styles.tableColumn, styles.numericColumn]}
                        >
                          <Text
                            style={[styles.numericValue, styles.numericOldValue]}
                          >
                            {formatCurrency(c.aging["Old Balance"] || 0)}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                </View>
              </ScrollView>
            </View>
          </View>
        </ScrollView>
      )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#1D4ED8" },
  safeAreaAndroid: {
    flex: 1,
    backgroundColor: "#1D4ED8",
  },
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
  },
  backButton: { padding: 8 },
  refreshButton: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: "800", color: "#111827" },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 100,
  },
  loadingText: { marginTop: 8, color: "#6b7280", fontWeight: "600" },
  error: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 100,
  },
  errorText: { marginTop: 8, color: "#ef4444", fontWeight: "700" },
  content: { flex: 1 },
  kpiRow: { flexDirection: "row", gap: 12, paddingHorizontal: 16 },
  kpiCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
  },
  kpiLabel: { color: "#6b7280", fontWeight: "600", marginBottom: 6 },
  kpiValue: { fontSize: 22, fontWeight: "800", color: "#111827" },
  section: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
  },
  agingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  agingLabel: { color: "#6b7280", fontWeight: "600" },
  agingAmount: { color: "#111827", fontWeight: "800" },
  customerCard: {
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  customerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  customerName: { fontWeight: "700", color: "#111827" },
  customerAmount: { fontWeight: "800", color: "#111827" },
  customerAgingRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  customerAgingItem: { color: "#6b7280", fontWeight: "600" },
  // Redesigned rows
  customerRow: {
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  customerRowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  agingBarRow: {
    flexDirection: "row",
    height: 10,
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: "#e5e7eb",
  },
  agingSegment: { height: "100%" },
  agingLegendRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  legendItem: { fontSize: 12, fontWeight: "700" },
  // Table grid
  tableContainer: {
    marginTop: 8,
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  tableScrollContent: {
    paddingBottom: 8,
  },
  tableInner: {
    minWidth: GRID_MIN_WIDTH,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "stretch",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  tableRowEven: { backgroundColor: "#F9FAFB" },
  tableHeaderRow: {
    backgroundColor: "#F3F4F6",
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  tableColumn: {
    paddingHorizontal: 10,
    justifyContent: "center",
  },
  customerColumn: {
    width: CUSTOMER_COLUMN_WIDTH,
    alignItems: "flex-start",
  },
  customerNameText: {
    color: "#111827",
    fontWeight: "700",
    fontSize: 13,
    flexWrap: "wrap",
    lineHeight: 16,
  },
  numericColumn: {
    width: NUMERIC_COLUMN_WIDTH,
    alignItems: "flex-end",
  },
  tableHeaderText: {
    color: "#6b7280",
    fontWeight: "700",
    fontSize: 12,
    letterSpacing: 0.5,
    textAlign: "right",
  },
  tableHeaderLeft: {
    textAlign: "left",
  },
  numericValue: {
    color: "#111827",
    fontWeight: "700",
    fontSize: 12,
    textAlign: "right",
  },
  numericOldValue: {
    color: "#B45309",
  },
});
