/**
 * Option A — navigate from a resolved More-hub item by screen_type.
 */

import { router } from "expo-router";
import { Alert } from "react-native";
import type { ResolvedHubItem } from "./resolveHubItems";
import { navigateToModule } from "./navigateToModule";

export function openHubItem(item: ResolvedHubItem): void {
  if (item.updateRequired || !item.route) {
    Alert.alert(
      "Update required",
      `${item.title} is enabled for this site but needs a newer app version.`
    );
    return;
  }

  const type = String(item.screenType || "module").toLowerCase();

  if (type === "report_list") {
    router.push(item.route as any);
    return;
  }

  if (type === "dashboard") {
    router.push(item.route as any);
    return;
  }

  // Built-in module screens
  if (item.route.startsWith("/")) {
    router.push(item.route as any);
    return;
  }

  navigateToModule(item.key);
}
