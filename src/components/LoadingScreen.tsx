import React from "react";
import { View, ActivityIndicator, Text, StyleSheet } from "react-native";
import { SafeScreen } from "./SafeScreen";

interface LoadingScreenProps {
  message?: string;
  /** Tab routes — default true */
  aboveTabBar?: boolean;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  message = "Loading...",
  aboveTabBar = true,
}) => {
  return (
    <SafeScreen aboveTabBar={aboveTabBar} includeTop style={styles.container}>
      <View style={styles.inner}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={styles.message}>{message}</Text>
      </View>
    </SafeScreen>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  inner: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  message: {
    marginTop: 16,
    fontSize: 16,
    color: "#6b7280",
  },
});
