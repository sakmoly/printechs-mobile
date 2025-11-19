import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo } from "react";
import { useAuthStore } from "../../src/store/auth";

type TabConfig = {
  name: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  permissionKey: string;
};

const TAB_CONFIG: TabConfig[] = [
  {
    name: "index",
    title: "Dashboard",
    icon: "stats-chart",
    permissionKey: "AO-00022",
  },
  {
    name: "approvals",
    title: "Approvals",
    icon: "checkmark-circle",
    permissionKey: "AO-00023",
  },
  {
    name: "ecatalogue",
    title: "E-Catalogue",
    icon: "book-outline",
    permissionKey: "AO-00031",
  },
  {
    name: "settings",
    title: "Settings",
    icon: "settings",
    permissionKey: "AO-00025",
  },
];

export default function TabsLayout() {
  const permissions = useAuthStore((state) => state.permissions);

  const visibleTabs = useMemo(() => {
    if (!permissions.fetched) {
      return TAB_CONFIG;
    }

    const allowed = TAB_CONFIG.filter(
      (tab) => permissions.menus[tab.permissionKey] === true
    );

    if (allowed.length > 0) {
      return allowed;
    }

    // Fallback to keep essential navigation available
    return TAB_CONFIG.filter((tab) =>
      ["AO-00022", "AO-00025"].includes(tab.permissionKey)
    );
  }, [permissions]);

  useEffect(() => {
    console.log("🗺️ Menu permissions fetched:", permissions.fetched);
    console.log("🗂️ Menu map:", permissions.menus);
    console.log(
      "📋 Visible tabs:",
      visibleTabs.map((tab) => tab.permissionKey)
    );
  }, [permissions, visibleTabs]);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#667eea",
        tabBarInactiveTintColor: "#9ca3af",
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: "#e5e7eb",
          paddingTop: 8,
          paddingBottom: 8,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "600",
        },
        headerStyle: {
          backgroundColor: "#667eea",
        },
        headerTintColor: "#ffffff",
        headerTitleStyle: {
          fontWeight: "bold",
        },
      }}
    >
      {visibleTabs.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          listeners={{
            tabPress: () => {
              if (tab.name === "index") {
                console.log("🧭 Dashboard tab pressed");
              } else {
                console.log(`🧭 Tab pressed: ${tab.name}`);
              }
            },
          }}
          options={{
            title: tab.title,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name={tab.icon} size={size} color={color} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
