import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import type { InventoryWidgetEntry } from "../../screens/inventory/buildInventorySections";
import type { AnalysisRow } from "../../api/genericAnalysisTypes";
import { INVENTORY } from "../../screens/inventory/inventoryTheme";
import { InventorySectionHeader } from "./InventorySectionHeader";
import { Fonts } from "../../theme/typography";

type IonIcon = ComponentProps<typeof Ionicons>["name"];

type Props = {
  entry: InventoryWidgetEntry;
};

function alertIcon(row: AnalysisRow): { icon: IonIcon; color: string } {
  const label = String(row.label || "").toLowerCase();
  const sev = String(row.meta?.severity || "").toLowerCase();
  if (/out.of.stock|negative/.test(label) || sev === "danger") {
    return { icon: "alert-circle", color: INVENTORY.red };
  }
  if (/low.stock/.test(label)) {
    return { icon: "warning", color: INVENTORY.amber };
  }
  if (/dead|365/.test(label)) {
    return { icon: "skull-outline", color: INVENTORY.red };
  }
  if (/no movement|180/.test(label)) {
    return { icon: "information-circle-outline", color: "#2563eb" };
  }
  if (/negative/.test(label)) {
    return { icon: "remove-circle-outline", color: INVENTORY.purple };
  }
  return { icon: "notifications-outline", color: INVENTORY.subtitle };
}

export function InventoryAlertsList({ entry }: Props) {
  const rows = entry.payload.rows?.length ? entry.payload.rows : [];

  if (!rows.length) return null;

  return (
    <View style={styles.wrap}>
      <InventorySectionHeader
        title={entry.label || "Inventory Alerts"}
        rightLabel="View All"
      />
      {rows.map((row, i) => {
        const count = Number(row.value) || 0;
        const { icon, color } = alertIcon(row);
        return (
          <TouchableOpacity
            key={`${row.id}-${i}`}
            style={styles.row}
            activeOpacity={0.85}
          >
            <Ionicons name={icon} size={16} color={color} />
            <Text style={styles.label} numberOfLines={2}>
              {row.label}
            </Text>
            <Text style={styles.count}>{count.toLocaleString("en-US")}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: INVENTORY.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: INVENTORY.border,
    marginBottom: 12,
    minWidth: 0,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f1f5f9",
  },
  label: {
    flex: 1,
    fontSize: 12,
    fontFamily: Fonts.body,
    color: INVENTORY.value,
    lineHeight: 16,
  },
  count: {
    fontSize: 14,
    fontFamily: Fonts.bodyBold,
    color: INVENTORY.value,
    minWidth: 32,
    textAlign: "right",
  },
});
