/**
 * Printechs dashboard typography
 * Display: Outfit — KPI values & titles (distinctive, consistent scale)
 * Body: DM Sans — labels, captions, supporting text
 */

export const Fonts = {
  display: "Outfit_700Bold",
  displaySemi: "Outfit_600SemiBold",
  displayExtra: "Outfit_800ExtraBold",
  displayMedium: "Outfit_500Medium",
  body: "DMSans_400Regular",
  bodyMedium: "DMSans_500Medium",
  bodySemi: "DMSans_600SemiBold",
  bodyBold: "DMSans_700Bold",
} as const;

/** Fixed type scale so dashboards don’t mix random font sizes */
export const Type = {
  hero: {
    fontFamily: Fonts.displayExtra,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  kpi: {
    fontFamily: Fonts.display,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.3,
  },
  kpiCompact: {
    fontFamily: Fonts.display,
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  screenTitle: {
    fontFamily: Fonts.display,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.2,
  },
  sectionTitle: {
    fontFamily: Fonts.displaySemi,
    fontSize: 16,
    lineHeight: 22,
  },
  cardTitle: {
    fontFamily: Fonts.bodyBold,
    fontSize: 15,
    lineHeight: 20,
  },
  body: {
    fontFamily: Fonts.body,
    fontSize: 14,
    lineHeight: 20,
  },
  label: {
    fontFamily: Fonts.bodySemi,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.2,
  },
  caption: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 11,
    lineHeight: 14,
  },
  micro: {
    fontFamily: Fonts.bodySemi,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 0.3,
  },
} as const;
