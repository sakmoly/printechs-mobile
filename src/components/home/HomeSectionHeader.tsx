import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { HOME } from "../../screens/home/homeTheme";
import { Fonts } from "../../theme/typography";

type Props = {
  title: string;
  rightLabel?: string;
};

export function HomeSectionHeader({ title, rightLabel }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title.toUpperCase()}</Text>
      {rightLabel ? <Text style={styles.right}>{rightLabel}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  title: {
    fontSize: 12,
    fontFamily: Fonts.bodyBold,
    color: HOME.title,
    letterSpacing: 0.4,
  },
  right: {
    fontSize: 11,
    fontFamily: Fonts.bodySemi,
    color: HOME.link,
  },
});
