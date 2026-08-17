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
import { RankingCard } from "../src/components/RankingCard";
import { LoadingScreen } from "../src/components/LoadingScreen";
import {
  useDeadStock,
  useInventoryHealth,
  useStockCover,
} from "../src/hooks/useInventoryHealth";
import { useAuthStore } from "../src/store/auth";
import { isModuleEnabled } from "../src/api/mobileConfig";
import { resolveCompanyName } from "../src/api/apiResilience";
import { formatCurrency } from "../src/utils/currency";
import { SafeScreen } from "../src/components/SafeScreen";

type Tab = "health" | "cover" | "dead";

const COVER_COLOR: Record<string, string> = {
  critical: "#dc2626",
  low: "#d97706",
  ok: "#059669",
  excess: "#7c3aed",
};

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

export default function InventoryHealthScreen() {
  const mobileConfig = useAuthStore((s) => s.mobileConfig);
  const permissions = useAuthStore((s) => s.permissions);
  const user = useAuthStore((s) => s.user);
  const enabled = isModuleEnabled(mobileConfig, "inventory_health");

  const company = resolveCompanyName(
    permissions.scope?.company,
    user?.company
  );

  const [tab, setTab] = useState<Tab>("health");
  const [refreshing, setRefreshing] = useState(false);

  const params = useMemo(() => ({ company }), [company]);

  const health = useInventoryHealth(params, { enabled });
  const cover = useStockCover(params, {
    enabled: enabled && tab === "cover",
  });
  const dead = useDeadStock(params, {
    enabled: enabled && tab === "dead",
  });

  const currency =
    health.data?.meta.currency ||
    cover.data?.meta.currency ||
    dead.data?.meta.currency ||
    "SAR";

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        health.refetch(),
        ...(tab === "cover" ? [cover.refetch()] : []),
        ...(tab === "dead" ? [dead.refetch()] : []),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  if (!enabled) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>
          Inventory Health is disabled for this site.
        </Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.link}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (health.isLoading && !health.data) {
    return <LoadingScreen message="Loading inventory health…" />;
  }

  const kpis = health.data?.kpis;
  const activeError =
    tab === "health"
      ? health.error
      : tab === "cover"
        ? cover.error
        : dead.error;

  return (
    <SafeScreen style={styles.container}>
      <LinearGradient colors={["#10b981", "#047857"]} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Inventory Health</Text>
            <Text style={styles.headerSub}>
              Cover · low stock · dead stock
            </Text>
          </View>
          <TouchableOpacity
            style={styles.linkBtn}
            onPress={() => router.push("/inventory-dashboard")}
          >
            <Ionicons name="layers-outline" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <View style={styles.tabRow}>
        {(
          [
            ["health", "Health"],
            ["cover", "Stock cover"],
            ["dead", "Dead stock"],
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
        {activeError && (
          <Text style={styles.error}>
            {(activeError as Error).message || "Failed to load"}
          </Text>
        )}

        {tab === "health" && (
          <>
            <Section title="Snapshot">
              <View style={styles.grid}>
                <ExecutiveKpiTile
                  title="Stock value"
                  value={kpis?.total_value}
                  currency={currency}
                  compact
                />
                <ExecutiveKpiTile
                  title="SKUs"
                  value={kpis?.sku_count}
                  format="number"
                  compact
                />
                <ExecutiveKpiTile
                  title="Low stock"
                  value={kpis?.low_stock_count}
                  format="number"
                  compact
                />
                <ExecutiveKpiTile
                  title="Low stock value"
                  value={kpis?.low_stock_value}
                  currency={currency}
                  compact
                />
                <ExecutiveKpiTile
                  title="Overstock value"
                  value={kpis?.overstock_value}
                  currency={currency}
                  compact
                />
                <ExecutiveKpiTile
                  title="Non-moving"
                  value={kpis?.non_moving_value}
                  currency={currency}
                  compact
                />
                <ExecutiveKpiTile
                  title="Turnover"
                  value={kpis?.turnover}
                  format="number"
                  compact
                />
                <ExecutiveKpiTile
                  title="Avg days cover"
                  value={kpis?.days_of_cover}
                  format="number"
                  compact
                />
              </View>
            </Section>

            {(health.data?.low_stock || []).length > 0 && (
              <Section title="Low stock alerts">
                {(health.data?.low_stock || []).map((item) => (
                  <View key={item.id} style={styles.itemCard}>
                    <View style={styles.itemTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemName}>{item.name}</Text>
                        <Text style={styles.itemMeta}>
                          {[item.item_code, item.warehouse, item.status]
                            .filter(Boolean)
                            .join(" · ")}
                        </Text>
                      </View>
                      <Text style={styles.itemValue}>
                        {formatCurrency(item.value, currency, {
                          compact: true,
                        })}
                      </Text>
                    </View>
                    <Text style={styles.itemStats}>
                      Qty {item.qty ?? "—"}
                      {item.reorder_level != null
                        ? ` · Reorder ${item.reorder_level}`
                        : ""}
                      {item.days_cover != null
                        ? ` · ${item.days_cover}d cover`
                        : ""}
                    </Text>
                  </View>
                ))}
              </Section>
            )}

            {(health.data?.by_warehouse || []).length > 0 && (
              <Section title="By warehouse">
                {(health.data?.by_warehouse || []).map((w, idx) => (
                  <RankingCard
                    key={w.id}
                    rank={idx + 1}
                    title={w.name}
                    primary={formatCurrency(w.value, currency, {
                      compact: true,
                    })}
                    metrics={
                      w.sku_count != null
                        ? [{ label: "SKUs", value: String(w.sku_count) }]
                        : []
                    }
                  />
                ))}
              </Section>
            )}

            {(health.data?.by_category || []).length > 0 && (
              <Section title="By category">
                {(health.data?.by_category || []).map((c, idx) => (
                  <RankingCard
                    key={c.id}
                    rank={idx + 1}
                    title={c.name}
                    primary={formatCurrency(c.value, currency, {
                      compact: true,
                    })}
                    metrics={
                      c.low_stock != null
                        ? [{ label: "Low", value: String(c.low_stock) }]
                        : []
                    }
                  />
                ))}
              </Section>
            )}
          </>
        )}

        {tab === "cover" && (
          <>
            {cover.isLoading && !cover.data ? (
              <Text style={styles.muted}>Loading stock cover…</Text>
            ) : (
              <>
                {cover.data?.summary && (
                  <Section title="Cover summary">
                    <View style={styles.grid}>
                      <ExecutiveKpiTile
                        title="Avg days"
                        value={cover.data.summary.avg_days_cover}
                        format="number"
                        compact
                      />
                      <ExecutiveKpiTile
                        title="Critical"
                        value={cover.data.summary.critical_count}
                        format="number"
                        compact
                      />
                      <ExecutiveKpiTile
                        title="Low"
                        value={cover.data.summary.low_count}
                        format="number"
                        compact
                      />
                      <ExecutiveKpiTile
                        title="Excess"
                        value={cover.data.summary.excess_count}
                        format="number"
                        compact
                      />
                    </View>
                  </Section>
                )}
                <Section title="Items">
                  {(cover.data?.items || []).map((item) => {
                    const tone =
                      COVER_COLOR[String(item.status || "").toLowerCase()] ||
                      "#6b7280";
                    return (
                      <View key={item.id} style={styles.itemCard}>
                        <View style={styles.itemTop}>
                          <View
                            style={[styles.statusDot, { backgroundColor: tone }]}
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.itemName}>{item.name}</Text>
                            <Text style={styles.itemMeta}>
                              {[item.item_code, item.warehouse, item.status]
                                .filter(Boolean)
                                .join(" · ")}
                            </Text>
                          </View>
                          <Text style={[styles.coverDays, { color: tone }]}>
                            {item.days_cover != null
                              ? `${item.days_cover}d`
                              : "—"}
                          </Text>
                        </View>
                        <Text style={styles.itemStats}>
                          Qty {item.qty ?? "—"}
                          {item.value != null
                            ? ` · ${formatCurrency(item.value, currency, {
                                compact: true,
                              })}`
                            : ""}
                          {item.avg_daily_usage != null
                            ? ` · ${item.avg_daily_usage}/day`
                            : ""}
                        </Text>
                      </View>
                    );
                  })}
                  {(cover.data?.items || []).length === 0 && (
                    <Text style={styles.muted}>No stock cover rows.</Text>
                  )}
                </Section>
              </>
            )}
          </>
        )}

        {tab === "dead" && (
          <>
            {dead.isLoading && !dead.data ? (
              <Text style={styles.muted}>Loading dead stock…</Text>
            ) : (
              <>
                {dead.data?.summary && (
                  <Section title="Dead stock summary">
                    <View style={styles.grid}>
                      <ExecutiveKpiTile
                        title="Value"
                        value={dead.data.summary.total_value}
                        currency={currency}
                        compact
                      />
                      <ExecutiveKpiTile
                        title="Items"
                        value={dead.data.summary.item_count}
                        format="number"
                        compact
                      />
                      <ExecutiveKpiTile
                        title="% of inventory"
                        value={dead.data.summary.pct_of_inventory}
                        format="percent"
                        compact
                      />
                    </View>
                  </Section>
                )}

                {(dead.data?.by_category || []).length > 0 && (
                  <Section title="By category">
                    {(dead.data?.by_category || []).map((c, idx) => (
                      <RankingCard
                        key={c.name}
                        rank={idx + 1}
                        title={c.name}
                        primary={formatCurrency(c.value, currency, {
                          compact: true,
                        })}
                        metrics={
                          c.count != null
                            ? [{ label: "Items", value: String(c.count) }]
                            : []
                        }
                      />
                    ))}
                  </Section>
                )}

                <Section title="Items">
                  {(dead.data?.items || []).map((item) => (
                    <View key={item.id} style={styles.itemCard}>
                      <View style={styles.itemTop}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.itemName}>{item.name}</Text>
                          <Text style={styles.itemMeta}>
                            {[item.item_code, item.warehouse, item.category]
                              .filter(Boolean)
                              .join(" · ")}
                          </Text>
                        </View>
                        <Text style={styles.itemValueWarn}>
                          {formatCurrency(item.value, currency, {
                            compact: true,
                          })}
                        </Text>
                      </View>
                      <Text style={styles.itemStats}>
                        Qty {item.qty ?? "—"}
                        {item.days_since_movement != null
                          ? ` · Idle ${item.days_since_movement}d`
                          : ""}
                        {item.last_movement
                          ? ` · Last ${item.last_movement}`
                          : ""}
                      </Text>
                    </View>
                  ))}
                  {(dead.data?.items || []).length === 0 && (
                    <Text style={styles.muted}>No dead stock found.</Text>
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
  tabActive: { borderBottomColor: "#10b981" },
  tabText: { fontSize: 12, fontWeight: "600", color: "#6b7280" },
  tabTextActive: { color: "#047857", fontWeight: "800" },
  body: { padding: 16, paddingBottom: 40 },
  section: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1f2937",
    marginBottom: 10,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  itemCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#d1fae5",
  },
  itemTop: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  itemName: { fontSize: 14, fontWeight: "800", color: "#111827" },
  itemMeta: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  itemValue: { fontSize: 13, fontWeight: "800", color: "#111827" },
  itemValueWarn: { fontSize: 13, fontWeight: "800", color: "#d97706" },
  coverDays: { fontSize: 16, fontWeight: "800" },
  itemStats: { marginTop: 6, fontSize: 11, color: "#6b7280", fontWeight: "600" },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#f8fafc",
  },
  muted: { color: "#6b7280", textAlign: "center", marginTop: 24 },
  link: { color: "#10b981", fontWeight: "700", marginTop: 12 },
  error: { color: "#dc2626", marginBottom: 12, fontWeight: "600" },
});
