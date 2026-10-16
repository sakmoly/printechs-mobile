import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import Svg, { Path } from "react-native-svg";
import type { HomeWidgetEntry } from "../../screens/home/buildHomeSections";
import { HOME, healthStatus } from "../../screens/home/homeTheme";
import { resolveHealthScore } from "../../utils/healthScore";
import { HomeSectionHeader } from "./HomeSectionHeader";
import { Fonts } from "../../theme/typography";

type Props = {
  entries: HomeWidgetEntry[];
};

function MiniGauge({
  label,
  score,
  maxScore = 100,
}: {
  label: string;
  score: number;
  maxScore?: number;
}) {
  const pct = Math.min(Math.max(score / maxScore, 0), 1);
  const { text: statusText, color } = healthStatus(score);
  const gaugeW = 140;
  const gaugeH = 78;
  const cx = gaugeW / 2;
  const cy = gaugeH - 4;
  const r = 58;
  const startX = cx - r;
  const angle = Math.PI * (1 - pct);
  const needleX = cx + r * Math.cos(angle);
  const needleY = cy - r * Math.sin(angle);
  const bgPath = `M ${startX} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  const progressPath = `M ${startX} ${cy} A ${r} ${r} 0 ${pct > 0.5 ? 1 : 0} 1 ${needleX} ${needleY}`;

  return (
    <View style={styles.gaugeCard}>
      <Text style={styles.gaugeLabel} numberOfLines={2}>
        {label}
      </Text>
      <View style={styles.gaugeSvgWrap}>
        <Svg width={gaugeW} height={gaugeH}>
          <Path
            d={bgPath}
            stroke="#e2e8f0"
            strokeWidth={10}
            fill="none"
            strokeLinecap="round"
          />
          <Path
            d={progressPath}
            stroke={color}
            strokeWidth={10}
            fill="none"
            strokeLinecap="round"
          />
        </Svg>
        <View style={styles.scoreOverlay}>
          <Text style={[styles.score, { color }]}>
            {Math.round(score)}/{Math.round(maxScore)}
          </Text>
          <Text style={[styles.status, { color }]}>{statusText}</Text>
        </View>
      </View>
    </View>
  );
}

function scoreFromEntry(entry: HomeWidgetEntry): number | null {
  const resolved = resolveHealthScore(entry.payload, entry.key);
  return resolved?.score ?? null;
}

export function HomeHealthGauges({ entries }: Props) {
  const gauges = entries
    .map((entry) => {
      const score = scoreFromEntry(entry);
      if (score == null) return null;
      return { entry, score };
    })
    .filter(Boolean) as Array<{ entry: HomeWidgetEntry; score: number }>;

  if (!gauges.length) return null;

  return (
    <View style={styles.wrap}>
      <HomeSectionHeader title="Business Health" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {gauges.map(({ entry, score }) => {
          const resolved = resolveHealthScore(entry.payload, entry.key);
          const maxScore = resolved?.maxScore ?? 100;
          return (
          <MiniGauge
            key={entry.key}
            label={entry.label}
            score={score}
            maxScore={maxScore}
          />
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  scroll: { gap: 10, paddingRight: 4 },
  gaugeCard: {
    width: 152,
    backgroundColor: HOME.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: HOME.border,
    padding: 10,
    alignItems: "center",
  },
  gaugeLabel: {
    fontSize: 10,
    fontFamily: Fonts.bodySemi,
    color: HOME.label,
    textAlign: "center",
    minHeight: 28,
    marginBottom: 4,
  },
  gaugeSvgWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  scoreOverlay: {
    position: "absolute",
    bottom: 0,
    alignItems: "center",
  },
  score: {
    fontSize: 16,
    fontFamily: Fonts.bodyBold,
  },
  status: {
    fontSize: 10,
    fontFamily: Fonts.bodySemi,
    marginTop: 1,
  },
});
