import React from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Fonts } from "../../theme/typography";

type Props = {
  title: string;
  subtitle?: string;
  tintColor?: string;
};

export function DashboardLoadingPanel({
  title,
  subtitle,
  tintColor = "#2563eb",
}: Props) {
  return (
    <View style={styles.wrap} accessibilityRole="progressbar">
      <View style={[styles.iconRing, { borderColor: `${tintColor}33` }]}>
        <ActivityIndicator size="large" color={tintColor} />
      </View>
      <View style={styles.textBlock}>
        <Ionicons
          name="cloud-download-outline"
          size={18}
          color={tintColor}
          style={styles.cloudIcon}
        />
        <Text style={styles.title}>{title}</Text>
        {subtitle ? (
          <Text style={styles.subtitle}>{subtitle}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    paddingHorizontal: 28,
    minHeight: 220,
    gap: 16,
  },
  iconRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  textBlock: {
    alignItems: "center",
    maxWidth: 320,
  },
  cloudIcon: {
    marginBottom: 6,
    opacity: 0.85,
  },
  title: {
    fontSize: 16,
    fontFamily: Fonts.bodySemi,
    color: "#1e293b",
    textAlign: "center",
    lineHeight: 22,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 13,
    fontFamily: Fonts.body,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 18,
  },
});
