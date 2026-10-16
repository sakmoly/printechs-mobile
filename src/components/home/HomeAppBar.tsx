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
import { HOME } from "../../screens/home/homeTheme";
import { Fonts } from "../../theme/typography";

type Props = {
  title: string;
  subtitle?: string;
  onFilterPress?: () => void;
  onNotificationsPress?: () => void;
  notificationCount?: number;
};

export function HomeAppBar({
  title,
  subtitle,
  onFilterPress,
  onNotificationsPress,
  notificationCount = 0,
}: Props) {
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
          color={HOME.title}
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
            <Ionicons name="funnel-outline" size={20} color={HOME.title} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtn}
            activeOpacity={0.85}
            onPress={onNotificationsPress}
          >
            <Ionicons
              name="notifications-outline"
              size={20}
              color={HOME.title}
            />
            {notificationCount > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {notificationCount > 99 ? "99+" : notificationCount}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: HOME.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: HOME.border,
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
    color: HOME.title,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: Fonts.body,
    color: HOME.subtitle,
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
  badge: {
    position: "absolute",
    top: 2,
    right: 2,
    backgroundColor: HOME.red,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: {
    color: "#fff",
    fontSize: 9,
    fontFamily: Fonts.bodyBold,
  },
});
