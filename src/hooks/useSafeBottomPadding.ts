import { useSafeAreaInsets } from "react-native-safe-area-context";
import { systemHomeClearance } from "../components/SafeScreen";

/**
 * Extra scroll/content padding so the last row clears the system Home /
 * nav bar (and optionally a fixed tab bar / footer).
 */
export function useSafeBottomPadding(
  extra = 24,
  opts?: { aboveTabBar?: boolean }
): number {
  const insets = useSafeAreaInsets();
  if (opts?.aboveTabBar) {
    // Tab bar already clears system nav — only need content breathing room
    return extra;
  }
  return systemHomeClearance(insets.bottom, extra);
}
