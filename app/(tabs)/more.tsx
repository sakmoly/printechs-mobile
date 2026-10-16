import React, { useCallback, useMemo, useState } from "react";
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
import { useNavigation } from "../../src/hooks/useNavigation";
import {
  groupHubItemsByFamily,
  shortHubChipLabel,
  type MoreMenuFamily,
  type ResolvedHubItem,
} from "../../src/modules/resolveHubItems";
import { openHubItem } from "../../src/modules/moduleRouter";
import { Fonts, Type } from "../../src/theme/typography";
import {
  SafeScreen,
  systemStatusBarClearance,
  useSafeScreenInsets,
} from "../../src/components/SafeScreen";

export default function MoreScreen() {
  const insets = useSafeAreaInsets();
  const { scrollPaddingBottom } = useSafeScreenInsets({ aboveTabBar: true });
  const loadPermissions = useAuthStore((s) => s.loadPermissions);
  const {
    modules: items,
    branding,
    businessType,
  } = useNavigation();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeByFamily, setActiveByFamily] = useState<Record<string, string>>(
    {}
  );

  useFocusEffect(
    useCallback(() => {
      if (!useAuthStore.getState().isAuthenticated) return;
      void Promise.all([
        loadPermissions(),
        useBootstrapStore.getState().refresh(),
      ]);
    }, [loadPermissions])
  );

  const families = useMemo(() => groupHubItemsByFamily(items), [items]);

  const empty = families.length === 0;
  const subtitle =
    branding.appSubtitle ||
    (businessType && businessType !== "B2B"
      ? `${String(businessType).replace(/_/g, " ")} · pick an area`
      : "Tap a group to open boards");

  const openChip = (family: MoreMenuFamily, item: ResolvedHubItem) => {
    setActiveByFamily((prev) => ({ ...prev, [family.id]: item.key }));
    openHubItem(item);
  };

  const onFamilyPress = (family: MoreMenuFamily) => {
    // Always expand/collapse so Inventory / Collection / etc. show boards
    // (Sales has many chips; others often have a single Overview board).
    setExpandedId((prev) => (prev === family.id ? null : family.id));
  };

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
        <Text style={styles.headerTitle}>More</Text>
        <Text style={styles.headerSub}>{subtitle}</Text>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={[
          styles.list,
          { paddingBottom: scrollPaddingBottom },
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
          families.map((family) => {
            const expanded = expandedId === family.id;
            const activeKey =
              activeByFamily[family.id] || family.primary.key;
            const chipCount = family.chips.length;

            return (
              <View key={family.id} style={styles.familyCard}>
                <TouchableOpacity
                  activeOpacity={0.88}
                  onPress={() => onFamilyPress(family)}
                  onLongPress={() => openChip(family, family.primary)}
                  style={styles.familyHeader}
                >
                  <View
                    style={[
                      styles.familyIcon,
                      { backgroundColor: `${family.color}18` },
                    ]}
                  >
                    <Ionicons
                      name={family.icon}
                      size={20}
                      color={family.color}
                    />
                  </View>
                  <View style={styles.familyText}>
                    <Text style={styles.familyTitle} numberOfLines={1}>
                      {family.title}
                    </Text>
                    <Text style={styles.familySub} numberOfLines={1}>
                      {chipCount > 1
                        ? `${chipCount} boards · ${family.subtitle}`
                        : family.subtitle}
                    </Text>
                  </View>
                  <Ionicons
                    name={expanded ? "chevron-up" : "chevron-down"}
                    size={16}
                    color="#94a3b8"
                  />
                </TouchableOpacity>

                {expanded ? (
                  <View style={styles.segment}>
                    {family.chips.map((chip) => {
                      const active = chip.key === activeKey;
                      return (
                        <TouchableOpacity
                          key={`tab-${family.id}-${chip.key}`}
                          style={[
                            styles.segmentTab,
                            active && styles.segmentTabActive,
                            chipCount === 1 && styles.segmentTabSingle,
                          ]}
                          activeOpacity={0.85}
                          onPress={() => openChip(family, chip)}
                        >
                          <View
                            style={[
                              styles.chipIconWrap,
                              {
                                backgroundColor: active
                                  ? `${family.color}22`
                                  : "#ffffff",
                              },
                            ]}
                          >
                            <Ionicons
                              name={chip.icon}
                              size={15}
                              color={active ? family.color : "#64748b"}
                            />
                          </View>
                          <Text
                            style={[
                              styles.segmentText,
                              active && { color: family.color },
                            ]}
                            numberOfLines={1}
                          >
                            {chipCount === 1
                              ? family.title
                              : shortHubChipLabel(chip)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  header: {
    paddingBottom: 18,
    paddingHorizontal: 20,
  },
  headerTitle: {
    ...Type.hero,
    color: "#fff",
    fontFamily: Fonts.displayExtra,
  },
  headerSub: {
    ...Type.caption,
    color: "rgba(255,255,255,0.88)",
    marginTop: 4,
    fontSize: 14,
  },
  list: {
    padding: 16,
    gap: 10,
  },
  familyCard: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#eef2ff",
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  familyHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  familyIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  familyText: { flex: 1, minWidth: 0 },
  familyTitle: {
    fontFamily: Fonts.bodyBold,
    fontSize: 15,
    color: "#111827",
  },
  familySub: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
    lineHeight: 16,
  },
  segment: {
    flexDirection: "row",
    flexWrap: "wrap",
    backgroundColor: "#f1f5f9",
    borderRadius: 12,
    padding: 6,
    gap: 6,
    marginTop: 10,
  },
  segmentTab: {
    flexGrow: 1,
    flexBasis: "30%",
    minWidth: "28%",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 10,
  },
  segmentTabSingle: {
    flexBasis: "100%",
    minWidth: "100%",
    flexDirection: "row",
    justifyContent: "flex-start",
    paddingHorizontal: 12,
    gap: 10,
  },
  segmentTabActive: {
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  chipIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e2e8f0",
  },
  segmentText: {
    fontFamily: Fonts.bodySemi,
    fontSize: 11,
    color: "#64748b",
    textAlign: "center",
  },
  emptyWrap: {
    alignItems: "center",
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 16,
    fontFamily: Fonts.display,
    color: "#334155",
    textAlign: "center",
  },
  emptySub: {
    marginTop: 8,
    fontSize: 13,
    fontFamily: Fonts.body,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 19,
  },
});
