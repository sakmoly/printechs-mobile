import React, { useEffect } from "react";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeScreen } from "../../src/components/SafeScreen";
import { INVENTORY } from "../../src/screens/inventory/inventoryTheme";
import { ALL_TERRITORIES } from "../../src/utils/dashboardTerritory";

/** Redirect legacy route → brand → item → warehouse drill on stock-by-brand. */
export default function InventoryItemStockRedirect() {
  const params = useLocalSearchParams<{
    company?: string;
    item_code?: string;
    territory?: string;
  }>();

  useEffect(() => {
    const territory = String(params.territory || "").trim();
    router.replace({
      pathname: "/(tabs)/inventory-stock-by-brand",
      params: {
        company: String(params.company || "").trim(),
        item_code: String(params.item_code || "").trim(),
        territory:
          territory && territory !== ALL_TERRITORIES ? territory : "",
      },
    });
  }, [params.company, params.item_code, params.territory]);

  return (
    <SafeScreen style={styles.container}>
      <View style={styles.center}>
        <ActivityIndicator size="large" color={INVENTORY.link} />
      </View>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: INVENTORY.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
