import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Linking,
  RefreshControl,
  ActivityIndicator,
  Platform,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { PeriodSelector } from "../../src/components/PeriodSelector";
import { ExecutiveKpiTile } from "../../src/components/ExecutiveKpiTile";
import { LoadingScreen } from "../../src/components/LoadingScreen";
import {
  useCustomer360,
  useCustomerSearch,
} from "../../src/hooks/useCustomer360";
import { useAuthStore } from "../../src/store/auth";
import { isModuleEnabled } from "../../src/api/mobileConfig";
import { canAccessHubFeature } from "../../src/api/menuAccess";
import { resolveCompanyName } from "../../src/api/apiResilience";
import { optimizedApis } from "../../src/api/optimized-apis";
import { presentWhatsAppShare } from "../../src/utils/whatsappShare";
import {
  defaultPeriod,
  resolvePeriod,
  type DateRange,
  type PeriodPreset,
} from "../../src/utils/period";
import { formatCurrency, formatPercent, changeDirection } from "../../src/utils/currency";
import {
  SafeScreen,
  useSafeScreenInsets,
} from "../../src/components/SafeScreen";
import { ScreenHeaderNav, goPreviousScreen } from "../../src/components/ScreenHeaderNav";
import { useSafeBottomPadding } from "../../src/hooks/useSafeBottomPadding";
import { useDashboardFiltersStore } from "../../src/store/dashboardFilters";
import { getTerritoryFilterOptions } from "../../src/api/accessScope";
import {
  ALL_TERRITORIES,
  isKnownTerritoryName,
  territoryLabel,
} from "../../src/utils/dashboardTerritory";

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      {children}
    </View>
  );
}

function ActivityRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <View style={styles.activityRow}>
      <Text style={styles.activityLabel}>{label}</Text>
      <Text style={styles.activityValue}>{value || "—"}</Text>
    </View>
  );
}

export default function Customer360Screen() {
  const { topInset } = useSafeScreenInsets({ aboveTabBar: true });
  const params = useLocalSearchParams<{ customer?: string }>();
  const mobileConfig = useAuthStore((s) => s.mobileConfig);
  const permissions = useAuthStore((s) => s.permissions);
  const selectedTerritory = useDashboardFiltersStore(
    (s) => s.selectedTerritory
  );
  const territoryOptions = useMemo(
    () => getTerritoryFilterOptions(permissions.scope),
    [permissions.scope]
  );
  const enabled = isModuleEnabled(mobileConfig, "customer_360");
  const allowedByAccess = canAccessHubFeature(permissions, "customer360");

  const [query, setQuery] = useState("");
  const routeCustomer = useMemo(
    () => (params.customer ? String(params.customer).trim() : ""),
    [params.customer]
  );
  const [selectedId, setSelectedId] = useState<string | undefined>(
    routeCustomer || undefined
  );

  useEffect(() => {
    if (!routeCustomer) return;
    if (isKnownTerritoryName(routeCustomer, permissions.scope)) {
      Alert.alert(
        "Not a customer",
        `"${routeCustomer}" is a territory name, not a Customer. Search for a customer below.`
      );
      setSelectedId(undefined);
      router.setParams({ customer: "" });
      return;
    }
    setSelectedId((prev) => (prev === routeCustomer ? prev : routeCustomer));
  }, [routeCustomer, permissions.scope]);
  const [period, setPeriod] = useState<DateRange>(() => defaultPeriod());
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const bottomPad = useSafeBottomPadding(24, { aboveTabBar: true });

  const company = resolveCompanyName(permissions.scope?.company);

  const debouncedQ = query.trim();
  const search = useCustomerSearch(
    debouncedQ,
    selectedTerritory,
    enabled && !selectedId
  );
  const territoryScoped =
    selectedTerritory && selectedTerritory !== ALL_TERRITORIES;
  const searchSubtitle = territoryScoped
    ? `Territory: ${territoryLabel(selectedTerritory, territoryOptions)}`
    : "Search customers";
  const {
    data,
    isLoading,
    error,
    refetch,
  } = useCustomer360(
    selectedId,
    {
      company,
      from_date: period.from_date,
      to_date: period.to_date,
    },
    { enabled }
  );

  const currency = data?.meta.currency || "SAR";
  const customer = data?.customer;

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      if (selectedId) await refetch();
      else await search.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const openCall = () => {
    if (customer?.mobile) Linking.openURL(`tel:${customer.mobile}`);
  };
  const openEmail = () => {
    if (customer?.email) Linking.openURL(`mailto:${customer.email}`);
  };
  const openStatement = () => {
    if (!customer?.id && !customer?.name) return;
    router.push({
      pathname: "/customer-statement",
      params: { customer: customer.id || customer.name },
    });
  };
  const sendStatement = async () => {
    if (!customer?.name && !customer?.id) return;
    setSending(true);
    try {
      await optimizedApis.sendStatementByEmail(
        String(customer.id || customer.name),
        { company }
      );
      Alert.alert("Success", "Statement sent successfully");
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to send statement");
    } finally {
      setSending(false);
    }
  };
  const openWhatsApp = () => {
    const message = `Hello ${
      customer?.name || ""
    }, please find your account statement update.`;
    presentWhatsAppShare({
      message,
      customerPhone: customer?.mobile,
      customerName: customer?.name,
    });
  };

  if (!enabled) {
    return (
      <SafeScreen aboveTabBar includeTop style={styles.centered}>
        <Text style={styles.muted}>Customer 360 is disabled for this site.</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.link}>Go back</Text>
        </TouchableOpacity>
      </SafeScreen>
    );
  }

  if (permissions.fetched && !allowedByAccess) {
    return (
      <SafeScreen aboveTabBar includeTop style={styles.centered}>
        <Text style={styles.muted}>
          You do not have permission to view Customer 360.
        </Text>
        <Text style={[styles.muted, { marginTop: 8, fontSize: 13 }]}>
          Ask an admin to enable Can View on Sales Performance (AO-00026) and
          any Customer 360 Access Object on your Access Profile.
        </Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.link}>Go back</Text>
        </TouchableOpacity>
      </SafeScreen>
    );
  }

  return (
    <SafeScreen aboveTabBar includeTop={false} style={styles.container}>
      <LinearGradient
        colors={["#667eea", "#764ba2"]}
        style={[styles.header, { paddingTop: topInset }]}
      >
        <View style={styles.headerRow}>
          <ScreenHeaderNav
            onBack={() => {
              if (selectedId) {
                setSelectedId(undefined);
                if (routeCustomer) {
                  router.setParams({ customer: "" });
                }
              } else {
                goPreviousScreen();
              }
            }}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>
              {selectedId ? customer?.name || "Customer 360" : "Customer 360"}
            </Text>
            <Text style={styles.headerSub}>
              {selectedId
                ? customer?.territory || customer?.customer_group || "Profile"
                : searchSubtitle}
            </Text>
          </View>
        </View>
      </LinearGradient>

      {!selectedId ? (
        <View style={styles.searchPane}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={18} color="#9ca3af" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search customer name…"
              placeholderTextColor="#9ca3af"
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
              autoCapitalize="none"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery("")}>
                <Ionicons name="close-circle" size={18} color="#9ca3af" />
              </TouchableOpacity>
            )}
          </View>

          {territoryScoped ? (
            <View style={styles.territoryChip}>
              <Ionicons name="location-outline" size={14} color="#667eea" />
              <Text style={styles.territoryChipText}>
                Showing customers in{" "}
                {territoryLabel(selectedTerritory, territoryOptions)}
              </Text>
            </View>
          ) : null}

          {search.isLoading && (
            <ActivityIndicator style={{ marginTop: 24 }} color="#667eea" />
          )}

          <ScrollView
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            contentContainerStyle={{ paddingBottom: bottomPad }}
          >
            {(search.data || []).map((hit) => (
              <TouchableOpacity
                key={hit.id}
                style={styles.hitCard}
                onPress={() => setSelectedId(hit.id)}
                activeOpacity={0.85}
              >
                <View style={styles.hitIcon}>
                  <Ionicons name="person" size={18} color="#667eea" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.hitName}>{hit.name}</Text>
                  <Text style={styles.hitMeta}>
                    {[hit.customer_group, hit.territory, hit.salesperson]
                      .filter(Boolean)
                      .join(" · ") || hit.id}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
              </TouchableOpacity>
            ))}
            {!search.isLoading && (search.data || []).length === 0 && (
              <Text style={styles.muted}>No customers found.</Text>
            )}
          </ScrollView>
        </View>
      ) : isLoading && !data ? (
        <LoadingScreen message="Loading customer…" />
      ) : (
        <ScrollView
          contentContainerStyle={[styles.body, { paddingBottom: bottomPad }]}
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
              {(error as Error).message || "Failed to load customer"}
            </Text>
          )}

          {customer && (
            <View style={styles.profileCard}>
              <Text style={styles.profileName}>{customer.name}</Text>
              <Text style={styles.profileMeta}>
                {[customer.customer_group, customer.territory, customer.salesperson]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.actionBtn} onPress={openCall}>
                  <Ionicons name="call" size={16} color="#667eea" />
                  <Text style={styles.actionText}>Call</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={openEmail}>
                  <Ionicons name="mail" size={16} color="#667eea" />
                  <Text style={styles.actionText}>Email</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={openWhatsApp}
                >
                  <Ionicons name="logo-whatsapp" size={16} color="#25D366" />
                  <Text style={styles.actionText}>WhatsApp</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionWide]}
                  onPress={openStatement}
                >
                  <Ionicons name="document-text" size={16} color="#667eea" />
                  <Text style={styles.actionText}>Statement</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionWide]}
                  onPress={sendStatement}
                  disabled={sending}
                >
                  <Ionicons name="send" size={16} color="#667eea" />
                  <Text style={styles.actionText}>
                    {sending ? "Sending…" : "Email statement"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {data?.sales && (
            <Section title="Sales">
              <View style={styles.grid}>
                <ExecutiveKpiTile
                  title="Today"
                  value={data.sales.today}
                  currency={currency}
                  compact
                />
                <ExecutiveKpiTile
                  title="MTD"
                  value={data.sales.mtd}
                  currency={currency}
                  compact
                />
                <ExecutiveKpiTile
                  title="YTD"
                  value={data.sales.ytd}
                  previous={data.sales.ytd_ly}
                  changePct={data.sales.growth_pct}
                  currency={currency}
                  compact
                />
                <ExecutiveKpiTile
                  title="GP %"
                  value={data.sales.gp_pct}
                  format="percent"
                  compact
                />
                <ExecutiveKpiTile
                  title="Gross Profit"
                  value={data.sales.gp}
                  currency={currency}
                  compact
                />
                <ExecutiveKpiTile
                  title="Avg Invoice"
                  value={data.sales.avg_invoice}
                  currency={currency}
                  compact
                />
              </View>
              {data.sales.last_invoice_date ? (
                <Text style={styles.hint}>
                  Last invoice {data.sales.last_invoice_date}
                </Text>
              ) : null}
            </Section>
          )}

          {data?.receivables && (
            <Section title="Receivables">
              <View style={styles.grid}>
                <ExecutiveKpiTile
                  title="Outstanding"
                  value={data.receivables.outstanding}
                  currency={currency}
                  valueColor="#059669"
                  compact
                />
                <ExecutiveKpiTile
                  title="Overdue"
                  value={data.receivables.overdue}
                  currency={currency}
                  valueColor="#dc2626"
                  compact
                />
                <ExecutiveKpiTile
                  title="Current"
                  value={data.receivables.current}
                  currency={currency}
                  compact
                />
                <ExecutiveKpiTile
                  title="Avg monthly sales"
                  value={data.receivables.avg_monthly_sales}
                  currency={currency}
                  compact
                />
                <ExecutiveKpiTile
                  title="Avg monthly paid"
                  value={data.receivables.avg_monthly_paid}
                  currency={currency}
                  compact
                />
              </View>
              {data.receivables.oldest_invoice ? (
                <Text style={styles.hint}>
                  Oldest invoice {data.receivables.oldest_invoice}
                </Text>
              ) : null}
              {data.receivables.avg_monthly_paid != null ? (
                <Text style={styles.hint}>
                  Avg monthly paid = collections YTD ÷ months elapsed
                </Text>
              ) : null}
            </Section>
          )}

          {data?.orders && (
            <Section title="Orders">
              <View style={styles.grid}>
                <ExecutiveKpiTile
                  title="Open SO value"
                  value={data.orders.open_so_value}
                  currency={currency}
                  compact
                />
                <ExecutiveKpiTile
                  title="Open SO count"
                  value={data.orders.open_so_count}
                  format="number"
                  compact
                />
                <ExecutiveKpiTile
                  title="Pending delivery"
                  value={data.orders.pending_delivery}
                  currency={currency}
                  compact
                />
                <ExecutiveKpiTile
                  title="Pending billing"
                  value={data.orders.pending_billing}
                  currency={currency}
                  compact
                />
                <ExecutiveKpiTile
                  title="Backorder"
                  value={data.orders.backorder}
                  currency={currency}
                  compact
                />
              </View>
            </Section>
          )}

          {data?.activity && (
            <Section title="Activity">
              <View style={styles.activityCard}>
                <ActivityRow
                  label="Last quotation"
                  value={data.activity.last_quotation}
                />
                <ActivityRow
                  label="Last sales order"
                  value={data.activity.last_sales_order}
                />
                <ActivityRow
                  label="Last delivery"
                  value={data.activity.last_delivery}
                />
                <ActivityRow
                  label="Last invoice"
                  value={data.activity.last_invoice}
                />
                <ActivityRow
                  label="Last payment"
                  value={data.activity.last_payment}
                />
              </View>
            </Section>
          )}

          {data?.charts?.months && data.charts.sales && (
            <Section
              title={
                data.charts.months[0] === "Jan"
                  ? "YTD trend"
                  : data.charts.months.length >= 12
                    ? "12-month trend"
                    : `${data.charts.months.length}-month trend`
              }
            >
              <View style={styles.trendCard}>
                <View style={styles.trendHeaderRow}>
                  <Text
                    style={[styles.trendMonthCol, styles.trendHeaderText]}
                    numberOfLines={1}
                  >
                    Month
                  </Text>
                  <Text
                    style={[styles.trendSalesCol, styles.trendHeaderText]}
                    numberOfLines={1}
                  >
                    Sales
                  </Text>
                  <Text
                    style={[styles.trendPctCol, styles.trendHeaderText]}
                    numberOfLines={1}
                  >
                    % LY
                  </Text>
                  <Text
                    style={[styles.trendCollCol, styles.trendHeaderText]}
                    numberOfLines={1}
                  >
                    Collection
                  </Text>
                </View>
                {(data.charts.months.length > 12
                  ? data.charts.months.slice(-12)
                  : data.charts.months
                ).map((m, i) => {
                  const start =
                    data.charts!.months!.length > 12
                      ? data.charts!.months!.length - 12
                      : 0;
                  const idx = start + i;
                  const sales = data.charts!.sales?.[idx];
                  const coll = data.charts!.collection?.[idx];
                  const growth = data.charts!.sales_growth_pct?.[idx];
                  const dir = changeDirection(growth);
                  return (
                    <View key={`${m}-${idx}`} style={styles.trendRow}>
                      <Text style={styles.trendMonthCol} numberOfLines={1}>
                        {m}
                      </Text>
                      <Text style={styles.trendSalesCol} numberOfLines={1}>
                        {sales == null
                          ? "—"
                          : formatCurrency(sales, currency, { compact: true })}
                      </Text>
                      <View style={styles.trendPctCol}>
                        {growth == null ? (
                          <Text style={styles.trendPctMuted} numberOfLines={1}>
                            —
                          </Text>
                        ) : (
                          <Text
                            style={[
                              styles.trendPctValue,
                              dir === "up" && styles.trendUp,
                              dir === "down" && styles.trendDown,
                            ]}
                            numberOfLines={1}
                          >
                            {dir === "up" ? "▲ " : dir === "down" ? "▼ " : "● "}
                            {formatPercent(growth)}
                          </Text>
                        )}
                      </View>
                      <Text style={styles.trendCollCol} numberOfLines={1}>
                        {coll == null
                          ? "—"
                          : formatCurrency(coll, currency, { compact: true })}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </Section>
          )}
        </ScrollView>
      )}
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  header: {
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
  searchPane: { flex: 1, padding: 16 },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: 15, color: "#111827", padding: 0 },
  territoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#eef2ff",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 12,
  },
  territoryChipText: {
    flex: 1,
    fontSize: 12,
    color: "#4338ca",
    fontWeight: "600",
  },
  hitCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#eef2ff",
  },
  hitIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#eef2ff",
    alignItems: "center",
    justifyContent: "center",
  },
  hitName: { fontSize: 15, fontWeight: "700", color: "#111827" },
  hitMeta: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  body: { padding: 16, paddingBottom: 40 },
  profileCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#eef2ff",
  },
  profileName: { fontSize: 18, fontWeight: "800", color: "#111827" },
  profileMeta: { fontSize: 13, color: "#6b7280", marginTop: 4 },
  actionRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  actionWide: { flex: 1, justifyContent: "center" },
  actionText: { fontSize: 12, fontWeight: "700", color: "#374151" },
  section: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1f2937",
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
    marginBottom: 10,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  hint: { marginTop: 8, fontSize: 12, color: "#9ca3af" },
  activityCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#eef2ff",
  },
  activityRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e7eb",
  },
  activityLabel: { fontSize: 13, color: "#6b7280" },
  activityValue: { fontSize: 13, fontWeight: "700", color: "#111827" },
  trendCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#eef2ff",
  },
  trendHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 8,
    marginBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e7eb",
  },
  trendHeaderText: {
    fontWeight: "700",
    color: "#6b7280",
    fontSize: 10,
    textTransform: "uppercase",
  },
  trendRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 7,
  },
  trendMonthCol: {
    width: 42,
    fontSize: 12,
    fontWeight: "700",
    color: "#6b7280",
  },
  trendSalesCol: {
    flex: 1.1,
    minWidth: 0,
    paddingRight: 4,
    fontSize: 12,
    fontWeight: "600",
    color: "#111827",
  },
  trendPctCol: {
    width: 78,
    paddingRight: 4,
    alignItems: "flex-end",
    justifyContent: "center",
    fontSize: 10,
    fontWeight: "700",
    color: "#6b7280",
    textAlign: "right",
  },
  trendCollCol: {
    flex: 1.1,
    minWidth: 0,
    fontSize: 12,
    fontWeight: "600",
    color: "#111827",
    textAlign: "right",
  },
  trendPctValue: {
    fontSize: 10,
    fontWeight: "700",
    color: "#6b7280",
    textAlign: "right",
  },
  trendPctMuted: {
    fontSize: 12,
    fontWeight: "600",
    color: "#9ca3af",
    textAlign: "right",
  },
  trendUp: { color: "#059669" },
  trendDown: { color: "#dc2626" },
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
});
