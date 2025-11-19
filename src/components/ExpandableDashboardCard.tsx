import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

interface ExpandableDashboardCardProps {
  icon: string;
  title: string;
  color: string;
  iconBgColor: string;
  metrics: {
    label: string;
    value: string | number;
    change?: number | string;
    format?: "currency" | "number" | "percentage";
    previousYearValue?: string | number; // Add previous year value
  }[];
  expandedContent?: React.ReactNode;
  onPress?: () => void;
}

export const ExpandableDashboardCard: React.FC<
  ExpandableDashboardCardProps
> = ({
  icon,
  title,
  color,
  iconBgColor,
  metrics,
  expandedContent,
  onPress,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const rotation = React.useRef(new Animated.Value(0)).current;

  const toggleExpand = () => {
    const toValue = isExpanded ? 0 : 1;
    Animated.spring(rotation, {
      toValue,
      useNativeDriver: true,
      tension: 50,
      friction: 7,
    }).start();
    setIsExpanded(!isExpanded);
  };

  const rotate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });

  const formatValue = (value: string | number, format?: string) => {
    if (typeof value === "number") {
      if (format === "currency") {
        // Remove SAR, show only number with comma formatting
        return value.toLocaleString("en-US", {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        });
      }
      if (format === "percentage") {
        return `${value}%`;
      }
      return value.toLocaleString();
    }
    return value;
  };

  const getChangeValue = (change: number | string | undefined): number => {
    if (change === undefined) return 0;
    if (typeof change === "number") return change;
    return parseFloat(change.toString()) || 0;
  };

  return (
    <View style={styles.card}>
      {/* Header */}
      <TouchableOpacity
        style={styles.cardHeader}
        onPress={expandedContent ? toggleExpand : onPress}
        activeOpacity={0.7}
      >
        <View style={styles.headerLeft}>
          <View
            style={[styles.iconContainer, { backgroundColor: iconBgColor }]}
          >
            <Ionicons name={icon as any} size={24} color={color} />
          </View>
          <Text style={styles.cardTitle}>{title}</Text>
        </View>
        {expandedContent && (
          <Animated.View style={{ transform: [{ rotate }] }}>
            <Ionicons name="chevron-down" size={24} color="#6b7280" />
          </Animated.View>
        )}
      </TouchableOpacity>

      {/* Quick Metrics - Only visible when expanded or if no expanded content */}
      {(isExpanded || !expandedContent) && (
        <View style={styles.metricsContainer}>
          {metrics.map((metric, index) => {
            const changeValue = getChangeValue(metric.change);
            const isPositive = changeValue >= 0;
            
            return (
              <View key={index} style={styles.metricRow}>
                <View style={styles.metricLeft}>
                  <Text style={styles.metricLabel}>{metric.label}</Text>
                  <View style={styles.metricValueContainer}>
                    <Text style={styles.metricValue}>
                      {formatValue(metric.value, metric.format)}
                    </Text>
                    {metric.previousYearValue !== undefined && (
                      <Text style={styles.metricPreviousYear}>
                        LY: {formatValue(metric.previousYearValue, metric.format)}
                      </Text>
                    )}
                  </View>
                </View>
                <View style={styles.metricRight}>
                  {metric.change !== undefined && (
                    <View
                      style={[
                        styles.changeBadge,
                        isPositive
                          ? styles.changePositive
                          : styles.changeNegative,
                      ]}
                    >
                      <Ionicons
                        name={isPositive ? "arrow-up" : "arrow-down"}
                        size={14}
                        color={isPositive ? "#10b981" : "#ef4444"}
                      />
                      <Text
                        style={[
                          styles.changeText,
                          isPositive
                            ? styles.changeTextPositive
                            : styles.changeTextNegative,
                        ]}
                      >
                        {Math.abs(changeValue)}%
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Expanded Content */}
      {isExpanded && expandedContent && (
        <View style={styles.expandedContent}>{expandedContent}</View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1f2937",
  },
  metricsContainer: {
    gap: 16,
  },
  metricRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  metricLeft: {
    flex: 1,
  },
  metricLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6b7280",
    marginBottom: 4,
  },
  metricValueContainer: {
    gap: 2,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1f2937",
  },
  metricPreviousYear: {
    fontSize: 12,
    fontWeight: "500",
    color: "#9ca3af",
  },
  metricRight: {
    marginLeft: 12,
  },
  changeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  changePositive: {
    backgroundColor: "#d1fae5",
  },
  changeNegative: {
    backgroundColor: "#fee2e2",
  },
  changeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  changeTextPositive: {
    color: "#10b981",
  },
  changeTextNegative: {
    color: "#ef4444",
  },
  expandedContent: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
  },
});
