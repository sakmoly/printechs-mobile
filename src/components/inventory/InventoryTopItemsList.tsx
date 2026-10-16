import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import type { InventoryWidgetEntry } from "../../screens/inventory/buildInventorySections";
import type { AnalysisRow } from "../../api/genericAnalysisTypes";
import { formatCurrency } from "../../utils/currency";
import { INVENTORY } from "../../screens/inventory/inventoryTheme";
import { InventorySectionHeader } from "./InventorySectionHeader";
import { Fonts } from "../../theme/typography";
import {
  openInventoryItemStock,
  openInventoryStockByBrand,
  type InventoryStockByBrandScope,
} from "../../utils/inventoryNavigation";

type Props = {
  entry: InventoryWidgetEntry;
  brandExplorerScope?: InventoryStockByBrandScope;
};

function rowQty(row: AnalysisRow): number | null {
  const cells = row.meta?.cells as Record<string, unknown> | undefined;
  const qty =
    cells?.quantity ??
    cells?.qty ??
    cells?.stock_qty ??
    row.meta?.quantity;
  if (qty != null && Number.isFinite(Number(qty))) return Number(qty);
  return null;
}

function rowCode(row: AnalysisRow): string {
  const cells = row.meta?.cells as Record<string, unknown> | undefined;
  return String(
    cells?.item_code ?? cells?.code ?? row.meta?.item_code ?? row.id ?? ""
  ).trim();
}

export function InventoryTopItemsList({
  entry,
  brandExplorerScope,
}: Props) {
  const payload = entry.payload;
  const currency = payload.currency || payload.meta?.currency || "SAR";
  const rows = payload.table?.rows?.length
    ? payload.table.rows
    : payload.rows || [];

  if (!rows.length) return null;

  return (
    <View style={styles.wrap}>
      <InventorySectionHeader
        title={entry.label || "Top 5 Items by Inventory Value"}
        rightLabel="By Brand"
        rightAction={() => openInventoryStockByBrand(brandExplorerScope)}
      />
      <View style={styles.headerRow}>
        <Text style={[styles.th, styles.thItem]}>Item</Text>
        <Text style={[styles.th, styles.thVal]}>Value</Text>
        <Text style={[styles.th, styles.thQty]}>Qty</Text>
      </View>
      {rows.slice(0, 5).map((row, i) => {
        const code = rowCode(row);
        const qty = rowQty(row);
        return (
          <TouchableOpacity
            key={`${row.id}-${i}`}
            style={styles.row}
            activeOpacity={0.85}
            onPress={() => {
              if (code && brandExplorerScope) {
                openInventoryItemStock(brandExplorerScope, code);
              }
            }}
          >
            <View style={styles.itemCol}>
              {code ? (
                <Text style={styles.code} numberOfLines={1}>
                  {code}
                </Text>
              ) : null}
              <Text style={styles.name} numberOfLines={2}>
                {row.label}
              </Text>
            </View>
            <Text style={styles.value}>
              {formatCurrency(row.value, currency, {
                compact: true,
                hideCode: true,
              })}
            </Text>
            <Text style={styles.qty}>
              {qty != null
                ? qty.toLocaleString("en-US", { maximumFractionDigits: 0 })
                : "—"}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: INVENTORY.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: INVENTORY.border,
    marginBottom: 12,
    minWidth: 0,
  },
  headerRow: {
    flexDirection: "row",
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: INVENTORY.border,
    marginBottom: 4,
  },
  th: {
    fontSize: 10,
    fontFamily: Fonts.bodySemi,
    color: INVENTORY.subtitle,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  thItem: { flex: 1 },
  thVal: { width: 72, textAlign: "right" },
  thQty: { width: 56, textAlign: "right" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f1f5f9",
    gap: 6,
  },
  itemCol: { flex: 1, minWidth: 0 },
  code: {
    fontSize: 10,
    fontFamily: Fonts.bodySemi,
    color: INVENTORY.link,
    marginBottom: 2,
  },
  name: {
    fontSize: 12,
    fontFamily: Fonts.body,
    color: INVENTORY.value,
    lineHeight: 16,
  },
  value: {
    width: 72,
    textAlign: "right",
    fontSize: 12,
    fontFamily: Fonts.bodyBold,
    color: INVENTORY.value,
  },
  qty: {
    width: 56,
    textAlign: "right",
    fontSize: 11,
    fontFamily: Fonts.body,
    color: INVENTORY.subtitle,
  },
});
