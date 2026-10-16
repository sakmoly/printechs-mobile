/**
 * Host for bootstrap dashboard widgets.
 * Prefers dashboards[].widget_rows (section / row / widget); falls back to
 * synthesizing rows from size=sm + section_title when rows are absent.
 *
 * Data: one get_dashboard_board_data batch per board; drill uses
 * get_dashboard_widget_data.
 */

import React, { useMemo, useImperativeHandle } from "react";
import { View, Text, StyleSheet } from "react-native";
import { router } from "expo-router";
import { useBootstrapStore } from "../store/bootstrap";
import { WidgetRenderer } from "./WidgetRenderer";
import { useWidgetDrill } from "./useWidgetDrill";
import type {
  MobileDashboardBoard,
  MobileWidgetConfig,
  MobileWidgetRow,
} from "../types/bootstrap";
import {
  resolveBoardWidgetRows,
  widgetsForDashboardId,
} from "../types/bootstrap";
import { Fonts, Type } from "../theme/typography";
import {
  resolveWidgetDateRange,
} from "../utils/period";
import { normalizeWidgetType } from "./types";
import { useDashboardBoardData } from "../hooks/useDashboardBoardData";
import {
  lookupBoardWidget,
  type DashboardBoardDataResponse,
} from "../api/dashboardBoardData";
import type { DashboardWidgetDataResponse } from "../api/dashboardWidgetData";

function isPlaceholderWidgetKey(key: string): boolean {
  return /^widget_\d+(__\d+)?$/i.test(String(key || "").trim());
}

function isLayoutOnlyWidget(w: MobileWidgetConfig): boolean {
  const t = normalizeWidgetType(w.type);
  return t === "HEADER" || t === "LINK";
}

type Props = {
  company?: string;
  from_date?: string;
  to_date?: string;
  period?: string;
  /** Cap how many bootstrap widgets to show on Home */
  limit?: number;
  title?: string;
  /**
   * When set, only render this board (Option A screen_type: dashboard).
   * Matches dashboards[].key or config.dashboard_id.
   */
  boardKey?: string;
  /** Hide the outer "Configured widgets" style title */
  hideTitle?: boolean;
  /** Hide per-board title (screen header already shows the name). */
  hideBoardTitle?: boolean;
  /** Hide LINK tiles (e.g. Salespersons / Products — shown as header chips instead). */
  hideLinkWidgets?: boolean;
  /** Optional ref for pull-to-refresh — batch API with refresh=1 */
  boardRef?: React.Ref<DashboardWidgetsHandle | null>;
};

export type DashboardWidgetsHandle = {
  refreshBoard: () => Promise<DashboardBoardDataResponse | null | undefined>;
};

function SingleWidgetHost({
  widget,
  company,
  from_date,
  to_date,
  period,
  compact,
  batchPayload,
  boardLoading,
  boardSettled,
  usePerWidgetFallback,
  hideTitle,
  fillRowCell,
}: {
  widget: MobileWidgetConfig;
  company?: string;
  from_date?: string;
  to_date?: string;
  period?: string;
  /** Side-by-side row cell — hide outer shell title (section already shown). */
  compact?: boolean;
  batchPayload?: DashboardWidgetDataResponse | null;
  boardLoading?: boolean;
  /** Board batch finished (even if widgets map is empty / missing this key). */
  boardSettled?: boolean;
  usePerWidgetFallback?: boolean;
  /** Hide widget title when it duplicates the section above */
  hideTitle?: boolean;
  /** Own the flex cell so empty widgets don't leave a blank column */
  fillRowCell?: boolean;
}) {
  const normalizedType = normalizeWidgetType(widget.type);
  const isHeader = normalizedType === "HEADER";
  const isLink = normalizedType === "LINK";
  const skipData = isHeader || isLink;
  // Desk often sends empty/placeholder header rows (key widget_0, no title)
  if (isHeader) {
    const title = String(widget.label || "").trim();
    if (!title || isPlaceholderWidgetKey(title)) {
      return null;
    }
  }
  const range = useMemo(
    () =>
      resolveWidgetDateRange(widget, {
        from_date,
        to_date,
        period,
      }),
    [widget, from_date, to_date, period]
  );

  const mergedConfig = useMemo(() => {
    const base = { ...(widget.config || {}) };
    const fromBatch = batchPayload?.config;
    if (fromBatch && typeof fromBatch === "object") {
      return { ...base, ...fromBatch };
    }
    return base;
  }, [widget.config, batchPayload?.config]);

  // Per-widget when batch is missing, denied, or returned no payload for this key.
  const perWidget =
    !skipData &&
    !batchPayload &&
    !boardLoading &&
    Boolean(usePerWidgetFallback);

  const {
    data,
    isLoading,
    isFetching,
    error,
    stack,
    drillable,
    onSliceTap,
    goBack,
    metric,
    activeDimension,
  } = useWidgetDrill(
    { ...widget, config: mergedConfig },
    {
      company,
      from_date: range.from_date,
      to_date: range.to_date,
      period: range.preset,
      enabled: !skipData,
      batchPayload: skipData ? null : batchPayload,
      boardLoading: skipData ? false : boardLoading,
      usePerWidgetFallback: skipData ? false : perWidget,
    }
  );

  if (skipData) {
    return (
      <WidgetRenderer
        widget={{ ...widget, config: mergedConfig }}
        data={{ loading: false, config: mergedConfig }}
        compact={compact}
      />
    );
  }

  const openAnalysis = (dim: string, met?: string) => {
    router.push({
      pathname: "/generic-analysis",
      params: {
        dimension: dim || activeDimension,
        metric: met || metric,
        title: widget.label || dim,
      },
    });
  };

  const errMsg = error
    ? (error as Error).message || "Failed to load widget"
    : null;

  const cfgShowLy =
    mergedConfig?.show_ly === true ||
    mergedConfig?.show_ly === 1 ||
    mergedConfig?.show_ly === "1" ||
    mergedConfig?.show_ly_comparison === true ||
    mergedConfig?.show_ly_comparison === 1 ||
    mergedConfig?.compare === "ly";
  const cfgHideLy =
    mergedConfig?.show_ly === false ||
    mergedConfig?.show_ly === 0 ||
    mergedConfig?.show_ly === "0" ||
    mergedConfig?.show_ly_comparison === false ||
    mergedConfig?.show_ly_comparison === 0;

  // Prefer Desk flag; if bootstrap omitted it, trust API LY payload
  const apiHasLy = Boolean(
    data?.show_ly ||
      data?.chart?.summary?.value_ly != null ||
      data?.rows?.some((r) => r.previous != null) ||
      data?.kpis?.some((k) => k.previous != null)
  );
  const showLyUi = cfgHideLy ? false : Boolean(cfgShowLy || apiHasLy);

  // Avoid wrapping a null KPI in a flex cell (blank column pushes siblings right)
  const kpiHasContent =
    Boolean(data?.kpis?.length) ||
    Boolean(data?.rows?.length) ||
    (data?.chart?.summary?.value != null &&
      Number.isFinite(Number(data.chart.summary.value))) ||
    Boolean(showLyUi && data?.chart?.summary?.value_ly != null);
  if (
    fillRowCell &&
    isKpiType(widget.type) &&
    !boardLoading &&
    !isLoading &&
    !errMsg &&
    !kpiHasContent
  ) {
    return null;
  }

  const body = (
    <WidgetRenderer
      widget={{
        ...widget,
        config: {
          ...mergedConfig,
          ...(data?.config || {}),
          ...(cfgHideLy
            ? { show_ly: false }
            : showLyUi
              ? { show_ly: true }
              : {}),
          ...(compact ? { _compact: true } : {}),
        },
      }}
      data={{
        currency: data?.currency || data?.meta.currency,
        kpis: data?.kpis,
        rows: data?.rows,
        loading: isLoading,
        fetching: isFetching,
        error: errMsg,
        preferred_label: widget.label,
        widget_type: data?.widget_type || widget.type,
        render_hint:
          (data?.meta as { render_hint?: string } | undefined)?.render_hint ??
          null,
        drill_depth: stack.length,
        chart: data?.chart
          ? {
              series: (data.chart.series || []).map((p) => ({
                label: p.label,
                value: p.value,
                id: p.dimension_value || p.label,
                previous: p.value_ly,
              })),
              metric: data.chart.metric,
              summary: data.chart.summary ?? null,
            }
          : null,
        table: data?.table ?? null,
        action: data?.action ?? (mergedConfig?.action as any) ?? null,
        config: {
          ...mergedConfig,
          ...(data?.config || {}),
          ...(cfgHideLy
            ? { show_ly: false }
            : showLyUi
              ? { show_ly: true }
              : {}),
        },
        show_ly: showLyUi,
        chart_summary: showLyUi ? data?.chart?.summary ?? null : null,
        chart_metric: data?.chart?.metric || widget.metric_key,
        ly_display: data?.meta.ly_display ?? null,
      }}
      onOpenAnalysis={openAnalysis}
      onSliceTap={drillable ? onSliceTap : undefined}
      drillable={drillable}
      drillStack={stack}
      onDrillBack={stack.length > 0 ? goBack : undefined}
      compact={compact}
      hideTitle={hideTitle}
    />
  );

  if (fillRowCell) {
    return <View style={styles.rowCell}>{body}</View>;
  }
  return body;
}

function applyWidgetLimit(
  rows: MobileWidgetRow[],
  limit: number
): MobileWidgetRow[] {
  if (limit <= 0) return rows;
  const out: MobileWidgetRow[] = [];
  let used = 0;
  for (const row of rows) {
    if (row.type === "section") {
      out.push(row);
      continue;
    }
    if (row.type === "widget") {
      const layoutOnly = isLayoutOnlyWidget(row.widget);
      if (!layoutOnly && used >= limit) break;
      out.push(row);
      if (!layoutOnly) used += 1;
      continue;
    }
    if (used >= limit) break;
    const kept: MobileWidgetConfig[] = [];
    for (const w of row.widgets) {
      const layoutOnly = isLayoutOnlyWidget(w);
      if (!layoutOnly && used >= limit) break;
      kept.push(w);
      if (!layoutOnly) used += 1;
    }
    if (!kept.length) break;
    out.push({ ...row, widgets: kept, columns: kept.length });
  }
  // Drop trailing section with no widgets after it
  while (out.length && out[out.length - 1].type === "section") {
    out.pop();
  }
  return out;
}

/** Drop LINK widgets (header chips replace them on board-tabs screens). */
function stripLinkWidgets(rows: MobileWidgetRow[]): MobileWidgetRow[] {
  const out: MobileWidgetRow[] = [];
  for (const row of rows) {
    if (row.type === "section") {
      out.push(row);
      continue;
    }
    if (row.type === "widget") {
      if (normalizeWidgetType(row.widget.type) === "LINK") continue;
      out.push(row);
      continue;
    }
    const kept = row.widgets.filter(
      (w) => normalizeWidgetType(w.type) !== "LINK"
    );
    if (!kept.length) continue;
    out.push({ ...row, widgets: kept, columns: kept.length });
  }
  while (out.length && out[out.length - 1].type === "section") {
    out.pop();
  }
  return out;
}

function isKpiType(type?: string | null): boolean {
  return /^kpi$/i.test(String(type || "").trim());
}

function normalizeSectionTitle(s: string): string {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function titlesMatch(a?: string | null, b?: string | null): boolean {
  const aa = normalizeSectionTitle(a || "");
  const bb = normalizeSectionTitle(b || "");
  return Boolean(aa && bb && aa === bb);
}

/** Split wide Desk rows into pairs so KPI cards stay a clean 2-column grid. */
function chunkWidgets<T>(items: T[], size = 2): T[][] {
  if (items.length <= size) return [items];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

/** True when batch payload can paint a KPI card (incl. chart.summary-only). */
function kpiPayloadIsVisible(
  payload: DashboardWidgetDataResponse | null | undefined
): boolean {
  if (!payload) return false;
  if (payload.kpis?.length) return true;
  if (payload.rows?.length) return true;
  if (
    payload.chart?.summary?.value != null &&
    Number.isFinite(Number(payload.chart.summary.value))
  ) {
    return true;
  }
  if (payload.chart?.summary?.value_ly != null) return true;
  return false;
}

/**
 * Drop blank KPI / header slots before laying out a row.
 * Prevents empty flex cells from shoving real cards to the right.
 * Only removes widgets whose batch payload is present and empty — never
 * drops a KPI just because the key is missing from the map.
 */
function widgetsForRowLayout(
  widgets: MobileWidgetConfig[],
  widgetMap: Record<string, DashboardWidgetDataResponse> | null | undefined,
  boardLoading?: boolean
): MobileWidgetConfig[] {
  return widgets.filter((w) => {
    const t = normalizeWidgetType(w.type);
    if (t === "HEADER" || t === "LINK") {
      const title = String(w.label || "").trim();
      return Boolean(title) && !isPlaceholderWidgetKey(title);
    }
    if (!isKpiType(w.type)) return true;
    if (boardLoading || !widgetMap) return true;
    const payload = lookupBoardWidget(widgetMap, w.key);
    // Missing key → keep (fallback / alias may still paint the card)
    if (!payload) return true;
    return kpiPayloadIsVisible(payload);
  });
}

function WidgetRows({
  rows,
  company,
  from_date,
  to_date,
  period,
  hideKpiShellTitle,
  widgetMap,
  boardLoading,
  boardSettled,
  usePerWidgetFallback,
}: {
  rows: MobileWidgetRow[];
  company?: string;
  from_date?: string;
  to_date?: string;
  period?: string;
  /** Dedicated board screens: KPI card already shows its own title */
  hideKpiShellTitle?: boolean;
  widgetMap?: Record<string, DashboardWidgetDataResponse> | null;
  boardLoading?: boolean;
  boardSettled?: boolean;
  usePerWidgetFallback?: boolean;
}) {
  let lastSectionTitle = "";
  return (
    <>
      {rows.map((row, idx) => {
        if (row.type === "section") {
          lastSectionTitle = row.title || "";
          return (
            <Text
              key={`section-${idx}-${row.title}`}
              style={styles.sectionTitle}
            >
              {row.title}
            </Text>
          );
        }
        if (row.type === "row") {
          const layoutWidgets = widgetsForRowLayout(
            row.widgets,
            widgetMap,
            boardLoading
          );
          if (!layoutWidgets.length) return null;
          const chunks = chunkWidgets(layoutWidgets, 2);
          return (
            <React.Fragment key={`row-${idx}-${row.widgets.map((w) => w.key).join("-")}`}>
              {chunks.map((chunk, ci) => (
                <View
                  key={`row-${idx}-${ci}-${chunk.map((w) => w.key).join("-")}`}
                  style={styles.row}
                >
                  {chunk.map((w, wi) => (
                    <SingleWidgetHost
                      key={`${w.key}-${idx}-${ci}-${wi}`}
                      widget={w}
                      company={company}
                      from_date={from_date}
                      to_date={to_date}
                      period={period}
                      compact
                      fillRowCell
                      hideTitle={titlesMatch(
                        w.label,
                        lastSectionTitle ||
                          String(w.config?.section_title || "")
                      )}
                      batchPayload={lookupBoardWidget(widgetMap, w.key) ?? null}
                      boardLoading={boardLoading}
                      boardSettled={boardSettled}
                      usePerWidgetFallback={usePerWidgetFallback}
                    />
                  ))}
                  {/* Keep 2-column alignment when a row has a single card */}
                  {chunk.length === 1 ? (
                    <View style={styles.rowCellSpacer} />
                  ) : null}
                </View>
              ))}
            </React.Fragment>
          );
        }
        const w = row.widget;
        const sectionDup = titlesMatch(
          w.label,
          lastSectionTitle || String(w.config?.section_title || "")
        );
        return (
          <SingleWidgetHost
            key={`${w.key}-${idx}`}
            widget={w}
            company={company}
            from_date={from_date}
            to_date={to_date}
            period={period}
            compact={hideKpiShellTitle && isKpiType(w.type)}
            hideTitle={sectionDup}
            batchPayload={lookupBoardWidget(widgetMap, w.key) ?? null}
            boardLoading={boardLoading}
            boardSettled={boardSettled}
            usePerWidgetFallback={usePerWidgetFallback}
          />
        );
      })}
    </>
  );
}

export function DashboardWidgets({
  company,
  from_date,
  to_date,
  period,
  limit = 12,
  title = "Configured widgets",
  boardKey,
  hideTitle,
  hideBoardTitle,
  hideLinkWidgets,
  boardRef,
}: Props) {
  const bootstrap = useBootstrapStore((s) => s.bootstrap);

  const resolvedBoardKey = useMemo(() => {
    if (boardKey && String(boardKey).trim()) return String(boardKey).trim();
    const fromCtx = bootstrap?.context?.default_dashboard;
    if (fromCtx != null && String(fromCtx).trim()) {
      return String(fromCtx).trim();
    }
    return "home";
  }, [boardKey, bootstrap?.context?.default_dashboard]);

  const boardQuery = useDashboardBoardData(
    {
      dashboard_id: resolvedBoardKey,
      company,
      from_date,
      to_date,
      period,
    },
    { enabled: Boolean(bootstrap) }
  );

  useImperativeHandle(
    boardRef,
    () => ({
      refreshBoard: boardQuery.refreshBoard,
    }),
    [boardQuery.refreshBoard]
  );

  const boards: MobileDashboardBoard[] = useMemo(() => {
    const all: MobileDashboardBoard[] = bootstrap?.dashboards?.length
      ? bootstrap.dashboards
      : Array.isArray(bootstrap?.dashboard) && bootstrap!.dashboard!.length
        ? [
            {
              key: "home",
              title: null,
              widgets: bootstrap!.dashboard!,
              widget_rows: null,
            },
          ]
        : [];

    if (!resolvedBoardKey) {
      return all;
    }

    const id = resolvedBoardKey.trim().toLowerCase();
    const matched = all.find(
      (b) => String(b.key || "").toLowerCase() === id
    );

    // Merge board widgets + any Desk rows tagged with this Dashboard ID
    // (fixes missing sales_mtd_kpi / gp_* when widget_rows is partial)
    const widgets = widgetsForDashboardId(
      all,
      bootstrap?.dashboard,
      resolvedBoardKey
    );

    if (widgets.length) {
      const rowsIncomplete = Boolean(
        matched?.widget_rows?.length &&
          widgets.some((w) => {
            const keys = new Set(
              (matched.widgets || []).map((x) =>
                String(x.key)
                  .replace(/__\d+$/i, "")
                  .toLowerCase()
              )
            );
            // Prefer API widget_rows when it already lists every merged widget
            const rowKeys = new Set(
              (matched.widget_rows
                ? matched.widget_rows.flatMap((r) =>
                    r.type === "row"
                      ? r.widgets
                      : r.type === "widget"
                        ? [r.widget]
                        : []
                  )
                : []
              ).map((x) =>
                String(x.key)
                  .replace(/__\d+$/i, "")
                  .toLowerCase()
              )
            );
            const k = String(w.key)
              .replace(/__\d+$/i, "")
              .toLowerCase();
            return rowKeys.size > 0 ? !rowKeys.has(k) : !keys.has(k);
          })
      );
      return [
        {
          key: matched?.key || resolvedBoardKey,
          title: matched?.title ?? null,
          widgets,
          // Keep Desk widget_rows (side-by-side) when complete; else synthesize
          widget_rows:
            matched?.widget_rows?.length && !rowsIncomplete
              ? matched.widget_rows
              : null,
        },
      ];
    }

    // Fallback: widgets whose key is prefixed with the board id (Desk naming)
    const prefixed = all
      .flatMap((b) => b.widgets || [])
      .filter((w) => {
        const k = String(w.key || "").toLowerCase();
        return k === id || k.startsWith(`${id}_`);
      });
    if (!prefixed.length) return [];
    return [
      {
        key: resolvedBoardKey,
        title: null,
        widgets: prefixed,
        widget_rows: null,
      },
    ];
  }, [bootstrap, resolvedBoardKey, boardQuery.widgets]);

  const boardsWithRows = useMemo(() => {
    return boards
      .map((board) => {
        let rows = applyWidgetLimit(resolveBoardWidgetRows(board), limit);
        if (hideLinkWidgets) rows = stripLinkWidgets(rows);
        return { board, rows };
      })
      .filter((b) => b.rows.length > 0);
  }, [boards, limit, hideLinkWidgets]);

  // Show "Configured widgets" / "Widgets" only when BA opts in
  const showWidgetsTitle = useMemo(() => {
    if (hideTitle) return false;
    const flag = bootstrap?.meta?.dashboard_layout?.show_widgets_title;
    if (flag === false) return false;
    if (flag === true) return Boolean(title);
    // Default: never show the mobile-only "WIDGETS" chrome — section titles
    // come from bootstrap widget_rows (Sales, Receivables, …).
    return false;
  }, [hideTitle, title, bootstrap?.meta?.dashboard_layout?.show_widgets_title]);

  // Show layout shell as soon as bootstrap has rows (batch fills later)
  if (!boardsWithRows.length) return null;

  // Dedicated board screens already have a nav header — never repeat board.title
  const suppressBoardTitle = hideBoardTitle || Boolean(boardKey);
  // On More dashboard boards (not Home), KPI tiles carry their own labels
  const hideKpiShellTitle =
    Boolean(boardKey) && String(boardKey).toLowerCase() !== "home";

  const widgetCount = Object.keys(boardQuery.widgets || {}).length;
  const boardDenied = Boolean(boardQuery.data?.meta?.permission_denied);
  const boardFallback = Boolean(boardQuery.usePerWidgetFallback);
  const boardEmpty =
    !boardQuery.isLoading &&
    boardQuery.data != null &&
    widgetCount === 0 &&
    !boardFallback;
  // Per-widget fallback loads allowed widgets silently — no banner.
  const boardNotice = boardFallback
    ? null
    : boardDenied
      ? String(boardQuery.data?.meta?.error || "").trim() ||
        "This board is not enabled for your mobile profile."
      : boardEmpty
        ? "No widget data from the server for this board yet."
        : null;

  return (
    <View style={styles.wrap}>
      {showWidgetsTitle && title ? (
        <Text style={styles.title}>{title}</Text>
      ) : null}
      {boardNotice ? (
        <View style={styles.boardNotice}>
          <Text style={styles.boardNoticeTitle}>Waiting on server data</Text>
          <Text style={styles.boardNoticeBody}>{boardNotice}</Text>
        </View>
      ) : null}
      {boardsWithRows.map(({ board, rows }, bi) => (
        <View key={board.key || `board-${bi}`} style={styles.board}>
          {board.title && !suppressBoardTitle ? (
            <Text style={styles.boardTitle}>{board.title}</Text>
          ) : null}
          <WidgetRows
            rows={rows}
            company={company}
            from_date={from_date}
            to_date={to_date}
            period={period}
            hideKpiShellTitle={hideKpiShellTitle}
            widgetMap={boardQuery.widgets}
            boardLoading={boardQuery.isLoading}
            boardSettled={
              boardQuery.usePerWidgetFallback ||
              (!boardQuery.isLoading &&
                (boardQuery.data != null || boardQuery.isError))
            }
            usePerWidgetFallback={boardQuery.usePerWidgetFallback}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 8,
  },
  title: {
    ...Type.label,
    fontFamily: Fonts.bodyBold,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  board: {
    marginBottom: 4,
  },
  boardTitle: {
    ...Type.sectionTitle,
    color: "#0f172a",
    marginBottom: 8,
  },
  sectionTitle: {
    ...Type.label,
    fontFamily: Fonts.bodyBold,
    color: "#334155",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 6,
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 8,
    marginBottom: 8,
    width: "100%",
  },
  rowCell: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
  },
  rowCellSpacer: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
  },
  boardNotice: {
    backgroundColor: "#fffbeb",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#fde68a",
    padding: 12,
    marginBottom: 12,
  },
  boardNoticeTitle: {
    fontFamily: Fonts.bodySemi,
    fontSize: 13,
    color: "#92400e",
    marginBottom: 4,
  },
  boardNoticeBody: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: "#78350f",
    lineHeight: 18,
  },
});
