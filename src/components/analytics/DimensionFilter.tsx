/**
 * Single logical-dimension filter control.
 * Picks UI by data_type — never uses custom_* field names.
 */

import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Switch,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Fonts, Type } from "../../theme/typography";
import type { ResolvedDimension } from "../../dimensions";
import type { DimensionValue } from "../../api/dimensions";
import { useDimensionValues } from "../../hooks/useDimensionValues";

export const DIMENSION_FILTER_ALL = "__all__";

export type DimensionFilterValue =
  | string
  | string[]
  | boolean
  | number
  | null
  | undefined;

type Props = {
  dimension: ResolvedDimension;
  value: DimensionFilterValue;
  onChange: (next: DimensionFilterValue) => void;
  company?: string;
  /** Used when get_dimension_values is empty / missing */
  staticOptions?: DimensionValue[];
  /** Compact chip row (default) vs always-open modal list */
  variant?: "chips" | "field";
};

function asStringValue(value: DimensionFilterValue): string {
  if (value == null || value === "" || value === false) {
    return DIMENSION_FILTER_ALL;
  }
  if (typeof value === "boolean") return value ? "1" : "0";
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return value[0] || DIMENSION_FILTER_ALL;
  return value;
}

export function DimensionFilter({
  dimension,
  value,
  onChange,
  company,
  staticOptions,
  variant = "chips",
}: Props) {
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const dataType = (dimension.data_type || "Data").toLowerCase();

  const { data: remoteOptions = [], isFetching } = useDimensionValues(
    {
      dimension: dimension.key,
      search: search || undefined,
      limit: 80,
      company,
    },
    {
      enabled: dataType !== "check" && dataType !== "int" && dataType !== "float",
      staticFallback: staticOptions,
    }
  );

  const options = useMemo(() => {
    const base =
      remoteOptions.length > 0 ? remoteOptions : staticOptions || [];
    return base;
  }, [remoteOptions, staticOptions]);

  // ——— Check ———
  if (dataType === "check") {
    const on = value === true || value === "1" || value === 1;
    return (
      <View style={styles.wrap}>
        <View style={styles.checkRow}>
          <Text style={styles.caption}>{dimension.label}</Text>
          <Switch
            value={on}
            onValueChange={(v) => onChange(v)}
            trackColor={{ false: "#cbd5e1", true: "#a5b4fc" }}
            thumbColor={on ? "#667eea" : "#f8fafc"}
          />
        </View>
      </View>
    );
  }

  // ——— Number ———
  if (dataType === "int" || dataType === "float" || dataType === "currency") {
    const str =
      value == null || value === DIMENSION_FILTER_ALL ? "" : String(value);
    return (
      <View style={styles.wrap}>
        <Text style={styles.caption}>{dimension.label}</Text>
        <TextInput
          style={styles.input}
          value={str}
          keyboardType="numeric"
          placeholder="Any"
          placeholderTextColor="#94a3b8"
          onChangeText={(t) => {
            if (!t.trim()) {
              onChange(null);
              return;
            }
            const n =
              dataType === "int" ? parseInt(t, 10) : parseFloat(t);
            onChange(Number.isFinite(n) ? n : null);
          }}
        />
      </View>
    );
  }

  // ——— Date (simple ISO text; full picker can land later) ———
  if (dataType === "date") {
    const str =
      value == null || value === DIMENSION_FILTER_ALL ? "" : String(value);
    return (
      <View style={styles.wrap}>
        <Text style={styles.caption}>{dimension.label}</Text>
        <TextInput
          style={styles.input}
          value={str}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#94a3b8"
          onChangeText={(t) => onChange(t.trim() || null)}
        />
      </View>
    );
  }

  // ——— Select / Link / Data — chips + optional search modal ———
  const current = asStringValue(value);
  const isLink = dataType === "link" || options.length > 8;
  const activeLabel =
    current === DIMENSION_FILTER_ALL
      ? `All ${dimension.label.toLowerCase()}`
      : options.find((o) => o.value === current)?.label || current;

  const chips = [
    { value: DIMENSION_FILTER_ALL, label: "All" },
    ...options.slice(0, variant === "chips" && !isLink ? 24 : 12),
  ];

  const openPicker = () => setModalOpen(true);

  return (
    <View style={styles.wrap}>
      <View style={styles.captionRow}>
        <Text style={styles.caption}>
          {dimension.label} · {activeLabel}
        </Text>
        {(isLink || options.length > 8) && (
          <TouchableOpacity onPress={openPicker} hitSlop={8}>
            <Ionicons name="search" size={16} color="#667eea" />
          </TouchableOpacity>
        )}
      </View>

      {options.length === 0 && !isFetching ? (
        <Text style={styles.emptyHint}>
          No values yet (server dimension list unavailable)
        </Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
        >
          {chips.map((opt) => {
            const active =
              current === opt.value ||
              (opt.value === DIMENSION_FILTER_ALL &&
                (current === DIMENSION_FILTER_ALL || !current));
            return (
              <TouchableOpacity
                key={`${dimension.key}-${opt.value}`}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() =>
                  onChange(
                    opt.value === DIMENSION_FILTER_ALL ? null : opt.value
                  )
                }
                activeOpacity={0.85}
              >
                <Text
                  style={[styles.chipText, active && styles.chipTextActive]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
          {(isLink || options.length > chips.length - 1) && (
            <TouchableOpacity
              style={styles.chipMore}
              onPress={openPicker}
              activeOpacity={0.85}
            >
              <Text style={styles.chipMoreText}>More</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}

      <Modal
        visible={modalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{dimension.label}</Text>
              <TouchableOpacity onPress={() => setModalOpen(false)}>
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.search}
              value={search}
              onChangeText={setSearch}
              placeholder="Search…"
              placeholderTextColor="#94a3b8"
              autoCorrect={false}
            />
            <ScrollView style={styles.modalList}>
              <TouchableOpacity
                style={styles.modalRow}
                onPress={() => {
                  onChange(null);
                  setModalOpen(false);
                }}
              >
                <Text style={styles.modalRowText}>All</Text>
              </TouchableOpacity>
              {options
                .filter((o) =>
                  !search.trim()
                    ? true
                    : o.label.toLowerCase().includes(search.toLowerCase()) ||
                      o.value.toLowerCase().includes(search.toLowerCase())
                )
                .map((o) => (
                  <TouchableOpacity
                    key={o.value}
                    style={styles.modalRow}
                    onPress={() => {
                      onChange(o.value);
                      setModalOpen(false);
                      setSearch("");
                    }}
                  >
                    <Text
                      style={[
                        styles.modalRowText,
                        current === o.value && styles.modalRowActive,
                      ]}
                    >
                      {o.label}
                    </Text>
                    {current === o.value ? (
                      <Ionicons name="checkmark" size={18} color="#667eea" />
                    ) : null}
                  </TouchableOpacity>
                ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 10,
  },
  captionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  caption: {
    ...Type.label,
    fontFamily: Fonts.bodySemi,
    color: "#6b7280",
    marginBottom: 0,
    flex: 1,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 10 : 8,
    fontFamily: Fonts.body,
    fontSize: 14,
    color: "#1f2937",
  },
  row: {
    gap: 8,
    paddingRight: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  chipActive: {
    backgroundColor: "#667eea",
    borderColor: "#667eea",
  },
  chipText: {
    fontFamily: Fonts.bodySemi,
    fontSize: 13,
    color: "#475569",
  },
  chipTextActive: {
    color: "#fff",
  },
  chipMore: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#eef2ff",
    borderWidth: 1,
    borderColor: "#c7d2fe",
  },
  chipMoreText: {
    fontFamily: Fonts.bodySemi,
    fontSize: 13,
    color: "#667eea",
  },
  emptyHint: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: "#94a3b8",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "72%",
    paddingBottom: Platform.OS === "ios" ? 28 : 16,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  modalTitle: {
    fontFamily: Fonts.displaySemi,
    fontSize: 17,
    color: "#0f172a",
  },
  search: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 10 : 8,
    fontFamily: Fonts.body,
    fontSize: 14,
    color: "#1f2937",
  },
  modalList: {
    paddingHorizontal: 8,
  },
  modalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e2e8f0",
  },
  modalRowText: {
    fontFamily: Fonts.body,
    fontSize: 15,
    color: "#334155",
  },
  modalRowActive: {
    fontFamily: Fonts.bodySemi,
    color: "#667eea",
  },
});
