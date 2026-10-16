import React, { useCallback } from "react";
import { useFocusEffect } from "expo-router";
import * as Notifications from "expo-notifications";
import { LoadingScreen } from "../../src/components/LoadingScreen";
import { useAuthStore } from "../../src/store/auth";
import { PHASE2_FEATURES } from "../../src/api/endpoints";
import {
  useModuleEnabled,
  useBootstrapReady,
} from "../../src/hooks/useBootstrap";
import {
  useApprovalsStats,
  useUserProfileData,
} from "../../src/hooks/useOptimizedApis";
import { HomeDashboardScreen } from "../../src/screens/home/HomeDashboardScreen";

export default function DashboardScreen() {
  const bootstrapReady = useBootstrapReady();
  const loadMobileConfig = useAuthStore((s) => s.loadMobileConfig);
  const pushEnabled = useModuleEnabled("push");

  const { refetch: refetchUserProfile } = useUserProfileData();
  const { pending: approvalCount } = useApprovalsStats();

  const onRefreshExtra = useCallback(async () => {
    await Promise.all([loadMobileConfig(), refetchUserProfile()]);
  }, [loadMobileConfig, refetchUserProfile]);

  useFocusEffect(
    useCallback(() => {
      refetchUserProfile();
      if (!PHASE2_FEATURES.push || !pushEnabled) return;
      const receivedSubscription =
        Notifications.addNotificationReceivedListener(() => {
          refetchUserProfile();
        });
      const responseSubscription =
        Notifications.addNotificationResponseReceivedListener(() => {
          refetchUserProfile();
        });
      return () => {
        receivedSubscription.remove();
        responseSubscription.remove();
      };
    }, [pushEnabled, refetchUserProfile])
  );

  if (!bootstrapReady) {
    return <LoadingScreen message="Loading dashboard..." />;
  }

  return (
    <HomeDashboardScreen
      notificationCount={approvalCount > 0 ? approvalCount : 0}
      onRefreshExtra={onRefreshExtra}
    />
  );
}
