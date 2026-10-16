import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import type { InventoryWidgetEntry } from "../../screens/inventory/buildInventorySections";
import { formatCurrency } from "../../utils/currency";
import { AGING_COLORS, INVENTORY } from "../../screens/inventory/inventoryTheme";
import { InventorySectionHeader } from "./InventorySectionHeader";
import { Fonts } from "../../theme/typography";
import {
  openInventoryWidgetDetail,
  type InventoryWidgetDetailScope,
} from "../../utils/inventoryNavigation";

type Props = {
  entry: InventoryWidgetEntry;
  detailScope?: InventoryWidgetDetailScope;
};

export function InventoryAgingBar({ entry, detailScope }: Props) {
  const payload = entry.payload;
  const currency = payload.currency || payload.meta?.currency || "SAR";
  const series = payload.chart?.series || [];
  const total = useMemo(
    () => series.reduce((s, p) => s + (Number(p.value) || 0), 0),
    [series]
  );

  const footnotes = useMemo(() => {
    const fromKpis = (payload.kpis || [])
      .filter((k) => /old|dead|180|365/.test(String(k.label || k.key || "").toLowerCase()))
      .map((k) => ({
        label: String(k.label || k.key),
        value: Number(k.value) || 0,
        danger: /dead|365/.test(String(k.label || "").toLowerCase()),
      }));
    if (fromKpis.length) return fromKpis;
    const oldRow = series.find((p) =>
      /180|old/.test(String(p.label || "").toLowerCase())
    );
    const deadRow = series.find((p) =>
      /365|dead/.test(String(p.label || "").toLowerCase())
    );
    const out: Array<{ label: string; value: number; danger: boolean }> = [];
    if (oldRow) {
      out.push({
        label: "Old Stock (> 180 Days)",
        value: Number(oldRow.value) || 0,
        danger: false,
      });
    }
    if (deadRow) {
      out.push({
        label: "Dead Stock (> 365 Days)",
        value: Number(deadRow.value) || 0,
        danger: true,
      });
    }
    return out;
  }, [payload.kpis, series]);

  if (!series.length) return null;

  const widgetKey =
    detailScope?.widgetKey ||
    String(entry.payload.widget_key || entry.key || "inventory_aging_bar");

  const openDetails = () => {
    openInventoryWidgetDetail({
      widgetKey,
      title: entry.label || "Stock Aging",
      company: detailScope?.company,
      from_date: detailScope?.from_date,
      to_date: detailScope?.to_date,
      period: detailScope?.period,
      selectedTerritory: detailScope?.selectedTerritory,
    });
  };

  return (
    <View style={styles.wrap}>
      <InventorySectionHeader
        title={entry.label || "Inventory Aging (By Value)"}
        rightLabel="View Details"
        rightAction={openDetails}
      />
      <View style={styles.columns}>
        {series.map((point, i) => {
          const val = Number(point.value) || 0;
          const pct = total > 0 ? (val / total) * 100 : 0;
          return (
            <View key={`${point.label}-${i}`} style={styles.col}>
              <Text style={styles.colLabel} numberOfLines={2}>
                {point.label}
              </Text>
              <Text style={styles.colValue}>
                {formatCurrency(val, currency, {
                  compact: true,
                  hideCode: true,
                })}
              </Text>
              <Text style={styles.colPct}>{pct.toFixed(1)}%</Text>
            </View>
          );
        })}
      </View>
      <View style={styles.segmentTrack}>
        {series.map((point, i) => {
          const val = Number(point.value) || 0;
          const pct = total > 0 ? (val / total) * 100 : 0;
          if (pct <= 0) return null;
          return (
            <View
              key={`seg-${i}`}
              style={[
                styles.segment,
                {
                  flex: pct,
                  backgroundColor: AGING_COLORS[i % AGING_COLORS.length],
                },
              ]}
            />
          );
        })}
      </View>
      {footnotes.length ? (
        <View style={styles.footnotes}>
          {footnotes.map((fn, i) => (
            <Text
              key={`fn-${i}`}
              style={[styles.footnote, fn.danger && styles.footnoteDanger]}
            >
              {fn.label}:{" "}
              {formatCurrency(fn.value, currency, {
                compact: true,
                hideCode: false,
              })}
              {total > 0
                ? ` (${((fn.value / total) * 100).toFixed(0)}%)`
                : ""}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: INVENTORY.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: INVENTORY.border,
    marginBottom: 12,
  },
  columns: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 10,
  },
  col: {
    width: "31%",
    minWidth: 96,
    flexGrow: 1,
  },
  colLabel: {
    fontSize: 9,
    fontFamily: Fonts.body,
    color: INVENTORY.subtitle,
    lineHeight: 12,
    marginBottom: 2,
  },
  colValue: {
    fontSize: 12,
    fontFamily: Fonts.bodyBold,
    color: INVENTORY.value,
  },
  colPct: {
    fontSize: 10,
    fontFamily: Fonts.body,
    color: INVENTORY.subtitle,
    marginTop: 1,
  },
  segmentTrack: {
    flexDirection: "row",
    height: 10,
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: "#f1f5f9",
  },
  segment: { minWidth: 2 },
  footnotes: {
    marginTop: 10,
    gap: 4,
  },
  footnote: {
    fontSize: 11,
    fontFamily: Fonts.bodySemi,
    color: INVENTORY.amber,
  },
  footnoteDanger: {
    color: INVENTORY.red,
  },
});
