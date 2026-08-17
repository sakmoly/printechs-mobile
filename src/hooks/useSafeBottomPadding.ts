import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Extra scroll/content padding so the last row clears the system nav
 * (and optionally a fixed tab bar / footer).
 */
export function useSafeBottomPadding(extra = 24): number {
  const insets = useSafeAreaInsets();
  const minInset = Platform.OS === "android" ? 12 : 0;
  return Math.max(insets.bottom, minInset) + extra;
}
