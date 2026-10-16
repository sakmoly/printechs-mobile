import React from "react";
import { Platform, StatusBar, StyleProp, ViewStyle } from "react-native";
import {
  SafeAreaView,
  type Edge,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /**
   * Pad below the status bar. Set false when the screen header already calls
   * systemStatusBarClearance (HomeAppBar, gradient headers, etc.).
   */
  includeTop?: boolean;
  /** Extra pt below status bar when includeTop is true */
  topExtra?: number;
  edges?: Edge[];
  bottomExtra?: number;
  /** Tab navigator — tab bar clears system nav; no extra bottom pad on root */
  aboveTabBar?: boolean;
};

/**
 * Minimum bottom clearance so the system Home button / 3-button nav
 * is never covered — Android often reports insets.bottom = 0 incorrectly.
 */
export function systemHomeClearance(insetBottom: number, extra = 8): number {
  const minNav =
    Platform.OS === "android" ? 48 : Platform.OS === "ios" ? 8 : 0;
  return Math.max(insetBottom, minNav) + extra;
}

/**
 * Top clearance for headers — Android edge-to-edge often reports insets.top = 0.
 */
export function systemStatusBarClearance(insetTop: number, extra = 0): number {
  const minTop =
    Platform.OS === "android"
      ? StatusBar.currentHeight ?? 28
      : 0;
  return Math.max(insetTop, minTop) + extra;
}

/** Shared insets for tab screens, scroll views, and modals */
export function useSafeScreenInsets(opts?: { aboveTabBar?: boolean }) {
  const insets = useSafeAreaInsets();
  const aboveTabBar = opts?.aboveTabBar !== false;

  const topInset = systemStatusBarClearance(
    insets.top,
    Platform.OS === "ios" ? 8 : 6
  );
  const bottomInset = aboveTabBar
    ? 12
    : systemHomeClearance(insets.bottom, 12);
  const scrollPaddingBottom = aboveTabBar
    ? 28
    : systemHomeClearance(insets.bottom, 28);
  const modalSheetPaddingBottom = systemHomeClearance(insets.bottom, 16);

  return {
    insets,
    topInset,
    bottomInset,
    scrollPaddingBottom,
    modalSheetPaddingBottom,
  };
}

/**
 * Screen root that clears the system navigation / home indicator.
 * Use on root stack screens (no tab bar). Prefer `aboveTabBar` inside `(tabs)`.
 */
export function SafeScreen({
  children,
  style,
  includeTop = false,
  topExtra,
  edges,
  bottomExtra = 8,
  aboveTabBar = false,
}: Props) {
  const insets = useSafeAreaInsets();
  const resolvedEdges: Edge[] =
    edges ?? (aboveTabBar ? [] : ["bottom"]);
  const padBottom =
    !aboveTabBar && resolvedEdges.includes("bottom")
      ? systemHomeClearance(insets.bottom, bottomExtra)
      : undefined;
  const padTop = includeTop
    ? systemStatusBarClearance(
        insets.top,
        topExtra ?? (Platform.OS === "ios" ? 8 : 6)
      )
    : undefined;

  return (
    <SafeAreaView
      style={[{ flex: 1, paddingBottom: padBottom, paddingTop: padTop }, style]}
      edges={resolvedEdges.filter((e) => e !== "bottom" && e !== "top")}
    >
      {children}
    </SafeAreaView>
  );
}
