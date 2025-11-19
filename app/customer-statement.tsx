import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { optimizedApis } from "../src/api/optimized-apis";

const formatCurrency = (value: number) =>
  (value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

export default function CustomerStatementScreen() {
  const params = useLocalSearchParams<{ customer?: string }>();
  const customer = params.customer || "";

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["customer-statement", customer],
    queryFn: async () => {
      if (!customer) return null as any;
      const today = new Date();
      const year = today.getFullYear();
      const toIso = (d: Date) => d.toISOString().slice(0, 10);
      const fromDate = `${year}-01-01`;
      const toDate = toIso(today);
      return optimizedApis.getCustomerStatement({
        customer: String(customer),
        from_date: fromDate,
        to_date: toDate,
      });
    },
    enabled: !!customer,
    staleTime: 60 * 1000,
  });

  const handleSend = async () => {
    if (!customer) return;
    try {
      await optimizedApis.sendStatementByEmail(String(customer));
      alert("Statement sent successfully");
    } catch (e: any) {
      alert(e?.message || "Failed to send statement");
    }
  };

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
          <Text style={styles.headerTitle}>Statement</Text>
          <TouchableOpacity
            onPress={handleSend}
            style={styles.primaryButton}
            activeOpacity={0.9}
          >
            <Ionicons name="mail" size={18} color="#1D4ED8" />
            <Text style={styles.primaryButtonText}>Send Email</Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={styles.loadingText}>Loading statement...</Text>
        </View>
      ) : isError || !data ? (
        <View style={styles.error}>
          <Ionicons name="alert-circle" size={40} color="#ef4444" />
          <Text style={styles.errorText}>Failed to load statement</Text>
          <TouchableOpacity onPress={() => refetch()} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.metaCard}>
            <Text style={styles.metaTitle}>{data.customer}</Text>
            <Text style={styles.metaSub}>
              Period: {data.from_date} → {data.to_date}
            </Text>
          </View>

          <View style={styles.kpiRow}>
            <View style={[styles.kpiCard, { borderLeftColor: "#667eea" }]}>
              <Text style={styles.kpiLabel}>Total Invoiced</Text>
              <Text style={styles.kpiValue}>
                {formatCurrency(data.total_invoiced)}
              </Text>
            </View>
            <View style={[styles.kpiCard, { borderLeftColor: "#ef4444" }]}>
              <Text style={styles.kpiLabel}>Total Outstanding</Text>
              <Text style={[styles.kpiValue, { color: "#ef4444" }]}>
                {formatCurrency(data.total_outstanding)}
              </Text>
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tableScrollContent}
          >
            <View style={styles.tableContainer}>
              <View style={[styles.tableRow, styles.tableHeaderRow]}>
                <Text style={[styles.th, styles.invoiceCol]}>INVOICE</Text>
                <Text style={[styles.th, styles.dateCol]}>POSTING</Text>
                <Text style={[styles.th, styles.dateCol]}>DUE</Text>
                <Text style={[styles.th, styles.amountCol]}>AMOUNT</Text>
                <Text style={[styles.th, styles.amountCol]}>OUTSTANDING</Text>
              </View>
              {(data.items || []).map((it: any, idx: number) => (
                <View
                  key={`${it.invoice}-${idx}`}
                  style={[
                    styles.tableRow,
                    idx % 2 === 0 && styles.tableRowEven,
                  ]}
                >
                  <Text style={[styles.td, styles.invoiceCol]} numberOfLines={1}>
                    {it.invoice}
                  </Text>
                  <Text style={[styles.td, styles.dateCol]}>
                    {it.posting_date}
                  </Text>
                  <Text style={[styles.td, styles.dateCol]}>
                    {it.due_date}
                  </Text>
                  <Text style={[styles.td, styles.amountCol]}>
                    {formatCurrency(it.amount)}
                  </Text>
                  <Text style={[styles.td, styles.amountCol]}>
                    {formatCurrency(it.outstanding)}
                  </Text>
                </View>
              ))}
            </View>
          </ScrollView>

          <View style={{ height: 24 }} />
          <TouchableOpacity
            onPress={() => refetch()}
            style={[styles.secondaryButton]}
          >
            <Ionicons name="refresh" size={16} color="#374151" />
            <Text style={styles.secondaryButtonText}>Refresh</Text>
          </TouchableOpacity>
          <View style={{ height: 24 }} />
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
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 20,
  },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: "800", color: "#111827" },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  primaryButtonText: {
    color: "#1D4ED8",
    fontWeight: "700",
    fontSize: 14,
  },
  content: { flex: 1 },
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
  retryBtn: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  retryText: { color: "#374151", fontWeight: "700" },
  metaCard: {
    backgroundColor: "#fff",
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  metaTitle: { fontSize: 16, fontWeight: "800", color: "#111827" },
  metaSub: { marginTop: 4, color: "#6b7280", fontWeight: "600" },
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
  tableScrollContent: {
    paddingHorizontal: 16,
  },
  tableContainer: {
    minWidth: 620,
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginTop: 12,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingHorizontal: 12,
  },
  tableHeaderRow: { backgroundColor: "#F3F4F6" },
  tableRowEven: { backgroundColor: "#F9FAFB" },
  th: {
    color: "#6b7280",
    fontWeight: "700",
    fontSize: 11,
    letterSpacing: 0.3,
  },
  td: {
    color: "#111827",
    fontWeight: "600",
    fontSize: 11,
  },
  numCell: { textAlign: "right" },
  invoiceCol: {
    flex: 1.3,
    minWidth: 150,
    paddingRight: 12,
  },
  dateCol: {
    flex: 1,
    minWidth: 120,
  },
  amountCol: {
    flex: 1,
    minWidth: 120,
    textAlign: "right",
  },
  secondaryButton: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
  },
  secondaryButtonText: { color: "#374151", fontWeight: "700" },
});
