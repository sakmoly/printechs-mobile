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
import { RankingCard } from "../src/components/RankingCard";
import { LoadingScreen } from "../src/components/LoadingScreen";
import { useApprovalAnalytics } from "../src/hooks/useExceptionsAndApprovals";
import { useAuthStore } from "../src/store/auth";
import { isModuleEnabled } from "../src/api/mobileConfig";
import { resolveCompanyName } from "../src/api/apiResilience";
import { SafeScreen } from "../src/components/SafeScreen";
import {
  defaultPeriod,
  resolvePeriod,
  type DateRange,
  type PeriodPreset,
} from "../src/utils/period";

type Tab = "overview" | "doctypes" | "approvers";

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

export default function ApprovalAnalyticsScreen() {
  const mobileConfig = useAuthStore((s) => s.mobileConfig);
  const permissions = useAuthStore((s) => s.permissions);
  const user = useAuthStore((s) => s.user);
  const enabled = isModuleEnabled(mobileConfig, "approval_analytics");

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

  const { data, isLoading, error, refetch } = useApprovalAnalytics(params, {
    enabled,
  });

  const kpis = data?.kpis;

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  if (!enabled) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>
          Approval Analytics is disabled for this site.
        </Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.link}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isLoading && !data) {
    return <LoadingScreen message="Loading approval analytics…" />;
  }

  return (
    <SafeScreen style={styles.container}>
      <LinearGradient colors={["#6366f1", "#4338ca"]} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Approval Analytics</Text>
            <Text style={styles.headerSub}>Cycle time · backlog · SLA</Text>
          </View>
          <TouchableOpacity
            style={styles.linkBtn}
            onPress={() => router.push("/(tabs)/approvals")}
          >
            <Ionicons name="checkmark-done" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <View style={styles.tabRow}>
        {(
          [
            ["overview", "Overview"],
            ["doctypes", "DocTypes"],
            ["approvers", "Approvers"],
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

        {error && (
          <Text style={styles.error}>
            {(error as Error).message || "Failed to load"}
          </Text>
        )}

        {tab === "overview" && (
          <>
            <Section title="Volume">
              <View style={styles.grid}>
                <ExecutiveKpiTile
                  title="Pending"
                  value={kpis?.pending_count}
                  format="number"
                  compact
                />
                <ExecutiveKpiTile
                  title="Approved"
                  value={kpis?.approved_count}
                  format="number"
                  compact
                />
                <ExecutiveKpiTile
                  title="Rejected"
                  value={kpis?.rejected_count}
                  format="number"
                  compact
                />
                <ExecutiveKpiTile
                  title="Overdue pending"
                  value={kpis?.overdue_pending}
                  format="number"
                  compact
                />
              </View>
            </Section>

            <Section title="Cycle time">
              <View style={styles.grid}>
                <ExecutiveKpiTile
                  title="Avg hours"
                  value={kpis?.avg_cycle_hours}
                  format="number"
                  compact
                />
                <ExecutiveKpiTile
                  title="Median hours"
                  value={kpis?.median_cycle_hours}
                  format="number"
                  compact
                />
                <ExecutiveKpiTile
                  title="SLA breach %"
                  value={kpis?.sla_breach_pct}
                  format="percent"
                  compact
                />
              </View>
            </Section>

            {data?.aging && data.aging.length > 0 && (
              <Section title="Pending aging">
                <View style={styles.agingCard}>
                  {data.aging.map((b) => (
                    <View key={b.label} style={styles.agingRow}>
                      <Text style={styles.agingLabel}>{b.label}</Text>
                      <Text style={styles.agingValue}>{b.count}</Text>
                    </View>
                  ))}
                </View>
              </Section>
            )}

            {data?.charts?.months && data.charts.approved && (
              <Section title="Monthly volume">
                <View style={styles.trendCard}>
                  {data.charts.months.slice(-6).map((m, i) => {
                    const idx = data.charts!.months!.length - 6 + i;
                    const approved = data.charts!.approved?.[idx];
                    const rejected = data.charts!.rejected?.[idx];
                    const pending = data.charts!.pending?.[idx];
                    return (
                      <View key={`${m}-${i}`} style={styles.trendRow}>
                        <Text style={styles.trendMonth}>{m}</Text>
                        <Text style={styles.trendVal}>
                          ✓ {approved ?? "—"} · ✕ {rejected ?? "—"}
                        </Text>
                        <Text style={styles.trendValMuted}>
                          Pend {pending ?? "—"}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </Section>
            )}

            <TouchableOpacity
              style={styles.cta}
              onPress={() => router.push("/(tabs)/approvals")}
            >
              <Ionicons name="checkmark-circle" size={18} color="#4338ca" />
              <Text style={styles.ctaText}>Open approvals inbox</Text>
              <Ionicons name="chevron-forward" size={18} color="#4338ca" />
            </TouchableOpacity>
          </>
        )}

        {tab === "doctypes" && (
          <>
            {(data?.by_doctype || []).map((row, idx) => (
              <RankingCard
                key={row.id}
                rank={idx + 1}
                title={row.name}
                primary={`${row.pending ?? 0} pending`}
                metrics={[
                  {
                    label: "Approved",
                    value: String(row.approved ?? "—"),
                  },
                  {
                    label: "Rejected",
                    value: String(row.rejected ?? "—"),
                  },
                  ...(row.avg_cycle_hours != null
                    ? [
                        {
                          label: "Avg hrs",
                          value: String(row.avg_cycle_hours),
                        },
                      ]
                    : []),
                ]}
              />
            ))}
            {(data?.by_doctype || []).length === 0 && (
              <Text style={styles.muted}>No doctype breakdown.</Text>
            )}
          </>
        )}

        {tab === "approvers" && (
          <>
            {(data?.by_approver || []).map((row, idx) => (
              <RankingCard
                key={row.id}
                rank={idx + 1}
                title={row.name}
                primary={`${row.pending ?? 0} pending`}
                metrics={[
                  {
                    label: "Approved",
                    value: String(row.approved ?? "—"),
                  },
                  ...(row.avg_cycle_hours != null
                    ? [
                        {
                          label: "Avg hrs",
                          value: String(row.avg_cycle_hours),
                        },
                      ]
                    : []),
                ]}
              />
            ))}
            {(data?.by_approver || []).length === 0 && (
              <Text style={styles.muted}>No approver breakdown.</Text>
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
  linkBtn: {
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
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: { borderBottomColor: "#6366f1" },
  tabText: { fontSize: 13, fontWeight: "600", color: "#6b7280" },
  tabTextActive: { color: "#4338ca", fontWeight: "800" },
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
    borderColor: "#e0e7ff",
  },
  agingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e7eb",
  },
  agingLabel: { flex: 1, fontWeight: "700", color: "#6b7280" },
  agingValue: { fontWeight: "800", color: "#111827" },
  trendCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e0e7ff",
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
    backgroundColor: "#e0e7ff",
    padding: 14,
    borderRadius: 12,
    marginTop: 4,
  },
  ctaText: { flex: 1, fontWeight: "700", color: "#4338ca" },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#f8fafc",
  },
  muted: { color: "#6b7280", textAlign: "center", marginTop: 24 },
  link: { color: "#6366f1", fontWeight: "700", marginTop: 12 },
  error: { color: "#dc2626", marginBottom: 12, fontWeight: "600" },
});
