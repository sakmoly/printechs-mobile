import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { Fonts, Type } from "../theme/typography";

export const ALL_TERRITORIES = "__all__";

type Props = {
  /** Territory names available for filtering */
  options: string[];
  /** `ALL_TERRITORIES` or a territory name */
  value: string;
  onChange: (territory: string) => void;
};

/**
 * Chip row to filter Sales / executive KPIs by territory.
 * "All" = company-wide or full view scope (no single-territory pin).
 */
export function TerritoryFilter({ options, value, onChange }: Props) {
  if (!options.length) return null;

  const chips = [
    { id: ALL_TERRITORIES, label: "All" },
    ...options.map((t) => ({ id: t, label: t })),
  ];

  const activeLabel =
    value === ALL_TERRITORIES || !value ? "All territories" : value;

  return (
    <View style={styles.wrap}>
      <Text style={styles.caption}>Territory · {activeLabel}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {chips.map((opt) => {
          const active =
            value === opt.id ||
            (opt.id === ALL_TERRITORIES &&
              (value === ALL_TERRITORIES || !value));
          return (
            <TouchableOpacity
              key={opt.id}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => onChange(opt.id)}
              activeOpacity={0.85}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 10,
  },
  caption: {
    ...Type.label,
    fontFamily: Fonts.bodySemi,
    color: "#6b7280",
    marginBottom: 8,
  },
  row: {
    gap: 8,
    paddingRight: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  chipActive: {
    backgroundColor: "#667eea",
    borderColor: "#667eea",
  },
  chipText: {
    fontFamily: Fonts.bodySemi,
    fontSize: 13,
    color: "#4b5563",
  },
  chipTextActive: {
    color: "#ffffff",
    fontFamily: Fonts.bodyBold,
  },
});
