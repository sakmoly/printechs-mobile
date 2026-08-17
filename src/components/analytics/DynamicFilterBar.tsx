/**
 * Renders filterable logical dimensions from bootstrap (Phase G).
 * Company is usually fixed from Access Profile — excluded by default.
 */

import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Fonts, Type } from "../../theme/typography";
import {
  useFilterableDimensions,
} from "../../hooks/useBootstrap";
import type { ResolvedDimension } from "../../dimensions";
import type { DimensionValue } from "../../api/dimensions";
import {
  DimensionFilter,
  DIMENSION_FILTER_ALL,
  type DimensionFilterValue,
} from "./DimensionFilter";

export type DimensionFilterMap = Record<string, DimensionFilterValue>;

type Props = {
  /** Controlled filter values (logical keys → value) */
  value: DimensionFilterMap;
  onChange: (next: DimensionFilterMap) => void;
  /** Restrict to these logical keys (intersection with filterable bootstrap dims) */
  keys?: string[];
  /** Always hide these (default includes company) */
  excludeKeys?: string[];
  company?: string;
  /** Static option lists keyed by logical dimension */
  staticOptions?: Record<string, DimensionValue[]>;
  /** Override dimension list instead of bootstrap */
  dimensions?: ResolvedDimension[];
  title?: string;
};

const DEFAULT_EXCLUDE = ["company"];

/**
 * Convert filter map into BA query params (drops All / empty / physical keys).
 */
export function dimensionFiltersToParams(
  filters: DimensionFilterMap
): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [key, raw] of Object.entries(filters)) {
    if (!key || /^custom_/i.test(key)) continue;
    if (raw == null || raw === "" || raw === DIMENSION_FILTER_ALL) continue;
    if (Array.isArray(raw)) {
      if (!raw.length) continue;
      out[key] = raw.join(",");
      continue;
    }
    out[key] = raw as string | number | boolean;
  }
  return out;
}

export function DynamicFilterBar({
  value,
  onChange,
  keys,
  excludeKeys = DEFAULT_EXCLUDE,
  company,
  staticOptions,
  dimensions: dimensionsProp,
  title = "Filters",
}: Props) {
  const fromBootstrap = useFilterableDimensions();
  const dimensions = useMemo(() => {
    const base = dimensionsProp?.length ? dimensionsProp : fromBootstrap;
    const exclude = new Set(excludeKeys);
    let list = base.filter(
      (d) => d.filterable && !exclude.has(d.key) && !/^custom_/i.test(d.key)
    );
    if (keys?.length) {
      const allow = new Set(keys);
      list = list.filter((d) => allow.has(d.key));
    }
    return list;
  }, [dimensionsProp, fromBootstrap, excludeKeys, keys]);

  if (!dimensions.length) return null;

  const setOne = (key: string, next: DimensionFilterValue) => {
    onChange({ ...value, [key]: next });
  };

  return (
    <View style={styles.wrap}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {dimensions.map((dim) => (
        <DimensionFilter
          key={dim.key}
          dimension={dim}
          value={value[dim.key]}
          onChange={(v) => setOne(dim.key, v)}
          company={company}
          staticOptions={staticOptions?.[dim.key]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 12,
  },
  title: {
    ...Type.label,
    fontFamily: Fonts.bodyBold,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 8,
  },
});
