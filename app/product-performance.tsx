import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { PeriodSelector } from "../src/components/PeriodSelector";
import { RankingCard, currencyMetric } from "../src/components/RankingCard";
import { LoadingScreen } from "../src/components/LoadingScreen";
import { useProductPerformance } from "../src/hooks/useSalesPerformance";
import { useAuthStore } from "../src/store/auth";
import { isModuleEnabled, isDimensionEnabled } from "../src/api/mobileConfig";
import { resolveCompanyName } from "../src/api/apiResilience";
import {
  defaultPeriod,
  resolvePeriod,
  type DateRange,
  type PeriodPreset,
} from "../src/utils/period";
import { formatCurrency } from "../src/utils/currency";
import type { ProductLevel } from "../src/api/salesPerformanceTypes";
import { SafeScreen } from "../src/components/SafeScreen";
import { Type } from "../src/theme/typography";

type Crumb = {
  level: ProductLevel;
  id?: string;
  name?: string;
};

const LEVEL_FLOW: ProductLevel[] = [
  "division",
  "brand",
  "item_group",
  "item",
];

function nextLevel(level: ProductLevel): ProductLevel | null {
  const i = LEVEL_FLOW.indexOf(level);
  if (i < 0 || i >= LEVEL_FLOW.length - 1) return null;
  return LEVEL_FLOW[i + 1];
}

export default function ProductPerformanceScreen() {
  const mobileConfig = useAuthStore((s) => s.mobileConfig);
  const user = useAuthStore((s) => s.user);
  const permissions = useAuthStore((s) => s.permissions);
  const company = resolveCompanyName(
    permissions.scope?.company,
    user?.company
  );
  const enabled = isModuleEnabled(mobileConfig, "product_performance");
  const showDivision = isDimensionEnabled(mobileConfig, "division");
  const showBrand = isDimensionEnabled(mobileConfig, "brand");

  const startLevel: ProductLevel = showDivision
    ? "division"
    : showBrand
      ? "brand"
      : "item_group";

  const [period, setPeriod] = useState<DateRange>(() => defaultPeriod());
  const [stack, setStack] = useState<Crumb[]>([{ level: startLevel }]);
  const [refreshing, setRefreshing] = useState(false);

  const current = stack[stack.length - 1];
  const params = useMemo(() => {
    const p: Record<string, string | undefined> = {
      company,
      from_date: period.from_date,
      to_date: period.to_date,
      period: period.preset,
      level: current.level,
    };
    for (const c of stack) {
      if (!c.id) continue;
      if (c.level === "division") p.division = c.id;
      if (c.level === "brand") p.brand = c.id;
      if (c.level === "item_group") p.item_group = c.id;
      if (c.level === "item") p.item_code = c.id;
    }
    return p;
  }, [stack, period, company, current.level]);

  const { data, isLoading, error, refetch } = useProductPerformance(params as any, {
    enabled,
  });

  const currency = data?.meta.currency || "SAR";
  const rows = data?.rows || [];
  const metricsIncomplete =
    rows.length > 0 &&
    rows.every(
      (r) =>
        r.gp == null &&
        r.gp_pct == null &&
        r.customer_count == null &&
        r.sales_ly == null
    );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const goBack = () => {
    if (stack.length > 1) {
      setStack((s) => s.slice(0, -1));
    } else {
      router.back();
    }
  };

  const drillInto = (id: string, name: string) => {
    const nxt = nextLevel(current.level);
    if (!nxt) return;
    if (nxt === "brand" && !showBrand) {
      // skip brand if disabled
      const after = nextLevel("brand");
      if (!after) return;
      setStack((s) => [
        ...s.slice(0, -1),
        { ...current, id, name },
        { level: after },
      ]);
      return;
    }
    setStack((s) => [
      ...s.slice(0, -1),
      { ...current, id, name },
      { level: nxt },
    ]);
  };

  if (!enabled) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Product performance is disabled for this site.</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.link}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isLoading && !data) {
    return <LoadingScreen message="Loading product performance..." />;
  }

  const crumbLabel = stack
    .map((c) => c.name || c.level.replace("_", " "))
    .join(" → ");

  return (
    <SafeScreen style={styles.container}>
      <LinearGradient colors={["#667eea", "#764ba2"]} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={goBack} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Product Performance</Text>
            <Text style={styles.headerSub} numberOfLines={1}>
              {crumbLabel}
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
            setStack([{ level: startLevel }]);
          }}
        />

        {error && (
          <Text style={styles.error}>
            {(error as Error).message || "Failed to load"}
          </Text>
        )}

        {metricsIncomplete && (
          <Text style={styles.hintBanner}>
            Backend returns sales, qty, and invoices only. GP, customers, and
            vs LY need fields on get_product_performance (see API contract).
            ASP is derived from sales ÷ qty when possible.
          </Text>
        )}

        {rows.map((row, idx) => {
          const canDrill = nextLevel(current.level) != null;
          const subtitleParts: string[] = [];
          if (row.invoice_count != null)
            subtitleParts.push(`${row.invoice_count} invoices`);
          if (row.qty != null)
            subtitleParts.push(`Qty ${Number(row.qty).toLocaleString()}`);
          return (
            <RankingCard
              key={`${row.id || row.name || "row"}-${idx}`}
              rank={idx + 1}
              title={row.name}
              subtitle={
                subtitleParts.length ? subtitleParts.join(" · ") : undefined
              }
              primary={formatCurrency(row.sales, currency, { compact: true })}
              changePct={row.growth_pct}
              metrics={[
                currencyMetric("GP", row.gp, currency),
                {
                  label: "GP %",
                  value:
                    row.gp_pct == null
                      ? "—"
                      : `${Number(row.gp_pct).toFixed(1)}%`,
                },
                {
                  label: "Invoices",
                  value:
                    row.invoice_count == null
                      ? "—"
                      : String(row.invoice_count),
                },
                {
                  label: "Customers",
                  value:
                    row.customer_count == null
                      ? "—"
                      : String(row.customer_count),
                },
                {
                  label: "vs LY",
                  value:
                    row.sales_ly == null
                      ? "—"
                      : formatCurrency(row.sales_ly, currency, {
                          compact: true,
                        }),
                },
                {
                  label: "ASP",
                  value:
                    row.asp == null
                      ? "—"
                      : formatCurrency(row.asp, currency, { compact: true }),
                },
              ]}
              onPress={
                canDrill ? () => drillInto(row.id, row.name) : undefined
              }
            />
          );
        })}

        {rows.length === 0 && !isLoading && (
          <Text style={styles.muted}>No product data for this level.</Text>
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
});
