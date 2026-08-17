/**
 * Single place to register Expo push token with erp_analysis.
 * Call from root layout only after auth — do not duplicate in tabs.
 */

import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { useAuthStore } from "../store/auth";
import { isModuleEnabled } from "../api/mobileConfig";
import { PHASE2_FEATURES } from "../api/endpoints";
import { optimizedApis } from "../api/optimized-apis";
import { logger } from "../utils/logger";

export function usePushRegistration() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const permissions = useAuthStore((s) => s.permissions);
  const user = useAuthStore((s) => s.user);
  const mobileConfig = useAuthStore((s) => s.mobileConfig);
  const registeredFor = useRef<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      registeredFor.current = null;
      return;
    }

    if (!PHASE2_FEATURES.push || !isModuleEnabled(mobileConfig, "push")) {
      return;
    }

    const userKey = user?.email || user?.username || "";
    if (!userKey) return;
    if (registeredFor.current === userKey) return;

    let cancelled = false;

    (async () => {
      try {
        const existing = await Notifications.getPermissionsAsync();
        let status = existing.status;
        if (status !== "granted") {
          const req = await Notifications.requestPermissionsAsync();
          status = req.status;
        }
        if (status !== "granted" || cancelled) {
          logger.info("Push permission not granted");
          return;
        }

        const tokenResponse = await Notifications.getExpoPushTokenAsync();
        const expoToken = tokenResponse.data;
        if (!expoToken || cancelled) return;

        const company =
          permissions.scope?.company || user?.company || null;
        const territory =
          permissions.scope?.territories?.[0] ||
          permissions.scope?.territory ||
          permissions.scope?.branch ||
          null;

        await optimizedApis.storePushToken({
          expoToken,
          platform: Platform.OS,
          territory,
          company,
        });

        if (!cancelled) {
          registeredFor.current = userKey;
          logger.info("Push token registered");
        }
      } catch (e) {
        logger.warn("Push registration skipped/failed", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    isAuthenticated,
    mobileConfig,
    permissions.scope,
    user?.company,
    user?.email,
    user?.username,
  ]);
}
