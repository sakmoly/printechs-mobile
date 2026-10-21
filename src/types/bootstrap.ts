/**
 * Mobile bootstrap contract (erp_analysis.api.get_mobile_bootstrap).
 * Keys are open strings so future BA modules/dimensions do not break the app.
 */

import { normalizeWidgetType } from "../widgets/types";

export type BusinessType =
  | "B2B"
  | "GENERAL_RETAIL"
  | "FASHION_RETAIL"
  | "SUPERMARKET"
  | "POS_RETAIL"
  | "HYBRID"
  | string;

export type MobileModuleScreenType =
  | "module"
  | "dashboard"
  | "report_list"
  | string;

export type MobileModuleConfig = {
  key: string;
  label: string;
  enabled: boolean;
  sort_order?: number;
  icon_key?: string | null;
  /** Logical route key resolved via local module registry — never a remote component path */
  route_key: string;
  /** Section id from Desk (e.g. finance, sales_customers) */
  section?: string;
  /** Display label for section (e.g. FINANCE) — schema v2 */
  section_label?: string | null;
  subtitle?: string | null;
  /**
   * How to open this module.
   * schema v2: module | dashboard | report_list
   */
  screen_type?: MobileModuleScreenType | null;
  /** Reserved; backend may pass null in v1 */
  feature_key?: string | null;
  /** Desk Config JSON (api_method, limit, dashboard_id, …) */
  config?: Record<string, unknown> | null;
};

export type MobileDimensionConfig = {
  /** Logical key only — never custom_* physical ERPNext field names */
  key: string;
  label: string;
  data_type?: string;
  filterable: boolean;
  groupable: boolean;
  sortable?: boolean;
};

export type MobileWidgetConfig = {
  key: string;
  label: string;
  /** Normalized widget type: KPI | BAR | PIE | LIST | … */
  type: string;
  /** Desk size: sm shares a row; md/lg full width */
  size?: "sm" | "md" | "lg" | string | null;
  metric_key?: string;
  dimension_key?: string;
  secondary_dimension_key?: string;
  sort_order?: number;
  config?: Record<string, unknown>;
};

/** Pre-built layout row from `dashboards[].widget_rows`. */
export type MobileWidgetRow =
  | { type: "section"; title: string }
  | {
      type: "row";
      columns?: number;
      widgets: MobileWidgetConfig[];
    }
  | { type: "widget"; widget: MobileWidgetConfig };

/** One Access Profile dashboard board (optional `widget_rows` layout). */
export type MobileDashboardBoard = {
  key?: string | null;
  title?: string | null;
  widgets: MobileWidgetConfig[];
  widget_rows?: MobileWidgetRow[] | null;
};

function isGrossProfitWidget(key: string, label: string): boolean {
  return (
    /^gp_|gross_profit/i.test(key) || /gross\s*profit|\bgp\b/i.test(label)
  );
}

function isSmWidget(w: MobileWidgetConfig): boolean {
  const size = String(w.size || w.config?.size || "").toLowerCase();
  const layout = String(
    w.config?.layout || w.config?.layout_mode || ""
  ).toLowerCase();
  const columns = Number(w.config?.columns || w.config?.col || 0);
  // Desk: Side by Side Row / size=sm / columns:2 → pair in one horizontal row
  // (Layout Mode "header" is chrome only — still allowed to sit in a side-by-side row)
  return (
    size === "sm" ||
    columns === 2 ||
    layout === "row" ||
    layout === "side_by_side" ||
    layout === "side-by-side" ||
    layout === "side by side row" ||
    layout === "side_by_side_row"
  );
}

/** MTD + YTD KPI pair (same prefix) → left | right columns in one row */
function isMtdYtdPair(
  a: MobileWidgetConfig,
  b: MobileWidgetConfig
): boolean {
  if (normalizeWidgetType(a.type) !== "KPI") return false;
  if (normalizeWidgetType(b.type) !== "KPI") return false;
  const ka = String(a.key || "")
    .replace(/__\d+$/i, "")
    .toLowerCase();
  const kb = String(b.key || "")
    .replace(/__\d+$/i, "")
    .toLowerCase();
  const aMtd = /_mtd(_|$)/i.test(ka) || /\bmtd\b/i.test(a.label || "");
  const aYtd = /_ytd(_|$)/i.test(ka) || /\bytd\b/i.test(a.label || "");
  const bMtd = /_mtd(_|$)/i.test(kb) || /\bmtd\b/i.test(b.label || "");
  const bYtd = /_ytd(_|$)/i.test(kb) || /\bytd\b/i.test(b.label || "");
  if (!(aMtd && bYtd) && !(aYtd && bMtd)) return false;
  const strip = (k: string) =>
    k.replace(/_?(mtd|ytd)_?/gi, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
  return strip(ka) === strip(kb) || strip(ka).length === 0 || strip(kb).length === 0;
}

/** Desk Layout Mode + Header Align / Compact for KPI chrome */
export function resolveKpiChrome(config?: Record<string, unknown> | null): {
  layoutMode: string;
  headerAlign: "left" | "right" | "center";
  headerCompact: boolean;
  /** Title | values on one line (Layout Mode = header / screen header) */
  inlineHeader: boolean;
} {
  const layoutMode = String(
    config?.layout_mode || config?.layout || ""
  )
    .trim()
    .toLowerCase();
  const alignRaw = String(
    config?.header_align || config?.align || "left"
  )
    .trim()
    .toLowerCase();
  const headerAlign =
    alignRaw === "right" || alignRaw === "center" ? alignRaw : "left";
  const headerCompact =
    config?.header_compact === true ||
    config?.header_compact === 1 ||
    config?.header_compact === "1" ||
    config?.header_compact === "true" ||
    layoutMode === "header" ||
    layoutMode === "screen_header" ||
    layoutMode === "screen-header";
  // Desk "header" / Header Compact / unset → title | values on one line.
  // Only "standard" / "card" keep the stacked title-above-value look.
  const stacked =
    layoutMode === "standard" ||
    layoutMode === "card" ||
    layoutMode === "full" ||
    layoutMode === "stack";
  const inlineHeader =
    !stacked &&
    (layoutMode === "header" ||
      layoutMode === "screen_header" ||
      layoutMode === "screen-header" ||
      layoutMode === "inline" ||
      headerCompact ||
      !layoutMode);
  return { layoutMode, headerAlign, headerCompact, inlineHeader };
}

/** Desk / BA may send widget_type, title, metric_key aliases — normalize here */
export function normalizeDashboardWidgets(
  raw: unknown
): MobileWidgetConfig[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Map<string, number>();
  return raw
    .map((w: any, i: number) => {
      if (!w || typeof w !== "object") return null;
      let key = String(
        w.key || w.id || w.widget_key || w.name || `widget_${i}`
      );
      // Desk often repeats keys (e.g. header rows all as widget_0)
      const n = seen.get(key) || 0;
      seen.set(key, n + 1);
      if (n > 0) key = `${key}__${n}`;

      const type = normalizeWidgetType(
        // Prefer widget_type (BA contract) over legacy type
        w.widget_type || w.widgetType || w.type || "LIST"
      );
      const rawLabel = String(
        w.label || w.title || w.widget_label || ""
      ).trim();
      // Don't use placeholder keys (widget_0) as visible titles
      const label =
        rawLabel ||
        (type === "HEADER" || /^widget_\d+/i.test(key) ? "" : key);
      let dimension_key =
        w.dimension_key ||
        w.dimensionKey ||
        w.dimension ||
        undefined;
      let metric_key =
        w.metric_key || w.metricKey || w.metric || undefined;

      let config: Record<string, unknown> | undefined;
      if (Array.isArray(w.config)) {
        // Desk pasted bare columns array as config
        config = { columns: w.config };
      } else if (w.config && typeof w.config === "object") {
        config = { ...w.config };
      } else if (w.props && typeof w.props === "object") {
        config = Array.isArray(w.props)
          ? { columns: w.props }
          : { ...w.props };
      }
      if (typeof w.config_json === "string" && w.config_json.trim()) {
        try {
          const parsed = JSON.parse(w.config_json);
          if (Array.isArray(parsed)) {
            // Bare array → treat as columns (common Desk mistake)
            config = { ...(config || {}), columns: parsed };
          } else if (parsed && typeof parsed === "object") {
            config = { ...(config || {}), ...parsed };
          }
        } catch {
          /* ignore bad config_json */
        }
      }
      // Recover `{0: col, 1: col}` from spreading a columns array into an object
      if (config && !Array.isArray(config.columns)) {
        const keys = Object.keys(config);
        if (
          keys.length &&
          keys.every((k) => /^\d+$/.test(k)) &&
          keys.some((k) => {
            const v = config![k];
            return v && typeof v === "object" && (v as any).key != null;
          })
        ) {
          config = {
            ...config,
            columns: keys
              .sort((a, b) => Number(a) - Number(b))
              .map((k) => config![k]),
          };
        }
      }

      // Dimension from Desk config / drill_path when top-level omitted
      if (!dimension_key && config) {
        const fromCfg = config.dimension_key ?? config.dimension;
        if (fromCfg != null && String(fromCfg).trim()) {
          dimension_key = String(fromCfg).trim();
        } else if (Array.isArray(config.drill_path) && config.drill_path[0]) {
          const keyHint = String(
            w.key || w.id || w.widget_key || ""
          ).toLowerCase();
          const path = config.drill_path.map(String);
          dimension_key =
            path.find((d) => keyHint.includes(String(d).toLowerCase())) ||
            String(path[0]);
        }
      }
      if (!dimension_key) {
        const keyHint = String(
          w.key || w.id || w.widget_key || key || ""
        ).toLowerCase();
        if (/brand/.test(keyHint)) dimension_key = "brand";
        else if (/customer/.test(keyHint)) dimension_key = "customer";
        else if (/warehouse|stock|inventory/.test(keyHint))
          dimension_key = "warehouse";
        else if (/sales/i.test(key) || isGrossProfitWidget(key, label))
          dimension_key = "territory";
        else if (/receivable|collection/i.test(key)) dimension_key = "territory";
      }
      if (!metric_key) {
        if (/inventory|stock/i.test(key)) metric_key = "stock_value";
        else if (isGrossProfitWidget(key, label)) metric_key = "gross_profit";
        else metric_key = "net_sales";
      }
      // Desk "Show LY Comparison" may be a top-level widget field
      if (
        w.show_ly != null ||
        w.show_ly_comparison != null ||
        w.compare != null
      ) {
        config = {
          ...(config || {}),
          ...(w.show_ly != null ? { show_ly: w.show_ly } : {}),
          ...(w.show_ly_comparison != null
            ? { show_ly_comparison: w.show_ly_comparison }
            : {}),
          ...(w.compare != null ? { compare: w.compare } : {}),
        };
      }
      // Desk period (MTD/YTD/…) — widget-fixed range, not home filter
      if (
        w.period != null ||
        w.period_key != null ||
        w.default_period != null ||
        w.time_period != null
      ) {
        config = {
          ...(config || {}),
          ...(w.period != null ? { period: w.period } : {}),
          ...(w.period_key != null ? { period_key: w.period_key } : {}),
          ...(w.default_period != null
            ? { default_period: w.default_period }
            : {}),
          ...(w.time_period != null ? { time_period: w.time_period } : {}),
        };
      }

      // Desk Layout Mode / Header Align / Header Compact (KPI chrome)
      if (
        w.layout != null ||
        w.layout_mode != null ||
        w.header_align != null ||
        w.header_compact != null ||
        w.align != null
      ) {
        config = {
          ...(config || {}),
          ...(w.layout != null ? { layout: w.layout } : {}),
          ...(w.layout_mode != null ? { layout_mode: w.layout_mode } : {}),
          ...(w.header_align != null ? { header_align: w.header_align } : {}),
          ...(w.header_compact != null
            ? { header_compact: w.header_compact }
            : {}),
          ...(w.align != null ? { align: w.align } : {}),
        };
      }

      // Desk Dashboard ID (home, my_reports_home, …)
      const dashboardIdRaw =
        w.dashboard_id ??
        w.dashboard ??
        w.dashboard_key ??
        config?.dashboard_id ??
        config?.dashboard;
      if (dashboardIdRaw != null && String(dashboardIdRaw).trim()) {
        config = {
          ...(config || {}),
          dashboard_id: String(dashboardIdRaw).trim(),
        };
      }

      const sizeRaw = w.size ?? config?.size;
      const size =
        sizeRaw != null && String(sizeRaw).trim()
          ? String(sizeRaw).trim().toLowerCase()
          : null;

      return {
        key,
        label,
        type,
        size,
        metric_key: metric_key ? String(metric_key) : undefined,
        dimension_key: dimension_key ? String(dimension_key) : undefined,
        secondary_dimension_key:
          w.secondary_dimension_key ||
          w.secondaryDimensionKey ||
          undefined,
        sort_order:
          typeof w.sort_order === "number"
            ? w.sort_order
            : typeof w.idx === "number"
              ? w.idx
              : (i + 1) * 10,
        config,
      } as MobileWidgetConfig;
    })
    .filter((w): w is MobileWidgetConfig => w != null);
}

/** Ensure widget keys are unique across a full layout (Desk may repeat widget_0). */
function uniquifyKeysInRows(rows: MobileWidgetRow[]): MobileWidgetRow[] {
  const seen = new Map<string, number>();
  const nextKey = (key: string) => {
    const n = seen.get(key) || 0;
    seen.set(key, n + 1);
    return n === 0 ? key : `${key}__${n}`;
  };
  return rows.map((row) => {
    if (row.type === "row") {
      return {
        ...row,
        widgets: row.widgets.map((w) => ({
          ...w,
          key: nextKey(w.key || "widget"),
        })),
      };
    }
    if (row.type === "widget") {
      return {
        ...row,
        widget: {
          ...row.widget,
          key: nextKey(row.widget.key || "widget"),
        },
      };
    }
    return row;
  });
}

/** Normalize bootstrap `widget_rows` (section / row / widget). */
export function normalizeWidgetRows(raw: unknown): MobileWidgetRow[] {
  if (!Array.isArray(raw)) return [];
  const rows: MobileWidgetRow[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const type = String((item as any).type || "").toLowerCase();
    if (type === "section") {
      const title = String(
        (item as any).title || (item as any).label || ""
      ).trim();
      if (title) rows.push({ type: "section", title });
      continue;
    }
    if (type === "row") {
      const widgets = normalizeDashboardWidgets((item as any).widgets || []);
      if (widgets.length) {
        rows.push({
          type: "row",
          columns:
            Number((item as any).columns) > 0
              ? Number((item as any).columns)
              : widgets.length,
          widgets,
        });
      }
      continue;
    }
    if (type === "widget") {
      const nested = (item as any).widget ?? item;
      const widgets = normalizeDashboardWidgets([nested]);
      if (widgets[0]) rows.push({ type: "widget", widget: widgets[0] });
      continue;
    }
    // Bare widget object without type
    const widgets = normalizeDashboardWidgets([item]);
    if (widgets[0]) rows.push({ type: "widget", widget: widgets[0] });
  }
  return uniquifyKeysInRows(rows);
}

/**
 * When `widget_rows` is missing, group consecutive `sm` / layout:row widgets
 * (same section_title / row_group) into horizontal rows.
 * Also pairs consecutive MTD+YTD KPIs into left | right columns.
 */
export function synthesizeWidgetRows(
  widgets: MobileWidgetConfig[]
): MobileWidgetRow[] {
  const sorted = [...widgets].sort(
    (a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999)
  );
  const rows: MobileWidgetRow[] = [];
  let i = 0;
  while (i < sorted.length) {
    const w = sorted[i];
    const section = w.config?.section_title;
    if (
      typeof section === "string" &&
      section.trim() &&
      (i === 0 ||
        sorted[i - 1]?.config?.section_title !== section)
    ) {
      rows.push({ type: "section", title: section.trim() });
    }

    // Left | right columns: MTD + YTD KPI pair from Desk
    if (i + 1 < sorted.length && isMtdYtdPair(w, sorted[i + 1])) {
      const left = w;
      const right = sorted[i + 1];
      // Prefer MTD on left, YTD on right
      const leftIsYtd =
        /_ytd(_|$)/i.test(String(left.key)) ||
        /\bytd\b/i.test(left.label || "");
      const pair = leftIsYtd ? [right, left] : [left, right];
      rows.push({
        type: "row",
        columns: 2,
        widgets: pair,
      });
      i += 2;
      continue;
    }

    if (isSmWidget(w)) {
      const group =
        w.config?.row_group ?? w.config?.section_title ?? null;
      const batch: MobileWidgetConfig[] = [];
      while (i < sorted.length && isSmWidget(sorted[i])) {
        const cur = sorted[i];
        const curGroup =
          cur.config?.row_group ?? cur.config?.section_title ?? null;
        if (group != null && curGroup != null && curGroup !== group) break;
        if (group == null && curGroup != null && batch.length) break;
        batch.push(cur);
        i += 1;
        // Always pair into 2-up rows so mobile grids stay even (2×2, not 1×4)
        if (batch.length >= 2) break;
      }
      rows.push({
        type: "row",
        columns: batch.length,
        widgets: batch,
      });
      continue;
    }

    rows.push({ type: "widget", widget: w });
    i += 1;
  }
  return rows;
}

export function normalizeDashboardBoards(
  raw: unknown
): MobileDashboardBoard[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((b: any, i: number) => {
      if (!b || typeof b !== "object") return null;
      const widget_rows = normalizeWidgetRows(b.widget_rows);
      let widgets = normalizeDashboardWidgets(
        b.widgets || b.dashboard || []
      );
      if (!widgets.length && widget_rows.length) {
        widgets = flattenWidgetsFromRows(widget_rows);
      }
      return {
        key: String(b.key || b.name || b.id || `board_${i}`),
        title:
          b.title != null || b.label != null
            ? String(b.title || b.label)
            : null,
        widgets,
        widget_rows: widget_rows.length ? widget_rows : null,
      } as MobileDashboardBoard;
    })
    .filter((b): b is MobileDashboardBoard => b != null);
}

/** Prefer API `widget_rows`; otherwise synthesize from flat widgets.
 * If rows omit widgets that exist on the board, rebuild from the full list
 * (Desk sometimes ships a stale/partial widget_rows).
 */
export function resolveBoardWidgetRows(
  board: MobileDashboardBoard
): MobileWidgetRow[] {
  const flat = board.widgets || [];
  if (board.widget_rows?.length) {
    const inRows = new Set(
      flattenWidgetsFromRows(board.widget_rows).map((w) =>
        String(w.key || "")
          .replace(/__\d+$/i, "")
          .toLowerCase()
      )
    );
    const missing = flat.some(
      (w) =>
        !inRows.has(
          String(w.key || "")
            .replace(/__\d+$/i, "")
            .toLowerCase()
        )
    );
    if (!missing) return board.widget_rows;
  }
  return synthesizeWidgetRows(flat);
}

/** Collect every widget that belongs to a Dashboard ID (Desk column). */
export function widgetsForDashboardId(
  boards: MobileDashboardBoard[],
  flat: MobileWidgetConfig[] | undefined,
  boardKey: string
): MobileWidgetConfig[] {
  const id = boardKey.trim().toLowerCase();
  if (!id) return [];

  const baseKey = (key: string) =>
    String(key || "")
      .replace(/__\d+$/i, "")
      .toLowerCase();

  const dashboardOf = (w: MobileWidgetConfig) =>
    String(w.config?.dashboard_id || w.config?.dashboard || "")
      .trim()
      .toLowerCase();

  const byKey = new Map<string, MobileWidgetConfig>();

  const matched = boards.find(
    (b) => String(b.key || "").toLowerCase() === id
  );
  for (const w of matched?.widgets || []) {
    byKey.set(baseKey(w.key), w);
  }

  const pool = [
    ...boards.flatMap((b) => b.widgets || []),
    ...(Array.isArray(flat) ? flat : []),
  ];
  for (const w of pool) {
    const did = dashboardOf(w);
    if (did === id || (!did && matched && byKey.has(baseKey(w.key)))) {
      const k = baseKey(w.key);
      if (!byKey.has(k)) byKey.set(k, w);
    }
  }

  // Flat `dashboard[]` is often the full Desk table — pull any rows tagged
  // for this board (or untagged when resolving the home board).
  for (const w of Array.isArray(flat) ? flat : []) {
    const did = dashboardOf(w);
    const k = baseKey(w.key);
    if (byKey.has(k)) continue;
    if (did === id || (!did && (id === "home" || id === "primary"))) {
      byKey.set(k, w);
    }
  }

  // Also pull widgets that live only on the matched board's rows
  if (matched?.widget_rows?.length) {
    for (const w of flattenWidgetsFromRows(matched.widget_rows)) {
      const k = baseKey(w.key);
      if (!byKey.has(k)) byKey.set(k, w);
    }
  }

  return [...byKey.values()].sort(
    (a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999)
  );
}

/** Collect widgets referenced by layout rows (skips section titles). */
export function flattenWidgetsFromRows(
  rows: MobileWidgetRow[]
): MobileWidgetConfig[] {
  const out: MobileWidgetConfig[] = [];
  for (const row of rows) {
    if (row.type === "row") out.push(...row.widgets);
    else if (row.type === "widget") out.push(row.widget);
  }
  return out;
}

export type MobileBootstrap = {
  schema_version: number;
  api_version?: string;
  user?: {
    email?: string;
    full_name?: string;
  };
  context: {
    company?: string;
    profile?: string;
    business_type: BusinessType;
    /** Preferred home board key when present */
    default_dashboard?: string | null;
  };
  branding?: {
    app_title?: string;
    app_subtitle?: string;
    logo_url?: string;
  };
  modules: MobileModuleConfig[];
  dimensions: MobileDimensionConfig[];
  /** Flat widgets for the primary board (legacy / convenience). */
  dashboard?: MobileWidgetConfig[];
  /**
   * Full dashboard boards from bootstrap. Prefer rendering
   * `dashboards[].widget_rows` over looping `dashboard` one-by-one.
   */
  dashboards?: MobileDashboardBoard[];
  /**
   * Optional layout / feature hints from BA.
   * e.g. meta.dashboard_layout.show_widgets_title === false
   */
  meta?: {
    dashboard_layout?: {
      show_widgets_title?: boolean;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  } | null;
  /** Optional AO / capability hints — Access Profile remains authoritative for can_view */
  permissions?: Record<string, unknown>;
  capabilities?: Record<string, boolean>;
  /**
   * Optional legacy-shaped module flags (from get_mobile_config fallback).
   * Prefer `modules[]` when present.
   */
  module_flags?: Record<string, boolean>;
  /** Optional per-method switches (legacy get_mobile_config.apis) */
  apis?: Record<string, boolean>;
  /** Provenance for debugging */
  source?: "bootstrap" | "mobile_config" | "defaults";
};

/** Option A — Desk-driven modules (schema v2 / capability / report_list payload). */
/** Server rebuild of tabSalesDashBoard (erp_analysis.api.refresh_sales_dashboard*). */
export function canRefreshSalesDashboard(
  bootstrap: MobileBootstrap | null | undefined
): boolean {
  return bootstrap?.capabilities?.can_refresh_sales_dashboard === true;
}

export function supportsDynamicModules(
  bootstrap: MobileBootstrap | null | undefined
): boolean {
  if (!bootstrap) return false;
  if (Number(bootstrap.schema_version) >= 2) return true;
  if (bootstrap.capabilities?.dynamic_modules === true) return true;
  // Heuristic: Option A payload even if schema_version lagged
  return (bootstrap.modules || []).some((m) => {
    const st = String(m.screen_type || "")
      .trim()
      .toLowerCase();
    if (st === "report_list" || st === "dashboard") return true;
    const fk = String(m.feature_key || "")
      .trim()
      .toLowerCase();
    if (fk.startsWith("board_tabs:") || fk.startsWith("board_tabs=")) return true;
    // Desk custom boards often keep screen_type=module (e.g. sales_dashboard_test)
    return /dashboard/.test(String(m.key || m.route_key || "").toLowerCase());
  });
}
