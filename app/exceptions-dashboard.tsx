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
import { ExecutiveKpiTile } from "../src/components/ExecutiveKpiTile";
import { LoadingScreen } from "../src/components/LoadingScreen";
import { useManagementExceptions } from "../src/hooks/useExceptionsAndApprovals";
import { useAuthStore } from "../src/store/auth";
import { isModuleEnabled } from "../src/api/mobileConfig";
import { resolveCompanyName } from "../src/api/apiResilience";
import { formatCurrency } from "../src/utils/currency";
import { SafeScreen } from "../src/components/SafeScreen";
import type {
  ExceptionSeverity,
  ManagementException,
} from "../src/api/exceptionsTypes";

const SEV_COLOR: Record<ExceptionSeverity, string> = {
  critical: "#dc2626",
  high: "#ea580c",
  medium: "#d97706",
  low: "#6b7280",
};

function openException(item: ManagementException) {
  if (item.route) {
    if (item.route.includes("customer-360") && item.party_id) {
      router.push({
        pathname: "/customer-360",
        params: { customer: item.party_id },
      });
      return;
    }
    router.push(item.route as any);
    return;
  }
  if (item.category === "receivables" || item.category === "collection") {
    router.push("/collection-dashboard");
  } else if (item.category === "inventory") {
    router.push("/inventory-health");
  } else if (item.category === "orders") {
    router.push("/sales-order-dashboard");
  } else if (item.category === "payables") {
    router.push("/payables-dashboard");
  } else if (item.category === "approvals") {
    router.push("/(tabs)/approvals");
  }
}

export default function ExceptionsDashboardScreen() {
  const mobileConfig = useAuthStore((s) => s.mobileConfig);
  const permissions = useAuthStore((s) => s.permissions);
  const user = useAuthStore((s) => s.user);
  const enabled = isModuleEnabled(mobileConfig, "exceptions");

  const company = resolveCompanyName(
    permissions.scope?.company,
    user?.company
  );

  const [severityFilter, setSeverityFilter] = useState<
    "all" | ExceptionSeverity
  >("all");
  const [refreshing, setRefreshing] = useState(false);

  const params = useMemo(() => ({ company }), [company]);
  const { data, isLoading, error, refetch } = useManagementExceptions(params, {
    enabled,
  });

  const currency = data?.meta.currency || "SAR";
  const items = useMemo(() => {
    const list = data?.items || [];
    if (severityFilter === "all") return list;
    return list.filter((i) => i.severity === severityFilter);
  }, [data?.items, severityFilter]);

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
        <Text style={styles.muted}>Exceptions is disabled for this site.</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.link}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isLoading && !data) {
    return <LoadingScreen message="Loading exceptions…" />;
  }

  return (
    <SafeScreen style={styles.container}>
      <LinearGradient colors={["#ea580c", "#9a3412"]} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Exceptions</Text>
            <Text style={styles.headerSub}>
              Management alerts (no target misses)
            </Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {error && (
          <Text style={styles.error}>
            {(error as Error).message || "Failed to load"}
          </Text>
        )}

        <View style={styles.grid}>
          <ExecutiveKpiTile
            title="Total"
            value={data?.summary.total}
            format="number"
            compact
          />
          <ExecutiveKpiTile
            title="Critical"
            value={data?.summary.critical}
            format="number"
            compact
          />
          <ExecutiveKpiTile
            title="High"
            value={data?.summary.high}
            format="number"
            compact
          />
          <ExecutiveKpiTile
            title="Medium"
            value={data?.summary.medium}
            format="number"
            compact
          />
        </View>

        <View style={styles.chipRow}>
          {(
            [
              ["all", "All"],
              ["critical", "Critical"],
              ["high", "High"],
              ["medium", "Medium"],
              ["low", "Low"],
            ] as const
          ).map(([id, label]) => (
            <TouchableOpacity
              key={id}
              style={[styles.chip, severityFilter === id && styles.chipActive]}
              onPress={() => setSeverityFilter(id)}
            >
              <Text
                style={[
                  styles.chipText,
                  severityFilter === id && styles.chipTextActive,
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {items.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.card}
            activeOpacity={0.85}
            onPress={() => openException(item)}
          >
            <View style={styles.cardTop}>
              <View
                style={[
                  styles.sevDot,
                  { backgroundColor: SEV_COLOR[item.severity] },
                ]}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardMeta}>
                  {[item.category, item.party || item.reference, item.detected_at]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              </View>
              {item.metric_value != null && (
                <Text style={styles.cardValue}>
                  {item.metric_label === "days" ||
                  item.metric_label === "docs"
                    ? `${item.metric_value}${
                        item.metric_label === "days" ? "d" : ""
                      }`
                    : formatCurrency(item.metric_value, currency, {
                        compact: true,
                      })}
                </Text>
              )}
            </View>
            {item.message ? (
              <Text style={styles.cardMsg}>{item.message}</Text>
            ) : null}
            <View style={styles.cardFooter}>
              <Text style={[styles.sevLabel, { color: SEV_COLOR[item.severity] }]}>
                {item.severity.toUpperCase()}
              </Text>
              <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
            </View>
          </TouchableOpacity>
        ))}

        {items.length === 0 && (
          <Text style={styles.muted}>No exceptions for this filter.</Text>
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
  body: { padding: 16, paddingBottom: 40 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  chipActive: { backgroundColor: "#ffedd5", borderColor: "#ea580c" },
  chipText: { fontSize: 12, fontWeight: "700", color: "#6b7280" },
  chipTextActive: { color: "#9a3412" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#ffedd5",
  },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  sevDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  cardTitle: { fontSize: 15, fontWeight: "800", color: "#111827" },
  cardMeta: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  cardValue: { fontSize: 13, fontWeight: "800", color: "#111827" },
  cardMsg: { marginTop: 8, fontSize: 13, color: "#374151", lineHeight: 18 },
  cardFooter: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sevLabel: { fontSize: 11, fontWeight: "800" },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#f8fafc",
  },
  muted: { color: "#6b7280", textAlign: "center", marginTop: 24 },
  link: { color: "#ea580c", fontWeight: "700", marginTop: 12 },
  error: { color: "#dc2626", marginBottom: 12, fontWeight: "600" },
});
