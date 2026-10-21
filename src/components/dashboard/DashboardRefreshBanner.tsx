import React from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { Fonts } from "../../theme/typography";

type Props = {
  message?: string;
  tintColor?: string;
};

/** Shown under filters while pull-to-refresh runs (visible without scrolling). */
export function DashboardRefreshBanner({
  message = "Refreshing dashboard…",
  tintColor = "#2563eb",
}: Props) {
  return (
    <View style={styles.wrap} accessibilityLiveRegion="polite">
      <ActivityIndicator size="small" color={tintColor} />
      <Text style={[styles.text, { color: tintColor }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginHorizontal: 14,
    marginBottom: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  text: {
    fontSize: 13,
    fontFamily: Fonts.bodySemi,
  },
});
