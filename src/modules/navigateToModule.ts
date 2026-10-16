/**
 * Navigate to a registered module by key (never uses server-supplied paths).
 */

import { router } from "expo-router";
import { Alert } from "react-native";
import { getModuleRoute, getRegistryEntry } from "./navigation";

export function navigateToModule(key: string): boolean {
  const entry = getRegistryEntry(key);
  if (entry?.shipped === false) {
    Alert.alert(
      "Update required",
      `${entry.defaultLabel} needs a newer app version.`
    );
    return false;
  }
  const route = getModuleRoute(key);
  if (!route) return false;
  router.push(route as any);
  return true;
}
