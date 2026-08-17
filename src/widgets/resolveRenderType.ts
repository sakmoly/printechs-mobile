import type { WidgetType } from "./types";

const CHART_TYPES = new Set(["PIE", "DONUT", "BAR", "LINE"]);
const TABLE_TYPES = new Set(["TABLE", "LIST", "CARD", "RANKING"]);

function normalizeTypeToken(raw: unknown): string {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

function mapHintToWidgetType(hint: string): WidgetType | null {
  const h = normalizeTypeToken(hint);
  if (!h) return null;
  if (h === "DONUT" || h.includes("DONUT")) return "DONUT";
  if (h === "PIE" || h.includes("PIE")) return "PIE";
  if (h === "BAR" || h.includes("BAR")) return "BAR";
  if (h === "LINE" || h.includes("LINE")) return "LINE";
  if (h === "KPI" || h.includes("KPI") || h === "METRIC") return "KPI";
  if (
    h === "TABLE" ||
    h === "LIST" ||
    h === "CARD" ||
    h === "RANKING" ||
    h.includes("TABLE") ||
    h.includes("LIST")
  ) {
    return "TABLE";
  }
  if (h === "LINK" || h.includes("LINK") || h.includes("ACTION")) return "LINK";
  if (h === "CHART") return "DONUT";
  return null;
}

function lookupDrillView(
  drillViews: unknown,
  drillDepth: number
): string | null {
  if (!drillViews || typeof drillViews !== "object") return null;
  const map = drillViews as Record<string, unknown>;
  const candidates = [
    map[String(drillDepth)],
    map[drillDepth as unknown as string],
    (map as { views?: unknown }).views &&
      typeof (map as { views?: unknown }).views === "object"
      ? ((map as { views: Record<string, unknown> }).views[String(drillDepth)] as
          | string
          | undefined)
      : undefined,
  ];
  for (const c of candidates) {
    if (c != null && String(c).trim()) return String(c).trim();
  }
  return null;
}

export type ResolveRenderTypeInput = {
  bootstrapType?: string | null;
  payloadType?: string | null;
  renderHint?: string | null;
  drillViews?: unknown;
  drillDepth?: number | null;
  hasTable?: boolean;
  hasChart?: boolean;
  hasKpi?: boolean;
  hasAction?: boolean;
};

/**
 * Pick renderer from Desk drill_views / meta.render_hint / payload shape.
 * Do not hardcode widget keys (e.g. sales_card → always pie).
 *
 * Priority:
 * 1. config.drill_views[drill_depth]
 * 2. meta.render_hint
 * 3. payload.widget_type
 * 4. payload shape
 * 5. bootstrap widget_type
 */
export function resolveEffectiveWidgetType(
  input: ResolveRenderTypeInput
): WidgetType {
  const depth = Math.max(0, Number(input.drillDepth) || 0);
  const fromDrill = mapHintToWidgetType(
    lookupDrillView(input.drillViews, depth) || ""
  );
  const fromHint = mapHintToWidgetType(input.renderHint || "");
  const fromPayload = mapHintToWidgetType(input.payloadType || "");
  const fromBootstrap = mapHintToWidgetType(input.bootstrapType || "");

  let preferred: WidgetType =
    fromDrill ||
    fromHint ||
    fromPayload ||
    (input.hasTable
      ? "TABLE"
      : input.hasChart
        ? fromBootstrap && CHART_TYPES.has(fromBootstrap)
          ? fromBootstrap
          : "DONUT"
        : input.hasKpi
          ? "KPI"
          : input.hasAction
            ? "LINK"
            : fromBootstrap) ||
    "KPI";

  // If preferred type has no matching payload, fall back to available shape.
  if (CHART_TYPES.has(preferred) && !input.hasChart && input.hasTable) {
    preferred = "TABLE";
  } else if (TABLE_TYPES.has(preferred) && !input.hasTable && input.hasChart) {
    preferred =
      fromBootstrap && CHART_TYPES.has(fromBootstrap) ? fromBootstrap : "DONUT";
  } else if (preferred === "KPI" && !input.hasKpi) {
    if (input.hasTable) preferred = "TABLE";
    else if (input.hasChart) preferred = "DONUT";
    else if (input.hasAction) preferred = "LINK";
  }

  return preferred;
}
