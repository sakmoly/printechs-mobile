/**
 * Shared header back + Home actions for stack screens.
 * Home always returns to the main tab Home (default escape hatch).
 * Back follows navigation history — never jumps to Home.
 */

import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useNavigation } from "expo-router";

type Props = {
  /** Icon / hit color (white on gradient headers) */
  color?: string;
  /** Button circle background */
  buttonBackground?: string;
  /** Show Home button (default true) */
  showHome?: boolean;
  onBack?: () => void;
};

export function goAppHome() {
  router.replace("/(tabs)" as any);
}

/** Previous screen when possible; otherwise More hub (where boards open from). */
export function goPreviousScreen(navigation?: { canGoBack: () => boolean; goBack: () => void }) {
  if (navigation?.canGoBack()) {
    navigation.goBack();
    return;
  }
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.navigate("/(tabs)/more" as any);
}

export function ScreenHeaderNav({
  color = "#ffffff",
  buttonBackground = "rgba(255, 255, 255, 0.2)",
  showHome = true,
  onBack,
}: Props) {
  const navigation = useNavigation();
  const btnStyle = [styles.btn, { backgroundColor: buttonBackground }];
  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    goPreviousScreen(navigation);
  };
  return (
    <View style={styles.row}>
      <TouchableOpacity
        onPress={handleBack}
        hitSlop={10}
        style={btnStyle}
        accessibilityLabel="Back"
      >
        <Ionicons name="arrow-back" size={22} color={color} />
      </TouchableOpacity>
      {showHome ? (
        <TouchableOpacity
          onPress={goAppHome}
          hitSlop={10}
          style={btnStyle}
          accessibilityLabel="Home"
        >
          <Ionicons name="home-outline" size={22} color={color} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  btn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
});
