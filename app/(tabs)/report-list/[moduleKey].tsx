/**
 * Generic report_list screen — config.api_method comes from bootstrap only.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  SafeScreen,
  systemStatusBarClearance,
  useSafeScreenInsets,
} from "../../../src/components/SafeScreen";
import { TouchableOpacity } from "react-native";
import { useBootstrapStore } from "../../../src/store/bootstrap";
import {
  fetchReportList,
  type MyReportRow,
} from "../../../src/api/myReports";
import { Fonts, Type } from "../../../src/theme/typography";
import { ScreenHeaderNav } from "../../../src/components/ScreenHeaderNav";

export default function ReportListScreen() {
  const insets = useSafeAreaInsets();
  const { scrollPaddingBottom } = useSafeScreenInsets({ aboveTabBar: true });
  const { moduleKey: rawKey } = useLocalSearchParams<{ moduleKey: string }>();
  const moduleKey = decodeURIComponent(String(rawKey || ""));
  const bootstrap = useBootstrapStore((s) => s.bootstrap);

  const mod = useMemo(
    () =>
      bootstrap?.modules?.find(
        (m) => m.key === moduleKey || m.route_key === moduleKey
      ) || null,
    [bootstrap, moduleKey]
  );

  const [rows, setRows] = useState<MyReportRow[]>([]);
  const [company, setCompany] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!mod) {
        setLoading(false);
        setError("Module not found in bootstrap");
        return;
      }
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const data = await fetchReportList(mod.config);
        setRows(data.reports);
        setCompany(data.company);
      } catch (e: any) {
        const status = e?.response?.status;
        const msg =
          status === 403
            ? "No access to this module"
            : e?.message || "Failed to load reports";
        setError(msg);
        setRows([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [mod]
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  const title = mod?.label || moduleKey || "Reports";
  const subtitle = mod?.subtitle || undefined;

  return (
    <SafeScreen aboveTabBar includeTop={false} style={styles.container}>
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
        {company ? (
          <Text style={styles.company} numberOfLines={1}>
            {company}
          </Text>
        ) : null}
      </LinearGradient>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#667eea" />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: scrollPaddingBottom },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void load(true)}
              tintColor="#667eea"
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons
                name={error ? "lock-closed-outline" : "document-text-outline"}
                size={36}
                color="#94a3b8"
              />
              <Text style={styles.emptyTitle}>
                {error || "No reports available"}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={styles.rowTitle}>{item.title}</Text>
              <Text style={styles.rowSub}>
                {[item.module, item.ref_doctype].filter(Boolean).join(" · ")}
              </Text>
            </View>
          )}
        />
      )}
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
  backBtn: {
    padding: 4,
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
  company: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 12,
    marginTop: 8,
    marginLeft: 36,
    fontFamily: Fonts.body,
  },
  list: {
    paddingTop: 8,
  },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#eef2ff",
    backgroundColor: "#fff",
  },
  rowTitle: {
    ...Type.cardTitle,
    color: "#0f172a",
  },
  rowSub: {
    ...Type.caption,
    color: "#64748b",
    marginTop: 4,
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
});
