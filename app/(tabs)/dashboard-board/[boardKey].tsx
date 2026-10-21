/**
 * Option A — screen_type: dashboard
 * Renders one Access Profile board by key (config.dashboard_id || module key).
 */

import React, { useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  RefreshControl,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBootstrapStore } from "../../../src/store/bootstrap";
import { useAuthStore } from "../../../src/store/auth";
import {
  DashboardWidgets,
  type DashboardWidgetsHandle,
} from "../../../src/widgets";
import { defaultPeriod } from "../../../src/utils/period";
import { resolveCompanyName } from "../../../src/api/apiResilience";
import { Fonts } from "../../../src/theme/typography";
import {
  SafeScreen,
  systemStatusBarClearance,
} from "../../../src/components/SafeScreen";
import { ScreenHeaderNav } from "../../../src/components/ScreenHeaderNav";
import { ReceivablesDashboardScreen } from "../../../src/screens/receivables/ReceivablesDashboardScreen";
import { SalesDashboardScreen } from "../../../src/screens/sales/SalesDashboardScreen";
import { InventoryDashboardScreen } from "../../../src/screens/inventory/InventoryDashboardScreen";
import { VatDashboardScreen } from "../../../src/screens/vat/VatDashboardScreen";

function normalizeBoardKey(boardKey: string): string {
  return String(boardKey || "")
    .trim()
    .toLowerCase()
    .replace(/__\d+$/i, "");
}

function isReceivablesOverviewBoard(boardKey: string): boolean {
  const k = normalizeBoardKey(boardKey);
  return k === "receivables_overview" || k === "receivables";
}

function isSalesOverviewBoard(boardKey: string): boolean {
  const k = normalizeBoardKey(boardKey);
  return k === "sales_overview" || k === "sales";
}

function isInventoryOverviewBoard(boardKey: string): boolean {
  const k = normalizeBoardKey(boardKey);
  return k === "inventory_overview" || k === "inventory";
}

function isVatOverviewBoard(boardKey: string): boolean {
  const k = normalizeBoardKey(boardKey);
  return (
    k === "vat_overview" ||
    k === "vat" ||
    k === "vat_dashboard" ||
    k === "vat_report"
  );
}

export default function DashboardBoardScreen() {
  const insets = useSafeAreaInsets();
  const { boardKey: rawKey } = useLocalSearchParams<{ boardKey: string }>();
  const boardKey = decodeURIComponent(String(rawKey || "")).trim();
  const bootstrap = useBootstrapStore((s) => s.bootstrap);
  const permissions = useAuthStore((s) => s.permissions);
  const user = useAuthStore((s) => s.user);
  const boardRef = useRef<DashboardWidgetsHandle | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const mod = useMemo(
    () =>
      bootstrap?.modules?.find(
        (m) => m.key === boardKey || m.route_key === boardKey
      ) || null,
    [bootstrap, boardKey]
  );

  const resolvedBoardKey = useMemo(() => {
    const fromConfig = mod?.config?.dashboard_id;
    if (fromConfig != null && String(fromConfig).trim()) {
      return String(fromConfig).trim();
    }
    return boardKey;
  }, [mod, boardKey]);

  const period = useMemo(() => defaultPeriod(), []);
  const company = resolveCompanyName(
    permissions.scope?.company,
    user?.company
  );

  if (isReceivablesOverviewBoard(resolvedBoardKey)) {
    return <ReceivablesDashboardScreen />;
  }

  if (isSalesOverviewBoard(resolvedBoardKey)) {
    return <SalesDashboardScreen />;
  }

  if (isInventoryOverviewBoard(resolvedBoardKey)) {
    return <InventoryDashboardScreen />;
  }

  if (isVatOverviewBoard(resolvedBoardKey)) {
    return <VatDashboardScreen />;
  }

  const title =
    mod?.label ||
    bootstrap?.dashboards?.find((b) => b.key === resolvedBoardKey)?.title ||
    boardKey ||
    "Dashboard";
  const subtitle = mod?.subtitle || undefined;

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await boardRef.current?.refreshBoard?.();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <SafeScreen aboveTabBar includeTop={false} style={styles.container} bottomExtra={0}>
      <LinearGradient
        colors={["#667eea", "#764ba2"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.header,
          {
            paddingTop: systemStatusBarClearance(
              insets.top,
              Platform.OS === "ios" ? 12 : 10
            ),
          },
        ]}
      >
        <View style={styles.headerRow}>
          <ScreenHeaderNav />
          <View style={styles.headerText}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={styles.headerSub} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#667eea"
            colors={["#667eea", "#764ba2"]}
          />
        }
      >
        <DashboardWidgets
          boardRef={boardRef}
          boardKey={resolvedBoardKey}
          company={company}
          from_date={period.from_date}
          to_date={period.to_date}
          period={period.preset}
          limit={24}
          hideTitle
          hideBoardTitle
          title=""
        />
        {!bootstrap?.dashboards?.some(
          (b) =>
            String(b.key || "").toLowerCase() ===
            resolvedBoardKey.toLowerCase()
        ) &&
        !(bootstrap?.dashboards || []).some((b) =>
          (b.widgets || []).some((w) => {
            const k = String(w.key || "").toLowerCase();
            const id = resolvedBoardKey.toLowerCase();
            return k === id || k.startsWith(`${id}_`);
          })
        ) ? (
          <View style={styles.empty}>
            <Ionicons name="grid-outline" size={36} color="#94a3b8" />
            <Text style={styles.emptyTitle}>No widgets on this board</Text>
            <Text style={styles.emptySub}>
              Add widgets to dashboard “{resolvedBoardKey}” in the Mobile App
              Profile.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  header: {
    paddingBottom: 14,
    paddingHorizontal: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerText: { flex: 1, minWidth: 0 },
  headerTitle: {
    color: "#fff",
    fontSize: 22,
    fontFamily: Fonts.display,
  },
  headerSub: {
    color: "rgba(255,255,255,0.88)",
    fontSize: 13,
    marginTop: 2,
    fontFamily: Fonts.body,
  },
  body: {
    padding: 16,
    paddingBottom: 28,
  },
  empty: {
    alignItems: "center",
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 15,
    fontFamily: Fonts.bodySemi,
    color: "#64748b",
    textAlign: "center",
  },
  emptySub: {
    marginTop: 8,
    fontSize: 13,
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: 19,
  },
});
