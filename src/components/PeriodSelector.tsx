import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import {
  PERIOD_PRESET_OPTIONS,
  type PeriodPreset,
  type DateRange,
} from "../utils/period";
import { Fonts, Type } from "../theme/typography";

type Props = {
  value: DateRange;
  onChange: (preset: PeriodPreset) => void;
  hideCustom?: boolean;
};

export function PeriodSelector({
  value,
  onChange,
  hideCustom = true,
}: Props) {
  const options = hideCustom
    ? PERIOD_PRESET_OPTIONS.filter((o) => o.id !== "custom")
    : PERIOD_PRESET_OPTIONS;

  return (
    <View style={styles.wrap}>
      <Text style={styles.caption}>Period · {value.label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {options.map((opt) => {
          const active = value.preset === opt.id;
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
    marginBottom: 12,
  },
  caption: {
    ...Type.label,
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
