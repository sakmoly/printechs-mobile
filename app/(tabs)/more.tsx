import React, { useCallback, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore } from "../../src/store/auth";
import { useBootstrapStore } from "../../src/store/bootstrap";
import { clearMyAccessCache } from "../../src/api/permissions";
import { useNavigation } from "../../src/hooks/useNavigation";
import { groupHubItemsBySection } from "../../src/modules/resolveHubItems";
import { openHubItem } from "../../src/modules/moduleRouter";
import { supportsDynamicModules } from "../../src/types/bootstrap";
import { logger } from "../../src/utils/logger";

export default function MoreScreen() {
  const insets = useSafeAreaInsets();
  const loadPermissions = useAuthStore((s) => s.loadPermissions);
  const bootstrap = useBootstrapStore((s) => s.bootstrap);
  const {
    modules: items,
    branding,
    businessType,
  } = useNavigation();

  useFocusEffect(
    useCallback(() => {
      if (!useAuthStore.getState().isAuthenticated) return;
      void (async () => {
        try {
          await clearMyAccessCache();
        } catch {
          /* optional */
        }
        await Promise.all([
          loadPermissions(),
          useBootstrapStore.getState().refresh(),
        ]);
      })();
    }, [loadPermissions])
  );

  useEffect(() => {
    if (!__DEV__) return;
    const mods = bootstrap?.modules || [];
    logger.info("[more-hub]", {
      schema_version: bootstrap?.schema_version,
      dynamic: supportsDynamicModules(bootstrap),
      source: bootstrap?.source,
      bootstrapModules: mods.map(
        (m) => `${m.key}|${m.screen_type || "module"}|en=${m.enabled}`
      ),
      hubItems: items.map((i) => `${i.key}|${i.screenType}`),
    });
  }, [bootstrap, items]);

  const grouped = useMemo(() => groupHubItemsBySection(items), [items]);

  const empty = items.length === 0;
  const subtitle =
    branding.appSubtitle ||
    (businessType && businessType !== "B2B"
      ? `${String(businessType).replace(/_/g, " ")} · dashboards by area`
      : "Dashboards grouped by business area");

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#667eea", "#764ba2"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.header,
          { paddingTop: Math.max(insets.top, Platform.OS === "ios" ? 52 : 36) },
        ]}
      >
        <Text style={styles.headerTitle}>More</Text>
        <Text style={styles.headerSub}>{subtitle}</Text>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={[
          styles.list,
          { paddingBottom: 24 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {empty ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="lock-closed-outline" size={36} color="#94a3b8" />
            <Text style={styles.emptyTitle}>No dashboards available</Text>
            <Text style={styles.emptySub}>
              Your Access Profile does not allow any More menu items. Ask an
              administrator to enable Can View on the relevant Access Objects.
            </Text>
          </View>
        ) : (
          grouped.map((sec) => (
            <View key={`section-${sec.id}`} style={styles.sectionBlock}>
              <Text style={styles.sectionLabel}>{sec.label}</Text>
              <View style={styles.grid}>
                {sec.items.map((item) => (
                  <TouchableOpacity
                    key={`hub-${item.id}-${item.key}`}
                    style={styles.card}
                    activeOpacity={0.85}
                    onPress={() => openHubItem(item)}
                  >
                    <View
                      style={[
                        styles.iconWrap,
                        { backgroundColor: `${item.color}18` },
                      ]}
                    >
                      <Ionicons name={item.icon} size={22} color={item.color} />
                    </View>
                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={styles.cardSub} numberOfLines={2}>
                      {item.subtitle}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  header: {
    paddingBottom: 18,
    paddingHorizontal: 20,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "800",
  },
  headerSub: {
    color: "rgba(255,255,255,0.88)",
    fontSize: 14,
    marginTop: 4,
  },
  list: {
    padding: 16,
  },
  sectionBlock: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 10,
    marginLeft: 2,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -5,
  },
  card: {
    width: "47%",
    flexGrow: 1,
    maxWidth: "48.5%",
    minWidth: "45%",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#eef2ff",
    marginHorizontal: 5,
    marginBottom: 10,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 2,
  },
  cardSub: {
    fontSize: 11,
    color: "#6b7280",
    lineHeight: 15,
  },
  emptyWrap: {
    alignItems: "center",
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: "800",
    color: "#334155",
    textAlign: "center",
  },
  emptySub: {
    marginTop: 8,
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 19,
  },
});
