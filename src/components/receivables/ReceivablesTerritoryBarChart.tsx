import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import {
  isValidReceivablesTerritoryDrillName,
  type TerritoryReceivablePoint,
} from "../../utils/receivablesTerritoryBreakdown";
import { useAuthStore } from "../../store/auth";
import { formatCurrency } from "../../utils/currency";
import { RECEIVABLES } from "../../screens/receivables/receivablesTheme";
import { ReceivablesSectionHeader } from "./ReceivablesSectionHeader";
import { Fonts } from "../../theme/typography";
import {
  openReceivablesTerritoryCustomerList,
  type ReceivablesWidgetListScope,
} from "../../utils/receivablesNavigation";

const BAR_COLORS = ["#2563eb", "#16a34a", "#0ea5e9", "#7c3aed", "#d97706"];

type Props = {
  points: TerritoryReceivablePoint[];
  currency?: string;
  title?: string;
  listScope?: Omit<ReceivablesWidgetListScope, "widgetKey" | "title">;
};

export function ReceivablesTerritoryBarChart({
  points,
  currency = "SAR",
  title = "Receivables by Territory",
  listScope,
}: Props) {
  const permissionsScope = useAuthStore((s) => s.permissions.scope);

  const maxValue = useMemo(
    () => Math.max(...points.map((p) => p.value), 1),
    [points]
  );
  const total = useMemo(
    () => points.reduce((s, p) => s + p.value, 0),
    [points]
  );

  if (!points.length) return null;

  const onTerritoryPress = (point: TerritoryReceivablePoint) => {
    if (!listScope || point.value <= 0) return;
    if (!isValidReceivablesTerritoryDrillName(point.territory, permissionsScope)) {
      return;
    }
    openReceivablesTerritoryCustomerList(point.territory, {
      ...listScope,
      territoryCardTotal: point.value,
    });
  };

  return (
    <View style={styles.wrap}>
      <ReceivablesSectionHeader title={title} />
      <View style={styles.card}>
        {points.map((point, i) => {
          const pct = maxValue > 0 ? (point.value / maxValue) * 100 : 0;
          const color = BAR_COLORS[i % BAR_COLORS.length];
          const amountLabel = formatCurrency(point.value, currency, {
            compact: true,
            hideCode: false,
          });
          const share =
            total > 0 ? Math.round((point.value / total) * 100) : 0;
          return (
            <TouchableOpacity
              key={`${point.territory}-${point.widgetKey}`}
              style={styles.row}
              activeOpacity={listScope && point.value > 0 ? 0.85 : 1}
              onPress={() => onTerritoryPress(point)}
              disabled={!listScope || point.value <= 0}
            >
              <View style={styles.rowHead}>
                <Text style={styles.territoryName} numberOfLines={1}>
                  {point.territory}
                </Text>
                <Text style={styles.amount}>{amountLabel}</Text>
              </View>
              <View style={styles.track}>
                <View
                  style={[
                    styles.fill,
                    {
                      width: `${Math.max(pct, point.value > 0 ? 4 : 0)}%`,
                      backgroundColor: color,
                    },
                  ]}
                />
              </View>
              {total > 0 ? (
                <Text style={styles.share}>{share}% of total</Text>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>
      {listScope ? (
        <Text style={styles.hint}>Tap a territory to view customers</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  card: {
    backgroundColor: RECEIVABLES.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: RECEIVABLES.border,
    padding: 14,
    gap: 16,
  },
  row: { gap: 6 },
  rowHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  territoryName: {
    flex: 1,
    fontSize: 13,
    fontFamily: Fonts.bodySemi,
    color: RECEIVABLES.value,
  },
  amount: {
    fontSize: 13,
    fontFamily: Fonts.bodyBold,
    color: RECEIVABLES.link,
  },
  track: {
    height: 10,
    borderRadius: 5,
    backgroundColor: "#e2e8f0",
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 5,
    minWidth: 4,
  },
  share: {
    fontSize: 10,
    fontFamily: Fonts.body,
    color: RECEIVABLES.subtitle,
  },
  hint: {
    marginTop: 8,
    fontSize: 11,
    fontFamily: Fonts.body,
    color: RECEIVABLES.subtitle,
    textAlign: "center",
  },
});
