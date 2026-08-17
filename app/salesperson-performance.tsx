import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { PeriodSelector } from "../src/components/PeriodSelector";
import { RankingCard, currencyMetric } from "../src/components/RankingCard";
import { LoadingScreen } from "../src/components/LoadingScreen";
import {
  useSalesInvoiceItems,
  useSalespersonInvoices,
  useSalespersonPerformance,
} from "../src/hooks/useSalesPerformance";
import { useAuthStore } from "../src/store/auth";
import { isModuleEnabled } from "../src/api/mobileConfig";
import { resolveCompanyName } from "../src/api/apiResilience";
import {
  defaultPeriod,
  resolvePeriod,
  type DateRange,
  type PeriodPreset,
} from "../src/utils/period";
import { formatCurrency } from "../src/utils/currency";
import { SafeScreen } from "../src/components/SafeScreen";
import { Type } from "../src/theme/typography";
import type {
  InvoicePerfRow,
  SalespersonRow,
} from "../src/api/salesPerformanceTypes";

type Drill =
  | { level: "list" }
  | { level: "invoices"; sp: SalespersonRow }
  | { level: "items"; sp: SalespersonRow; invoice: InvoicePerfRow };

export default function SalespersonPerformanceScreen() {
  const mobileConfig = useAuthStore((s) => s.mobileConfig);
  const user = useAuthStore((s) => s.user);
  const permissions = useAuthStore((s) => s.permissions);
  const enabled = isModuleEnabled(mobileConfig, "salesperson");
  const company = resolveCompanyName(
    permissions.scope?.company,
    user?.company
  );
  const [period, setPeriod] = useState<DateRange>(() => defaultPeriod());
  const [drill, setDrill] = useState<Drill>({ level: "list" });
  const [refreshing, setRefreshing] = useState(false);

  // Ranking list only — do not pass salesperson= (BA drill returns 401).
  const { data, isLoading, error, refetch } = useSalespersonPerformance(
    {
      company,
      from_date: period.from_date,
      to_date: period.to_date,
      period: period.preset,
    },
    { enabled }
  );

  const spName =
    drill.level === "invoices" || drill.level === "items"
      ? drill.sp.name || drill.sp.id
      : "";
  const spId =
    drill.level === "invoices" || drill.level === "items"
      ? drill.sp.id && drill.sp.id !== drill.sp.name
        ? drill.sp.id
        : undefined
      : undefined;

  const invoicesQuery = useSalespersonInvoices(
    {
      salesperson: spName,
      salesperson_id: spId,
      company,
      from_date: period.from_date,
      to_date: period.to_date,
    },
    { enabled: enabled && drill.level !== "list" }
  );

  const invoiceName = drill.level === "items" ? drill.invoice.id : "";
  const itemsQuery = useSalesInvoiceItems(invoiceName, {
    enabled: enabled && drill.level === "items",
  });

  const currency = data?.meta.currency || "SAR";
  const rows = data?.rows || [];
  const invoices = invoicesQuery.data || [];
  const items = itemsQuery.data || [];

  const metricsIncomplete =
    rows.length > 0 &&
    rows.every(
      (r) =>
        r.gp == null &&
        r.gp_pct == null &&
        r.collection == null &&
        r.outstanding == null &&
        r.overdue == null &&
        r.sales_ly == null
    );

  const title = useMemo(() => {
    if (drill.level === "invoices") return drill.sp.name;
    if (drill.level === "items") return drill.invoice.name;
    return "Salesperson Performance";
  }, [drill]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
      if (drill.level !== "list") await invoicesQuery.refetch();
      if (drill.level === "items") await itemsQuery.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const goBackDrill = () => {
    if (drill.level === "items") {
      setDrill({ level: "invoices", sp: drill.sp });
    } else if (drill.level === "invoices") {
      setDrill({ level: "list" });
    } else {
      router.back();
    }
  };

  if (!enabled) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Salesperson module is disabled for this site.</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.link}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isLoading && !data) {
    return <LoadingScreen message="Loading salesperson performance..." />;
  }

  return (
    <SafeScreen style={styles.container}>
      <LinearGradient colors={["#667eea", "#764ba2"]} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={goBackDrill} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.headerSub}>
              {drill.level === "list"
                ? `${data?.meta.company || "Sales"} · No targets`
                : drill.level === "invoices"
                  ? `${period.label} · Invoices`
                  : "Line items"}
            </Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.body}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <PeriodSelector
          value={period}
          onChange={(p: PeriodPreset) => {
            setPeriod(resolvePeriod(p));
            setDrill({ level: "list" });
          }}
        />

        {metricsIncomplete && drill.level === "list" && (
          <Text style={styles.hintBanner}>
            Detail KPIs (GP, Collection, AR) were not returned for{" "}
            {period.label}. Sales totals are shown; ask backend to return the
            same row fields for all periods.
          </Text>
        )}

        {error && drill.level === "list" && (
          <Text style={styles.error}>
            {(error as Error).message || "Failed to load"}
          </Text>
        )}

        {drill.level === "list" &&
          rows.map((row, idx) => (
            <RankingCard
              key={`${row.id || row.name || "sp"}-${idx}`}
              rank={idx + 1}
              title={row.name}
              subtitle={
                row.invoice_count != null
                  ? `${row.invoice_count} invoices`
                  : undefined
              }
              primary={formatCurrency(row.sales, currency, { compact: true })}
              changePct={
                row.sales_ly == null || row.sales_ly === 0
                  ? null
                  : row.growth_pct
              }
              metrics={[
                currencyMetric("GP", row.gp, currency),
                {
                  label: "GP %",
                  value:
                    row.gp_pct == null
                      ? "—"
                      : `${Number(row.gp_pct).toFixed(1)}%`,
                },
                currencyMetric("Collected", row.collection, currency),
                currencyMetric("Outstanding", row.outstanding, currency),
                currencyMetric("Overdue", row.overdue, currency),
                {
                  label: "vs LY",
                  value:
                    row.sales_ly == null
                      ? "—"
                      : formatCurrency(row.sales_ly, currency, {
                          compact: true,
                        }),
                },
              ]}
              onPress={() => setDrill({ level: "invoices", sp: row })}
            />
          ))}

        {drill.level === "invoices" && invoicesQuery.isLoading && (
          <View style={styles.loadingBlock}>
            <ActivityIndicator color="#667eea" />
            <Text style={styles.muted}>Loading invoices…</Text>
          </View>
        )}

        {drill.level === "invoices" && invoicesQuery.error && (
          <Text style={styles.error}>
            {(invoicesQuery.error as Error).message ||
              "Failed to load invoices"}
          </Text>
        )}

        {drill.level === "invoices" &&
          !invoicesQuery.isLoading &&
          invoices.map((inv, idx) => (
            <RankingCard
              key={`${inv.id || inv.name || "inv"}-${idx}`}
              rank={idx + 1}
              title={inv.name}
              subtitle={[inv.posting_date, inv.customer]
                .filter(Boolean)
                .join(" · ")}
              primary={formatCurrency(inv.sales, currency, { compact: true })}
              onPress={() =>
                setDrill({ level: "items", sp: drill.sp, invoice: inv })
              }
            />
          ))}

        {drill.level === "invoices" &&
          !invoicesQuery.isLoading &&
          !invoicesQuery.error &&
          invoices.length === 0 && (
            <Text style={styles.muted}>
              No invoices found for this salesperson in {period.label}.
            </Text>
          )}

        {drill.level === "items" && itemsQuery.isLoading && (
          <View style={styles.loadingBlock}>
            <ActivityIndicator color="#667eea" />
            <Text style={styles.muted}>Loading items…</Text>
          </View>
        )}

        {drill.level === "items" &&
          !itemsQuery.isLoading &&
          items.map((it, idx) => (
            <RankingCard
              key={`${it.id || it.name || "item"}-${idx}`}
              rank={idx + 1}
              title={it.name}
              subtitle={it.qty != null ? `Qty ${it.qty}` : undefined}
              primary={formatCurrency(it.sales, currency, { compact: true })}
              metrics={[
                {
                  label: "ASP",
                  value:
                    it.asp == null
                      ? "—"
                      : formatCurrency(it.asp, currency, { compact: true }),
                },
              ]}
            />
          ))}

        {drill.level === "items" &&
          !itemsQuery.isLoading &&
          items.length === 0 && (
            <Text style={styles.muted}>
              Line items aren’t available for this login (Sales Invoice read
              permission), or this invoice has no items.
            </Text>
          )}

        {drill.level === "list" && rows.length === 0 && !isLoading && (
          <Text style={styles.muted}>No salesperson data for this period.</Text>
        )}
      </ScrollView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  header: {
    paddingTop: 52,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { ...Type.screenTitle, color: "#fff" },
  headerSub: { ...Type.caption, color: "rgba(255,255,255,0.85)", marginTop: 2 },
  body: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#f8fafc",
  },
  muted: { color: "#6b7280", textAlign: "center", marginTop: 24 },
  link: { color: "#667eea", fontWeight: "700", marginTop: 12 },
  error: { color: "#dc2626", marginBottom: 12, fontWeight: "600" },
  hintBanner: {
    backgroundColor: "#FEF3C7",
    color: "#92400E",
    fontSize: 12,
    fontWeight: "600",
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
    lineHeight: 17,
  },
  loadingBlock: {
    alignItems: "center",
    gap: 10,
    marginTop: 32,
  },
});
