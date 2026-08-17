import React from "react";
import { StyleProp, ViewStyle } from "react-native";
import {
  SafeAreaView,
  type Edge,
} from "react-native-safe-area-context";

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /**
   * Top is usually handled by gradient headers / status bar.
   * Bottom keeps content above Android nav / iOS home indicator.
   */
  edges?: Edge[];
};

/**
 * Screen root that clears the system navigation / home indicator.
 * Use on stack screens (no tab bar). Tab screens already pad via the tab bar.
 */
export function SafeScreen({
  children,
  style,
  edges = ["bottom"],
}: Props) {
  return (
    <SafeAreaView style={[{ flex: 1 }, style]} edges={edges}>
      {children}
    </SafeAreaView>
  );
}
