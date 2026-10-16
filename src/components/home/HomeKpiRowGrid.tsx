import React from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { HomeKpiCard } from "./HomeKpiCard";
import { HomeSectionHeader } from "./HomeSectionHeader";
import type { HomeWidgetEntry } from "../../screens/home/buildHomeSections";

type GridProps = {
  items: HomeWidgetEntry[];
  columns?: number;
  showLy?: boolean;
  selectedTerritory?: string;
};

export function HomeKpiRowGrid({
  items,
  columns = 2,
  showLy = true,
  selectedTerritory,
}: GridProps) {
  const rows: HomeWidgetEntry[][] = [];
  for (let i = 0; i < items.length; i += columns) {
    rows.push(items.slice(i, i + columns));
  }
  return (
    <>
      {rows.map((row, ri) => (
        <View key={`home-kpi-row-${ri}`} style={styles.row}>
          {row.map((item) => (
            <HomeKpiCard
              key={item.key}
              payload={item.payload}
              label={item.label}
              showLy={showLy}
              selectedTerritory={selectedTerritory}
            />
          ))}
          {row.length < columns
            ? Array.from({ length: columns - row.length }).map((_, si) => (
                <View key={`spacer-${si}`} style={styles.spacer} />
              ))
            : null}
        </View>
      ))}
    </>
  );
}

type StripProps = {
  items: HomeWidgetEntry[];
  showLy?: boolean;
  selectedTerritory?: string;
};

export function HomeKeyIndicatorsStrip({
  items,
  showLy = true,
  selectedTerritory,
}: StripProps) {
  if (!items.length) return null;
  return (
    <View style={styles.stripWrap}>
      <HomeSectionHeader title="Key Indicators" rightLabel="View All" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {items.map((item) => (
          <HomeKpiCard
            key={item.key}
            payload={item.payload}
            label={item.label}
            showLy={showLy}
            compact
            selectedTerritory={selectedTerritory}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },
  spacer: { flex: 1 },
  stripWrap: { marginBottom: 12 },
  scroll: { gap: 10, paddingRight: 4 },
});
