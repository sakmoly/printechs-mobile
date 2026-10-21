import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SectionList,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { AnalysisRow } from "../../api/genericAnalysisTypes";
import { formatCurrency } from "../../utils/currency";
import { RECEIVABLES } from "../../screens/receivables/receivablesTheme";
import { Fonts } from "../../theme/typography";
import {
  filterTerritoryReceivableCustomerRows,
  isOverdueReceivableRow,
  meetsMinOverdueListAmount,
  rowOutstanding,
  rowOverdueAmount,
} from "../../utils/receivablesRankingRows";
import { customerIdFromRow } from "../../utils/receivablesNavigation";
import {
  dueAmountColor,
  resolveOverdueDays,
} from "./overdueDueStatus";

const OVERDUE_SECTION = "overdue";
const CURRENT_SECTION = "current";

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

function rowSubtitle(row: AnalysisRow, overdueSection: boolean): string | null {
  const days = resolveOverdueDays(row);
  if (days != null && days > 0) {
    return `${Math.round(days)} day${days === 1 ? "" : "s"} overdue`;
  }
  if (overdueSection) return "Overdue balance";
  const cells = row.meta?.cells as Record<string, unknown> | undefined;
  const untilDue = Number(
    cells?.days_until_due ?? cells?.due_in_days ?? cells?.days_to_due
  );
  if (Number.isFinite(untilDue) && untilDue > 0) {
    return `Due in ${Math.round(untilDue)} day${untilDue === 1 ? "" : "s"}`;
  }
  return "Not yet due";
}

type Props = {
  rows: AnalysisRow[];
  currency: string;
  onRowPress: (row: AnalysisRow) => void;
  refreshing: boolean;
  loading?: boolean;
  onRefresh: () => void;
  contentPaddingBottom: number;
  /** Total due from territory bar KPI (680.9K). */
  territoryCardTotal?: number;
  listMode?: "full" | "overdue_only";
};

export function TerritoryReceivablesListPanel({
  rows,
  currency,
  onRowPress,
  refreshing,
  loading = false,
  onRefresh,
  contentPaddingBottom,
  territoryCardTotal,
  listMode = "full",
}: Props) {
  const [query, setQuery] = useState("");

  const cleaned = useMemo(() => {
    const list = filterTerritoryReceivableCustomerRows(rows);
    return list.filter(
      (r) =>
        !isOverdueReceivableRow(r) || meetsMinOverdueListAmount(r)
    );
  }, [rows]);

  const filtered = useMemo(
    () => cleaned.filter((r) => rowMatchesQuery(r, query)),
    [cleaned, query]
  );

  const { overdueRows, currentRows } = useMemo(() => {
    const overdue: AnalysisRow[] = [];
    const current: AnalysisRow[] = [];
    for (const row of filtered) {
      if (isOverdueReceivableRow(row)) {
        if (meetsMinOverdueListAmount(row)) {
          overdue.push(row);
        }
      } else {
        current.push(row);
      }
    }
    overdue.sort(
      (a, b) => rowOverdueAmount(b) - rowOverdueAmount(a) || rowOutstanding(b) - rowOutstanding(a)
    );
    current.sort((a, b) => rowOutstanding(b) - rowOutstanding(a));
    return { overdueRows: overdue, currentRows: current };
  }, [filtered]);

  const sumOutstanding = useMemo(
    () => cleaned.reduce((s, r) => s + rowOutstanding(r), 0),
    [cleaned]
  );
  const totalDue =
    territoryCardTotal != null && territoryCardTotal > 0
      ? territoryCardTotal
      : sumOutstanding;
  const overdueTotal = overdueRows.reduce(
    (s, r) => s + (rowOverdueAmount(r) || rowOutstanding(r)),
    0
  );
  const currentTotal = Math.max(0, totalDue - overdueTotal);

  const sections = useMemo(() => {
    const out: { title: string; key: string; data: AnalysisRow[]; overdue: boolean }[] = [];
    if (overdueRows.length) {
      out.push({
        title: "Overdue customers",
        key: OVERDUE_SECTION,
        data: overdueRows,
        overdue: true,
      });
    }
    if (currentRows.length) {
      out.push({
        title: "Current (not yet due)",
        key: CURRENT_SECTION,
        data: currentRows,
        overdue: false,
      });
    }
    if (!out.length && filtered.length) {
      out.push({
        title: listMode === "overdue_only" ? "Overdue customers" : "Customers",
        key: "all",
        data: [...filtered].sort(
          (a, b) => rowOutstanding(b) - rowOutstanding(a)
        ),
        overdue: listMode === "overdue_only",
      });
    }
    return out;
  }, [overdueRows, currentRows, filtered, listMode]);

  const fmt = (n: number) =>
    formatCurrency(n, currency, {
      compact: false,
      hideCode: false,
      decimals: 0,
    });

  const bootLoading = loading && cleaned.length === 0 && !refreshing;

  return (
    <SectionList
      style={styles.listShell}
      sections={bootLoading ? [] : sections}
      keyExtractor={(item, index) =>
        `${customerIdFromRow(item) || item.id || item.label}-${index}`
      }
      stickySectionHeadersEnabled
      contentContainerStyle={[
        styles.listContent,
        { paddingBottom: contentPaddingBottom },
        !sections.length && styles.listContentEmpty,
      ]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={RECEIVABLES.link}
        />
      }
      ListHeaderComponent={
        bootLoading ? (
          <View style={styles.bootLoading}>
            <ActivityIndicator size="large" color={RECEIVABLES.link} />
            <Text style={styles.loadingText}>Loading receivables…</Text>
          </View>
        ) : (
          <View style={styles.headerBlock}>
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <View style={[styles.summaryTile, styles.summaryTilePrimary]}>
                  <Text style={styles.summaryTileLabel}>Total due</Text>
                  <Text style={styles.summaryTileValue}>{fmt(totalDue)}</Text>
                </View>
                <View style={[styles.summaryTile, styles.summaryTileOverdue]}>
                  <Text style={styles.summaryTileLabelOverdue}>Overdue</Text>
                  <Text style={styles.summaryTileValueOverdue}>
                    {fmt(overdueTotal)}
                  </Text>
                </View>
              </View>
              {currentTotal > 0.5 ? (
                <View style={styles.summaryCurrentRow}>
                  <Ionicons
                    name="time-outline"
                    size={14}
                    color={RECEIVABLES.green}
                  />
                  <Text style={styles.summaryCurrentText}>
                    Current (not yet due): {fmt(currentTotal)}
                  </Text>
                </View>
              ) : null}
              <Text style={styles.summaryMeta}>
                {cleaned.length} customer{cleaned.length === 1 ? "" : "s"}
                {listMode === "overdue_only"
                  ? " · overdue list only (full AR API unavailable)"
                  : ""}
              </Text>
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
            </View>
          </View>
        )
      }
      renderSectionHeader={({ section }) => (
        <View
          style={[
            styles.sectionHeader,
            section.overdue
              ? styles.sectionHeaderOverdue
              : styles.sectionHeaderCurrent,
          ]}
        >
          <Text
            style={[
              styles.sectionTitle,
              section.overdue
                ? styles.sectionTitleOverdue
                : styles.sectionTitleCurrent,
            ]}
          >
            {section.title}
          </Text>
          <Text style={styles.sectionCount}>{section.data.length}</Text>
        </View>
      )}
      ListEmptyComponent={
        bootLoading ? null : !sections.length ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="people-outline" size={40} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>
              {query.trim() ? "No matching customers" : "No receivables in this territory"}
            </Text>
          </View>
        ) : null
      }
      renderItem={({ item, index, section }) => {
        const overdueSection = section.overdue;
        const displayAmount = overdueSection
          ? rowOverdueAmount(item) || rowOutstanding(item)
          : rowOutstanding(item);
        const label = String(item.label || customerIdFromRow(item) || "—");
        const subtitle = rowSubtitle(item, overdueSection);
        const amountColor = dueAmountColor(item);
        const isLast = index === section.data.length - 1;
        return (
          <View
            style={[
              styles.listRowsCard,
              overdueSection && styles.listRowsCardOverdue,
              isLast && styles.listRowsCardBottom,
            ]}
          >
            <TouchableOpacity
              style={[styles.row, !isLast && styles.rowBorder]}
              activeOpacity={0.85}
              onPress={() => onRowPress(item)}
            >
              <View
                style={[
                  styles.avatar,
                  overdueSection ? styles.avatarOverdue : styles.avatarCurrent,
                ]}
              >
                <Text
                  style={[
                    styles.avatarText,
                    overdueSection && styles.avatarTextOverdue,
                  ]}
                >
                  {initialsFromLabel(label)}
                </Text>
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle} numberOfLines={2}>
                  {label}
                </Text>
                {subtitle ? (
                  <Text style={styles.rowSub} numberOfLines={1}>
                    {subtitle}
                  </Text>
                ) : null}
              </View>
              <View style={styles.rowTrailing}>
                <Text style={[styles.rowAmount, { color: amountColor }]}>
                  {fmt(displayAmount)}
                </Text>
                <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
              </View>
            </TouchableOpacity>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  listShell: { flex: 1, backgroundColor: RECEIVABLES.bg },
  listContent: { paddingHorizontal: 16, paddingTop: 12 },
  listContentEmpty: { flexGrow: 1 },
  headerBlock: { gap: 12, marginBottom: 8 },
  summaryCard: {
    backgroundColor: RECEIVABLES.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: RECEIVABLES.border,
    gap: 10,
  },
  summaryRow: { flexDirection: "row", gap: 10 },
  summaryTile: {
    flex: 1,
    borderRadius: 10,
    padding: 12,
  },
  summaryTilePrimary: { backgroundColor: "#eff6ff" },
  summaryTileOverdue: { backgroundColor: "#fff7ed" },
  summaryTileLabel: {
    fontSize: 11,
    fontFamily: Fonts.bodySemi,
    color: RECEIVABLES.subtitle,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  summaryTileLabelOverdue: {
    fontSize: 11,
    fontFamily: Fonts.bodySemi,
    color: "#c2410c",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  summaryTileValue: {
    fontSize: 20,
    fontFamily: Fonts.bodyBold,
    color: RECEIVABLES.link,
    marginTop: 4,
  },
  summaryTileValueOverdue: {
    fontSize: 20,
    fontFamily: Fonts.bodyBold,
    color: "#ea580c",
    marginTop: 4,
  },
  summaryCurrentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  summaryCurrentText: {
    fontSize: 12,
    fontFamily: Fonts.bodySemi,
    color: RECEIVABLES.green,
  },
  summaryMeta: {
    fontSize: 11,
    fontFamily: Fonts.body,
    color: RECEIVABLES.subtitle,
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: RECEIVABLES.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: RECEIVABLES.border,
    paddingHorizontal: 10,
    minHeight: 42,
  },
  searchIcon: { marginRight: 6 },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: Fonts.body,
    color: RECEIVABLES.value,
    paddingVertical: 8,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginTop: 4,
  },
  sectionHeaderOverdue: {},
  sectionHeaderCurrent: {},
  sectionTitle: {
    fontSize: 12,
    fontFamily: Fonts.bodyBold,
    letterSpacing: 0.35,
    textTransform: "uppercase",
  },
  sectionTitleOverdue: { color: "#c2410c" },
  sectionTitleCurrent: { color: RECEIVABLES.green },
  sectionCount: {
    fontSize: 11,
    fontFamily: Fonts.bodySemi,
    color: RECEIVABLES.subtitle,
  },
  listRowsCard: {
    backgroundColor: RECEIVABLES.card,
    borderLeftWidth: 3,
    borderLeftColor: RECEIVABLES.green,
  },
  listRowsCardOverdue: { borderLeftColor: "#ea580c" },
  listRowsCardBottom: { borderBottomLeftRadius: 12, borderBottomRightRadius: 12 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 10,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: RECEIVABLES.border,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarCurrent: { backgroundColor: "#dcfce7" },
  avatarOverdue: { backgroundColor: "#ffedd5" },
  avatarText: {
    fontSize: 13,
    fontFamily: Fonts.bodyBold,
    color: RECEIVABLES.green,
  },
  avatarTextOverdue: { color: "#c2410c" },
  rowBody: { flex: 1, minWidth: 0 },
  rowTitle: {
    fontSize: 14,
    fontFamily: Fonts.bodySemi,
    color: RECEIVABLES.value,
  },
  rowSub: {
    fontSize: 11,
    fontFamily: Fonts.body,
    color: RECEIVABLES.subtitle,
    marginTop: 2,
  },
  rowTrailing: { alignItems: "flex-end", gap: 2 },
  rowAmount: {
    fontSize: 14,
    fontFamily: Fonts.bodyBold,
  },
  loadingWrap: { alignItems: "center", paddingVertical: 48, gap: 12 },
  bootLoading: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 56,
    gap: 12,
  },
  loadingText: { color: RECEIVABLES.subtitle, fontFamily: Fonts.body },
  emptyWrap: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyTitle: {
    fontSize: 15,
    fontFamily: Fonts.bodySemi,
    color: RECEIVABLES.subtitle,
  },
});
