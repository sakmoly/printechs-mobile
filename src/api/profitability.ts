import { http } from "./http";
import { useAuthStore } from "../store/auth";
import { oauthApi } from "./oauth";
import { ERP_ANALYSIS } from "./endpoints";
import { isApiEnabled } from "./mobileConfig";
import { isBaPermissionDeniedError, isMissingBaMethodError } from "./baErrors";
import {
  demoDataOnlyWhenNoServer,
  filterBaParams,
  restoreTerritoryBaParams,
  isBaMethodKnownMissing,
  markBaMethodMissing,
  resolveCompanyName,
  unwrapFrappeMessage,
} from "./apiResilience";
import {
  getDemoProfitabilityDashboard,
  normalizeProfitabilityDashboard,
  profitabilityKpisAreEmpty,
  type ProfitabilityDashboard,
  type ProfitRow,
} from "./profitabilityTypes";
import { rowMatchesTerritory } from "../utils/dashboardTerritory";

export type ProfitabilityParams = {
  company?: string;
  from_date?: string;
  to_date?: string;
  period?: string;
  territory?: string;
  salesperson?: string;
  customer?: string;
  brand?: string;
  division?: string;
  limit?: number;
};

async function prepare() {
  const serverUrl = useAuthStore.getState().serverConfig.serverUrl;
  http.setBaseUrl(serverUrl);
  const token = await oauthApi.getValidToken();
  if (!token) throw new Error("No valid access token available");
  return useAuthStore.getState();
}

function n(v: unknown): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "object" && !Array.isArray(v)) {
    const o = v as Record<string, unknown>;
    if (o.value != null) return n(o.value);
    if (o.amount != null) return n(o.amount);
  }
  const x = Number(String(v).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(x) ? x : 0;
}

function mapBrandRow(r: any): ProfitRow {
  const sales = n(r.total_sales ?? r.sales ?? r.amount);
  const cogs = n(r.total_cost ?? r.cogs ?? r.cost);
  const gp = n(
    r.profit ?? r.gross_profit_amount ?? r.gp ?? (sales - cogs)
  );
  const gpPct =
    r.gross_profit_percent != null
      ? n(r.gross_profit_percent)
      : sales > 0
        ? (gp / sales) * 100
        : 0;
  return {
    id: String(r.brand || r.name || r.id || "brand"),
    name: String(r.brand || r.name || "Brand"),
    sales,
    cogs,
    gp,
    gp_pct: gpPct,
    invoice_count: r.invoice_count != null ? n(r.invoice_count) : null,
  };
}

function mapCustomerRow(r: any): ProfitRow {
  const sales = n(r.total_sales ?? r.sales ?? r.amount);
  return {
    id: String(r.customer || r.customer_name || r.name || r.id || "cust"),
    name: String(r.customer_name || r.customer || r.name || "Customer"),
    sales,
    cogs: null,
    gp: null,
    gp_pct: null,
    invoice_count: r.invoice_count != null ? n(r.invoice_count) : null,
  };
}

function mapTerritoryRow(r: any): ProfitRow {
  const sales = n(r.total_sales ?? r.sales ?? r.amount);
  const margin = r.margin_percentage != null ? n(r.margin_percentage) : null;
  return {
    id: String(r.territory || r.name || r.id || "terr"),
    name: String(r.territory || r.name || "Territory"),
    sales,
    cogs: null,
    gp: margin != null && sales > 0 ? (sales * margin) / 100 : null,
    gp_pct: margin,
    invoice_count: r.invoice_count != null ? n(r.invoice_count) : null,
  };
}

/**
 * Live GP from existing sales_kpis / complete dashboard APIs when
 * erp_analysis.profitability.get_profitability_dashboard is not installed.
 */
/** Live sales / executive path — use when get_profitability_dashboard is 403 or missing. */
export async function fetchProfitabilityFromLiveSales(
  params: ProfitabilityParams = {}
): Promise<ProfitabilityDashboard> {
  return fetchProfitabilityViaLiveSales(params);
}

/**
 * Territory-scoped cost of sales for inventory turnover (COGS ÷ avg stock).
 * Falls back through by_territory rows, GP margin, then sales_kpis POST.
 */
export async function fetchTerritoryCostOfSales(
  params: ProfitabilityParams = {}
): Promise<{ sales: number; cogs: number }> {
  const territory = String(params.territory || "").trim();
  const prof = await fetchProfitabilityFromLiveSales(params);

  let sales = prof.kpis.sales;
  let cogs = prof.kpis.cogs;

  if (territory && prof.by_territory?.length) {
    const row = prof.by_territory.find(
      (r) =>
        rowMatchesTerritory(r.name, territory) ||
        rowMatchesTerritory(r.id, territory)
    );
    if (row && row.sales > 0) {
      sales = row.sales;
      if (row.cogs != null && row.cogs > 0) {
        cogs = row.cogs;
      } else if (row.gp != null && Number.isFinite(row.gp)) {
        cogs = Math.max(0, sales - row.gp);
      }
    }
  }

  if (cogs <= 0 && sales > 0) {
    const gp = prof.kpis.gp;
    const gpPct = prof.kpis.gp_pct;
    if (gp > 0 && gp < sales) {
      cogs = sales - gp;
    } else if (gpPct > 0 && gpPct < 100) {
      cogs = sales * (1 - gpPct / 100);
    }
  }

  if (cogs <= 0 && territory) {
    try {
      await prepare();
      const state = useAuthStore.getState();
      const cfg = state.mobileConfig;
      const company =
        params.company ||
        resolveCompanyName(
          state.permissions.scope?.company,
          state.user?.company
        );
      const raw = {
        company,
        from_date: params.from_date,
        to_date: params.to_date,
        period: params.period,
        territory,
      };
      const clean = restoreTerritoryBaParams(
        raw,
        filterBaParams(raw, cfg)
      );
      const res = await http.post<any>(
        ERP_ANALYSIS.salesKpis.getSalesDashboard,
        clean
      );
      let apiData = unwrapFrappeMessage(res);
      if (apiData?.message && typeof apiData.message === "object") {
        apiData = apiData.message;
      }
      const total = n(
        apiData?.total_sales ?? apiData?.sales ?? apiData?.net_sales
      );
      const gp = n(
        apiData?.gross_profit ?? apiData?.gp ?? apiData?.gross_profit_amount
      );
      const gpPct = n(
        apiData?.gross_profit_percentage ?? apiData?.gp_pct ?? apiData?.margin
      );
      if (total > 0) {
        sales = total;
        if (gp > 0 && gp <= total) {
          cogs = total - gp;
        } else if (gpPct > 0 && gpPct < 100) {
          cogs = total * (1 - gpPct / 100);
        }
      }
    } catch {
      /* optional */
    }
  }

  return { sales, cogs };
}

async function fetchProfitabilityViaLiveSales(
  params: ProfitabilityParams
): Promise<ProfitabilityDashboard> {
  await prepare();
  const state = useAuthStore.getState();
  const cfg = state.mobileConfig;
  const company =
    params.company ||
    resolveCompanyName(
      state.permissions.scope?.company,
      state.user?.company
    );

  const rawSales = {
    company,
    from_date: params.from_date,
    to_date: params.to_date,
    period: params.period,
    territory: params.territory,
    brand: params.brand,
    division: params.division,
  };
  const clean = restoreTerritoryBaParams(
    rawSales,
    filterBaParams(rawSales, cfg)
  );

  // 1) Prefer sales_kpis dashboard (already live on Printechs)
  let salesPayload: any = null;
  try {
    const res = await http.post<any>(
      ERP_ANALYSIS.salesKpis.getSalesDashboard,
      clean
    );
    salesPayload = unwrapFrappeMessage(res);
    if (salesPayload?.message && typeof salesPayload.message === "object") {
      salesPayload = salesPayload.message;
    }
  } catch (e) {
    console.warn("⚠️ sales_kpis.get_sales_dashboard failed for GP fallback:", e);
  }

  // 2) Enrich with complete dashboard sales section (brands / customers / territory)
  let dashSales: any = null;
  try {
    const res = await http.get<any>(
      ERP_ANALYSIS.dashboard.getCompleteDashboardData,
      clean
    );
    const root = unwrapFrappeMessage(res);
    dashSales = root?.sales_dashboard || root?.sales || null;
  } catch {
    /* optional */
  }

  // 3) Executive dashboard — known live on Printechs (sales / GP)
  let exec: any = null;
  try {
    const res = await http.get<any>(ERP_ANALYSIS.executive.getDashboard, clean);
    exec = unwrapFrappeMessage(res);
    if (exec?.data && typeof exec.data === "object") exec = exec.data;
  } catch {
    /* optional */
  }

  const preferYtd =
    params.period === "ytd" ||
    params.period === "previous_year" ||
    params.period === "qtd";
  const execSales = preferYtd
    ? exec?.sales?.ytd ?? exec?.sales?.mtd ?? exec?.sales_ytd ?? exec?.sales_mtd
    : exec?.sales?.mtd ?? exec?.sales?.ytd ?? exec?.sales_mtd ?? exec?.sales_ytd;
  const execGp = preferYtd
    ? exec?.gross_profit?.ytd ??
      exec?.gp?.ytd ??
      exec?.gross_profit?.mtd ??
      exec?.gp?.mtd
    : exec?.gross_profit?.mtd ??
      exec?.gp?.mtd ??
      exec?.gross_profit?.ytd ??
      exec?.gp?.ytd;

  const sales = n(
    salesPayload?.total_sales ??
      salesPayload?.sales ??
      dashSales?.metrics?.totalSales ??
      dashSales?.metrics?.total_sales ??
      execSales
  );
  const cogs = n(
    salesPayload?.cost_of_goods_sold ??
      salesPayload?.cogs ??
      dashSales?.metrics?.costOfGoodsSold ??
      dashSales?.metrics?.cost_of_goods_sold ??
      exec?.cogs?.ytd ??
      exec?.cogs?.mtd ??
      exec?.cogs
  );
  const gp = n(
    salesPayload?.gross_profit ??
      salesPayload?.gp ??
      dashSales?.metrics?.grossProfit ??
      execGp ??
      (sales && cogs ? sales - cogs : 0)
  );
  const gpPct = n(
    salesPayload?.gross_profit_percentage ??
      salesPayload?.gp_pct ??
      dashSales?.metrics?.grossProfitPercentage ??
      exec?.gross_profit?.gp_pct ??
      exec?.gp?.gp_pct ??
      (sales > 0 ? (gp / sales) * 100 : 0)
  );
  const invoiceCount = n(
    salesPayload?.total_invoices ??
      salesPayload?.invoice_count ??
      dashSales?.metrics?.totalInvoices
  );

  const brandsSrc =
    dashSales?.top_brands ||
    salesPayload?.top_brands ||
    salesPayload?.brands ||
    [];
  const customersSrc =
    dashSales?.top_customers ||
    salesPayload?.top_customers ||
    salesPayload?.customers ||
    [];
  const territorySrc =
    dashSales?.territory ||
    salesPayload?.territory ||
    salesPayload?.territories ||
    [];

  if (!sales && !gp && !brandsSrc.length && !customersSrc.length) {
    throw new Error(
      "Profitability data is not available from live sales APIs on this server yet."
    );
  }

  console.log("📊 Profitability live fallback:", {
    sales,
    cogs,
    gp,
    gpPct,
    brands: Array.isArray(brandsSrc) ? brandsSrc.length : 0,
    customers: Array.isArray(customersSrc) ? customersSrc.length : 0,
  });

  return {
    meta: {
      currency: "SAR",
      company: company || "",
      from_date: params.from_date,
      to_date: params.to_date,
      generated_at: new Date().toISOString(),
    },
    kpis: {
      sales,
      cogs,
      gp,
      gp_pct: gpPct,
      sales_ly: null,
      gp_ly: null,
      gp_pct_ly: null,
      growth_pct: null,
      gp_growth_pct: null,
      invoice_count: invoiceCount || null,
    },
    by_brand: Array.isArray(brandsSrc) ? brandsSrc.map(mapBrandRow) : null,
    by_customer: Array.isArray(customersSrc)
      ? customersSrc.map(mapCustomerRow)
      : null,
    by_territory: Array.isArray(territorySrc)
      ? territorySrc.map(mapTerritoryRow)
      : null,
    by_product: null,
    by_salesperson: null,
    charts: null,
  };
}

export async function fetchProfitabilityDashboard(
  params: ProfitabilityParams = {}
): Promise<ProfitabilityDashboard> {
  const state = useAuthStore.getState();
  const cfg = state.mobileConfig;
  const demo = demoDataOnlyWhenNoServer(getDemoProfitabilityDashboard);
  if (demo !== undefined) return demo;

  const tryBa = async () => {
    await prepare();
    const company =
      params.company ||
      resolveCompanyName(
        state.permissions.scope?.company,
        state.user?.company
      );
    const rawProf = { ...params, company };
    const response = await http.get<any>(
      ERP_ANALYSIS.profitability.getDashboard,
      restoreTerritoryBaParams(
        rawProf,
        filterBaParams(rawProf, cfg)
      ),
      { silentError: true }
    );
    return normalizeProfitabilityDashboard(unwrapFrappeMessage(response));
  };

  if (
    isApiEnabled(cfg, "get_profitability_dashboard") &&
    !isBaMethodKnownMissing("get_profitability_dashboard")
  ) {
    try {
      const ba = await tryBa();
      // BA may return 200 with empty / mismatched shape — use live sales GP
      if (!profitabilityKpisAreEmpty(ba.kpis)) {
        return ba;
      }
      console.log(
        "ℹ️ get_profitability_dashboard returned empty KPIs — using live sales GP APIs"
      );
    } catch (error) {
      if (isMissingBaMethodError(error)) {
        markBaMethodMissing("get_profitability_dashboard");
        console.log(
          "ℹ️ get_profitability_dashboard missing — using live sales GP APIs"
        );
      } else if (isBaPermissionDeniedError(error)) {
        markBaMethodMissing("get_profitability_dashboard");
        if (__DEV__) {
          console.log(
            "ℹ️ get_profitability_dashboard not permitted — using live sales GP APIs"
          );
        }
      } else if (__DEV__) {
        console.warn(
          "⚠️ get_profitability_dashboard failed — trying live sales GP:",
          (error as Error)?.message || error
        );
      }
    }
  }

  return fetchProfitabilityViaLiveSales(params);
}
