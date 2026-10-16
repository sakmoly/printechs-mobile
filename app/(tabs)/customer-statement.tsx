import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
} from "react-native";
import {
  SafeScreen,
  useSafeScreenInsets,
} from "../../src/components/SafeScreen";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { optimizedApis } from "../../src/api/optimized-apis";
import { resolveCompanyName } from "../../src/api/apiResilience";
import { resolveCustomerParty } from "../../src/api/customer360";
import { useAuthStore } from "../../src/store/auth";
import { ScreenHeaderNav } from "../../src/components/ScreenHeaderNav";

const formatCurrency = (value: number) =>
  (value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

function lineOutstanding(it: {
  outstanding?: number;
  outstanding_amount?: number;
  balance?: number;
}): number {
  const n = Number(it.outstanding ?? it.outstanding_amount);
  return Number.isFinite(n) ? n : 0;
}

function lineSortKey(it: {
  posting_date?: string;
  due_date?: string;
  invoice?: string;
}): string {
  return [
    String(it.posting_date || ""),
    String(it.due_date || ""),
    String(it.invoice || ""),
  ].join("|");
}

type StatementRow = {
  invoice?: string;
  posting_date?: string;
  due_date?: string;
  amount?: number;
  lineOutstanding: number;
  cumulativeOutstanding: number;
  isOverdue: boolean;
};

function localDateIso(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Due date strictly before the statement “as of” date (usually today / period end). */
function isInvoiceOverdue(
  due_date: string | undefined,
  asOf: string | undefined
): boolean {
  const due = String(due_date || "").trim().slice(0, 10);
  const ref = String(asOf || localDateIso()).trim().slice(0, 10);
  if (due.length < 10 || ref.length < 10) return false;
  return due < ref;
}

export default function CustomerStatementScreen() {
  const params = useLocalSearchParams<{ customer?: string }>();
  const customer = params.customer || "";

  const scopeCompany = useAuthStore((s) => s.permissions.scope?.company);
  const company = useMemo(
    () => resolveCompanyName(scopeCompany),
    [scopeCompany]
  );

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["customer-statement", customer, company],
    queryFn: async () => {
      if (!customer) return null as any;
      const party = await resolveCustomerParty(String(customer));
      const today = new Date();
      const year = today.getFullYear();
      const toIso = (d: Date) => d.toISOString().slice(0, 10);
      const fromDate = `${year}-01-01`;
      const toDate = toIso(today);
      return optimizedApis.getCustomerStatement({
        customer: party,
        company,
        from_date: fromDate,
        to_date: toDate,
      });
    },
    enabled: !!customer,
    staleTime: 60 * 1000,
  });

  const handleSend = async () => {
    const party =
      String(data?.customer || "").trim() || String(customer || "").trim();
    if (!party) return;
    try {
      await optimizedApis.sendStatementByEmail(party, { company });
      alert("Statement sent successfully");
    } catch (e: any) {
      alert(e?.message || "Failed to send statement");
    }
  };

  const { scrollPaddingBottom } = useSafeScreenInsets({
    aboveTabBar: true,
  });

  const statementRows = useMemo((): StatementRow[] => {
    const items = data?.items;
    if (!Array.isArray(items)) return [];

    const asOf = data?.to_date || localDateIso();
    const open = items
      .filter((it) => lineOutstanding(it) > 0)
      .slice()
      .sort((a, b) => lineSortKey(a).localeCompare(lineSortKey(b)));

    let running = 0;
    return open.map((it) => {
      const line = lineOutstanding(it);
      running += line;
      return {
        invoice: it.invoice,
        posting_date: it.posting_date,
        due_date: it.due_date,
        amount: it.amount,
        lineOutstanding: line,
        cumulativeOutstanding: running,
        isOverdue: isInvoiceOverdue(it.due_date, asOf),
      };
    });
  }, [data?.items, data?.to_date]);

  return (
    <SafeScreen aboveTabBar includeTop style={styles.container}>
      <View style={styles.containerInner}>
        <View style={styles.header}>
          <ScreenHeaderNav
            color="#111827"
            buttonBackground="rgba(0,0,0,0.06)"
          />
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
          <Text style={styles.errorText}>
            {(error as Error)?.message || "Failed to load statement"}
          </Text>
          <Text style={styles.errorHint}>
            If this is a permissions issue, your admin can enable customer
            statement on your Access Profile (Receivables).
          </Text>
          <TouchableOpacity onPress={() => refetch()} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={{ paddingBottom: scrollPaddingBottom }}
          showsVerticalScrollIndicator={false}
        >
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
                <Text style={[styles.th, styles.amountCol]}>BALANCE</Text>
              </View>
              {statementRows.length === 0 ? (
                <View style={styles.tableEmpty}>
                  <Text style={styles.tableEmptyText}>
                    No open invoices in this period
                  </Text>
                </View>
              ) : (
                statementRows.map((it, idx) => (
                  <View
                    key={`${it.invoice}-${idx}`}
                    style={[
                      styles.tableRow,
                      it.isOverdue
                        ? styles.tableRowOverdue
                        : idx % 2 === 0 && styles.tableRowEven,
                    ]}
                  >
                    <Text
                      style={[styles.td, styles.invoiceCol]}
                      numberOfLines={1}
                    >
                      {it.invoice}
                    </Text>
                    <Text style={[styles.td, styles.dateCol]}>
                      {it.posting_date}
                    </Text>
                    <Text
                      style={[
                        styles.td,
                        styles.dateCol,
                        it.isOverdue && styles.dueOverdue,
                      ]}
                    >
                      {it.due_date}
                    </Text>
                    <Text style={[styles.td, styles.amountCol]}>
                      {formatCurrency(Number(it.amount) || 0)}
                    </Text>
                    <Text style={[styles.td, styles.amountCol]}>
                      {formatCurrency(it.lineOutstanding)}
                    </Text>
                    <Text
                      style={[
                        styles.td,
                        styles.amountCol,
                        styles.balanceCell,
                        it.isOverdue
                          ? styles.balanceCellOverdue
                          : styles.balanceCellCurrent,
                      ]}
                    >
                      {formatCurrency(it.cumulativeOutstanding)}
                    </Text>
                  </View>
                ))
              )}
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
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  containerInner: {
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
  errorText: {
    marginTop: 8,
    color: "#ef4444",
    fontWeight: "700",
    textAlign: "center",
    paddingHorizontal: 20,
  },
  errorHint: {
    marginTop: 8,
    color: "#6b7280",
    fontSize: 13,
    textAlign: "center",
    paddingHorizontal: 24,
    lineHeight: 18,
  },
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
    minWidth: 720,
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
  tableRowOverdue: { backgroundColor: "#fef2f2" },
  dueOverdue: { color: "#dc2626", fontWeight: "800" },
  tableEmpty: {
    paddingVertical: 20,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  tableEmptyText: {
    color: "#6b7280",
    fontWeight: "600",
    fontSize: 13,
  },
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
  balanceCell: {
    fontWeight: "800",
  },
  balanceCellOverdue: {
    color: "#b45309",
  },
  balanceCellCurrent: {
    color: "#16a34a",
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
