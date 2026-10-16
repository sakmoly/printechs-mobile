import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { DashboardWidgetDataResponse } from "../../api/dashboardWidgetData";
import type { AnalysisRow } from "../../api/genericAnalysisTypes";
import { formatCurrency } from "../../utils/currency";
import {
  isCustomerAdvancesWidgetKey,
  openCustomerAdvancePaymentsDrill,
  openCustomerFromRow,
  openReceivablesWidgetList,
  type ReceivablesWidgetListScope,
} from "../../utils/receivablesNavigation";
import {
  filterReceivablesRankingRows,
  MIN_OVERDUE_LIST_AMOUNT_SAR,
  rankingRowDisplayAmount,
  rowOutstanding,
} from "../../utils/receivablesRankingRows";

export {
  filterOverdueRankingRows,
  MIN_OVERDUE_LIST_AMOUNT_SAR,
  rowOutstanding,
} from "../../utils/receivablesRankingRows";
import { RECEIVABLES } from "../../screens/receivables/receivablesTheme";
import { ReceivablesSectionHeader } from "./ReceivablesSectionHeader";
import { Fonts } from "../../theme/typography";
import { dueAmountColor } from "./overdueDueStatus";

type Props = {
  payload: DashboardWidgetDataResponse;
  title?: string;
  compact?: boolean;
  widgetKey?: string;
  listScope?: Omit<ReceivablesWidgetListScope, "widgetKey" | "title">;
  /** Full-screen list — slightly taller rows */
  variant?: "card" | "list";
};

export function OverdueCustomerRow({
  row,
  index,
  currency,
  isLast,
  variant = "card",
  amount: amountOverride,
  onPress,
}: {
  row: AnalysisRow;
  index: number;
  currency: string;
  isLast?: boolean;
  variant?: "card" | "list";
  amount?: number;
  onPress?: () => void;
}) {
  const amount =
    amountOverride != null && Number.isFinite(amountOverride)
      ? amountOverride
      : rowOutstanding(row);
  const amountColor = dueAmountColor(row);
  const isList = variant === "list";

  return (
    <TouchableOpacity
      style={[
        styles.row,
        isList && styles.rowList,
        !isLast && styles.rowBorder,
      ]}
      activeOpacity={0.85}
      onPress={onPress || (() => openCustomerFromRow(row))}
    >
      <Text
        style={[styles.name, isList && styles.nameList]}
        numberOfLines={isList ? 2 : 1}
        ellipsizeMode="tail"
      >
        {row.label}
      </Text>
      <View style={styles.amountWrap}>
        <Text
          style={[styles.amount, { color: amountColor }]}
          numberOfLines={1}
        >
          {formatCurrency(amount, currency, {
            compact: false,
            hideCode: false,
            decimals: 0,
          })}
        </Text>
        <Ionicons name="chevron-forward" size={14} color="#94a3b8" />
      </View>
    </TouchableOpacity>
  );
}

export function OverdueRankingList({
  payload,
  title,
  compact,
  widgetKey,
  listScope,
  variant = "card",
}: Props) {
  const currency = payload.currency || payload.meta?.currency || "SAR";
  const resolvedKey =
    widgetKey ||
    payload.widget_key ||
    "receivables_overdue_customers_table";
  const rawRows = payload.table?.rows?.length
    ? payload.table.rows
    : payload.rows || [];
  const rows = filterReceivablesRankingRows(resolvedKey, rawRows);
  const advances = isCustomerAdvancesWidgetKey(resolvedKey);
  const sectionTitle = title || "Top 5 Overdue Customers";
  const topRows = rows.slice(0, 5);

  const openViewAll = () => {
    openReceivablesWidgetList({
      widgetKey: resolvedKey,
      title: sectionTitle,
      ...listScope,
    });
  };

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <ReceivablesSectionHeader
        title={sectionTitle}
        rightLabel="View All"
        rightAction={openViewAll}
      />
      {!topRows.length ? (
        <Text style={styles.empty}>
          {advances
            ? "No customers with unallocated advances for the current filters."
            : `No customers with balance ≥ ${MIN_OVERDUE_LIST_AMOUNT_SAR.toLocaleString()} ${currency}`}
        </Text>
      ) : (
        topRows.map((row, i) => (
          <OverdueCustomerRow
            key={`${row.id}-${i}`}
            row={row}
            index={i}
            currency={currency}
            isLast={i === topRows.length - 1}
            variant={variant}
            amount={rankingRowDisplayAmount(resolvedKey, row)}
            onPress={
              advances
                ? () => {
                    void openCustomerAdvancePaymentsDrill(row, {
                      company: listScope?.company,
                      territory: listScope?.selectedTerritory,
                    });
                  }
                : undefined
            }
          />
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: RECEIVABLES.card,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: RECEIVABLES.border,
    marginBottom: 12,
    minWidth: 0,
  },
  wrapCompact: {
    marginBottom: 0,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingVertical: 10,
  },
  rowList: {
    paddingVertical: 12,
    backgroundColor: RECEIVABLES.card,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f1f5f9",
  },
  name: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    fontFamily: Fonts.bodySemi,
    color: RECEIVABLES.value,
    lineHeight: 17,
  },
  nameList: {
    fontSize: 14,
    lineHeight: 18,
  },
  amountWrap: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 0,
    maxWidth: "46%",
    gap: 2,
  },
  amount: {
    fontSize: 13,
    fontFamily: Fonts.bodyBold,
    textAlign: "right",
  },
  empty: {
    color: RECEIVABLES.subtitle,
    fontSize: 11,
    fontFamily: Fonts.body,
    paddingVertical: 6,
  },
});
