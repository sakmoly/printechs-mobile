import React, { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuthStore } from "../src/store/auth";
import { LoadingScreen } from "../src/components/LoadingScreen";
import * as Notifications from "expo-notifications";
import { optimizedApis } from "../src/hooks/useOptimizedApis";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});

const PUSH_NOTIFICATIONS_ENABLED = false;

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading = useAuthStore((state) => state.isLoading);
  const checkAuth = useAuthStore((state) => state.checkAuth);
  const permissions = useAuthStore((state) => state.permissions);
  const user = useAuthStore((state) => state.user);
  const pushTokenRegistered = useRef(false);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Reset push token flag on logout
  useEffect(() => {
    if (!isAuthenticated) {
      pushTokenRegistered.current = false;
    }
  }, [isAuthenticated]);

  // Register Expo push token globally
  useEffect(() => {
    if (!PUSH_NOTIFICATIONS_ENABLED || !isAuthenticated) {
      return;
    }

    async function registerPushToken() {
      try {
        const existingPermissions = await Notifications.getPermissionsAsync();
        let finalStatus = existingPermissions.status;
        if (finalStatus !== "granted") {
          const requested = await Notifications.requestPermissionsAsync();
          finalStatus = requested.status;
        }

        if (finalStatus !== "granted") {
          console.log("Notification permissions denied");
          return;
        }

        if (pushTokenRegistered.current) {
          return;
        }

        const tokenResponse = await Notifications.getExpoPushTokenAsync();
        const expoToken =
          (tokenResponse as any)?.data ||
          (tokenResponse as any)?.expoPushToken ||
          tokenResponse;

        if (!expoToken || typeof expoToken !== "string") {
          console.log("Unable to retrieve Expo push token");
          return;
        }

        const scope = permissions.scope;
        const company = scope?.company || user?.company || null;
        const territory =
          scope?.territories?.[0] ||
          scope?.territory ||
          (user as any)?.territory ||
          (user as any)?.branch ||
          null;

        await optimizedApis.storePushToken({
          expoToken,
          platform: Platform.OS,
          territory,
          company,
        });
        pushTokenRegistered.current = true;
        console.log("✅ Push token registered from root layout");
      } catch (error) {
        console.log("⚠️ Failed to register push token:", error);
      }
    }

    registerPushToken();
  }, [isAuthenticated, permissions.scope, user]);

  // Global notification listeners (refresh approvals data)
  useEffect(() => {
    if (!PUSH_NOTIFICATIONS_ENABLED || !isAuthenticated) {
      return;
    }

    const invalidateApprovals = () => {
      queryClient.invalidateQueries({ queryKey: ["approvals-complete"] });
    };

    const receivedSubscription =
      Notifications.addNotificationReceivedListener(() => {
        invalidateApprovals();
      });

    const responseSubscription =
      Notifications.addNotificationResponseReceivedListener(() => {
        invalidateApprovals();
      });

    return () => {
      receivedSubscription.remove();
      responseSubscription.remove();
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (isLoading) return;
    const inAuthGroup = segments.length > 0 && segments[0] === "(auth)";

    if (!isAuthenticated && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (isAuthenticated && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [isAuthenticated, isLoading, segments, router]);

  if (isLoading) {
    return <LoadingScreen message="Authenticating..." />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </QueryClientProvider>
  );
}
