import { Tabs, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Platform, View, StyleSheet } from "react-native";
import { useMemo } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore } from "../../src/store/auth";
import { useBootstrapStore } from "../../src/store/bootstrap";
import { resolveTabVisibility } from "../../src/modules/resolveTabs";
import { useBackgroundDashboardPrefetch } from "../../src/hooks/useBackgroundDashboardPrefetch";
import { useNavigation } from "../../src/hooks/useNavigation";
import { systemHomeClearance } from "../../src/components/SafeScreen";

const ACCENT = "#667eea";
const INACTIVE = "#94a3b8";
const TAB_CONTENT_HEIGHT = 52;

function TabIcon({
  name,
  color,
  focused,
}: {
  name: keyof typeof Ionicons.glyphMap;
  color: string;
  focused: boolean;
}) {
  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <Ionicons name={name} size={focused ? 22 : 20} color={color} />
    </View>
  );
}

/** Hide from tab bar but keep navigator mounted so the bar stays visible. */
const HIDDEN_TAB = { href: null as null };

export default function TabsLayout() {
  const permissions = useAuthStore((s) => s.permissions);
  const moduleMap = useBootstrapStore((s) => s.moduleMap);
  const loaded = useBootstrapStore((s) => s.loaded);
  const { moduleLabel } = useNavigation();
  const insets = useSafeAreaInsets();
  useBackgroundDashboardPrefetch();

  const tabs = useMemo(
    () => resolveTabVisibility(permissions),
    [permissions, moduleMap, loaded]
  );

  const tabBarPaddingBottom = systemHomeClearance(insets.bottom, 6);
  const tabBarHeight = TAB_CONTENT_HEIGHT + tabBarPaddingBottom;

  return (
    <Tabs
      // Default (esp. Android) is firstRoute → Home. Board screens live as
      // sibling tabs, so Back must follow visit history (e.g. More → board).
      backBehavior="history"
      safeAreaInsets={{ bottom: 0 }}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ACCENT,
        tabBarInactiveTintColor: INACTIVE,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: "#ffffff",
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: "#e2e8f0",
          paddingTop: 4,
          paddingBottom: tabBarPaddingBottom,
          height: tabBarHeight,
          elevation: 16,
          shadowColor: "#0f172a",
          shadowOpacity: 0.1,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: -4 },
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700",
          marginBottom: 0,
        },
        tabBarItemStyle: {
          paddingTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          href: "/(tabs)",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name={focused ? "home" : "home-outline"}
              color={color}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="approvals"
        options={{
          title: moduleLabel("approvals", "Approvals"),
          href: tabs.approvals ? "/(tabs)/approvals" : null,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name={focused ? "checkmark-circle" : "checkmark-circle-outline"}
              color={color}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "More",
          href: tabs.more ? "/(tabs)/more" : null,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name={focused ? "grid" : "grid-outline"}
              color={color}
              focused={focused}
            />
          ),
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            router.navigate("/(tabs)/more");
          },
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: moduleLabel("settings", "Settings"),
          href: tabs.settings ? "/(tabs)/settings" : null,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name={focused ? "settings" : "settings-outline"}
              color={color}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="employees"
        options={{
          href: null,
          title: moduleLabel("employees", "Employees"),
        }}
      />
      <Tabs.Screen
        name="ecatalogue"
        options={{
          href: tabs.catalogue ? "/(tabs)/ecatalogue" : null,
          title: moduleLabel("catalogue", "Catalogue"),
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name={focused ? "book" : "book-outline"}
              color={color}
              focused={focused}
            />
          ),
        }}
      />

      {/* Stack-style screens — tab bar stays visible */}
      <Tabs.Screen name="dashboard-board/[boardKey]" options={HIDDEN_TAB} />
      <Tabs.Screen name="board-tabs/[moduleKey]" options={HIDDEN_TAB} />
      <Tabs.Screen name="report-list/[moduleKey]" options={HIDDEN_TAB} />
      <Tabs.Screen name="customer-360" options={HIDDEN_TAB} />
      <Tabs.Screen name="customer-statement" options={HIDDEN_TAB} />
      <Tabs.Screen name="generic-analysis" options={HIDDEN_TAB} />
      <Tabs.Screen name="user-profile" options={HIDDEN_TAB} />
      <Tabs.Screen name="employee-profile/[id]" options={HIDDEN_TAB} />
      <Tabs.Screen name="kpi-details" options={HIDDEN_TAB} />
      <Tabs.Screen name="receivables-widget-list" options={HIDDEN_TAB} />
      <Tabs.Screen name="sales-widget-list" options={HIDDEN_TAB} />
      <Tabs.Screen name="inventory-widget-detail" options={HIDDEN_TAB} />
      <Tabs.Screen name="inventory-stock-by-brand" options={HIDDEN_TAB} />
      <Tabs.Screen name="inventory-item-stock" options={HIDDEN_TAB} />
      <Tabs.Screen name="pdf-viewer" options={HIDDEN_TAB} />
      <Tabs.Screen name="flip-web" options={HIDDEN_TAB} />
      <Tabs.Screen name="youtube-video" options={HIDDEN_TAB} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
    width: 36,
    height: 28,
    borderRadius: 14,
  },
  iconWrapActive: {
    backgroundColor: "#eef2ff",
  },
});
