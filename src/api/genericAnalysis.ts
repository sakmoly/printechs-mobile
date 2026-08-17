/**
 * Generic analysis API — logical dimension + metric.
 * Falls back to product performance for brand/division/item_group when
 * get_generic_analysis is not on the server yet.
 */

import { http } from "./http";
import { useAuthStore } from "../store/auth";
import { oauthApi } from "./oauth";
import { ERP_ANALYSIS } from "./endpoints";
import { isApiEnabled } from "./mobileConfig";
import {
  filterBaParams,
  isMissingBaMethodError,
  resolveCompanyName,
  unwrapFrappeMessage,
  withBaDemoFallback,
  BaApiUnavailableError,
} from "./apiResilience";
import { assertLogicalDimensionKey } from "../dimensions/logicalKeys";
import { logger } from "../utils/logger";
import { fetchProductPerformance } from "./salesPerformance";
import type {
  AnalysisKpi,
  AnalysisRow,
  GenericAnalysisRequest,
  GenericAnalysisResponse,
} from "./genericAnalysisTypes";
import { shouldUseMockData } from "./mock";

function emptyResponse(
  req: GenericAnalysisRequest,
  source: GenericAnalysisResponse["meta"]["source"] = "empty"
): GenericAnalysisResponse {
  return {
    meta: {
      currency: "SAR",
      dimension: req.dimension,
      metric: req.metric || "net_sales",
      company: req.company,
      from_date: req.from_date,
      to_date: req.to_date,
      source,
    },
    kpis: [],
    rows: [],
    views: ["kpi", "chart", "ranking", "table"],
  };
}

function demoResponse(req: GenericAnalysisRequest): GenericAnalysisResponse {
  const rows: AnalysisRow[] = [
    { id: "a", label: "Alpha", value: 120000, change_pct: 8.2 },
    { id: "b", label: "Beta", value: 95000, change_pct: -2.1 },
    { id: "c", label: "Gamma", value: 71000, change_pct: 4.5 },
  ];
  const total = rows.reduce((s, r) => s + r.value, 0);
  return {
    meta: {
      currency: "SAR",
      dimension: req.dimension,
      metric: req.metric || "net_sales",
      source: "empty",
    },
    kpis: [
      {
        key: "total",
        label: "Total",
        value: total,
        change_pct: 3.4,
        format: "currency",
      },
    ],
    rows,
    views: ["kpi", "chart", "ranking", "table"],
  };
}

function normalizeGenericPayload(
  raw: any,
  req: GenericAnalysisRequest
): GenericAnalysisResponse {
  const root = raw?.data && !Array.isArray(raw.data) ? raw.data : raw;
  const metric = String(root?.meta?.metric || req.metric || "net_sales");
  const dimension = String(root?.meta?.dimension || req.dimension);
  const currency = root?.meta?.currency || "SAR";

  const rawRows =
    root?.rows || root?.data || root?.items || root?.ranking || [];
  const rows: AnalysisRow[] = (Array.isArray(rawRows) ? rawRows : []).map(
    (r: any, i: number) => ({
      id: String(r.id || r.name || r.key || r.label || `row-${i}`),
      label: String(r.label || r.name || r.id || "—"),
      value: Number(r.value ?? r.amount ?? r.sales ?? r.net_sales ?? 0) || 0,
      previous:
        r.previous != null
          ? Number(r.previous)
          : r.previous_year_value != null
            ? Number(r.previous_year_value)
            : null,
      change_pct:
        r.change_pct != null
          ? Number(r.change_pct)
          : r.change_percentage != null
            ? Number(r.change_percentage)
            : null,
      secondary:
        r.secondary != null
          ? Number(r.secondary)
          : r.gp != null
            ? Number(r.gp)
            : null,
      meta: typeof r === "object" ? r : undefined,
    })
  );

  const rawKpis = root?.kpis || root?.summary || [];
  let kpis: AnalysisKpi[] = [];
  if (Array.isArray(rawKpis) && rawKpis.length) {
    kpis = rawKpis.map((k: any, i: number) => ({
      key: String(k.key || k.id || `kpi-${i}`),
      label: String(k.label || k.title || k.key || "KPI"),
      value: Number(k.value ?? 0) || 0,
      previous: k.previous != null ? Number(k.previous) : null,
      change_pct: k.change_pct != null ? Number(k.change_pct) : null,
      format: k.format || "currency",
    }));
  } else if (rows.length) {
    const total = rows.reduce((s, r) => s + r.value, 0);
    kpis = [
      {
        key: "total",
        label: "Total",
        value: total,
        format: "currency",
      },
      {
        key: "rows",
        label: "Rows",
        value: rows.length,
        format: "number",
      },
    ];
  }

  const views = Array.isArray(root?.views)
    ? root.views
    : ["kpi", "chart", "ranking", "table"];

  return {
    meta: {
      currency,
      dimension,
      metric,
      company: root?.meta?.company || req.company,
      from_date: root?.meta?.from_date || req.from_date,
      to_date: root?.meta?.to_date || req.to_date,
      source: "generic",
    },
    kpis,
    rows,
    views,
  };
}

async function fromSalesTerritory(
  req: GenericAnalysisRequest
): Promise<GenericAnalysisResponse | null> {
  if (req.dimension !== "territory") return null;
  try {
    const { optimizedApis } = await import("./optimized-apis");
    const dash = await optimizedApis.getDashboardData({
      company: req.company,
      from_date: req.from_date,
      to_date: req.to_date,
    });
    const charts = (dash as any)?.charts || {};
    const salesDash = (dash as any)?.sales_dashboard || {};
    const raw =
      charts.sales_by_territory ||
      salesDash.territory ||
      salesDash.by_territory ||
      [];
    if (!Array.isArray(raw) || !raw.length) return null;
    const rows: AnalysisRow[] = raw.map((r: any, i: number) => ({
      id: String(r.territory || r.name || r.id || `t-${i}`),
      label: String(r.territory || r.name || r.label || "Territory"),
      value: Number(r.total_sales ?? r.sales ?? r.value ?? r.amount ?? 0) || 0,
      previous:
        r.sales_ly != null
          ? Number(r.sales_ly)
          : r.value_ly != null
            ? Number(r.value_ly)
            : r.previous_year_value != null
              ? Number(r.previous_year_value)
              : r.previous != null
                ? Number(r.previous)
                : null,
      change_pct:
        r.change_pct != null
          ? Number(r.change_pct)
          : r.change_percentage != null
            ? Number(r.change_percentage)
            : null,
    }));
    const total = rows.reduce((s, r) => s + r.value, 0);
    const totalLy = rows.reduce(
      (s, r) => s + (r.previous != null ? Number(r.previous) : 0),
      0
    );
    const hasLy = rows.some((r) => r.previous != null);
    const changePct =
      hasLy && totalLy !== 0
        ? ((total - totalLy) / Math.abs(totalLy)) * 100
        : null;

    // Also try dashboard KPI previous_year_value when territory rows lack LY
    const dashKpis = Array.isArray((dash as any)?.kpis)
      ? (dash as any).kpis
      : [];
    let kpiPrevious: number | null = null;
    let kpiValue: number | null = null;
    let kpiChange: number | null = null;
    for (const k of dashKpis) {
      const id = String(k.id || k.key || "");
      const label = String(k.label || "");
      const period = String(req.period || "").toLowerCase();
      const wantsMtd = period === "mtd" || period === "previous_month";
      const wantsToday = period === "today" || period === "yesterday";
      const match = wantsToday
        ? /sales_today|today/i.test(id) || /today/i.test(label)
        : wantsMtd
          ? /sales_mtd|mtd/i.test(id) || /mtd|month/i.test(label)
          : /sales_ytd|ytd|net_sales|total_sales/i.test(id) ||
            /ytd/i.test(label);
      if (!match) continue;
      kpiValue = Number(k.value ?? k.current_value ?? total) || total;
      kpiChange =
        k.change_percentage != null
          ? Number(k.change_percentage)
          : k.change_pct != null
            ? Number(k.change_pct)
            : null;
      kpiPrevious =
        k.previous_year_value != null
          ? Number(k.previous_year_value)
          : k.value_ly != null
            ? Number(k.value_ly)
            : k.previous != null
              ? Number(k.previous)
              : null;
      if (kpiPrevious == null && kpiChange != null && kpiValue != null) {
        // Live dashboard often sends YoY % without previous_year_value
        const factor = 1 + kpiChange / 100;
        if (Math.abs(factor) >= 1e-9) {
          const inferred = kpiValue / factor;
          if (Number.isFinite(inferred)) kpiPrevious = inferred;
        }
      }
      if (kpiPrevious != null) break;
    }

    const previous =
      hasLy ? totalLy : kpiPrevious != null ? kpiPrevious : null;
    const value = kpiValue != null && !hasLy ? kpiValue : total;
    const pct =
      changePct != null
        ? changePct
        : kpiChange != null
          ? kpiChange
          : previous != null && previous !== 0
            ? ((value - previous) / Math.abs(previous)) * 100
            : null;

    return {
      meta: {
        currency: "SAR",
        dimension: "territory",
        metric: req.metric || "net_sales",
        company: req.company,
        from_date: req.from_date,
        to_date: req.to_date,
        source: "dashboard",
      },
      kpis: [
        {
          key: "total",
          label: "Total Sales",
          value,
          previous,
          change_pct: pct,
          format: "currency",
        },
      ],
      rows,
      views: ["kpi", "chart", "ranking", "table"],
    };
  } catch (e) {
    logger.warn("Territory sales fallback failed", e);
    return null;
  }
}

async function fromProductPerformance(
  req: GenericAnalysisRequest
): Promise<GenericAnalysisResponse | null> {
  const levelMap: Record<string, "division" | "brand" | "item_group" | "item"> =
    {
      division: "division",
      brand: "brand",
      item_group: "item_group",
      category: "item_group",
      item: "item",
    };
  const level = levelMap[req.dimension];
  if (!level) return null;

  const filters = req.filters || {};
  const data = await fetchProductPerformance({
    company: req.company,
    from_date: req.from_date,
    to_date: req.to_date,
    period: req.period,
    level,
    territory: String(filters.territory || "") || undefined,
    division: String(filters.division || "") || undefined,
    brand: String(filters.brand || "") || undefined,
    item_group: String(filters.item_group || "") || undefined,
  });

  const rows: AnalysisRow[] = (data.rows || []).map((r) => ({
    id: r.id,
    label: r.name,
    value: Number(r.sales ?? 0) || 0,
    previous: r.sales_ly != null ? Number(r.sales_ly) : null,
    change_pct: r.growth_pct != null ? Number(r.growth_pct) : null,
    secondary: r.gp != null ? Number(r.gp) : null,
  }));

  const total = rows.reduce((s, r) => s + r.value, 0);
  return {
    meta: {
      currency: data.meta?.currency || "SAR",
      dimension: req.dimension,
      metric: req.metric || "net_sales",
      company: req.company,
      from_date: req.from_date,
      to_date: req.to_date,
      source: "product_performance",
    },
    kpis: [
      {
        key: "total",
        label: "Total sales",
        value: total,
        format: "currency",
      },
      {
        key: "count",
        label: "Groups",
        value: rows.length,
        format: "number",
      },
    ],
    rows,
    views: ["kpi", "chart", "ranking", "table"],
  };
}

export async function fetchGenericAnalysis(
  req: GenericAnalysisRequest
): Promise<GenericAnalysisResponse> {
  if (!assertLogicalDimensionKey(req.dimension)) {
    logger.warn("fetchGenericAnalysis blocked physical dimension", req.dimension);
    return emptyResponse(req);
  }

  if (shouldUseMockData()) {
    return demoResponse(req);
  }

  const state = useAuthStore.getState();
  const cfg = state.mobileConfig;
  const serverUrl = state.serverConfig.serverUrl;
  http.setBaseUrl(serverUrl);
  const token = await oauthApi.getValidToken();
  if (!token) throw new Error("No valid access token available");

  const company =
    req.company ||
    resolveCompanyName(state.permissions.scope?.company, state.user?.company);

  const filterParams: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(req.filters || {})) {
    if (!assertLogicalDimensionKey(k)) continue;
    if (v == null || v === "") continue;
    filterParams[k] = Array.isArray(v) ? v.join(",") : v;
  }

  const body = filterBaParams(
    {
      company,
      from_date: req.from_date,
      to_date: req.to_date,
      period: req.period,
      dimension: req.dimension,
      metric: req.metric || "net_sales",
      limit: req.limit ?? 50,
      ...filterParams,
    },
    cfg
  );

  const enabled = isApiEnabled(cfg, "get_generic_analysis");

  try {
    if (!enabled) {
      throw new BaApiUnavailableError("get_generic_analysis");
    }
    return await withBaDemoFallback(
      "get_generic_analysis",
      async () => {
        const response = await http.get<any>(
          ERP_ANALYSIS.analytics.getGenericAnalysis,
          body
        );
        return normalizeGenericPayload(unwrapFrappeMessage(response), {
          ...req,
          company,
        });
      },
      () => demoResponse(req)
    );
  } catch (error) {
    if (
      isMissingBaMethodError(error) ||
      error instanceof BaApiUnavailableError
    ) {
      logger.info(
        "get_generic_analysis unavailable — trying legacy analysis fallbacks"
      );
      try {
        const terr = await fromSalesTerritory({ ...req, company });
        if (terr && terr.rows.length) return terr;
        const fallback = await fromProductPerformance({ ...req, company });
        if (fallback && fallback.rows.length) return fallback;
      } catch (e) {
        logger.warn("Analysis fallback failed", e);
      }
      return emptyResponse({ ...req, company }, "empty");
    }
    throw error;
  }
}
