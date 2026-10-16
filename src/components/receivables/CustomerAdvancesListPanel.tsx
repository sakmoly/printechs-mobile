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
import { RECEIVABLES } from "../../screens/receivables/receivablesTheme";
import { Fonts } from "../../theme/typography";
import { rankingRowDisplayAmount } from "../../utils/receivablesRankingRows";
import { customerIdFromRow } from "../../utils/receivablesNavigation";

const ADVANCES_ACCENT = "#0d9488";
const ADVANCES_ACCENT_BG = "#ecfdf5";

function initialsFromLabel(label: string): string {
  const parts = String(label || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
}

function rowMatchesQuery(row: AnalysisRow, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const label = String(row.label || "").toLowerCase();
  const id = String(customerIdFromRow(row) || row.id || "").toLowerCase();
  return label.includes(needle) || id.includes(needle);
}

type Props = {
  rows: AnalysisRow[];
  currency: string;
  widgetKey: string;
  onRowPress: (row: AnalysisRow) => void;
  refreshing: boolean;
  onRefresh: () => void;
  contentPaddingBottom: number;
};

export function CustomerAdvancesListPanel({
  rows,
  currency,
  widgetKey,
  onRowPress,
  refreshing,
  onRefresh,
  contentPaddingBottom,
}: Props) {
  const [query, setQuery] = useState("");

  const sorted = useMemo(() => {
    return [...rows].sort(
      (a, b) =>
        rankingRowDisplayAmount(widgetKey, b) -
        rankingRowDisplayAmount(widgetKey, a)
    );
  }, [rows, widgetKey]);

  const filtered = useMemo(
    () => sorted.filter((r) => rowMatchesQuery(r, query)),
    [sorted, query]
  );

  const totalUnallocated = useMemo(
    () =>
      sorted.reduce(
        (sum, r) => sum + rankingRowDisplayAmount(widgetKey, r),
        0
      ),
    [sorted, widgetKey]
  );

  return (
    <FlatList
      style={styles.listShell}
      data={filtered}
      keyExtractor={(item, index) =>
        `${customerIdFromRow(item) || item.id || item.label}-${index}`
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
          tintColor={ADVANCES_ACCENT}
        />
      }
      ListHeaderComponent={
        <View style={styles.headerBlock}>
          <View style={styles.summaryCard}>
            <View style={styles.summaryIconWrap}>
              <Ionicons name="cash-outline" size={22} color={ADVANCES_ACCENT} />
            </View>
            <View style={styles.summaryText}>
              <Text style={styles.summaryLabel}>Total unallocated advances</Text>
              <Text style={styles.summaryValue}>
                {formatCurrency(totalUnallocated, currency, {
                  compact: false,
                  hideCode: false,
                  decimals: 0,
                })}
              </Text>
              <Text style={styles.summaryMeta}>
                {sorted.length} customer{sorted.length === 1 ? "" : "s"}
                {query.trim()
                  ? ` · ${filtered.length} shown`
                  : ""}
              </Text>
            </View>
          </View>

          <View style={styles.searchWrap}>
            <Ionicons
              name="search-outline"
              size={18}
              color={RECEIVABLES.subtitle}
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Search customer name…"
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
          <Ionicons name="people-outline" size={40} color="#cbd5e1" />
          <Text style={styles.emptyTitle}>
            {query.trim() ? "No matching customers" : "No advances to show"}
          </Text>
          <Text style={styles.emptySub}>
            {query.trim()
              ? "Try a different search term."
              : "Adjust territory or period filters and pull to refresh."}
          </Text>
        </View>
      }
      renderItem={({ item, index }) => {
        const amount = rankingRowDisplayAmount(widgetKey, item);
        const label = String(item.label || customerIdFromRow(item) || "—");
        const isFirst = index === 0;
        const isLast = index === filtered.length - 1;
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
            activeOpacity={0.85}
            onPress={() => onRowPress(item)}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initialsFromLabel(label)}</Text>
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle} numberOfLines={2}>
                {label}
              </Text>
            </View>
            <View style={styles.rowTrailing}>
              <Text style={styles.rowAmount}>
                {formatCurrency(amount, currency, {
                  compact: false,
                  hideCode: false,
                  decimals: 0,
                })}
              </Text>
              <Ionicons
                name="chevron-forward"
                size={16}
                color="#94a3b8"
                style={styles.chevron}
              />
            </View>
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
    backgroundColor: RECEIVABLES.bg,
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
    backgroundColor: RECEIVABLES.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: RECEIVABLES.border,
    shadowColor: "#0f172a",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  summaryIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: ADVANCES_ACCENT_BG,
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
    color: RECEIVABLES.subtitle,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 22,
    fontFamily: Fonts.bodyBold,
    color: RECEIVABLES.value,
    letterSpacing: -0.3,
  },
  summaryMeta: {
    fontSize: 11,
    fontFamily: Fonts.body,
    color: RECEIVABLES.subtitle,
    marginTop: 4,
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: RECEIVABLES.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: RECEIVABLES.border,
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
    color: RECEIVABLES.value,
    paddingVertical: 10,
  },
  listRowsCard: {
    backgroundColor: RECEIVABLES.card,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: RECEIVABLES.border,
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
    color: RECEIVABLES.value,
    marginTop: 8,
  },
  emptySub: {
    fontSize: 13,
    fontFamily: Fonts.body,
    color: RECEIVABLES.subtitle,
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
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: ADVANCES_ACCENT_BG,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 13,
    fontFamily: Fonts.bodyBold,
    color: ADVANCES_ACCENT,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: 14,
    fontFamily: Fonts.bodySemi,
    color: RECEIVABLES.value,
    lineHeight: 18,
  },
  rowTrailing: {
    alignItems: "flex-end",
    maxWidth: "38%",
  },
  rowAmount: {
    fontSize: 13,
    fontFamily: Fonts.bodyBold,
    color: RECEIVABLES.value,
    textAlign: "right",
  },
  chevron: {
    marginTop: 2,
  },
});
