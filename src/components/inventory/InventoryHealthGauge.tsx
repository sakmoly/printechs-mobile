import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Path } from "react-native-svg";
import type { InventoryWidgetEntry } from "../../screens/inventory/buildInventorySections";
import { INVENTORY } from "../../screens/inventory/inventoryTheme";
import { resolveHealthScore } from "../../utils/healthScore";
import { InventorySectionHeader } from "./InventorySectionHeader";
import { Fonts } from "../../theme/typography";

type Props = {
  entry: InventoryWidgetEntry;
  showLy?: boolean;
};

function healthLabel(score: number): { text: string; color: string } {
  if (score >= 80) return { text: "Good", color: INVENTORY.green };
  if (score >= 60) return { text: "Fair", color: INVENTORY.amber };
  return { text: "Needs Attention", color: INVENTORY.red };
}

export function InventoryHealthGauge({ entry, showLy = true }: Props) {
  const resolved = resolveHealthScore(entry.payload, entry.key);
  if (!resolved) return null;

  const { score, maxScore } = resolved;
  const kpi = entry.payload.kpis[0];
  const summary = entry.payload.chart?.summary;
  const previous =
    kpi?.previous ??
    (summary?.value_ly != null ? Number(summary.value_ly) : null);
  const changePct =
    kpi?.change_pct ??
    (summary?.change_pct != null ? Number(summary.change_pct) : null);

  const pct = Math.min(Math.max(score / maxScore, 0), 1);
  const { text: statusText, color: statusColor } = healthLabel(score);
  const gaugeW = 220;
  const gaugeH = 120;
  const cx = gaugeW / 2;
  const cy = gaugeH - 8;
  const r = 88;
  const startX = cx - r;
  const endX = cx + r;
  const bgPath = `M ${startX} ${cy} A ${r} ${r} 0 0 1 ${endX} ${cy}`;
  const angle = Math.PI * (1 - pct);
  const needleX = cx + r * Math.cos(angle);
  const needleY = cy - r * Math.sin(angle);
  const progressPath = `M ${startX} ${cy} A ${r} ${r} 0 ${pct > 0.5 ? 1 : 0} 1 ${needleX} ${needleY}`;

  let lyLine = "";
  if (showLy && changePct != null && Number.isFinite(Number(changePct))) {
    const up = Number(changePct) > 0;
    const color = up ? INVENTORY.green : INVENTORY.red;
    lyLine = `${Math.abs(Number(changePct)).toFixed(2)}% vs LY`;
  }

  return (
    <View style={styles.wrap}>
      <InventorySectionHeader title={entry.label || "Inventory Health"} />
      <View style={styles.gaugeWrap}>
        <Svg width={gaugeW} height={gaugeH}>
          <Path
            d={bgPath}
            stroke="#e2e8f0"
            strokeWidth={14}
            fill="none"
            strokeLinecap="round"
          />
          <Path
            d={progressPath}
            stroke={statusColor}
            strokeWidth={14}
            fill="none"
            strokeLinecap="round"
          />
        </Svg>
        <View style={styles.scoreBlock}>
          <Text style={[styles.score, { color: statusColor }]}>
            {Math.round(score)}/{Math.round(maxScore)}
          </Text>
          <Text style={[styles.status, { color: statusColor }]}>
            {statusText}
          </Text>
        </View>
      </View>
      {showLy && previous != null && Number.isFinite(Number(previous)) ? (
        <Text style={styles.ly}>
          vs LY: {Math.round(Number(previous))}/{Math.round(maxScore)}
          {lyLine ? ` · ${lyLine}` : ""}
        </Text>
      ) : lyLine ? (
        <Text style={styles.ly}>{lyLine}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: INVENTORY.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: INVENTORY.border,
    padding: 12,
    marginBottom: 12,
    alignItems: "center",
  },
  gaugeWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: -8,
  },
  scoreBlock: {
    position: "absolute",
    bottom: 8,
    alignItems: "center",
  },
  score: {
    fontSize: 28,
    fontFamily: Fonts.bodyBold,
    letterSpacing: -0.5,
  },
  status: {
    fontSize: 13,
    fontFamily: Fonts.bodySemi,
    marginTop: 2,
  },
  ly: {
    marginTop: 4,
    fontSize: 11,
    fontFamily: Fonts.body,
    color: INVENTORY.subtitle,
    textAlign: "center",
  },
});
