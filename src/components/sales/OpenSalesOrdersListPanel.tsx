import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { AnalysisRow } from "../../api/genericAnalysisTypes";
import { formatCurrency } from "../../utils/currency";
import { SALES } from "../../screens/sales/salesTheme";
import { Fonts } from "../../theme/typography";
import { salesOrderFromRow } from "../../utils/salesNavigation";
import {
  compareOpenSoLinesByDeliveryDate,
  compareOpenSoOrdersByDeliveryDate,
  customerNameFromOpenSoRow,
  deliveryDateFromOpenSoRow,
  formatOpenSoDate,
  lineDeliveryDateFromOpenSoRow,
  itemCodeFromOpenSoLineRow,
  linePendingAmount,
  linePendingQty,
  lineRowSubtitle,
  openAmountFromOpenSoRow,
  orderRowSubtitle,
} from "../../utils/openSalesOrderRows";

const SO_ACCENT = "#059669";
const SO_ACCENT_BG = "#ecfdf5";

type Mode = "orders" | "items";

function rowMatchesQuery(row: AnalysisRow, q: string, mode: Mode): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  if (mode === "orders") {
    const so = salesOrderFromRow(row).toLowerCase();
    const customer = customerNameFromOpenSoRow(row).toLowerCase();
    const del = formatOpenSoDate(deliveryDateFromOpenSoRow(row)).toLowerCase();
    return (
      so.includes(needle) ||
      customer.includes(needle) ||
      del.includes(needle)
    );
  }
  const code = itemCodeFromOpenSoLineRow(row).toLowerCase();
  const sub = lineRowSubtitle(row).toLowerCase();
  return code.includes(needle) || sub.includes(needle);
}

type Props = {
  rows: AnalysisRow[];
  currency: string;
  mode: Mode;
  summaryCount?: number;
  summaryLabel?: string;
  onRowPress: (row: AnalysisRow) => void;
  refreshing: boolean;
  onRefresh: () => void;
  contentPaddingBottom: number;
};

export function OpenSalesOrdersListPanel({
  rows,
  currency,
  mode,
  summaryCount,
  summaryLabel,
  onRowPress,
  refreshing,
  onRefresh,
  contentPaddingBottom,
}: Props) {
  const [query, setQuery] = useState("");

  const sorted = useMemo(() => {
    const copy = [...rows];
    if (mode === "items") {
      copy.sort(compareOpenSoLinesByDeliveryDate);
      return copy;
    }
    copy.sort(compareOpenSoOrdersByDeliveryDate);
    return copy;
  }, [rows, mode]);

  const filtered = useMemo(
    () => sorted.filter((r) => rowMatchesQuery(r, query, mode)),
    [sorted, query, mode]
  );

  const totalPending = useMemo(
    () =>
      mode === "orders"
        ? sorted.reduce((sum, r) => sum + openAmountFromOpenSoRow(r), 0)
        : sorted.reduce((sum, r) => sum + linePendingAmount(r), 0),
    [sorted, mode]
  );

  const count = sorted.length || summaryCount || 0;

  return (
    <FlatList
      style={styles.listShell}
      data={filtered}
      keyExtractor={(item, index) =>
        `${salesOrderFromRow(item) || item.id || item.label}-${index}`
      }
      contentContainerStyle={[
        styles.listContent,
        { paddingBottom: contentPaddingBottom },
        !filtered.length && styles.listContentEmpty,
      ]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={SO_ACCENT}
        />
      }
      ListHeaderComponent={
        <View style={styles.headerBlock}>
          <View style={styles.summaryCard}>
            <View style={styles.summaryIconWrap}>
              <Ionicons
                name={mode === "orders" ? "cart-outline" : "cube-outline"}
                size={22}
                color={SO_ACCENT}
              />
            </View>
            <View style={styles.summaryText}>
              <Text style={styles.summaryLabel}>
                {summaryLabel ||
                  (mode === "orders"
                    ? "Pending delivery (open SOs)"
                    : "Pending on this order")}
              </Text>
              <Text style={styles.summaryValue}>
                {formatCurrency(totalPending, currency, {
                  compact: false,
                  hideCode: false,
                  decimals: 0,
                })}
              </Text>
              <Text style={styles.summaryMeta}>
                {count} {mode === "orders" ? "order" : "line"}
                {count === 1 ? "" : "s"}
                {query.trim() ? ` · ${filtered.length} shown` : ""}
              </Text>
            </View>
          </View>

          <View style={styles.searchWrap}>
            <Ionicons
              name="search-outline"
              size={18}
              color={SALES.subtitle}
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder={
                mode === "orders"
                  ? "Search SO or customer…"
                  : "Search item code or name…"
              }
              placeholderTextColor="#94a3b8"
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
              returnKeyType="search"
            />
            {query.length > 0 ? (
              <TouchableOpacity
                onPress={() => setQuery("")}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel="Clear search"
              >
                <Ionicons name="close-circle" size={18} color="#94a3b8" />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.emptyWrap}>
          <Ionicons name="document-text-outline" size={40} color="#cbd5e1" />
          <Text style={styles.emptyTitle}>
            {query.trim() ? "No matching rows" : "No open sales orders"}
          </Text>
          <Text style={styles.emptySub}>
            {query.trim()
              ? "Try a different search term."
              : "Adjust filters and pull to refresh."}
          </Text>
        </View>
      }
      renderItem={({ item, index }) => {
        const isFirst = index === 0;
        const isLast = index === filtered.length - 1;
        const drillable = mode === "orders";
        return (
          <View
            style={[
              styles.listRowsCard,
              isFirst && styles.listRowsCardTop,
              isLast && styles.listRowsCardBottom,
            ]}
          >
            <TouchableOpacity
              style={[styles.row, !isLast && styles.rowBorder]}
              activeOpacity={drillable ? 0.85 : 1}
              onPress={() => onRowPress(item)}
              disabled={!drillable}
            >
              {mode === "orders" ? (
                <>
                  <View style={styles.soBadge}>
                    <Ionicons name="receipt-outline" size={18} color={SO_ACCENT} />
                  </View>
                  <View style={styles.rowBody}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {salesOrderFromRow(item)}
                    </Text>
                    <Text style={styles.rowSub} numberOfLines={2}>
                      {orderRowSubtitle(item)}
                    </Text>
                  </View>
                  <View style={styles.rowTrailing}>
                    <Text style={styles.rowAmount}>
                      {formatCurrency(
                        openAmountFromOpenSoRow(item),
                        currency,
                        { compact: false, hideCode: false, decimals: 0 }
                      )}
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color="#94a3b8"
                      style={styles.chevron}
                    />
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.rowBody}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {itemCodeFromOpenSoLineRow(item) ||
                        salesOrderFromRow(item) ||
                        "—"}
                    </Text>
                    <Text style={styles.rowSub} numberOfLines={2}>
                      {lineRowSubtitle(item) || "—"}
                    </Text>
                  </View>
                  <View style={styles.rowTrailing}>
                    <Text style={styles.rowQty}>
                      Del{" "}
                      {formatOpenSoDate(lineDeliveryDateFromOpenSoRow(item)) ||
                        "—"}
                    </Text>
                    {linePendingQty(item) != null ? (
                      <Text style={styles.rowQtySecondary}>
                        {linePendingQty(item)!.toLocaleString("en-US")} pending
                      </Text>
                    ) : null}
                    <Text style={styles.rowAmount}>
                      {formatCurrency(linePendingAmount(item), currency, {
                        compact: false,
                        hideCode: false,
                        decimals: 0,
                      })}
                    </Text>
                  </View>
                </>
              )}
            </TouchableOpacity>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  listShell: {
    flex: 1,
    backgroundColor: SALES.bg,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  headerBlock: {
    gap: 12,
    marginBottom: 12,
  },
  summaryCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: SALES.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: SALES.border,
  },
  summaryIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: SO_ACCENT_BG,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryText: {
    flex: 1,
    minWidth: 0,
  },
  summaryLabel: {
    fontSize: 12,
    fontFamily: Fonts.body,
    color: SALES.subtitle,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 22,
    fontFamily: Fonts.bodyBold,
    color: SALES.value,
    letterSpacing: -0.3,
  },
  summaryMeta: {
    fontSize: 11,
    fontFamily: Fonts.body,
    color: SALES.subtitle,
    marginTop: 4,
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: SALES.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SALES.border,
    paddingHorizontal: 12,
    minHeight: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: Fonts.body,
    color: SALES.value,
    paddingVertical: 10,
  },
  listRowsCard: {
    backgroundColor: SALES.card,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: SALES.border,
    overflow: "hidden",
  },
  listRowsCardTop: {
    borderTopWidth: 1,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    marginTop: 4,
  },
  listRowsCardBottom: {
    borderBottomWidth: 1,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    marginBottom: 8,
  },
  emptyWrap: {
    alignItems: "center",
    paddingVertical: 48,
    paddingHorizontal: 24,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: Fonts.bodySemi,
    color: SALES.value,
    marginTop: 8,
  },
  emptySub: {
    fontSize: 13,
    fontFamily: Fonts.body,
    color: SALES.subtitle,
    textAlign: "center",
    lineHeight: 18,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 12,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f1f5f9",
  },
  soBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: SO_ACCENT_BG,
    alignItems: "center",
    justifyContent: "center",
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: 14,
    fontFamily: Fonts.bodySemi,
    color: SALES.value,
    lineHeight: 18,
  },
  rowSub: {
    fontSize: 12,
    fontFamily: Fonts.body,
    color: SALES.subtitle,
    marginTop: 2,
    lineHeight: 16,
  },
  rowTrailing: {
    alignItems: "flex-end",
    maxWidth: "42%",
  },
  rowAmount: {
    fontSize: 13,
    fontFamily: Fonts.bodyBold,
    color: SALES.value,
    textAlign: "right",
  },
  rowQty: {
    fontSize: 11,
    fontFamily: Fonts.bodySemi,
    color: SALES.value,
    marginBottom: 2,
    textAlign: "right",
  },
  rowQtySecondary: {
    fontSize: 10,
    fontFamily: Fonts.body,
    color: SALES.subtitle,
    marginBottom: 2,
    textAlign: "right",
  },
  chevron: {
    marginTop: 2,
  },
});
