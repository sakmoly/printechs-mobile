import React, { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Image,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import { KpiCard } from "../../src/components/KpiCard";
import { ExpandableDashboardCard } from "../../src/components/ExpandableDashboardCard";
import { LoadingScreen } from "../../src/components/LoadingScreen";
import { useAuthStore } from "../../src/store/auth";
import { Ionicons } from "@expo/vector-icons";
import {
  useDashboardData,
  useApprovalsStats,
  useUserProfileData,
  useReceivablesSnapshot,
  useReceivablesPerformance,
  useInventorySnapshot,
  useInventoryPerformance,
} from "../../src/hooks/useOptimizedApis";

const { width } = Dimensions.get("window");

function resolveImageUrl(url?: string | null, baseUrl?: string | null) {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/") && baseUrl) return `${baseUrl}${url}`;
  return url;
}

export default function DashboardScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const permissions = useAuthStore((state) => state.permissions);
  const serverConfig = useAuthStore((state) => state.serverConfig);
  const [profileLoadFailed, setProfileLoadFailed] = useState(false);
  const currentUsername = user?.username || "";

  const MENU_KEY_MAP: Record<string, string> = {
    menu_dashboard: "AO-00022",
    menu_approvals: "AO-00023",
    menu_settings: "AO-00025",
    menu_sales_performance: "AO-00026",
    menu_receivables: "AO-00027",
    menu_inventory: "AO-00028",
    menu_payables: "AO-00029",
    menu_purchase_performance: "AO-00030",
    menu_e_catalogue: "AO-00031",
  };

  const canViewMenu = useCallback(
    (key: string) => {
      if (!permissions?.fetched) {
        return true;
      }
      const mappedKey = MENU_KEY_MAP[key] || key;
      const value = permissions.menus[mappedKey];
      return value === true;
    },
    [permissions]
  );

  // 🎯 SINGLE API CALL - Gets ALL dashboard data in one request
  const {
    data: dashboardData,
    isLoading,
    error,
    refetch: refetchDashboard,
  } = useDashboardData();
  const {
    data: userProfileData,
    refetch: refetchUserProfile,
  } = useUserProfileData();
  const userProfile = userProfileData?.user_profile;

  // Get approval count for badge
  const { pending: approvalCount } = useApprovalsStats();

  // Receivables data to sync with Snapshot tab
  const {
    data: recvSnapshot,
    refetch: refetchReceivablesSnapshot,
  } = useReceivablesSnapshot();
  const {
    data: recvPerformance,
    refetch: refetchReceivablesPerformance,
  } = useReceivablesPerformance();

  // Inventory data
  const {
    data: inventorySnapshot,
    refetch: refetchInventorySnapshot,
  } = useInventorySnapshot();
  const {
    data: inventoryPerformance,
    refetch: refetchInventoryPerformance,
  } = useInventoryPerformance({ limit: 100 });

  // Compute header avatar URL once per render cycle (outside JSX to avoid hook ordering issues)
  // Use only the per-user profile photo when available; if it's empty, show logo.
  const avatarRaw = userProfile
    ? userProfile.image_url || ""
    : ((dashboardData as any)?.user_profile?.image_url ||
        (user as any)?.image ||
        (user as any)?.user_image ||
        (user as any)?.photo_url ||
        "");
  const avatarBaseResolved = React.useMemo(
    () => (resolveImageUrl(avatarRaw, serverConfig?.serverUrl) as string) || "",
    [avatarRaw, serverConfig?.serverUrl]
  );
  const avatarResolved =
    avatarBaseResolved && currentUsername
      ? `${avatarBaseResolved}${
          avatarBaseResolved.includes("?") ? "&" : "?"
        }u=${encodeURIComponent(currentUsername)}`
      : avatarBaseResolved;

  // Reset image load failure when the URL changes
  React.useEffect(() => {
    setProfileLoadFailed(false);
  }, [avatarResolved]);

  // Animation values
  const headerFadeAnim = useRef(new Animated.Value(0)).current;
  const headerSlideAnim = useRef(new Animated.Value(-20)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(headerFadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(headerSlideAnim, {
        toValue: 0,
        tension: 40,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refetchDashboard(),
        refetchUserProfile(),
        refetchReceivablesSnapshot(),
        refetchReceivablesPerformance(),
        refetchInventorySnapshot(),
        refetchInventoryPerformance(),
      ]);
    } catch (e) {
      console.log("⚠️ Dashboard refresh error:", e);
    } finally {
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      console.log("📊 Dashboard screen focused - refreshing data...");
      refetchDashboard();
      refetchUserProfile();
      refetchReceivablesSnapshot();
      refetchReceivablesPerformance();
      refetchInventorySnapshot();
      refetchInventoryPerformance();
    }, [
      refetchDashboard,
      refetchUserProfile,
      refetchReceivablesSnapshot,
      refetchReceivablesPerformance,
      refetchInventorySnapshot,
      refetchInventoryPerformance,
    ])
  );

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/(auth)/login");
        },
      },
    ]);
  };

  console.log("📊 Dashboard render state:", {
    hasData: !!dashboardData,
    kpiCount: dashboardData?.kpis?.length || 0,
    approvalsCount: approvalCount,
    canSales: canViewMenu("menu_sales_performance"),
    canReceivables: canViewMenu("menu_receivables"),
    canInventory: canViewMenu("menu_inventory"),
    receivablesSnapshotLoaded: !!recvSnapshot,
    receivablesPerformanceLoaded: !!recvPerformance,
    inventorySnapshotLoaded: !!inventorySnapshot,
    inventoryPerformanceLoaded: !!inventoryPerformance,
    isLoading,
    errorExists: !!error,
  });

  if (isLoading && !dashboardData) {
    return <LoadingScreen message="Loading dashboard..." />;
  }

  if (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={64} color="#ef4444" />
        <Text style={styles.errorTitle}>Failed to Load Dashboard</Text>
        <Text style={styles.errorMessage}>{errorMessage}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => refetchDashboard()}
        >
          <Ionicons name="refresh-outline" size={20} color="#ffffff" />
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Gradient Background */}
      <LinearGradient
        colors={["#f9fafb", "#ffffff", "#f3f4f6"]}
        style={styles.backgroundGradient}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
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
        {/* Header with Animation */}
        <Animated.View
          style={[
            styles.header,
            {
              opacity: headerFadeAnim,
              transform: [{ translateY: headerSlideAnim }],
            },
          ]}
        >
          <View style={styles.headerContent}>
            <View style={styles.headerLeft}>
              <Text style={styles.greeting}>📊 Dashboard</Text>
              <Text style={styles.date}>
                {dashboardData?.date ||
                  new Date().toLocaleDateString("en-US", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
              </Text>
            </View>

            <View style={styles.headerRight}>
              {/* Bell Icon with Approval Count */}
              <TouchableOpacity
                style={styles.bellButton}
                onPress={() => router.push("/(tabs)/approvals")}
              >
                <View style={styles.bellIconContainer}>
                  <Ionicons
                    name="notifications-outline"
                    size={28}
                    color="#667eea"
                  />
                  {approvalCount > 0 && (
                    <View style={styles.bellBadge}>
                      <Text style={styles.bellBadgeText}>
                        {approvalCount > 99 ? "99+" : approvalCount}
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>

              {/* User Profile Photo - Data comes from single API */}
              <TouchableOpacity
                style={styles.profileButton}
                onPress={() => router.push("/user-profile")}
              >
                <View style={styles.profilePhotoContainer}>
                  {avatarResolved && !profileLoadFailed ? (
                    <Image
                      key={avatarResolved}
                      source={{ uri: avatarResolved }}
                      style={styles.profilePhoto}
                      resizeMode="cover"
                      onError={() => setProfileLoadFailed(true)}
                    />
                  ) : (
                    <Image
                      source={require("../../assets/icon.png")}
                      style={styles.profilePhoto}
                      resizeMode="cover"
                    />
                  )}
                  <View style={styles.onlineIndicator} />
                </View>
              </TouchableOpacity>

              {/* Logout Button */}
              <TouchableOpacity
                style={styles.logoutButton}
                onPress={handleLogout}
              >
                <LinearGradient
                  colors={["#ef4444", "#dc2626"]}
                  style={styles.logoutGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons name="log-out-outline" size={20} color="#ffffff" />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>

        {/* Sales Performance Expandable Section */}
        {canViewMenu("menu_sales_performance") &&
          dashboardData?.kpis &&
          dashboardData.kpis.length >= 2 &&
          (() => {
            // Find KPIs
            const salesToday = dashboardData.kpis.find(
              (kpi) => kpi.id === "sales_today"
            );
            const salesMTD = dashboardData.kpis.find(
              (kpi) => kpi.id === "sales_mtd"
            );
            const salesYTD = dashboardData.kpis.find(
              (kpi) => kpi.id === "sales_ytd"
            );

            // Debug: Log KPI data
            console.log("🔍 KPI Data:", {
              salesToday: salesToday
                ? {
                    value: salesToday.value,
                    change: salesToday.change_percentage,
                    previous_year_value: (salesToday as any)
                      .previous_year_value,
                  }
                : null,
              salesMTD: salesMTD
                ? {
                    value: salesMTD.value,
                    change: salesMTD.change_percentage,
                    previous_year_value: (salesMTD as any).previous_year_value,
                  }
                : null,
              salesYTD: salesYTD
                ? {
                    value: salesYTD.value,
                    change: salesYTD.change_percentage,
                    previous_year_value: (salesYTD as any).previous_year_value,
                  }
                : null,
            });

            return (
              <ExpandableDashboardCard
                icon="trending-up-outline"
                title="Sales Performance"
                color="#667eea"
                iconBgColor="#eef2ff"
                metrics={[
                  {
                    label: "Sales Today",
                    value: salesToday?.value || 0,
                    change: salesToday?.change_percentage?.toFixed(1),
                    format: "currency",
                  },
                  {
                    label: "Sales MTD",
                    value: salesMTD?.value || 0,
                    change: salesMTD?.change_percentage?.toFixed(1),
                    format: "currency",
                    previousYearValue: (salesMTD as any)?.previous_year_value,
                  },
                  {
                    label: "Sales YTD",
                    value: salesYTD?.value || 0,
                    change: salesYTD?.change_percentage?.toFixed(1),
                    format: "currency",
                    previousYearValue: (salesYTD as any)?.previous_year_value,
                  },
                ]}
                expandedContent={
                  <View style={styles.expandedDetails}>
                    <TouchableOpacity
                      style={styles.viewDetailButton}
                      onPress={() => router.push("/sales-dashboard")}
                    >
                      <Text style={styles.viewDetailText}>
                        View Full Dashboard →
                      </Text>
                    </TouchableOpacity>
                  </View>
                }
              />
            );
          })()}

        {/* Receivables KPI + Expandable (like Sales Performance) */}
        {canViewMenu("menu_receivables") &&
          recvSnapshot &&
          recvPerformance &&
          (() => {
          const totalReceivable = recvSnapshot?.totalUnpaid || 0;
          const agingArray = recvPerformance?.agingBreakdown || [];
          const norm = new Map<string, number>();
          agingArray.forEach((b: any) => {
            const k = (b?.period || "").toString().trim().toLowerCase();
            norm.set(k, b?.amount || 0);
          });
          const get = (label: string) =>
            norm.get(label.trim().toLowerCase()) || 0;
          const currentBalance = get("Current") + get("1-30 Days");
          const overdue =
            get("31-60 Days") + get("61-90 Days") + get("91-120 Days");
          const oldBalance =
            get("Old Balance") || (recvSnapshot?.oldBalance ?? 0);

          return (
            <>
              {/* Receivables expandable with Total Receivable + three metrics */}
              <ExpandableDashboardCard
                icon="wallet-outline"
                title="Receivables"
                color="#667eea"
                iconBgColor="#eef2ff"
                metrics={[
                  {
                    label: "Total Receivable",
                    value: totalReceivable,
                    format: "currency" as const,
                  },
                  {
                    label: "Current",
                    value: currentBalance,
                    format: "currency" as const,
                  },
                  {
                    label: "Overdue",
                    value: overdue,
                    format: "currency" as const,
                  },
                  {
                    label: "Old Balance",
                    value: oldBalance,
                    format: "currency" as const,
                  },
                ]}
                expandedContent={
                  <View style={styles.expandedDetails}>
                    <TouchableOpacity
                      style={styles.viewDetailButton}
                      onPress={() => router.push("/receivables-dashboard")}
                    >
                      <Text style={styles.viewDetailText}>View Details →</Text>
                    </TouchableOpacity>
                  </View>
                }
              />
            </>
          );
        })()}

        {/* Inventory Expandable Section */}
        {canViewMenu("menu_inventory") &&
          inventorySnapshot &&
          inventoryPerformance &&
          (() => {
          const totalStockValue = inventorySnapshot?.totalInventoryValue || 0;
          const reorderAlerts = inventoryPerformance?.reorderAlerts || [];
          const lowStockCount = reorderAlerts.length;
          
          return (
            <ExpandableDashboardCard
              icon="cube-outline"
              title="Inventory"
              color="#667eea"
              iconBgColor="#eef2ff"
              metrics={[
                {
                  label: "Total Stock Value",
                  value: totalStockValue,
                  format: "currency" as const,
                },
                {
                  label: "Low Stock Items",
                  value: lowStockCount,
                  format: "number" as const,
                },
              ]}
              expandedContent={
                <View style={styles.expandedDetails}>
                  <TouchableOpacity
                    style={styles.viewDetailButton}
                    onPress={() => {
                      router.push("/inventory-dashboard");
                    }}
                  >
                    <Text style={styles.viewDetailText}>View Details →</Text>
                  </TouchableOpacity>
                </View>
              }
            />
          );
        })()}

        {/* Payables Expandable Section */}
        {canViewMenu("menu_payables") && (
          <ExpandableDashboardCard
            icon="receipt-outline"
            title="Payables"
            color="#667eea"
            iconBgColor="#eef2ff"
            metrics={[
              {
                label: "Total Payable",
                value: 2345678,
                change: 8.3,
                format: "currency",
              },
              {
                label: "Overdue",
                value: 123456,
                change: -12.5,
                format: "currency",
              },
            ]}
            expandedContent={
              <View style={styles.expandedDetails}>
                <TouchableOpacity
                  style={styles.viewDetailButton}
                  onPress={() => router.push("/payables-dashboard")}
                >
                  <Text style={styles.viewDetailText}>View Details →</Text>
                </TouchableOpacity>
              </View>
            }
          />
        )}

        {/* Purchase Performance Expandable Section */}
        {canViewMenu("menu_purchase_performance") && (
          <ExpandableDashboardCard
            icon="cart-outline"
            title="Purchase Performance"
            color="#667eea"
            iconBgColor="#eef2ff"
            metrics={[
              {
                label: "Purchase MTD",
                value: 1890000,
                change: 15.2,
                format: "currency",
              },
              {
                label: "Purchase YTD",
                value: 22500000,
                change: 18.5,
                format: "currency",
              },
            ]}
            expandedContent={
              <View style={styles.expandedDetails}>
                <TouchableOpacity
                  style={styles.viewDetailButton}
                  onPress={() =>
                    router.push("/purchase-performance-dashboard")
                  }
                >
                  <Text style={styles.viewDetailText}>View Details →</Text>
                </TouchableOpacity>
              </View>
            }
          />
        )}

        {/* Individual KPI Cards for other metrics (if any) - excluding Gross Margin */}
        {dashboardData?.kpis &&
          dashboardData.kpis
            .filter(
              (kpi) =>
                kpi.id !== "sales_today" &&
                kpi.id !== "sales_mtd" &&
                kpi.id !== "sales_ytd" &&
                kpi.id !== "gross_margin"
            )
            .map((kpi) => (
              <View key={kpi.id} style={styles.kpiCardWrapper}>
                <KpiCard
                  label={kpi.title}
                  value={kpi.value}
                  delta={kpi.change_percentage}
                  format={kpi.unit ? "percentage" : "currency"}
                  currency={kpi.currency}
                  unit={kpi.unit}
                  changeDirection={kpi.change_direction}
                  colors={["#3b82f6", "#2563eb"]}
                  onPress={() => {
                    console.log("KPI tapped:", kpi.id, kpi.title);
                    router.push("/sales-dashboard");
                  }}
                />
              </View>
            ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  backgroundGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 24,
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  greeting: {
    fontSize: 32,
    fontWeight: "800",
    color: "#1f2937",
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  date: {
    fontSize: 14,
    color: "#6b7280",
    fontWeight: "500",
  },
  bellButton: {
    padding: 8,
  },
  bellIconContainer: {
    position: "relative",
  },
  bellBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#ef4444",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: "#ffffff",
    shadowColor: "#ef4444",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 5,
  },
  bellBadgeText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "800",
    fontFamily: "System",
  },
  profileButton: {
    position: "relative",
  },
  profilePhotoContainer: {
    position: "relative",
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 3,
    borderColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  profilePhoto: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  profilePhotoPlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: "#667eea",
    justifyContent: "center",
    alignItems: "center",
  },
  profileInitials: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
  },
  onlineIndicator: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#10b981",
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  logoutButton: {
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#ef4444",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  logoutGradient: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1f2937",
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#667eea",
  },
  kpiGrid: {
    marginTop: 8,
  },
  kpiCardWrapper: {
    marginBottom: 16,
  },
  expandedDetails: {
    gap: 12,
  },
  expandedTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 8,
  },
  expandedDescription: {
    fontSize: 14,
    color: "#6b7280",
    lineHeight: 20,
  },
  viewDetailButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: "#667eea",
    borderRadius: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  viewDetailText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  // Receivables row card styles
  rowCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  rowCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  rowCardTitleWrap: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowCardTitle: { fontSize: 16, fontWeight: "800", color: "#111827" },
  rowCardCta: {
    backgroundColor: "#667eea",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  rowCardCtaText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  rowCardContent: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 8,
  },
  rowCol: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
  },
  rowLabel: {
    color: "#6b7280",
    fontWeight: "700",
    fontSize: 12,
    marginBottom: 6,
  },
  rowValue: { fontSize: 18, fontWeight: "800", color: "#111827" },
  rowDivider: { width: 1, backgroundColor: "#e5e7eb", marginVertical: 4 },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    backgroundColor: "#f9fafb",
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1f2937",
    marginTop: 16,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: "#667eea",
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  retryButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
});
