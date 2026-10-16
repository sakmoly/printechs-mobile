import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  TouchableOpacity,
} from "react-native";
import type { SalesWidgetEntry } from "../../screens/sales/buildSalesSections";
import type { AnalysisRow } from "../../api/genericAnalysisTypes";
import { AnalysisPieChart } from "../analytics/AnalysisPieChart";
import { formatCurrency } from "../../utils/currency";
import { SALES } from "../../screens/sales/salesTheme";
import { SalesSectionHeader } from "./SalesSectionHeader";
import { Fonts } from "../../theme/typography";

type Props = {
  entries: SalesWidgetEntry[];
};

const CARD_W = Math.min(280, Dimensions.get("window").width * 0.78);

function rowsFromEntry(entry: SalesWidgetEntry): AnalysisRow[] {
  const series = entry.payload.chart?.series || [];
  if (series.length) {
    return series.map((p, i) => ({
      id: String(p.dimension_value || p.label || `s-${i}`),
      label: String(p.label || `Slice ${i + 1}`),
      value: Number(p.value) || 0,
      change_pct: p.change_pct ?? null,
    }));
  }
  return entry.payload.rows || entry.payload.table?.rows || [];
}

function totalFromRows(rows: AnalysisRow[]): number {
  return rows.reduce((s, r) => s + (Number(r.value) || 0), 0);
}

function shortDonutTabLabel(label: string): string {
  const t = String(label || "").trim();
  return t.replace(/^by\s+/i, "").trim() || t;
}

function DonutCard({
  entry,
  fullWidth,
}: {
  entry: SalesWidgetEntry;
  fullWidth?: boolean;
}) {
  const rows = rowsFromEntry(entry);
  const currency = entry.payload.currency || "SAR";
  const total = totalFromRows(rows);

  return (
    <View style={[styles.card, fullWidth && styles.cardFull]}>
      <Text style={styles.cardTitle} numberOfLines={2}>
        {entry.label}
      </Text>
      {rows.length ? (
        <AnalysisPieChart
          rows={rows}
          currency={currency}
          title=""
          donut
          maxSlices={6}
          config={entry.payload.config}
        />
      ) : (
        <Text style={styles.empty}>No chart data</Text>
      )}
      {total > 0 ? (
        <Text style={styles.total}>
          {formatCurrency(total, currency, {
            compact: true,
            hideCode: false,
          })}{" "}
          Total
        </Text>
      ) : null}
    </View>
  );
}

export function SalesSummaryDonuts({ entries }: Props) {
  const tabs = useMemo(
    () =>
      entries.map((e) => ({
        id: e.key,
        label: shortDonutTabLabel(e.label),
        entry: e,
      })),
    [entries]
  );

  const [activeId, setActiveId] = useState(() => tabs[0]?.id || "");
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!tabs.length) return;
    const still = tabs.some((t) => t.id === activeId);
    if (!still) {
      const withData = tabs.find((t) => rowsFromEntry(t.entry).length);
      setActiveId(withData?.id || tabs[0].id);
    }
  }, [tabs, activeId]);

  if (!entries.length) return null;

  const active = tabs.find((t) => t.id === activeId) || tabs[0];
  const showSegment = tabs.length > 1;

  return (
    <View style={styles.wrap}>
      <SalesSectionHeader
        title="Sales Summary"
        rightLabel={expanded ? "One at a time" : "View all"}
        rightAction={() => setExpanded((v) => !v)}
      />

      {showSegment && !expanded ? (
        <View style={styles.segment}>
          {tabs.map((tab) => {
            const on = tab.id === (active?.id || "");
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.tab, on && styles.tabActive]}
                onPress={() => setActiveId(tab.id)}
                activeOpacity={0.85}
              >
                <Text
                  style={[styles.tabText, on && styles.tabTextActive]}
                  numberOfLines={2}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}

      {expanded ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        >
          {entries.map((entry) => (
            <DonutCard key={entry.key} entry={entry} />
          ))}
        </ScrollView>
      ) : active ? (
        <DonutCard entry={active.entry} fullWidth />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  segment: {
    flexDirection: "row",
    flexWrap: "wrap",
    backgroundColor: "#f1f5f9",
    borderRadius: 10,
    padding: 4,
    gap: 4,
    marginBottom: 10,
  },
  tab: {
    flexGrow: 1,
    flexBasis: "30%",
    alignItems: "center",
    paddingVertical: 7,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: SALES.link,
  },
  tabText: {
    fontSize: 10,
    fontFamily: Fonts.bodySemi,
    color: SALES.subtitle,
    textAlign: "center",
  },
  tabTextActive: {
    color: "#fff",
  },
  scroll: { gap: 10, paddingRight: 4 },
  card: {
    width: CARD_W,
    backgroundColor: SALES.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SALES.border,
    padding: 10,
  },
  cardFull: {
    width: "100%",
    alignSelf: "stretch",
  },
  cardTitle: {
    fontSize: 11,
    fontFamily: Fonts.bodySemi,
    color: SALES.subtitle,
    marginBottom: 4,
    minHeight: 28,
  },
  total: {
    marginTop: 4,
    textAlign: "center",
    fontSize: 11,
    fontFamily: Fonts.bodyBold,
    color: SALES.value,
  },
  empty: {
    color: SALES.subtitle,
    fontSize: 12,
    fontFamily: Fonts.body,
    paddingVertical: 24,
    textAlign: "center",
  },
});
