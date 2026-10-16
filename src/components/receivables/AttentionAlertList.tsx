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
import {
  openCollectionDashboard,
  openReceivablesWidgetList,
  type ReceivablesWidgetListScope,
} from "../../utils/receivablesNavigation";
import { useAuthStore } from "../../store/auth";
import { isModuleEnabled } from "../../api/mobileConfig";
import { RECEIVABLES } from "../../screens/receivables/receivablesTheme";
import { ReceivablesSectionHeader } from "./ReceivablesSectionHeader";
import { Fonts } from "../../theme/typography";

type Props = {
  payload: DashboardWidgetDataResponse;
  title?: string;
  compact?: boolean;
  widgetKey?: string;
  listScope?: Omit<ReceivablesWidgetListScope, "widgetKey" | "title">;
};

function itemSeverity(row: AnalysisRow): "danger" | "warning" {
  const s = String(row.meta?.severity || "").toLowerCase();
  const cells = row.meta?.cells as Record<string, unknown> | undefined;
  const fromCells = String(cells?.severity || "").toLowerCase();
  const sev = s || fromCells;
  if (sev === "danger" || sev === "error" || sev === "critical") {
    return "danger";
  }
  return "warning";
}

export function AttentionAlertList({
  payload,
  title,
  compact,
  widgetKey,
  listScope,
}: Props) {
  const rows = payload.rows?.length ? payload.rows : [];
  const resolvedKey =
    widgetKey || payload.widget_key || "receivables_attention";
  const sectionTitle = title || "Attention Required";

  const openViewAll = () => {
    openReceivablesWidgetList({
      widgetKey: resolvedKey,
      title: sectionTitle,
      ...listScope,
    });
  };

  const openAttentionRow = () => {
    const cfg = useAuthStore.getState().mobileConfig;
    if (isModuleEnabled(cfg, "collection")) {
      openCollectionDashboard();
      return;
    }
    openViewAll();
  };

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <ReceivablesSectionHeader
        title={sectionTitle}
        rightLabel="View All"
        rightAction={openViewAll}
      />
      {!rows.length ? (
        <Text style={styles.empty}>No attention items</Text>
      ) : (
        rows.map((row, i) => {
          const sev = itemSeverity(row);
          const count = Number(row.value) || 0;
          const icon =
            sev === "danger" ? "alert-circle" : "warning";
          const iconColor =
            sev === "danger" ? RECEIVABLES.red : RECEIVABLES.amber;
          return (
            <TouchableOpacity
              key={`${row.id}-${i}`}
              style={styles.row}
              activeOpacity={0.85}
              onPress={openAttentionRow}
            >
              <Ionicons name={icon} size={16} color={iconColor} />
              <Text style={styles.label} numberOfLines={2}>
                {row.label}
              </Text>
              <Text style={styles.count}>{count.toLocaleString("en-US")}</Text>
            </TouchableOpacity>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: RECEIVABLES.card,
    borderRadius: 12,
    padding: 12,
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
    gap: 8,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f1f5f9",
  },
  label: {
    flex: 1,
    fontSize: 10,
    fontFamily: Fonts.bodySemi,
    color: RECEIVABLES.value,
    lineHeight: 14,
  },
  count: {
    fontSize: 13,
    fontFamily: Fonts.bodyBold,
    color: RECEIVABLES.red,
    minWidth: 24,
    textAlign: "right",
  },
  empty: {
    color: RECEIVABLES.subtitle,
    fontSize: 12,
    fontFamily: Fonts.body,
    paddingVertical: 8,
  },
});
