import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { SALES, sectionTitleUpper } from "../../screens/sales/salesTheme";
import { Fonts } from "../../theme/typography";

type Props = {
  title: string;
  rightLabel?: string;
  rightAction?: () => void;
};

export function SalesSectionHeader({ title, rightLabel, rightAction }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{sectionTitleUpper(title)}</Text>
      {rightLabel ? (
        <TouchableOpacity onPress={rightAction} activeOpacity={0.85}>
          <Text style={styles.link}>{rightLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    marginTop: 6,
    gap: 8,
  },
  title: {
    flex: 1,
    fontSize: 12,
    fontFamily: Fonts.bodyBold,
    color: SALES.title,
    letterSpacing: 0.4,
  },
  link: {
    fontSize: 12,
    fontFamily: Fonts.bodySemi,
    color: SALES.link,
  },
});
