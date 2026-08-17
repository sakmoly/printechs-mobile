/**
 * Desk feature_key: board_tabs:sales_overview,sales_performance,sales_trends
 * Renders Sales Dashboard chrome (header chips + segmented tabs) with one
 * Access Profile board per tab — not the plain dashboard-board list UI.
 */

import React, { useMemo, useRef, useState } from "react";
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
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBootstrapStore } from "../../src/store/bootstrap";
import { useAuthStore } from "../../src/store/auth";
import { isModuleEnabled } from "../../src/api/mobileConfig";
import { resolveCompanyName } from "../../src/api/apiResilience";
import {
  DashboardWidgets,
  type DashboardWidgetsHandle,
} from "../../src/widgets";
import { resolveBoardTabIds } from "../../src/modules/resolveHubItems";
import { defaultPeriod } from "../../src/utils/period";
import { SafeScreen } from "../../src/components/SafeScreen";
import { Fonts, Type } from "../../src/theme/typography";

type TabMeta = {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
};

function tabMetaFor(boardId: string): TabMeta {
  const id = String(boardId || "").trim();
  const lower = id.toLowerCase();
  if (/overview/.test(lower)) {
    return { id, label: "Overview", icon: "pie-chart" };
  }
  if (/performance/.test(lower)) {
    return { id, label: "Performance", icon: "bar-chart" };
  }
  if (/trend/.test(lower)) {
    return { id, label: "Trends", icon: "trending-up" };
  }
  const label = id
    .replace(/^sales[_-]?/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim() || id;
  return { id, label, icon: "grid-outline" };
}

export default function BoardTabsScreen() {
  const insets = useSafeAreaInsets();
  const { moduleKey: rawKey } = useLocalSearchParams<{ moduleKey: string }>();
  const moduleKey = decodeURIComponent(String(rawKey || "")).trim();
  const bootstrap = useBootstrapStore((s) => s.bootstrap);
  const mobileConfig = useAuthStore((s) => s.mobileConfig);
  const permissions = useAuthStore((s) => s.permissions);
  const user = useAuthStore((s) => s.user);
  const boardRef = useRef<DashboardWidgetsHandle | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const mod = useMemo(
    () =>
      bootstrap?.modules?.find(
        (m) => m.key === moduleKey || m.route_key === moduleKey
      ) || null,
    [bootstrap, moduleKey]
  );

  const tabs = useMemo(() => {
    const ids = resolveBoardTabIds(mod || { key: moduleKey, route_key: moduleKey, feature_key: null });
    if (ids.length) return ids.map(tabMetaFor);
    const fallback = String(
      mod?.config?.dashboard_id || mod?.route_key || mod?.key || moduleKey || ""
    ).trim();
    return fallback ? [tabMetaFor(fallback)] : [];
  }, [mod, moduleKey]);

  const [activeTabId, setActiveTabId] = useState<string>("");
  const resolvedActive =
    tabs.find((t) => t.id === activeTabId)?.id || tabs[0]?.id || "";

  const period = useMemo(() => defaultPeriod(), []);
  const company = resolveCompanyName(
    permissions.scope?.company,
    user?.company
  );

  const showSalesperson = isModuleEnabled(mobileConfig, "salesperson");
  const showProduct = isModuleEnabled(mobileConfig, "product_performance");

  const title = mod?.label || "Sales Dashboard";
  const subtitle =
    (mod?.subtitle && String(mod.subtitle).trim()) ||
    "Year-to-Date vs Last Year";

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await boardRef.current?.refreshBoard?.();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <SafeScreen style={styles.container}>
      <LinearGradient
        colors={["#667eea", "#764ba2"]}
        style={[
          styles.header,
          {
            paddingTop: Math.max(
              insets.top,
              Platform.OS === "ios" ? 52 : 36
            ),
          },
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#ffffff" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          </View>
          <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
            <Ionicons name="refresh-outline" size={24} color="#ffffff" />
          </TouchableOpacity>
        </View>

        {(showSalesperson || showProduct) && (
          <View style={styles.phaseLinks}>
            {showSalesperson ? (
              <TouchableOpacity
                style={styles.phaseChip}
                onPress={() => router.push("/salesperson-performance")}
              >
                <Ionicons name="people-outline" size={16} color="#667eea" />
                <Text style={styles.phaseChipText}>Salespersons</Text>
              </TouchableOpacity>
            ) : null}
            {showProduct ? (
              <TouchableOpacity
                style={styles.phaseChip}
                onPress={() => router.push("/product-performance")}
              >
                <Ionicons name="cube-outline" size={16} color="#667eea" />
                <Text style={styles.phaseChipText}>Products</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}

        {tabs.length > 0 ? (
          <View style={styles.tabContainer}>
            {tabs.map((tab) => {
              const active = tab.id === resolvedActive;
              return (
                <TouchableOpacity
                  key={tab.id}
                  style={[styles.tab, active && styles.activeTab]}
                  onPress={() => setActiveTabId(tab.id)}
                >
                  <Ionicons
                    name={tab.icon}
                    size={18}
                    color={active ? "#667eea" : "#ffffff"}
                  />
                  <Text
                    style={[styles.tabText, active && styles.activeTabText]}
                    numberOfLines={1}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}
      </LinearGradient>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#667eea"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {resolvedActive ? (
          <DashboardWidgets
            key={resolvedActive}
            boardKey={resolvedActive}
            boardRef={boardRef}
            company={company}
            from_date={period.from_date}
            to_date={period.to_date}
            period={period.preset}
            hideTitle
            hideBoardTitle
            hideLinkWidgets
            limit={24}
          />
        ) : (
          <Text style={styles.empty}>
            No board tabs configured. Set Feature Key to
            board_tabs:sales_overview,sales_performance,sales_trends
          </Text>
        )}
      </ScrollView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: "#667eea",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 8,
  },
  headerTitle: {
    ...Type.screenTitle,
    color: "#ffffff",
    fontFamily: Fonts.display,
  },
  headerSubtitle: {
    ...Type.caption,
    color: "rgba(255, 255, 255, 0.85)",
    marginTop: 2,
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  phaseLinks: {
    flexDirection: "row",
    gap: 8,
    paddingBottom: 12,
  },
  phaseChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  phaseChipText: {
    color: "#667eea",
    fontWeight: "700",
    fontSize: 13,
    fontFamily: Fonts.bodySemi,
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 16,
    padding: 4,
    gap: 6,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 12,
  },
  activeTab: {
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  tabText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#ffffff",
    fontFamily: Fonts.bodySemi,
  },
  activeTabText: {
    color: "#667eea",
  },
  content: {
    flex: 1,
  },
  contentInner: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },
  empty: {
    color: "#64748b",
    fontSize: 14,
    textAlign: "center",
    marginTop: 24,
    paddingHorizontal: 24,
  },
});
