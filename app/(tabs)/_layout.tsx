import { Tabs, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Platform, View, StyleSheet } from "react-native";
import { useMemo } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore } from "../../src/store/auth";
import { useBootstrapStore } from "../../src/store/bootstrap";
import { resolveTabVisibility } from "../../src/modules/resolveTabs";
import { useNavigation } from "../../src/hooks/useNavigation";

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

export default function TabsLayout() {
  const permissions = useAuthStore((s) => s.permissions);
  const moduleMap = useBootstrapStore((s) => s.moduleMap);
  const loaded = useBootstrapStore((s) => s.loaded);
  const { moduleLabel } = useNavigation();
  const insets = useSafeAreaInsets();

  const tabs = useMemo(
    () => resolveTabVisibility(permissions),
    [permissions, moduleMap, loaded]
  );

  const bottomInset = Math.max(
    insets.bottom,
    Platform.OS === "android" ? 12 : 0
  );
  const tabBarPaddingBottom = bottomInset + 6;
  const tabBarHeight = TAB_CONTENT_HEIGHT + tabBarPaddingBottom;

  return (
    <Tabs
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
          href: tabs.home ? "/(tabs)" : null,
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
