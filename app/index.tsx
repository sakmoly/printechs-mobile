import React from "react";
import { Redirect } from "expo-router";
import { useAuthStore } from "../src/store/auth";
import { LoadingScreen } from "../src/components/LoadingScreen";

export default function Index() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading = useAuthStore((state) => state.isLoading);

  if (isLoading) {
    return <LoadingScreen message="Authenticating..." />;
  }

  return <Redirect href={isAuthenticated ? "/(tabs)" : "/(auth)/login"} />;
}
