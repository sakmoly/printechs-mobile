import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { INVENTORY } from "../../screens/inventory/inventoryTheme";
import { Fonts } from "../../theme/typography";

type Props = {
  title: string;
  rightLabel?: string;
  rightAction?: () => void;
  subtitle?: string;
};

export function InventorySectionHeader({
  title,
  rightLabel,
  rightAction,
  subtitle,
}: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.left}>
        <Text style={styles.title}>{title.toUpperCase()}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {rightLabel ? (
        <TouchableOpacity
          onPress={rightAction}
          activeOpacity={0.85}
          disabled={!rightAction}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.right}>{rightLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 10,
    gap: 8,
  },
  left: { flex: 1, minWidth: 0 },
  title: {
    fontSize: 12,
    fontFamily: Fonts.bodyBold,
    color: INVENTORY.title,
    letterSpacing: 0.4,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 11,
    fontFamily: Fonts.body,
    color: INVENTORY.subtitle,
  },
  right: {
    fontSize: 11,
    fontFamily: Fonts.bodySemi,
    color: INVENTORY.link,
  },
});
