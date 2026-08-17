import React from "react";
import { ScrollView, StyleSheet, View, Text } from "react-native";
import { MonthlySalesTrend } from "../MonthlySalesTrend";
import { TerritoryPieChart } from "../TerritoryPieChart";
import { DivisionPieChart } from "../DivisionPieChart";
import { useDimensionEnabled } from "../../hooks/useBootstrap";

interface TrendsTabProps {
  monthlyTrend?: {
    labels?: string[];
    current?: number[];
    previous?: number[];
  };
  territoryData?: any[];
  divisionData?: any[];
  lastYearTerritoryData?: any[];
  lastYearDivisionData?: any[];
}

export const TrendsTab: React.FC<TrendsTabProps> = ({
  monthlyTrend,
  territoryData,
  divisionData,
  lastYearTerritoryData,
  lastYearDivisionData,
}) => {
  const showTerritory = useDimensionEnabled("territory");
  const showDivision = useDimensionEnabled("division");

  const hasTerritory = showTerritory && !!territoryData?.length;
  const hasDivision = showDivision && !!divisionData?.length;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.headerSection}>
        <Text style={styles.headerTitle}>Sales Trends Analysis</Text>
        <Text style={styles.headerSubtitle}>
          Year-to-Date Performance Trends
        </Text>
      </View>

      {monthlyTrend &&
      monthlyTrend.labels &&
      monthlyTrend.current &&
      monthlyTrend.previous ? (
        <MonthlySalesTrend
          labels={monthlyTrend.labels}
          current={monthlyTrend.current}
          previous={monthlyTrend.previous}
          title="Monthly Sales Trend YTD"
        />
      ) : (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>No trend data available</Text>
          <Text style={styles.subText}>
            Monthly sales trend data is not available for the YTD period
          </Text>
        </View>
      )}

      {showTerritory &&
        (hasTerritory ? (
          <TerritoryPieChart
            data={territoryData!}
            title="Territory Performance YTD"
          />
        ) : (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>No territory data available</Text>
            <Text style={styles.subText}>
              Territory performance data is not available for this site
            </Text>
          </View>
        ))}

      {showDivision &&
        (hasDivision ? (
          <DivisionPieChart
            data={divisionData!}
            title="Division Performance YTD"
          />
        ) : (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>No division data available</Text>
            <Text style={styles.subText}>
              Division is not used or returned empty for this site
            </Text>
          </View>
        ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#f8fafc",
  },
  headerSection: {
    marginBottom: 24,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1f2937",
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#6b7280",
  },
  loadingContainer: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 4,
  },
  subText: {
    fontSize: 13,
    color: "#9ca3af",
    textAlign: "center",
  },
});
