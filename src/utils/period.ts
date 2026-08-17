/**
 * Shared dashboard period presets for Phase 3 filters.
 * Backend receives normalized from_date / to_date (YYYY-MM-DD).
 */

export type PeriodPreset =
  | "today"
  | "yesterday"
  | "mtd"
  | "previous_month"
  | "qtd"
  | "ytd"
  | "previous_year"
  | "custom";

export type DateRange = {
  preset: PeriodPreset;
  from_date: string;
  to_date: string;
  label: string;
};

function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export const PERIOD_PRESET_OPTIONS: {
  id: PeriodPreset;
  label: string;
}[] = [
  { id: "ytd", label: "YTD" },
  { id: "mtd", label: "MTD" },
  { id: "qtd", label: "QTD" },
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "previous_month", label: "Prev Month" },
  { id: "previous_year", label: "Prev Year" },
  { id: "custom", label: "Custom" },
];

export function resolvePeriod(
  preset: PeriodPreset,
  custom?: { from_date: string; to_date: string },
  now = new Date()
): DateRange {
  const today = startOfDay(now);

  if (preset === "custom" && custom?.from_date && custom?.to_date) {
    return {
      preset,
      from_date: custom.from_date,
      to_date: custom.to_date,
      label: "Custom",
    };
  }

  switch (preset) {
    case "today":
      return {
        preset,
        from_date: toIso(today),
        to_date: toIso(today),
        label: "Today",
      };
    case "yesterday": {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      return {
        preset,
        from_date: toIso(y),
        to_date: toIso(y),
        label: "Yesterday",
      };
    }
    case "mtd":
      return {
        preset,
        from_date: toIso(new Date(today.getFullYear(), today.getMonth(), 1)),
        to_date: toIso(today),
        label: "MTD",
      };
    case "previous_month": {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      return {
        preset,
        from_date: toIso(start),
        to_date: toIso(end),
        label: "Prev Month",
      };
    }
    case "qtd": {
      const q = Math.floor(today.getMonth() / 3) * 3;
      return {
        preset,
        from_date: toIso(new Date(today.getFullYear(), q, 1)),
        to_date: toIso(today),
        label: "QTD",
      };
    }
    case "ytd":
      return {
        preset,
        from_date: toIso(new Date(today.getFullYear(), 0, 1)),
        to_date: toIso(today),
        label: "YTD",
      };
    case "previous_year": {
      const y = today.getFullYear() - 1;
      return {
        preset,
        from_date: toIso(new Date(y, 0, 1)),
        to_date: toIso(new Date(y, 11, 31)),
        label: "Prev Year",
      };
    }
    default:
      return resolvePeriod("ytd", undefined, now);
  }
}

export function defaultPeriod(): DateRange {
  return resolvePeriod("ytd");
}

const PERIOD_ALIASES: Record<string, PeriodPreset> = {
  today: "today",
  yesterday: "yesterday",
  mtd: "mtd",
  month: "mtd",
  month_to_date: "mtd",
  previous_month: "previous_month",
  prev_month: "previous_month",
  qtd: "qtd",
  quarter: "qtd",
  ytd: "ytd",
  year: "ytd",
  year_to_date: "ytd",
  previous_year: "previous_year",
  prev_year: "previous_year",
};

/** Parse a Desk/BA period string into a preset, or null. */
export function parsePeriodPreset(raw: unknown): PeriodPreset | null {
  if (raw == null) return null;
  const s = String(raw).trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (!s) return null;
  if (s in PERIOD_ALIASES) return PERIOD_ALIASES[s];
  if (s === "custom") return "custom";
  return null;
}

/**
 * Detect a fixed period from the widget name only (e.g. "Net Sales MTD").
 * Do NOT use Desk config.period — BA often sets a default on every widget,
 * which incorrectly locked Sales Performance / pie charts to MTD.
 * Returns null when the widget should follow the home Period filter.
 */
export function detectWidgetPeriodPreset(widget: {
  key?: string;
  label?: string;
  type?: string;
  config?: Record<string, unknown> | null;
}): PeriodPreset | null {
  const hay = `${widget.key || ""} ${widget.label || ""}`;
  // Prefer more specific tokens first — word-boundary so "sales_card" never matches
  if (/\bprevious[_\s-]?year\b|\bprev[_\s-]?year\b/i.test(hay)) {
    return "previous_year";
  }
  if (/\bprevious[_\s-]?month\b|\bprev[_\s-]?month\b/i.test(hay)) {
    return "previous_month";
  }
  if (/\byesterday\b/i.test(hay)) return "yesterday";
  if (/\btoday\b/i.test(hay)) return "today";
  if (/\bqtd\b/i.test(hay)) return "qtd";
  if (/\bmtd\b/i.test(hay)) return "mtd";
  if (/\bytd\b/i.test(hay)) return "ytd";
  return null;
}

/**
 * Resolve dates for one dashboard widget.
 * Widgets with Desk/label period (MTD/YTD/…) use that range;
 * others follow the home Period filter.
 */
export function resolveWidgetDateRange(
  widget: {
    key?: string;
    label?: string;
    config?: Record<string, unknown> | null;
  },
  home: { from_date?: string; to_date?: string; period?: string }
): DateRange {
  const fixed = detectWidgetPeriodPreset(widget);
  if (fixed) return resolvePeriod(fixed);

  const homePreset = parsePeriodPreset(home.period);
  if (
    homePreset === "custom" &&
    home.from_date &&
    home.to_date
  ) {
    return {
      preset: "custom",
      from_date: home.from_date,
      to_date: home.to_date,
      label: "Custom",
    };
  }
  if (homePreset) return resolvePeriod(homePreset);
  if (home.from_date && home.to_date) {
    return {
      preset: "custom",
      from_date: home.from_date,
      to_date: home.to_date,
      label: "Custom",
    };
  }
  return defaultPeriod();
}
