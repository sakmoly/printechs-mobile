import React, { useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Fonts, Type } from "../../theme/typography";
import { formatCurrency } from "../../utils/currency";
import type { AnalysisRow } from "../../api/genericAnalysisTypes";

type Props = {
  rows: AnalysisRow[];
  currency?: string;
  /** Optional column headers when BA sends matrix cells via meta */
  title?: string;
  maxCells?: number;
  onCellPress?: (row: AnalysisRow) => void;
};

function intensityColor(ratio: number): string {
  // Soft indigo → deep indigo by value share
  const t = Math.max(0, Math.min(1, ratio));
  const r = Math.round(238 - t * (238 - 79));
  const g = Math.round(242 - t * (242 - 70));
  const b = Math.round(255 - t * (255 - 229));
  return `rgb(${r},${g},${b})`;
}

function textOn(ratio: number): string {
  return ratio > 0.55 ? "#fff" : "#312e81";
}

/**
 * MATRIX widget: heatmap grid from 1D analysis rows.
 * If a row has meta.cells (2D payload), render those columns instead.
 */
export function AnalysisMatrix({
  rows,
  currency = "SAR",
  title = "",
  maxCells = 12,
  onCellPress,
}: Props) {
  const { cells, max, mode } = useMemo(() => {
    type Cell = {
      id: string;
      rowLabel: string;
      colLabel: string;
      value: number;
      secondary?: number | null;
      change_pct?: number | null;
    };

    const fromMeta: Cell[] = [];

    for (const r of rows) {
      const raw = r.meta?.cells;
      if (Array.isArray(raw)) {
        for (const c of raw) {
          if (!c || typeof c !== "object") continue;
          const cell = c as Record<string, unknown>;
          fromMeta.push({
            id: String(cell.id || `${r.id}-${cell.col || cell.column}`),
            rowLabel: String(cell.row || r.label),
            colLabel: String(cell.col || cell.column || "Value"),
            value: Number(cell.value ?? 0) || 0,
          });
        }
      }
    }

    if (fromMeta.length) {
      const m = Math.max(...fromMeta.map((c) => c.value), 1);
      return {
        cells: fromMeta.slice(0, maxCells),
        max: m,
        mode: "2d" as const,
      };
    }

    const mapped: Cell[] = rows.slice(0, maxCells).map((r) => ({
      id: r.id,
      rowLabel: r.label,
      colLabel: "",
      value: Math.max(0, Number(r.value) || 0),
      secondary: r.secondary,
      change_pct: r.change_pct,
    }));
    const m = Math.max(...mapped.map((c) => c.value), 1);
    return { cells: mapped, max: m, mode: "1d" as const };
  }, [rows, maxCells]);

  if (!cells.length) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No matrix data</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      <View style={styles.grid}>
        {cells.map((c) => {
          const ratio = max > 0 ? c.value / max : 0;
          const bg = intensityColor(ratio);
          const fg = textOn(ratio);
          const body = (
            <>
              <Text style={[styles.cellLabel, { color: fg }]} numberOfLines={2}>
                {mode === "2d"
                  ? `${c.rowLabel} × ${c.colLabel}`
                  : c.rowLabel}
              </Text>
              <Text style={[styles.cellValue, { color: fg }]}>
                {formatCurrency(c.value, currency, { compact: true })}
              </Text>
              {c.secondary != null ? (
                <Text style={[styles.cellSub, { color: fg, opacity: 0.85 }]}>
                  2nd {formatCurrency(c.secondary, currency, { compact: true })}
                </Text>
              ) : c.change_pct != null ? (
                <Text style={[styles.cellSub, { color: fg, opacity: 0.85 }]}>
                  {c.change_pct >= 0 ? "+" : ""}
                  {Number(c.change_pct).toFixed(1)}%
                </Text>
              ) : null}
            </>
          );
          if (onCellPress && mode === "1d") {
            return (
              <TouchableOpacity
                key={c.id}
                style={[styles.cell, { backgroundColor: bg }]}
                activeOpacity={0.85}
                onPress={() =>
                  onCellPress({
                    id: c.id,
                    label: c.rowLabel,
                    value: c.value,
                    change_pct: c.change_pct,
                    secondary: c.secondary,
                  })
                }
              >
                {body}
              </TouchableOpacity>
            );
          }
          return (
            <View key={c.id} style={[styles.cell, { backgroundColor: bg }]}>
              {body}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#eef2ff",
    marginBottom: 12,
  },
  title: {
    ...Type.cardTitle,
    color: "#1f2937",
    marginBottom: 8,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  cell: {
    width: "47%",
    flexGrow: 1,
    minWidth: "45%",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    minHeight: 78,
    justifyContent: "center",
  },
  cellLabel: {
    fontFamily: Fonts.bodySemi,
    fontSize: 12,
    marginBottom: 4,
  },
  cellValue: {
    fontFamily: Fonts.bodyBold,
    fontSize: 16,
  },
  cellSub: {
    fontFamily: Fonts.body,
    fontSize: 11,
    marginTop: 2,
  },
  empty: {
    padding: 24,
    alignItems: "center",
  },
  emptyText: {
    fontFamily: Fonts.body,
    color: "#94a3b8",
  },
});
