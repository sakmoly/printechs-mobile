import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { Fonts } from "../../theme/typography";
import {
  formatTableCellValue,
  type TableCurrencyDisplay,
} from "../../utils/currency";
import type { AnalysisRow } from "../../api/genericAnalysisTypes";

/**
 * Column layout from BA `table.columns[]` or Desk Config JSON `columns`.
 */
export type TableColumn = {
  key: string;
  label: string;
  format?: string;
  width?: number;
  flex?: number;
  width_pct?: number;
  min_width?: number;
  max_width?: number;
  align?: "left" | "right" | "center" | string;
};

type Props = {
  rows: AnalysisRow[];
  currency?: string;
  valueLabel?: string;
  columns?: TableColumn[] | null;
  total?: number | null;
  currency_display?: TableCurrencyDisplay | null;
  onRowPress?: (row: AnalysisRow) => void;
};

function rawCell(row: AnalysisRow, col: TableColumn): unknown {
  const cells = (row.meta?.cells || {}) as Record<string, unknown>;
  if (cells[col.key] !== undefined && cells[col.key] !== null) {
    return cells[col.key];
  }
  if (
    col.key === "label" ||
    col.key === "name" ||
    col.key === "territory" ||
    col.key === "dimension"
  ) {
    return cells.dimension ?? cells.territory ?? row.label;
  }
  if (
    col.key === "value" ||
    col.key === "amount" ||
    col.key === "net_sales" ||
    col.key === "total_sales" ||
    col.key === "metric"
  ) {
    return cells.metric ?? cells.net_sales ?? row.value;
  }
  if (
    col.key === "metric_ly" ||
    col.key === "net_sales_ly" ||
    col.key === "value_ly"
  ) {
    return cells.metric_ly ?? cells.net_sales_ly ?? row.previous;
  }
  if (col.key === "change_pct" || col.key === "growth_pct") {
    return cells.change_pct ?? row.change_pct;
  }
  return undefined;
}

function cellValue(
  row: AnalysisRow,
  col: TableColumn,
  currency: string,
  currencyDisplay: TableCurrencyDisplay | null | undefined
): string {
  const raw = rawCell(row, col);

  if (raw == null || raw === "") {
    if (
      col.key === "label" ||
      col.key === "name" ||
      col.key === "territory" ||
      col.key === "dimension"
    ) {
      return row.label || "—";
    }
    if (col.key === "change_pct" || col.key === "growth_pct") {
      return row.change_pct == null
        ? "—"
        : formatTableCellValue(row.change_pct, "percent");
    }
    if (
      col.key === "value" ||
      col.key === "amount" ||
      col.key === "net_sales" ||
      col.key === "metric"
    ) {
      return formatTableCellValue(row.value, col.format || "number", {
        currency,
        currency_display: currencyDisplay,
      });
    }
    if (col.key === "metric_ly" || col.key === "net_sales_ly") {
      return formatTableCellValue(row.previous, col.format || "number", {
        currency,
        currency_display: currencyDisplay,
      });
    }
    return "—";
  }

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed && Number.isNaN(Number(trimmed.replace(/,/g, "")))) {
      return trimmed;
    }
    const n = Number(trimmed.replace(/,/g, ""));
    if (Number.isFinite(n) && /[\d]/.test(trimmed)) {
      return formatTableCellValue(n, col.format, {
        currency,
        currency_display: currencyDisplay,
      });
    }
    return trimmed || "—";
  }

  const n = Number(raw);
  if (!Number.isFinite(n)) return String(raw);

  const fmt = String(col.format || "").toLowerCase();
  if (
    !fmt &&
    (col.key === "change_pct" ||
      col.key === "growth_pct" ||
      /_pct$/i.test(col.key))
  ) {
    return formatTableCellValue(n, "percent");
  }

  return formatTableCellValue(n, col.format, {
    currency,
    currency_display: currencyDisplay,
  });
}

function primaryValueColumn(
  columns?: TableColumn[] | null
): TableColumn | null {
  if (!columns?.length) return null;
  return (
    columns.find((c) => {
      const f = String(c.format || "").toLowerCase();
      return (
        f.includes("currency") ||
        f === "number" ||
        /^(net_)?sales$|^metric$|amount|value|revenue/i.test(c.key)
      );
    }) ||
    columns[1] ||
    columns[0]
  );
}

function resolveAlign(col: TableColumn): "left" | "right" | "center" {
  const a = String(col.align || "").toLowerCase();
  if (a === "right" || a === "end") return "right";
  if (a === "center" || a === "middle") return "center";
  if (a === "left" || a === "start") return "left";
  const f = String(col.format || "").toLowerCase();
  if (
    f.includes("currency") ||
    f === "number" ||
    f === "percent" ||
    /sales|amount|value|pct|change|qty|metric/i.test(col.key)
  ) {
    return "right";
  }
  return "left";
}

/** View box style — flex must be on View, not Text, for RN layout. */
export function columnBoxStyle(col: TableColumn): StyleProp<ViewStyle> {
  const style: ViewStyle = {
    justifyContent: "center",
  };

  const hasFlex = col.flex != null && Number(col.flex) > 0;
  const hasWidth = col.width != null && Number(col.width) > 0;
  const hasPct = col.width_pct != null && Number(col.width_pct) > 0;

  if (hasWidth) {
    style.width = Number(col.width);
    style.flexGrow = 0;
    style.flexShrink = 0;
  } else if (hasPct) {
    style.flex = Math.max(0.1, Number(col.width_pct) / 10);
    style.flexShrink = 1;
    style.minWidth = 0;
  } else if (hasFlex) {
    style.flex = Number(col.flex);
    style.flexShrink = 1;
    style.minWidth = 0;
  } else {
    const f = String(col.format || "").toLowerCase();
    if (f.includes("currency") || f === "number" || col.key === "metric") {
      style.flex = 1.1;
      style.minWidth = 72;
    } else if (f === "percent" || /pct|change/i.test(col.key)) {
      style.width = 56;
      style.flexGrow = 0;
    } else {
      style.flex = 1.4;
      style.minWidth = 64;
    }
    style.flexShrink = 1;
  }

  if (col.min_width != null && Number(col.min_width) > 0) {
    style.minWidth = Number(col.min_width);
  }
  if (col.max_width != null && Number(col.max_width) > 0) {
    style.maxWidth = Number(col.max_width);
  }

  return style;
}

function columnTextStyle(col: TableColumn): StyleProp<TextStyle> {
  const align = resolveAlign(col);
  return {
    textAlign: align,
    width: "100%",
  };
}

function primaryValueFormat(columns?: TableColumn[] | null): string {
  const col = primaryValueColumn(columns);
  return col?.format || "currency_compact";
}

/** Rank / row-number columns from Desk/API (avoid doubling with local "#"). */
function isIndexColumn(c: TableColumn): boolean {
  const key = String(c.key || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_");
  const label = String(c.label || "")
    .toLowerCase()
    .trim();
  return (
    key === "#" ||
    key === "rank" ||
    key === "row_num" ||
    key === "row_number" ||
    key === "rowno" ||
    key === "no" ||
    key === "idx" ||
    key === "index" ||
    key === "sr" ||
    key === "sno" ||
    label === "#" ||
    label === "rank" ||
    label === "no" ||
    label === "no." ||
    label === "sr#"
  );
}

/** Keep at most one index column from BA/Desk config. */
function dedupeIndexColumns(columns: TableColumn[]): TableColumn[] {
  let seenIndex = false;
  return columns.filter((c) => {
    if (!isIndexColumn(c)) return true;
    if (seenIndex) return false;
    seenIndex = true;
    return true;
  });
}

function CellBox({
  col,
  children,
  textStyle,
}: {
  col: TableColumn;
  children: React.ReactNode;
  textStyle?: StyleProp<TextStyle>;
}) {
  return (
    <View style={[styles.cellBox, columnBoxStyle(col)]}>
      <Text style={[styles.cell, columnTextStyle(col), textStyle]} numberOfLines={2}>
        {children}
      </Text>
    </View>
  );
}

export function AnalysisTable({
  rows,
  currency = "SAR",
  valueLabel = "Value",
  columns,
  total,
  currency_display,
  onRowPress,
}: Props) {
  const currencyDisplay = currency_display ?? { show_symbol: false };
  const totalFormat = useMemo(() => primaryValueFormat(columns), [columns]);
  const valueCol = useMemo(() => primaryValueColumn(columns), [columns]);
  const displayColumns = useMemo(
    () => (columns?.length ? dedupeIndexColumns(columns) : columns),
    [columns]
  );
  const showSyntheticIndex = useMemo(
    () => !(displayColumns || []).some(isIndexColumn),
    [displayColumns]
  );

  if (!rows.length) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No rows</Text>
      </View>
    );
  }

  const useColumns = Array.isArray(displayColumns) && displayColumns.length > 0;

  const renderConfiguredRow = (
    r: AnalysisRow,
    i: number,
    isHeader: boolean
  ) => (
    <View
      style={[
        styles.row,
        isHeader && styles.header,
        !isHeader && i % 2 === 1 && styles.rowAlt,
      ]}
    >
      {showSyntheticIndex ? (
        <View style={styles.colNameBox}>
          <Text style={[styles.cell, isHeader && styles.headerText]}>
            {isHeader ? "#" : String(i + 1)}
          </Text>
        </View>
      ) : null}
      {displayColumns!.map((c) => {
        if (isHeader) {
          return (
            <CellBox key={c.key} col={c} textStyle={styles.headerText}>
              {c.label}
            </CellBox>
          );
        }
        const isPct = /pct|percent|growth|change/i.test(
          String(c.format || c.key)
        );
        const pctVal = Number(rawCell(r, c) ?? r.change_pct);
        const isIdx = isIndexColumn(c);
        const raw = rawCell(r, c);
        const display =
          isIdx && (raw == null || raw === "")
            ? String(i + 1)
            : cellValue(r, c, currency, currencyDisplay);
        return (
          <CellBox
            key={c.key}
            col={c}
            textStyle={[
              /currency|number|percent/i.test(String(c.format || ""))
                ? styles.cellSemi
                : null,
              isPct && Number.isFinite(pctVal)
                ? pctVal < 0
                  ? styles.down
                  : styles.up
                : null,
            ]}
          >
            {display}
          </CellBox>
        );
      })}
    </View>
  );

  return (
    <View style={styles.card}>
      {useColumns ? (
        <>
          {renderConfiguredRow(rows[0], -1, true)}
          <ScrollView style={styles.list} nestedScrollEnabled>
            {rows.map((r, i) => {
              const body = renderConfiguredRow(r, i, false);
              if (onRowPress) {
                return (
                  <TouchableOpacity
                    key={`${r.id}-${i}`}
                    onPress={() => onRowPress(r)}
                    activeOpacity={0.85}
                  >
                    {body}
                  </TouchableOpacity>
                );
              }
              return <View key={`${r.id}-${i}`}>{body}</View>;
            })}
          </ScrollView>
          {total != null && Number.isFinite(Number(total)) ? (
            <View style={[styles.row, styles.footerRow]}>
              {showSyntheticIndex ? <View style={styles.colNameBox} /> : null}
              {displayColumns!.map((c, ci) => {
                if (valueCol?.key === c.key) {
                  return (
                    <CellBox key={c.key} col={c} textStyle={styles.footerValue}>
                      {formatTableCellValue(Number(total), totalFormat, {
                        currency,
                        currency_display: currencyDisplay,
                      })}
                    </CellBox>
                  );
                }
                const labelColKey =
                  displayColumns!.find((x) =>
                    /territory|name|label|customer|brand|dimension/i.test(
                      x.key
                    )
                  )?.key || displayColumns![0]?.key;
                if (c.key === labelColKey) {
                  return (
                    <CellBox key={c.key} col={c} textStyle={styles.footerLabel}>
                      Total
                    </CellBox>
                  );
                }
                return (
                  <View
                    key={c.key || `empty-${ci}`}
                    style={[styles.cellBox, columnBoxStyle(c)]}
                  />
                );
              })}
            </View>
          ) : null}
        </>
      ) : (
        <>
          <View style={[styles.row, styles.header]}>
            <Text style={[styles.cell, styles.colName, styles.headerText]}>
              #
            </Text>
            <Text style={[styles.cell, styles.colLabel, styles.headerText]}>
              Name
            </Text>
            <Text style={[styles.cell, styles.colValue, styles.headerText]}>
              {valueLabel}
            </Text>
            <Text style={[styles.cell, styles.colChange, styles.headerText]}>
              Δ%
            </Text>
          </View>
          <ScrollView style={styles.list} nestedScrollEnabled>
            {rows.map((r, i) => {
              const body = (
                <View style={[styles.row, i % 2 === 1 && styles.rowAlt]}>
                  <Text style={[styles.cell, styles.colName]}>{i + 1}</Text>
                  <Text
                    style={[styles.cell, styles.colLabel]}
                    numberOfLines={1}
                  >
                    {r.label}
                  </Text>
                  <Text style={[styles.cell, styles.colValue]}>
                    {formatTableCellValue(r.value, "currency_compact", {
                      currency,
                      currency_display: currencyDisplay,
                    })}
                  </Text>
                  <Text
                    style={[
                      styles.cell,
                      styles.colChange,
                      (r.change_pct ?? 0) >= 0 ? styles.up : styles.down,
                    ]}
                  >
                    {r.change_pct == null
                      ? "—"
                      : formatTableCellValue(r.change_pct, "percent")}
                  </Text>
                </View>
              );
              if (onRowPress) {
                return (
                  <TouchableOpacity
                    key={`${r.id}-${i}`}
                    onPress={() => onRowPress(r)}
                    activeOpacity={0.85}
                  >
                    {body}
                  </TouchableOpacity>
                );
              }
              return <View key={`${r.id}-${i}`}>{body}</View>;
            })}
          </ScrollView>
          {total != null && Number.isFinite(Number(total)) ? (
            <View style={styles.footer}>
              <Text style={styles.footerLabel}>Total</Text>
              <Text style={styles.footerValue}>
                {formatTableCellValue(Number(total), totalFormat, {
                  currency,
                  currency_display: currencyDisplay,
                })}
              </Text>
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#eef2ff",
    overflow: "hidden",
    marginBottom: 12,
    width: "100%",
  },
  list: {
    maxHeight: 420,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e2e8f0",
    width: "100%",
  },
  rowAlt: {
    backgroundColor: "#f8fafc",
  },
  header: {
    backgroundColor: "#eef2ff",
  },
  headerText: {
    fontFamily: Fonts.bodyBold,
    color: "#4338ca",
    fontSize: 11,
  },
  cellBox: {
    paddingHorizontal: 2,
  },
  cell: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: "#334155",
  },
  cellSemi: {
    fontFamily: Fonts.bodySemi,
  },
  colNameBox: {
    width: 28,
    flexGrow: 0,
    flexShrink: 0,
  },
  colName: { width: 28, flexGrow: 0, flexShrink: 0 },
  colLabel: { flex: 1, paddingRight: 6, minWidth: 0 },
  colValue: {
    flex: 1.1,
    minWidth: 72,
    textAlign: "right",
    fontFamily: Fonts.bodySemi,
  },
  colChange: { width: 52, flexGrow: 0, textAlign: "right" },
  up: { color: "#059669" },
  down: { color: "#dc2626" },
  empty: { padding: 24, alignItems: "center" },
  emptyText: { fontFamily: Fonts.body, color: "#94a3b8" },
  footerRow: {
    backgroundColor: "#f8fafc",
    borderBottomWidth: 0,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#f8fafc",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e2e8f0",
  },
  footerLabel: {
    fontFamily: Fonts.bodyBold,
    fontSize: 12,
    color: "#64748b",
  },
  footerValue: {
    fontFamily: Fonts.bodyBold,
    fontSize: 13,
    color: "#0f172a",
  },
});
