import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { RECEIVABLES, sectionTitleUpper } from "../../screens/receivables/receivablesTheme";
import { Fonts } from "../../theme/typography";

type Props = {
  title: string;
  rightLabel?: string;
  rightAction?: () => void;
  subtitle?: string;
};

export function ReceivablesSectionHeader({
  title,
  rightLabel,
  rightAction,
  subtitle,
}: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.left}>
        <Text style={styles.title}>{sectionTitleUpper(title)}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
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
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 10,
    marginTop: 6,
    gap: 8,
  },
  left: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 12,
    fontFamily: Fonts.bodyBold,
    color: RECEIVABLES.title,
    letterSpacing: 0.4,
  },
  subtitle: {
    fontSize: 11,
    fontFamily: Fonts.body,
    color: RECEIVABLES.link,
    marginTop: 2,
  },
  link: {
    fontSize: 12,
    fontFamily: Fonts.bodySemi,
    color: RECEIVABLES.link,
  },
});
