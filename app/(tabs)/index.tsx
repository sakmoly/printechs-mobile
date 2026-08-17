import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  Platform,
} from "react-native";
import * as Notifications from "expo-notifications";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import { LoadingScreen } from "../../src/components/LoadingScreen";
import { useAuthStore } from "../../src/store/auth";
import { PHASE2_FEATURES } from "../../src/api/endpoints";
import {
  useModuleEnabled,
  useBootstrapReady,
} from "../../src/hooks/useBootstrap";
import { useNavigation } from "../../src/hooks/useNavigation";
import { navigateToModule } from "../../src/modules/navigateToModule";
import { SYSTEM_SCREENS } from "../../src/modules/navigation";
import {
  DashboardWidgets,
  type DashboardWidgetsHandle,
} from "../../src/widgets";
import { Ionicons } from "@expo/vector-icons";
import {
  useApprovalsStats,
  useUserProfileData,
} from "../../src/hooks/useOptimizedApis";
import { defaultPeriod } from "../../src/utils/period";

function resolveImageUrl(url?: string | null, baseUrl?: string | null) {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/") && baseUrl) return `${baseUrl}${url}`;
  return url;
}

export default function DashboardScreen() {
  const [refreshing, setRefreshing] = useState(false);
  // Home has no Period chips — YTD by default; widgets named MTD/YTD lock their own range
  const period = defaultPeriod();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const permissions = useAuthStore((state) => state.permissions);
  const serverConfig = useAuthStore((state) => state.serverConfig);
  const loadMobileConfig = useAuthStore((s) => s.loadMobileConfig);
  const bootstrapReady = useBootstrapReady();
  const boardRef = useRef<DashboardWidgetsHandle | null>(null);
  const { branding, canModule, moduleLabel, homeShortcuts } = useNavigation();
  const pushEnabled = useModuleEnabled("push");
  const [profileLoadFailed, setProfileLoadFailed] = useState(false);
  const currentUsername = user?.username || "";

  // Prefer ERPNext Company from access scope only.
  const resolvedCompany = permissions.scope?.company?.trim() || undefined;

  // Home uses get_dashboard_board_data only — do not call
  // get_dashboard_kpis / get_complete_dashboard_data / get_executive_dashboard here.
  const { data: userProfileData, refetch: refetchUserProfile } =
    useUserProfileData();
  const userProfile = userProfileData?.user_profile;
  const { pending: approvalCount } = useApprovalsStats();

  const avatarRaw = userProfile
    ? userProfile.image_url || ""
    : ((user as any)?.image ||
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

  React.useEffect(() => {
    setProfileLoadFailed(false);
  }, [avatarResolved]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadMobileConfig();
      await Promise.all([
        refetchUserProfile(),
        boardRef.current?.refreshBoard?.() ?? Promise.resolve(),
      ]);
    } catch (e) {
      console.log("⚠️ Dashboard refresh error:", e);
    } finally {
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      refetchUserProfile();
      if (!PHASE2_FEATURES.push || !pushEnabled) {
        return;
      }
      const receivedSubscription =
        Notifications.addNotificationReceivedListener(() => {
          refetchUserProfile();
          boardRef.current?.refreshBoard?.();
        });
      const responseSubscription =
        Notifications.addNotificationResponseReceivedListener(() => {
          refetchUserProfile();
          boardRef.current?.refreshBoard?.();
        });
      return () => {
        receivedSubscription.remove();
        responseSubscription.remove();
      };
    }, [pushEnabled, refetchUserProfile])
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

  const badgeApprovals = approvalCount > 0 ? approvalCount : 0;

  // Wait only for bootstrap layout — widget values fill from batch afterward
  if (!bootstrapReady) {
    return <LoadingScreen message="Loading dashboard..." />;
  }

  const dateLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#667eea", "#764ba2"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerBand}
      >
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>{branding.appTitle}</Text>
            <Text style={styles.date}>{dateLabel}</Text>
          </View>

          <View style={styles.headerRight}>
            {canModule("approvals") ? (
              <TouchableOpacity
                style={styles.headerIconBtn}
                onPress={() => navigateToModule("approvals")}
                accessibilityLabel={moduleLabel("approvals", "Approvals")}
              >
                <Ionicons
                  name="notifications-outline"
                  size={22}
                  color="#ffffff"
                />
                {badgeApprovals > 0 && (
                  <View style={styles.bellBadge}>
                    <Text style={styles.bellBadgeText}>
                      {badgeApprovals > 99 ? "99+" : badgeApprovals}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={styles.profileButton}
              onPress={() => router.push(SYSTEM_SCREENS.profile.route as any)}
              accessibilityLabel={SYSTEM_SCREENS.profile.label}
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
                  <View style={styles.profilePhotoPlaceholder}>
                    <Ionicons name="person" size={20} color="#ffffff" />
                  </View>
                )}
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={handleLogout}
              accessibilityLabel="Logout"
            >
              <Ionicons name="log-out-outline" size={22} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

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
        {homeShortcuts.length > 0 && (
          <View style={styles.shortcutsBlock}>
            <Text style={styles.shortcutsTitle}>Explore</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.shortcutsRow}
            >
              {homeShortcuts.map((item) => (
                <TouchableOpacity
                  key={`shortcut-${item.key}`}
                  style={styles.shortcutChip}
                  activeOpacity={0.85}
                  onPress={() => {
                    if (item.route) router.push(item.route as any);
                    else navigateToModule(item.key);
                  }}
                >
                  <View
                    style={[
                      styles.shortcutIcon,
                      { backgroundColor: `${item.color}18` },
                    ]}
                  >
                    <Ionicons name={item.icon} size={16} color={item.color} />
                  </View>
                  <Text style={styles.shortcutLabel} numberOfLines={1}>
                    {item.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        <DashboardWidgets
          boardRef={boardRef}
          boardKey="home"
          company={resolvedCompany}
          from_date={period.from_date}
          to_date={period.to_date}
          period={period.preset}
          limit={40}
          hideTitle
          hideBoardTitle
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  headerBand: {
    paddingTop: Platform.OS === "ios" ? 52 : 36,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: {
    flex: 1,
    paddingRight: 12,
  },
  greeting: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "800",
  },
  date: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  shortcutsBlock: {
    marginBottom: 12,
  },
  shortcutsTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  shortcutsRow: {
    paddingRight: 8,
  },
  shortcutChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#eef2ff",
    marginRight: 8,
    maxWidth: 160,
  },
  shortcutIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  shortcutLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1f2937",
    flexShrink: 1,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  bellBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    backgroundColor: "#ef4444",
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: "#667eea",
  },
  bellBadgeText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "800",
  },
  profileButton: {
    position: "relative",
  },
  profilePhotoContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.85)",
  },
  profilePhoto: {
    width: "100%",
    height: "100%",
  },
  profilePhotoPlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(255,255,255,0.25)",
    justifyContent: "center",
    alignItems: "center",
  },
});
