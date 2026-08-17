/**
 * Resolve chart colors from bootstrap widget.config or get_dashboard_widget_data.config.
 *
 * Desk JSON shapes supported:
 * - chart_colors: ["#2563eb", "#16a34a", ...]  → pie/donut/bar slices
 * - colors: { current, ly, positive, negative } → series + derived slice palette
 * - colors: ["#…", …]                          → same as chart_colors
 */

export const DEFAULT_SLICE_COLORS = [
  "#2563eb",
  "#16a34a",
  "#dc2626",
  "#f59e0b",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
  "#84cc16",
];

export const DEFAULT_CURRENT_COLOR = "#2563eb";
export const DEFAULT_LY_COLOR = "#94a3b8";

export type ResolvedChartColors = {
  /** Per-slice / per-category colors (PIE / DONUT / single-series bars) */
  sliceColors: string[];
  /** Current-period series (BAR dual / LINE) */
  current: string;
  /** Last-year series */
  ly: string;
  positive: string;
  negative: string;
};

function isHexOrRgb(c: string): boolean {
  return (
    /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(c) ||
    /^rgb/i.test(c)
  );
}

function asColorList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((c) => String(c || "").trim())
    .filter((c) => isHexOrRgb(c));
}

function parseHex(color: string): { r: number; g: number; b: number } | null {
  let hex = color.trim().replace("#", "");
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((ch) => ch + ch)
      .join("");
  }
  if (hex.length !== 6) return null;
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}

function toHex(r: number, g: number, b: number): string {
  const clamp = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, "0");
  return `#${clamp(r)}${clamp(g)}${clamp(b)}`;
}

/** Lighten/darken a hex color for multi-slice palettes */
function shadeHex(color: string, factor: number): string {
  const rgb = parseHex(color);
  if (!rgb) return color;
  if (factor >= 0) {
    return toHex(
      rgb.r + (255 - rgb.r) * factor,
      rgb.g + (255 - rgb.g) * factor,
      rgb.b + (255 - rgb.b) * factor
    );
  }
  const f = 1 + factor;
  return toHex(rgb.r * f, rgb.g * f, rgb.b * f);
}

/**
 * Build a multi-slice palette from semantic Desk colors when chart_colors[] is absent.
 */
function paletteFromSemantic(colorsObj: Record<string, unknown>): string[] {
  const current = String(colorsObj.current || "").trim();
  const positive = String(colorsObj.positive || "").trim();
  const negative = String(colorsObj.negative || "").trim();
  const ly = String(colorsObj.ly || "").trim();
  const base = [current, positive, negative, ly].filter(
    (c) => c && isHexOrRgb(c)
  );
  if (!base.length) return [];

  const out: string[] = [...base];
  // Extra shades of current so 3+ territory slices stay colorful
  const seed = isHexOrRgb(current) ? current : base[0];
  const shades = [0.25, -0.15, 0.45, -0.3, 0.15, -0.45];
  for (const f of shades) {
    const s = shadeHex(seed, f);
    if (!out.includes(s)) out.push(s);
  }
  return out;
}

/**
 * Merge widgetData.config ?? widget.config and read chart_colors / colors.*.
 */
export function resolveChartColors(
  ...sources: Array<Record<string, unknown> | null | undefined>
): ResolvedChartColors {
  const cfg: Record<string, unknown> = {};
  for (const s of sources) {
    if (s && typeof s === "object") Object.assign(cfg, s);
  }

  const colorsObj =
    cfg.colors && typeof cfg.colors === "object" && !Array.isArray(cfg.colors)
      ? (cfg.colors as Record<string, unknown>)
      : {};

  const fromChartColors = asColorList(
    cfg.chart_colors ??
      cfg.chartColors ??
      cfg.palette ??
      cfg.slice_colors ??
      colorsObj.slices ??
      colorsObj.palette ??
      (Array.isArray(cfg.colors) ? cfg.colors : null)
  );

  const fromSemantic = paletteFromSemantic(colorsObj);

  const current = String(
    colorsObj.current ||
      cfg.current_color ||
      cfg.currentColor ||
      DEFAULT_CURRENT_COLOR
  );
  const ly = String(
    colorsObj.ly || cfg.ly_color || cfg.lyColor || DEFAULT_LY_COLOR
  );
  const positive = String(
    colorsObj.positive || cfg.positive_color || "#16a34a"
  );
  const negative = String(
    colorsObj.negative || cfg.negative_color || "#dc2626"
  );

  return {
    sliceColors: fromChartColors.length
      ? fromChartColors
      : fromSemantic.length
        ? fromSemantic
        : DEFAULT_SLICE_COLORS,
    current,
    ly,
    positive,
    negative,
  };
}

/** Hex/rgb → rgba() for chart-kit color callbacks */
export function colorWithOpacity(color: string, opacity = 1): string {
  const c = (color || "").trim();
  if (/^rgba?\(/i.test(c)) {
    if (/^rgb\(/i.test(c) && opacity < 1) {
      return c.replace(/^rgb\(/i, "rgba(").replace(/\)$/, `, ${opacity})`);
    }
    return c;
  }
  const rgb = parseHex(c);
  if (!rgb) {
    return `rgba(37, 99, 235, ${opacity})`;
  }
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
}
