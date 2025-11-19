import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

interface CombinedKpiCardProps {
  mtdValue: number;
  ytdValue: number;
  todayValue: number;
  previousMtdValue?: number;
  previousYtdValue?: number;
  previousTodayValue?: number;
  marginPercent?: number;
  currency?: string;
  onPress?: () => void;
}

const formatCurrency = (value: number, currency: string = "SAR"): string => {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  } else if (value >= 1000) {
    return `${(value / 1000).toFixed(0)}K`;
  }
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
};

export const CombinedKpiCard: React.FC<CombinedKpiCardProps> = ({
  mtdValue,
  ytdValue,
  todayValue,
  previousMtdValue,
  previousYtdValue,
  previousTodayValue,
  marginPercent,
  currency = "SAR",
  onPress,
}) => {
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Helper function to calculate change percentage
  const calculateChange = (current: number, previous?: number): number => {
    if (!previous || previous === 0) return 0;
    return ((current - previous) / previous) * 100;
  };

  // Helper function to get change color
  const getChangeColor = (change: number): string => {
    if (change > 0) return "#10b981"; // Green
    if (change < 0) return "#ef4444"; // Red
    return "#6b7280"; // Gray
  };

  const kpiItems = [
    {
      label: "Today",
      value: todayValue,
      previousValue: previousTodayValue,
      icon: "today" as const,
      color: "#3b82f6",
      gradient: ["#3b82f6", "#2563eb"],
    },
    {
      label: "MTD",
      value: mtdValue,
      previousValue: previousMtdValue,
      icon: "calendar" as const,
      color: "#8b5cf6",
      gradient: ["#8b5cf6", "#7c3aed"],
    },
    {
      label: "YTD",
      value: ytdValue,
      previousValue: previousYtdValue,
      icon: "trending-up" as const,
      color: "#10b981",
      gradient: ["#10b981", "#059669"],
    },
  ];

  return (
    <Animated.View
      style={[
        styles.card,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={onPress}
        style={styles.touchable}
      >
        <LinearGradient
          colors={["#667eea", "#764ba2"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.iconBadge}>
                <Ionicons name="stats-chart" size={24} color="#ffffff" />
              </View>
              <View>
                <Text style={styles.headerTitle}>Sales Performance</Text>
                {marginPercent !== undefined && (
                  <Text style={styles.headerSubtitle}>
                    Margin: {marginPercent.toFixed(1)}%
                  </Text>
                )}
              </View>
            </View>
            <View style={styles.headerBadge}>
              <View style={styles.pulseDot} />
              <Text style={styles.headerBadgeText}>LIVE</Text>
            </View>
          </View>

          {/* KPI Items */}
          <View style={styles.kpiContainer}>
            {kpiItems.map((item, index) => {
              const change = calculateChange(item.value, item.previousValue);
              const changeColor = getChangeColor(change);
              const isPositive = change > 0;

              return (
                <View key={item.label} style={styles.kpiItem}>
                  <LinearGradient
                    colors={item.gradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.kpiItemGradient}
                  >
                    <View style={styles.kpiItemContent}>
                      <View style={styles.kpiItemLeft}>
                        <View style={styles.kpiIconWrapper}>
                          <Ionicons
                            name={item.icon}
                            size={24}
                            color="#ffffff"
                          />
                        </View>
                        <View style={styles.kpiItemText}>
                          <Text style={styles.kpiItemLabel}>{item.label}</Text>
                          <Text style={styles.kpiItemValue}>
                            {currency} {formatCurrency(item.value)}
                          </Text>
                        </View>
                      </View>

                      {item.previousValue !== undefined && (
                        <View style={styles.comparison}>
                          <View
                            style={[
                              styles.changeBadge,
                              {
                                backgroundColor: `${changeColor}20`,
                                borderColor: `${changeColor}40`,
                              },
                            ]}
                          >
                            <Ionicons
                              name={isPositive ? "arrow-up" : "arrow-down"}
                              size={14}
                              color={changeColor}
                            />
                            <Text
                              style={[
                                styles.changeText,
                                { color: changeColor },
                              ]}
                            >
                              {Math.abs(change).toFixed(1)}%
                            </Text>
                          </View>
                          <Text style={styles.previousValue}>
                            vs {currency} {formatCurrency(item.previousValue)}
                          </Text>
                        </View>
                      )}
                    </View>
                  </LinearGradient>
                </View>
              );
            })}
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Tap to view detailed reports</Text>
            <Ionicons name="arrow-forward" size={16} color="#ffffff" />
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 0,
    marginTop: 0,
    borderRadius: 20,
    shadowColor: "#667eea",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  touchable: {
    borderRadius: 20,
    overflow: "hidden",
  },
  gradient: {
    padding: 24,
    borderRadius: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#ffffff",
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.9)",
  },
  headerBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#10b981",
  },
  headerBadgeText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  kpiContainer: {
    gap: 12,
  },
  kpiItem: {
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  kpiItemGradient: {
    padding: 16,
  },
  kpiItemContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  kpiItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  kpiIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  kpiItemText: {
    flex: 1,
  },
  kpiItemLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.8)",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  kpiItemValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#ffffff",
  },
  comparison: {
    alignItems: "flex-end",
  },
  changeBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
    marginBottom: 4,
  },
  changeText: {
    fontSize: 11,
    fontWeight: "800",
  },
  previousValue: {
    fontSize: 10,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.7)",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    paddingTop: 16,
    gap: 8,
  },
  footerText: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.9)",
  },
});
