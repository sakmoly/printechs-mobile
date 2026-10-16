import React from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { Fonts } from "../../theme/typography";

type Props = {
  label: string | null;
  isFetching?: boolean;
  tintColor?: string;
  subtitleColor?: string;
};

export function DashboardFreshnessFooter({
  label,
  isFetching = false,
  tintColor = "#2563eb",
  subtitleColor = "#64748b",
}: Props) {
  if (!label) return null;

  return (
    <View style={styles.row}>
      {isFetching ? (
        <ActivityIndicator size="small" color={tintColor} />
      ) : null}
      <Text style={[styles.text, { color: subtitleColor }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
  },
  text: {
    fontSize: 12,
    fontFamily: Fonts.body,
    textAlign: "center",
  },
});
