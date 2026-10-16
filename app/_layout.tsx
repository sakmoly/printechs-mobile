import React, { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import {
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
  Outfit_800ExtraBold,
} from "@expo-google-fonts/outfit";
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from "@expo-google-fonts/dm-sans";
import * as Notifications from "expo-notifications";
import { useAuthStore } from "../src/store/auth";
import { LoadingScreen } from "../src/components/LoadingScreen";
import { PHASE2_FEATURES } from "../src/api/endpoints";
import { http } from "../src/api/http";
import { isModuleEnabled } from "../src/api/mobileConfig";
import { usePushRegistration } from "../src/notifications/usePushRegistration";
import { useBootstrapReady } from "../src/hooks/useBootstrap";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: true,
      staleTime: 60_000,
      gcTime: 10 * 60_000,
    },
  },
});

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading = useAuthStore((state) => state.isLoading);
  const checkAuth = useAuthStore((state) => state.checkAuth);
  const mobileConfig = useAuthStore((state) => state.mobileConfig);
  const bootstrapReady = useBootstrapReady();

  usePushRegistration();

  const [fontsLoaded] = useFonts({
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
    Outfit_800ExtraBold,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
  });

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // On 401 (after failed refresh): clear tokens and leave the app shell — never stay as Guest.
  useEffect(() => {
    http.setUnauthorizedHandler(async () => {
      console.log("🔒 Unauthorized — clearing session and returning to login");
      queryClient.clear();
      await useAuthStore.getState().logout();
      router.replace("/(auth)/login");
    });
  }, [router]);

  // Invalidate approvals when a push notification arrives (registration is elsewhere)
  useEffect(() => {
    if (
      !PHASE2_FEATURES.push ||
      !isModuleEnabled(mobileConfig, "push") ||
      !isAuthenticated
    ) {
      return;
    }

    const invalidateApprovals = () => {
      queryClient.invalidateQueries({ queryKey: ["approvals-complete"] });
    };

    const receivedSubscription =
      Notifications.addNotificationReceivedListener(invalidateApprovals);
    const responseSubscription =
      Notifications.addNotificationResponseReceivedListener(invalidateApprovals);

    return () => {
      receivedSubscription.remove();
      responseSubscription.remove();
    };
  }, [isAuthenticated, mobileConfig]);

  useEffect(() => {
    if (isLoading) return;
    const inAuthGroup = segments.length > 0 && segments[0] === "(auth)";

    if (!isAuthenticated && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (isAuthenticated && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [isAuthenticated, isLoading, segments, router]);

  if (isLoading || !fontsLoaded) {
    return (
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <LoadingScreen message="Authenticating..." />
        </QueryClientProvider>
      </SafeAreaProvider>
    );
  }

  if (isAuthenticated && !bootstrapReady) {
    return (
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <LoadingScreen message="Loading workspace..." />
        </QueryClientProvider>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
