import React from "react";
import { Platform, RefreshControl } from "react-native";

type Props = {
  refreshing: boolean;
  onRefresh: () => void;
  tintColor: string;
};

/** Pull-to-refresh with Android spinner colors + iOS title. */
export function DashboardRefreshControl({
  refreshing,
  onRefresh,
  tintColor,
}: Props) {
  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor={tintColor}
      colors={[tintColor]}
      progressBackgroundColor="#ffffff"
      title={Platform.OS === "ios" ? "Refreshing…" : undefined}
    />
  );
}
