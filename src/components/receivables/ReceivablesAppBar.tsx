import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { systemStatusBarClearance } from "../SafeScreen";
import { ScreenHeaderNav } from "../ScreenHeaderNav";
import { RECEIVABLES } from "../../screens/receivables/receivablesTheme";
import { Fonts } from "../../theme/typography";

type Props = {
  title: string;
  subtitle?: string;
  onFilterPress?: () => void;
};

export function ReceivablesAppBar({ title, subtitle, onFilterPress }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.wrap,
        {
          paddingTop: systemStatusBarClearance(
            insets.top,
            Platform.OS === "ios" ? 8 : 6
          ),
        },
      ]}
    >
      <View style={styles.row}>
        <ScreenHeaderNav
          color={RECEIVABLES.title}
          buttonBackground="#f1f5f9"
          showHome={false}
        />
        <View style={styles.titles}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.iconBtn}
            activeOpacity={0.85}
            onPress={onFilterPress}
          >
            <Ionicons name="funnel-outline" size={20} color={RECEIVABLES.title} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} activeOpacity={0.85}>
            <Ionicons
              name="ellipsis-vertical"
              size={20}
              color={RECEIVABLES.title}
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: RECEIVABLES.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: RECEIVABLES.border,
    paddingBottom: 10,
    paddingHorizontal: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  titles: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 4,
  },
  title: {
    fontSize: 17,
    fontFamily: Fonts.bodyBold,
    color: RECEIVABLES.title,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: Fonts.body,
    color: RECEIVABLES.subtitle,
    marginTop: 1,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8fafc",
  },
});
