import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { PeriodSelector } from "../src/components/PeriodSelector";
import { ExecutiveKpiTile } from "../src/components/ExecutiveKpiTile";
import { RankingCard, currencyMetric } from "../src/components/RankingCard";
import { LoadingScreen } from "../src/components/LoadingScreen";
import {
  usePayablesDashboard,
  usePaymentPlanning,
} from "../src/hooks/usePayables";
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
import type { PaymentPlanItem } from "../src/api/payablesTypes";
import { SafeScreen } from "../src/components/SafeScreen";

type Tab = "overview" | "suppliers" | "planning";

const PRIORITY_COLOR = {
  high: "#dc2626",
  medium: "#d97706",
  low: "#6b7280",
} as const;

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function PlanCard({
  item,
  currency,
}: {
  item: PaymentPlanItem;
  currency: string;
}) {
  const priority = item.priority || "medium";
  return (
    <View style={styles.planCard}>
      <View style={styles.planTop}>
        <View
          style={[
            styles.priorityDot,
            { backgroundColor: PRIORITY_COLOR[priority] },
          ]}
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.planSupplier}>{item.supplier}</Text>
          <Text style={styles.planMeta}>
            {[item.invoice, item.due_date ? `Due ${item.due_date}` : null, item.notes]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        </View>
        <Text style={styles.planAmount}>
          {formatCurrency(item.amount, currency, { compact: true })}
        </Text>
      </View>
    </View>
  );
}

export default function PayablesDashboardScreen() {
  const mobileConfig = useAuthStore((s) => s.mobileConfig);
  const permissions = useAuthStore((s) => s.permissions);
  const user = useAuthStore((s) => s.user);
  const enabled = isModuleEnabled(mobileConfig, "payables");

  const company = resolveCompanyName(
    permissions.scope?.company,
    user?.company
  );

  const [period, setPeriod] = useState<DateRange>(() => defaultPeriod());
  const [tab, setTab] = useState<Tab>("overview");
  const [refreshing, setRefreshing] = useState(false);

  const params = useMemo(
    () => ({
      company,
      from_date: period.from_date,
      to_date: period.to_date,
      period: period.preset,
    }),
    [company, period]
  );

  const dash = usePayablesDashboard(params, { enabled });
  const plan = usePaymentPlanning(params, { enabled });

  const currency =
    dash.data?.meta.currency || plan.data?.meta.currency || "SAR";
  const kpis = dash.data?.kpis;

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([dash.refetch(), plan.refetch()]);
    } finally {
      setRefreshing(false);
    }
  };

  if (!enabled) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Payables is disabled for this site.</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.link}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (dash.isLoading && !dash.data) {
    return <LoadingScreen message="Loading payables…" />;
  }

  return (
    <SafeScreen style={styles.container}>
      <LinearGradient colors={["#ef4444", "#b91c1c"]} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Payables</Text>
            <Text style={styles.headerSub}>AP outstanding & payment plan</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.tabRow}>
        {(
          [
            ["overview", "Overview"],
            ["suppliers", "Suppliers"],
            ["planning", "Planning"],
          ] as const
        ).map(([id, label]) => (
          <TouchableOpacity
            key={id}
            style={[styles.tab, tab === id && styles.tabActive]}
            onPress={() => setTab(id)}
          >
            <Text style={[styles.tabText, tab === id && styles.tabTextActive]}>
              {label}
            </Text>
            {id === "planning" && (plan.data?.summary?.count || 0) > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{plan.data?.summary?.count}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <PeriodSelector
          value={period}
          onChange={(p: PeriodPreset) => setPeriod(resolvePeriod(p))}
        />

        {(dash.error || (tab === "planning" && plan.error)) && (
          <Text style={styles.error}>
            {((tab === "planning" ? plan.error : dash.error) as Error)
              ?.message || "Failed to load"}
          </Text>
        )}

        {tab === "overview" && (
          <>
            <Section title="Outstanding">
              <View style={styles.grid}>
                <ExecutiveKpiTile
                  title="Total payable"
                  value={kpis?.total}
                  currency={currency}
                  compact
                />
                <ExecutiveKpiTile
                  title="Overdue"
                  value={kpis?.overdue}
                  currency={currency}
                  compact
                />
                <ExecutiveKpiTile
                  title="Overdue %"
                  value={kpis?.overdue_pct}
                  format="percent"
                  compact
                />
                <ExecutiveKpiTile
                  title="Current"
                  value={kpis?.current}
                  currency={currency}
                  compact
                />
                <ExecutiveKpiTile
                  title="DPO"
                  value={kpis?.dpo}
                  format="number"
                  compact
                />
                <ExecutiveKpiTile
                  title="Invoices"
                  value={kpis?.invoice_count}
                  format="number"
                  compact
                />
              </View>
            </Section>

            <Section title="Payments made">
              <View style={styles.grid}>
                <ExecutiveKpiTile
                  title="Paid MTD"
                  value={kpis?.paid_mtd}
                  currency={currency}
                  compact
                />
                <ExecutiveKpiTile
                  title="Paid YTD"
                  value={kpis?.paid_ytd}
                  currency={currency}
                  compact
                />
              </View>
            </Section>

            {dash.data?.aging && dash.data.aging.length > 0 && (
              <Section title="Aging">
                <View style={styles.agingCard}>
                  {dash.data.aging.map((b) => (
                    <View key={b.label} style={styles.agingRow}>
                      <Text style={styles.agingLabel}>{b.label}</Text>
                      <Text style={styles.agingValue}>
                        {formatCurrency(b.value, currency, { compact: true })}
                      </Text>
                      {b.count != null && (
                        <Text style={styles.agingCount}>{b.count}</Text>
                      )}
                    </View>
                  ))}
                </View>
              </Section>
            )}

            {dash.data?.charts?.months && dash.data.charts.invoiced && (
              <Section title="Invoiced vs paid">
                <View style={styles.trendCard}>
                  {dash.data.charts.months.slice(-6).map((m, i) => {
                    const idx = dash.data!.charts!.months!.length - 6 + i;
                    const inv = dash.data!.charts!.invoiced?.[idx];
                    const paid = dash.data!.charts!.paid?.[idx];
                    return (
                      <View key={`${m}-${i}`} style={styles.trendRow}>
                        <Text style={styles.trendMonth}>{m}</Text>
                        <Text style={styles.trendVal}>
                          Inv{" "}
                          {inv == null
                            ? "—"
                            : formatCurrency(inv, currency, { compact: true })}
                        </Text>
                        <Text style={styles.trendValMuted}>
                          Paid{" "}
                          {paid == null
                            ? "—"
                            : formatCurrency(paid, currency, {
                                compact: true,
                              })}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </Section>
            )}

            <TouchableOpacity
              style={styles.cta}
              onPress={() => setTab("planning")}
            >
              <Ionicons name="calendar" size={18} color="#b91c1c" />
              <Text style={styles.ctaText}>Open payment planning</Text>
              <Ionicons name="chevron-forward" size={18} color="#b91c1c" />
            </TouchableOpacity>
          </>
        )}

        {tab === "suppliers" && (
          <>
            <Section title="By outstanding">
              {(dash.data?.by_supplier || []).map((row, idx) => (
                <RankingCard
                  key={row.id}
                  rank={idx + 1}
                  title={row.name}
                  primary={formatCurrency(row.outstanding, currency, {
                    compact: true,
                  })}
                  metrics={[
                    currencyMetric("Overdue", row.overdue, currency),
                    ...(row.invoice_count != null
                      ? [
                          {
                            label: "Invoices",
                            value: String(row.invoice_count),
                          },
                        ]
                      : []),
                    ...(row.avg_days_to_pay != null
                      ? [
                          {
                            label: "Avg days",
                            value: String(row.avg_days_to_pay),
                          },
                        ]
                      : []),
                  ]}
                />
              ))}
              {(dash.data?.by_supplier || []).length === 0 && (
                <Text style={styles.muted}>No supplier rows.</Text>
              )}
            </Section>

            {(dash.data?.overdue_suppliers || []).length > 0 && (
              <Section title="Top overdue">
                {(dash.data?.overdue_suppliers || []).map((row, idx) => (
                  <RankingCard
                    key={`od-${row.id}`}
                    rank={idx + 1}
                    title={row.name}
                    primary={formatCurrency(
                      row.overdue ?? row.outstanding,
                      currency,
                      { compact: true }
                    )}
                    metrics={[
                      ...(row.days_overdue != null
                        ? [
                            {
                              label: "Days",
                              value: String(row.days_overdue),
                            },
                          ]
                        : []),
                      currencyMetric("Outstanding", row.outstanding, currency),
                    ]}
                  />
                ))}
              </Section>
            )}

            {(dash.data?.invoices || []).length > 0 && (
              <Section title="Open invoices">
                {(dash.data?.invoices || []).map((inv) => (
                  <View key={inv.id} style={styles.invCard}>
                    <View style={styles.invTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.invId}>{inv.name}</Text>
                        <Text style={styles.invSupplier}>
                          {inv.supplier || "—"}
                        </Text>
                      </View>
                      <Text style={styles.invAmount}>
                        {formatCurrency(
                          inv.outstanding ?? inv.grand_total,
                          currency,
                          { compact: true }
                        )}
                      </Text>
                    </View>
                    <Text style={styles.invMeta}>
                      {[
                        inv.status,
                        inv.due_date ? `Due ${inv.due_date}` : null,
                        inv.overdue_days != null
                          ? `${inv.overdue_days}d overdue`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </Text>
                  </View>
                ))}
              </Section>
            )}
          </>
        )}

        {tab === "planning" && (
          <>
            {plan.isLoading && !plan.data ? (
              <Text style={styles.muted}>Loading payment plan…</Text>
            ) : (
              <>
                {plan.data?.summary && (
                  <Section title="Cash needs">
                    <View style={styles.grid}>
                      <ExecutiveKpiTile
                        title="Due this week"
                        value={plan.data.summary.due_this_week}
                        currency={currency}
                        compact
                      />
                      <ExecutiveKpiTile
                        title="Due next week"
                        value={plan.data.summary.due_next_week}
                        currency={currency}
                        compact
                      />
                      <ExecutiveKpiTile
                        title="Due this month"
                        value={plan.data.summary.due_this_month}
                        currency={currency}
                        compact
                      />
                      <ExecutiveKpiTile
                        title="Overdue to pay"
                        value={plan.data.summary.overdue_to_pay}
                        currency={currency}
                        compact
                      />
                    </View>
                  </Section>
                )}

                {plan.data?.by_week && plan.data.by_week.length > 0 && (
                  <Section title="By week">
                    <View style={styles.agingCard}>
                      {plan.data.by_week.map((w) => (
                        <View key={w.label} style={styles.agingRow}>
                          <Text style={styles.agingLabelWide}>{w.label}</Text>
                          <Text style={styles.agingValue}>
                            {formatCurrency(w.amount, currency, {
                              compact: true,
                            })}
                          </Text>
                          {w.count != null && (
                            <Text style={styles.agingCount}>{w.count}</Text>
                          )}
                        </View>
                      ))}
                    </View>
                  </Section>
                )}

                <Section title="Suggested payments">
                  {(plan.data?.items || []).map((item) => (
                    <PlanCard
                      key={item.id}
                      item={item}
                      currency={currency}
                    />
                  ))}
                  {(plan.data?.items || []).length === 0 && (
                    <Text style={styles.muted}>No planned payments.</Text>
                  )}
                </Section>
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  header: {
    paddingTop: Platform.OS === "ios" ? 52 : 40,
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
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "800" },
  headerSub: { color: "rgba(255,255,255,0.85)", fontSize: 12, marginTop: 2 },
  tabRow: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingTop: 10,
    gap: 6,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: { borderBottomColor: "#ef4444" },
  tabText: { fontSize: 13, fontWeight: "600", color: "#6b7280" },
  tabTextActive: { color: "#b91c1c", fontWeight: "800" },
  badge: {
    backgroundColor: "#dc2626",
    borderRadius: 8,
    minWidth: 16,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  body: { padding: 16, paddingBottom: 40 },
  section: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1f2937",
    marginBottom: 10,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  agingCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#fee2e2",
  },
  agingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e7eb",
  },
  agingLabel: { width: 64, fontWeight: "700", color: "#6b7280" },
  agingLabelWide: { width: 90, fontWeight: "700", color: "#6b7280" },
  agingValue: { flex: 1, fontWeight: "800", color: "#111827" },
  agingCount: { fontSize: 12, color: "#9ca3af", fontWeight: "600" },
  trendCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#fee2e2",
  },
  trendRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    gap: 8,
  },
  trendMonth: { width: 40, fontWeight: "700", color: "#6b7280" },
  trendVal: { flex: 1, fontSize: 12, color: "#111827", fontWeight: "600" },
  trendValMuted: { fontSize: 11, color: "#9ca3af" },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fee2e2",
    padding: 14,
    borderRadius: 12,
    marginTop: 4,
  },
  ctaText: { flex: 1, fontWeight: "700", color: "#b91c1c" },
  invCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#fee2e2",
  },
  invTop: { flexDirection: "row", gap: 8 },
  invId: { fontSize: 14, fontWeight: "800", color: "#111827" },
  invSupplier: { fontSize: 13, color: "#6b7280", marginTop: 2 },
  invAmount: { fontSize: 14, fontWeight: "800", color: "#111827" },
  invMeta: { marginTop: 6, fontSize: 11, color: "#9ca3af", fontWeight: "600" },
  planCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#fee2e2",
  },
  planTop: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  priorityDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  planSupplier: { fontSize: 15, fontWeight: "800", color: "#111827" },
  planMeta: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  planAmount: { fontSize: 14, fontWeight: "800", color: "#dc2626" },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#f8fafc",
  },
  muted: { color: "#6b7280", textAlign: "center", marginTop: 24 },
  link: { color: "#ef4444", fontWeight: "700", marginTop: 12 },
  error: { color: "#dc2626", marginBottom: 12, fontWeight: "600" },
});
