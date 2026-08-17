/**
 * React hook for Phase E dynamic navigation.
 */

import { useMemo } from "react";
import { useAuthStore } from "../store/auth";
import { useBootstrapStore } from "../store/bootstrap";
import {
  getModuleLabel,
  getModuleRoute,
  isNavModuleVisible,
  resolveHomeShortcuts,
  resolveNavigation,
  type NavResolution,
} from "../modules/navigation";
import type { ResolvedHubItem } from "../modules/resolveHubItems";

export function useNavigation(): NavResolution & {
  canModule: (key: string) => boolean;
  moduleRoute: (key: string) => string | null;
  moduleLabel: (key: string, fallback?: string) => string;
  homeShortcuts: ResolvedHubItem[];
} {
  const bootstrap = useBootstrapStore((s) => s.bootstrap);
  const mobileConfig = useAuthStore((s) => s.mobileConfig);
  const permissions = useAuthStore((s) => s.permissions);

  const nav = useMemo(
    () =>
      resolveNavigation({
        bootstrap,
        mobileConfig,
        permissions,
        showUpdateRequired: false,
      }),
    [bootstrap, mobileConfig, permissions]
  );

  const homeShortcuts = useMemo(
    () => resolveHomeShortcuts(nav, 8),
    [nav]
  );

  return {
    ...nav,
    canModule: (key: string) => isNavModuleVisible(nav, key),
    moduleRoute: (key: string) => getModuleRoute(key),
    moduleLabel: (key: string, fallback?: string) =>
      getModuleLabel(nav, key, fallback),
    homeShortcuts,
  };
}
