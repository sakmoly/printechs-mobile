import React, { useMemo, useState, useImperativeHandle, forwardRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Fonts } from "../../theme/typography";
import {
  PERIOD_PRESET_OPTIONS,
  resolvePeriod,
  type PeriodPreset,
} from "../../utils/period";
import {
  ReceivablesFilterPicker,
  type FilterPickerOption,
} from "../receivables/ReceivablesFilterPicker";
import {
  ALL_TERRITORIES,
  territoryLabel,
} from "../../utils/dashboardTerritory";
import { formatDateRangeLabel } from "../../screens/home/homeTheme";

export type CompareMode = "ly" | "none";

export type DashboardFilterTheme = {
  card: string;
  border: string;
  title: string;
  subtitle: string;
  refreshBtn?: string;
};

type Props = {
  theme: DashboardFilterTheme;
  territories?: string[];
  selectedTerritory?: string;
  periodPreset: PeriodPreset;
  compareMode: CompareMode;
  onPeriodChange: (preset: PeriodPreset) => void;
  onCompareChange: (mode: CompareMode) => void;
  onTerritoryChange: (territory: string) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
};

const PERIOD_OPTIONS = PERIOD_PRESET_OPTIONS.filter((o) => o.id !== "custom");

const COMPARE_OPTIONS: FilterPickerOption[] = [
  { id: "ly", label: "Last Year", subtitle: "Show vs LY on KPIs and charts" },
  { id: "none", label: "None", subtitle: "Current period only" },
];

type PickerKind = "period" | "compare" | "territory" | null;

export type DashboardFilterBarHandle = {
  openPeriodPicker: () => void;
};

export const DashboardFilterBar = forwardRef<DashboardFilterBarHandle, Props>(
  function DashboardFilterBar(
    {
      theme,
      territories = [],
      selectedTerritory,
      periodPreset,
      compareMode,
      onPeriodChange,
      onCompareChange,
      onTerritoryChange,
      onRefresh,
      refreshing,
    },
    ref
  ) {
    const [picker, setPicker] = useState<PickerKind>(null);

    useImperativeHandle(ref, () => ({
      openPeriodPicker: () => setPicker("period"),
    }));

    const period = useMemo(() => resolvePeriod(periodPreset), [periodPreset]);
    const dateLabel = formatDateRangeLabel(period.from_date, period.to_date);
    const activeTerritory = selectedTerritory || ALL_TERRITORIES;
    const territoryShort = territoryLabel(activeTerritory, territories);
    const compareLabel = compareMode === "ly" ? "Last Year" : "None";

    const periodPickerOptions: FilterPickerOption[] = PERIOD_OPTIONS.map((o) => {
      const range = resolvePeriod(o.id);
      return {
        id: o.id,
        label: o.label,
        subtitle: formatDateRangeLabel(range.from_date, range.to_date),
      };
    });

    const territoryPickerOptions: FilterPickerOption[] = useMemo(() => {
      const opts: FilterPickerOption[] = [
        {
          id: ALL_TERRITORIES,
          label: "All Territories",
          subtitle: "Company-wide within your access",
        },
      ];
      for (const t of territories) {
        opts.push({ id: t, label: t });
      }
      return opts;
    }, [territories]);

    return (
      <View style={styles.wrap}>
        <TouchableOpacity
          style={[
            styles.pill,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
          activeOpacity={0.85}
          onPress={() => setPicker("period")}
        >
          <Ionicons name="calendar-outline" size={13} color={theme.subtitle} />
          <Text style={[styles.pillText, { color: theme.title }]} numberOfLines={1}>
            {dateLabel}
          </Text>
          <Ionicons name="chevron-down" size={12} color={theme.subtitle} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.pill,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
          activeOpacity={0.85}
          onPress={() => setPicker("compare")}
        >
          <Text style={[styles.pillText, { color: theme.title }]} numberOfLines={1}>
            {compareLabel}
          </Text>
          <Ionicons name="chevron-down" size={12} color={theme.subtitle} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.pill,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
          activeOpacity={0.85}
          onPress={() => setPicker("territory")}
        >
          <Text style={[styles.pillText, { color: theme.title }]} numberOfLines={1}>
            {territoryShort}
          </Text>
          <Ionicons name="chevron-down" size={12} color={theme.subtitle} />
        </TouchableOpacity>

        {onRefresh ? (
          <TouchableOpacity
            style={[
              styles.refreshBtn,
              { backgroundColor: theme.refreshBtn || theme.title },
            ]}
            activeOpacity={0.85}
            onPress={onRefresh}
            disabled={refreshing}
          >
            <Ionicons name="refresh-outline" size={18} color="#fff" />
          </TouchableOpacity>
        ) : null}

        <ReceivablesFilterPicker
          visible={picker === "period"}
          title="Date Range"
          options={periodPickerOptions}
          selectedId={periodPreset}
          onSelect={(id) => {
            onPeriodChange(id as PeriodPreset);
            setPicker(null);
          }}
          onClose={() => setPicker(null)}
        />
        <ReceivablesFilterPicker
          visible={picker === "compare"}
          title="Comparison"
          options={COMPARE_OPTIONS}
          selectedId={compareMode}
          onSelect={(id) => {
            onCompareChange(id as CompareMode);
            setPicker(null);
          }}
          onClose={() => setPicker(null)}
        />
        <ReceivablesFilterPicker
          visible={picker === "territory"}
          title="Territory"
          options={territoryPickerOptions}
          selectedId={activeTerritory}
          onSelect={(id) => {
            onTerritoryChange(id);
            setPicker(null);
          }}
          onClose={() => setPicker(null)}
        />
      </View>
    );
  }
);

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    maxWidth: "48%",
    flexGrow: 1,
    minWidth: 100,
  },
  pillText: {
    flex: 1,
    fontSize: 11,
    fontFamily: Fonts.bodySemi,
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: "auto",
  },
});
