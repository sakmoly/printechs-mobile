import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { AnalysisRow } from "../../api/genericAnalysisTypes";
import { formatCurrency } from "../../utils/currency";
import { RECEIVABLES } from "../../screens/receivables/receivablesTheme";
import { Fonts } from "../../theme/typography";
import { rankingRowDisplayAmount } from "../../utils/receivablesRankingRows";
import { customerIdFromRow } from "../../utils/receivablesNavigation";
import { dueAmountColor, resolveOverdueDays } from "./overdueDueStatus";

const OVERDUE_ACCENT = "#ea580c";
const OVERDUE_ACCENT_BG = "#fff7ed";

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

function notYetDueSubtitle(row: AnalysisRow): string | null {
  const cells = row.meta?.cells as Record<string, unknown> | undefined;
  const untilDue = Number(
    cells?.days_until_due ?? cells?.due_in_days ?? cells?.days_to_due
  );
  if (Number.isFinite(untilDue) && untilDue > 0) {
    return `Due in ${Math.round(untilDue)} day${untilDue === 1 ? "" : "s"}`;
  }
  const days = Number(cells?.days ?? row.meta?.days);
  if (Number.isFinite(days) && days < 0) {
    const d = Math.abs(days);
    return `Due in ${d} day${d === 1 ? "" : "s"}`;
  }
  return "Not yet due";
}

function overdueSubtitle(
  row: AnalysisRow,
  selectedBucket?: string
): string | null {
  const days = resolveOverdueDays(row);
  const bucketCtx = String(selectedBucket || "").toLowerCase();
  const isCurrentCtx = /current|not.?due|not.?yet/.test(bucketCtx);

  if (days != null && days > 0) {
    return `${Math.round(days)} day${days === 1 ? "" : "s"} overdue`;
  }
  if (isCurrentCtx) {
    return notYetDueSubtitle(row);
  }
  return null;
}

type Props = {
  rows: AnalysisRow[];
  currency: string;
  widgetKey: string;
  onRowPress: (row: AnalysisRow) => void;
  refreshing: boolean;
  loading?: boolean;
  onRefresh: () => void;
  contentPaddingBottom: number;
  summaryLabel?: string;
  emptyTitle?: string;
  dashboardBucketTotal?: number;
  selectedAgingBucketLabel?: string;
};

export function OverdueCustomersListPanel({
  rows,
  currency,
  widgetKey,
  onRowPress,
  refreshing,
  loading = false,
  onRefresh,
  contentPaddingBottom,
  summaryLabel = "Total overdue balance",
  emptyTitle = "No overdue customers",
  dashboardBucketTotal,
  selectedAgingBucketLabel,
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

  const totalOverdue = useMemo(
    () =>
      sorted.reduce(
        (sum, r) => sum + rankingRowDisplayAmount(widgetKey, r),
        0
      ),
    [sorted, widgetKey]
  );

  const reconcileHint = useMemo(() => {
    if (dashboardBucketTotal == null || dashboardBucketTotal <= 0) return null;
    const diff = Math.abs(totalOverdue - dashboardBucketTotal);
    const pct =
      dashboardBucketTotal > 0 ? (diff / dashboardBucketTotal) * 100 : 0;
    const bucketLine = `Dashboard bucket: ${formatCurrency(
      dashboardBucketTotal,
      currency,
      { compact: false, hideCode: false, decimals: 0 }
    )}`;
    if (pct <= 3) return null;
    if (pct <= 12) {
      return `${bucketLine} · list uses territory overdue when days overdue is missing on rows`;
    }
    return bucketLine;
  }, [dashboardBucketTotal, totalOverdue, currency]);

  return (
    <FlatList
      style={styles.listShell}
      data={loading ? [] : filtered}
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
          tintColor={OVERDUE_ACCENT}
        />
      }
      ListHeaderComponent={
        <View style={styles.headerBlock}>
          <View style={styles.summaryCard}>
            <View style={styles.summaryIconWrap}>
              <Ionicons
                name="alert-circle-outline"
                size={22}
                color={OVERDUE_ACCENT}
              />
            </View>
            <View style={styles.summaryText}>
              <Text style={styles.summaryLabel}>{summaryLabel}</Text>
              {loading && !sorted.length ? (
                <ActivityIndicator
                  size="small"
                  color={OVERDUE_ACCENT}
                  style={styles.summaryLoader}
                />
              ) : (
                <Text style={styles.summaryValue}>
                  {formatCurrency(totalOverdue, currency, {
                    compact: false,
                    hideCode: false,
                    decimals: 0,
                  })}
                </Text>
              )}
              <Text style={styles.summaryMeta}>
                {sorted.length} customer{sorted.length === 1 ? "" : "s"}
                {query.trim() ? ` · ${filtered.length} shown` : ""}
              </Text>
              {reconcileHint ? (
                <Text style={styles.reconcileHint}>{reconcileHint}</Text>
              ) : null}
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
              editable={!loading || sorted.length > 0}
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
        loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={OVERDUE_ACCENT} />
            <Text style={styles.loadingText}>Loading customers…</Text>
          </View>
        ) : (
          <View style={styles.emptyWrap}>
            <Ionicons name="people-outline" size={40} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>
              {query.trim() ? "No matching customers" : emptyTitle}
            </Text>
            <Text style={styles.emptySub}>
              {query.trim()
                ? "Try a different search term."
                : "Adjust filters or pull down to refresh."}
            </Text>
          </View>
        )
      }
      renderItem={({ item, index }) => {
        const amount = rankingRowDisplayAmount(widgetKey, item);
        const label = String(item.label || customerIdFromRow(item) || "—");
        const subtitle = overdueSubtitle(item, selectedAgingBucketLabel);
        const amountColor = dueAmountColor(item);
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
                {subtitle ? (
                  <Text style={styles.rowSub} numberOfLines={1}>
                    {subtitle}
                  </Text>
                ) : null}
              </View>
              <View style={styles.rowTrailing}>
                <Text style={[styles.rowAmount, { color: amountColor }]}>
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
    backgroundColor: OVERDUE_ACCENT_BG,
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
  summaryLoader: {
    alignSelf: "flex-start",
    marginVertical: 6,
  },
  summaryMeta: {
    fontSize: 11,
    fontFamily: Fonts.body,
    color: RECEIVABLES.subtitle,
    marginTop: 4,
  },
  reconcileHint: {
    fontSize: 11,
    fontFamily: Fonts.bodySemi,
    color: RECEIVABLES.link,
    marginTop: 6,
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: RECEIVABLES.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: RECEIVABLES.border,
    paddingHorizontal: 12,
    minHeight: 46,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: Fonts.body,
    color: RECEIVABLES.value,
    paddingVertical: 11,
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
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f1f5f9",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: OVERDUE_ACCENT_BG,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 13,
    fontFamily: Fonts.bodyBold,
    color: OVERDUE_ACCENT,
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
  rowSub: {
    fontSize: 12,
    fontFamily: Fonts.body,
    color: RECEIVABLES.subtitle,
    marginTop: 3,
  },
  rowTrailing: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 0,
    maxWidth: "44%",
  },
  rowAmount: {
    fontSize: 14,
    fontFamily: Fonts.bodyBold,
    textAlign: "right",
  },
  chevron: {
    marginLeft: 4,
  },
  loadingWrap: {
    alignItems: "center",
    paddingVertical: 48,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: Fonts.body,
    color: RECEIVABLES.subtitle,
  },
  emptyWrap: {
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 24,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: Fonts.bodySemi,
    color: RECEIVABLES.value,
    textAlign: "center",
  },
  emptySub: {
    fontSize: 13,
    fontFamily: Fonts.body,
    color: RECEIVABLES.subtitle,
    textAlign: "center",
    lineHeight: 18,
  },
});
