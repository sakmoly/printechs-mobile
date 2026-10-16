import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { INVENTORY } from "../../screens/inventory/inventoryTheme";
import { Fonts } from "../../theme/typography";
import {
  openInventoryItemStock,
  openInventoryStockByBrand,
  type InventoryStockByBrandScope,
} from "../../utils/inventoryNavigation";
import { ALL_TERRITORIES } from "../../utils/dashboardTerritory";

type Props = {
  scope: InventoryStockByBrandScope;
  selectedTerritory?: string;
};

export function InventoryStockExplorerCard({
  scope,
  selectedTerritory,
}: Props) {
  const terr = String(selectedTerritory || "").trim();
  const terrHint =
    terr && terr !== ALL_TERRITORIES
      ? terr
      : "All territories — pick branch on next screen";

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Stock explorer</Text>
      <TouchableOpacity
        style={styles.row}
        activeOpacity={0.85}
        onPress={() => openInventoryStockByBrand(scope)}
      >
        <View style={styles.iconWrap}>
          <Ionicons name="layers-outline" size={20} color={INVENTORY.link} />
        </View>
        <View style={styles.textCol}>
          <Text style={styles.rowTitle}>By brand → item</Text>
          <Text style={styles.rowSub} numberOfLines={2}>
            Drill brands, items, then qty by warehouse · {terrHint}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={INVENTORY.subtitle} />
      </TouchableOpacity>
      <View style={styles.divider} />
      <TouchableOpacity
        style={styles.row}
        activeOpacity={0.85}
        onPress={() => openInventoryItemStock(scope)}
      >
        <View style={styles.iconWrap}>
          <Ionicons name="barcode-outline" size={20} color={INVENTORY.link} />
        </View>
        <View style={styles.textCol}>
          <Text style={styles.rowTitle}>Find item by code</Text>
          <Text style={styles.rowSub} numberOfLines={2}>
            Pick brand → item → warehouse stock (no full-company scan)
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={INVENTORY.subtitle} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: INVENTORY.card,
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: INVENTORY.border,
    marginBottom: 12,
  },
  title: {
    fontSize: 11,
    fontFamily: Fonts.bodyBold,
    color: INVENTORY.title,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    paddingVertical: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: INVENTORY.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: 14,
    fontFamily: Fonts.bodySemi,
    color: INVENTORY.value,
  },
  rowSub: {
    marginTop: 2,
    fontSize: 11,
    fontFamily: Fonts.body,
    color: INVENTORY.subtitle,
    lineHeight: 15,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: INVENTORY.border,
    marginLeft: 46,
  },
});
