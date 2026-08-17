import { isAxiosError } from "axios";
import { http } from "./http";
import { useAuthStore } from "../store/auth";
import { oauthApi } from "./oauth";
import { ERP_ANALYSIS } from "./endpoints";
import { isApiEnabled } from "./mobileConfig";
import {
  BaApiUnavailableError,
  demoDataOnlyWhenNoServer,
  filterBaParams,
  requireBaMethodEnabled,
  unwrapFrappeMessage,
} from "./apiResilience";
import { isMissingBaMethodError } from "./baErrors";
import {
  getDemoExecutiveDashboard,
  normalizeExecutiveDashboard,
  type ExecutiveDashboard,
} from "./executiveTypes";

const EXECUTIVE_PATHS = [
  ERP_ANALYSIS.executive.getDashboard,
  ERP_ANALYSIS.dashboard.getExecutiveDashboard,
];

export type ExecutiveParams = {
  company?: string;
  from_date?: string;
  to_date?: string;
  period?: string;
  /** Comma-separated view territories (Sales / analytics). */
  territories?: string;
  territory?: string;
};

function isHttpStatus(error: unknown, status: number): boolean {
  return isAxiosError(error) && error.response?.status === status;
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function singleTerritory(clean: Record<string, unknown>): string {
  const t = String(clean.territories || clean.territory || "").trim();
  if (!t || t.includes(",")) return "";
  return t;
}

async function requestExecutive(
  path: string,
  clean: Record<string, unknown>
): Promise<ExecutiveDashboard> {
  const response = await http.get<any>(path, clean, { silentError: true });
  const payload = unwrapFrappeMessage(response);
  const normalized = normalizeExecutiveDashboard(payload);
  console.log("📊 Executive dashboard normalized:", {
    path,
    params: clean,
    company: normalized.meta.company,
    currency: normalized.meta.currency,
    salesMtd: normalized.sales?.mtd?.value,
    salesYtd: normalized.sales?.ytd?.value,
    recvTotal: normalized.receivables?.total,
    invValue: normalized.inventory?.value,
    approvals: normalized.approvals?.pending_count,
  });
  return normalized;
}

/** Resolve ERPNext Territory names that match the filter chip (incl. children). */
async function resolveTerritoryNames(label: string): Promise<string[]> {
  const out: string[] = [];
  const add = (n: string) => {
    const t = String(n || "").trim();
    if (t && !out.some((x) => x.toLowerCase() === t.toLowerCase())) {
      out.push(t);
    }
  };
  add(label);

  try {
    const res = await http.get<any>(
      "/api/method/frappe.client.get_list",
      {
        doctype: "Territory",
        fields: JSON.stringify([
          "name",
          "is_group",
          "lft",
          "rgt",
          "parent_territory",
        ]),
        filters: JSON.stringify([["name", "like", `%${label}%`]]),
        limit_page_length: 50,
      },
      { silentError: true }
    );
    const raw = unwrapFrappeMessage(res);
    const rows = Array.isArray(raw)
      ? raw
      : Array.isArray(res?.message)
        ? res.message
        : [];

    for (const row of rows) {
      add(row?.name);
      const lft = Number(row?.lft);
      const rgt = Number(row?.rgt);
      // Pull nested territories under a group (Jeddah → branches)
      if (
        (row?.is_group === 1 || row?.is_group === true) &&
        Number.isFinite(lft) &&
        Number.isFinite(rgt) &&
        rgt > lft + 1
      ) {
        try {
          const childRes = await http.get<any>(
            "/api/method/frappe.client.get_list",
            {
              doctype: "Territory",
              fields: JSON.stringify(["name"]),
              filters: JSON.stringify([
                ["lft", ">", lft],
                ["rgt", "<", rgt],
              ]),
              limit_page_length: 200,
            },
            { silentError: true }
          );
          const childRaw = unwrapFrappeMessage(childRes);
          const children = Array.isArray(childRaw)
            ? childRaw
            : Array.isArray(childRes?.message)
              ? childRes.message
              : [];
          for (const c of children) add(c?.name);
        } catch {
          /* ignore */
        }
      }
    }
  } catch {
    /* keep label */
  }

  if (__DEV__) {
    console.log("📍 Territory name resolve:", label, "→", out);
  }
  return out;
}

/**
 * Live Sales Invoice totals for one territory when BA executive returns 403.
 */
async function fetchExecutiveSalesViaInvoices(params: {
  company?: string;
  territory: string;
  from_date?: string;
  to_date?: string;
}): Promise<ExecutiveDashboard | null> {
  try {
    const today = new Date();
    const todayIso = toIsoDate(today);
    const monthStart = toIsoDate(
      new Date(today.getFullYear(), today.getMonth(), 1)
    );
    const yearStart = `${today.getFullYear()}-01-01`;
    const from = params.from_date || yearStart;
    const to =
      params.to_date && params.to_date > todayIso ? params.to_date : todayIso;

    const names = await resolveTerritoryNames(params.territory);

    const runList = async (withCompany: boolean) => {
      const filters: unknown[] = [
        ["docstatus", "=", 1],
        ["posting_date", ">=", from],
        ["posting_date", "<=", to],
        names.length === 1
          ? ["territory", "=", names[0]]
          : ["territory", "in", names],
      ];
      if (withCompany && params.company) {
        filters.push(["company", "=", params.company]);
      }
      const pageSize = 500;
      const maxPages = 20;
      const all: any[] = [];
      for (let page = 0; page < maxPages; page++) {
        const res = await http.get<any>(
          "/api/method/frappe.client.get_list",
          {
            doctype: "Sales Invoice",
            fields: JSON.stringify([
              "name",
              "posting_date",
              "territory",
              "grand_total",
              "base_grand_total",
            ]),
            filters: JSON.stringify(filters),
            limit_page_length: pageSize,
            limit_start: page * pageSize,
            order_by: "posting_date desc",
          },
          { silentError: true }
        );
        const raw = unwrapFrappeMessage(res);
        const chunk = Array.isArray(raw)
          ? raw
          : Array.isArray(res?.message)
            ? res.message
            : [];
        all.push(...chunk);
        if (chunk.length < pageSize) break;
      }
      return all;
    };

    let rows = await runList(true);
    if (!rows.length && params.company) {
      // Retry without company if naming / permission quirks hide rows
      rows = await runList(false);
    }

    let todaySum = 0;
    let mtdSum = 0;
    let ytdSum = 0;
    for (const row of rows) {
      const amt = Number(row.base_grand_total ?? row.grand_total) || 0;
      const d = String(row.posting_date || "");
      if (!d) continue;
      if (d === todayIso) todaySum += amt;
      if (d >= monthStart && d <= todayIso) mtdSum += amt;
      if (d >= yearStart && d <= todayIso) ytdSum += amt;
    }

    console.log("📊 Executive sales via SI territory fallback:", {
      territory: params.territory,
      matchedNames: names,
      invoiceCount: rows.length,
      today: todaySum,
      mtd: mtdSum,
      ytd: ytdSum,
    });

    // Only accept as a real fallback when we found invoices (or confirmed zero)
    return {
      meta: {
        currency: "SAR",
        company: params.company || "",
        from_date: from,
        to_date: to,
      },
      sales: {
        today: { value: todaySum },
        mtd: { value: mtdSum },
        ytd: { value: ytdSum },
      },
      gross_profit: null,
      collection: null,
      receivables: null,
      inventory: null,
      orders: null,
      purchasing: null,
      payables: null,
      approvals: { pending_count: 0 },
    };
  } catch (e) {
    console.warn("⚠️ Executive SI territory fallback failed:", e);
    return null;
  }
}

/** Prefer sales_kpis when executive 403s for a territory. */
async function fetchExecutiveSalesViaSalesKpis(params: {
  company?: string;
  territory: string;
  from_date?: string;
  to_date?: string;
  period?: string;
}): Promise<ExecutiveDashboard | null> {
  try {
    const cfg = useAuthStore.getState().mobileConfig;
    const body = filterBaParams(
      {
        company: params.company,
        from_date: params.from_date,
        to_date: params.to_date,
        period: params.period,
        territory: params.territory,
      },
      cfg
    );
    const res = await http.post<any>(
      ERP_ANALYSIS.salesKpis.getSalesDashboard,
      body
    );
    const apiData = res?.message?.message || res?.message || res;
    if (!apiData || typeof apiData !== "object") return null;

    const total = Number(
      apiData.total_sales ?? apiData.sales ?? apiData.net_sales ?? 0
    );
    const gp = Number(
      apiData.gross_profit ?? apiData.gp ?? apiData.gross_profit_amount
    );
    const gpPct = Number(
      apiData.gross_profit_percentage ?? apiData.gp_pct ?? apiData.margin
    );
    if (!Number.isFinite(total) || total <= 0) {
      // Zero from BA is often a broken territory filter — try SI next
      console.log(
        "ℹ️ sales_kpis territory fallback returned 0 — will try SI list",
        params.territory
      );
      return null;
    }

    const period = String(params.period || "ytd").toLowerCase();
    // For a date-bounded KPI total, fill the active period bucket and
    // also set YTD when the request window is YTD (home default).
    const salesPoint = { value: total };
    const sales = {
      today: period === "today" ? salesPoint : null,
      mtd:
        period === "mtd" || period === "today" ? salesPoint : null,
      ytd: salesPoint,
    };

    console.log("📊 Executive sales via sales_kpis territory fallback:", {
      territory: params.territory,
      total,
      gp: Number.isFinite(gp) ? gp : null,
    });

    return {
      meta: {
        currency: String(apiData.currency || "SAR"),
        company: params.company || "",
        from_date: params.from_date,
        to_date: params.to_date,
      },
      sales,
      gross_profit: Number.isFinite(gp)
        ? {
            mtd: period === "mtd" ? { value: gp } : null,
            ytd: period !== "mtd" && period !== "today" ? { value: gp } : null,
            gp_pct: Number.isFinite(gpPct) ? { value: gpPct } : null,
          }
        : null,
      collection: null,
      receivables: null,
      inventory: null,
      orders: null,
      purchasing: null,
      payables: null,
      approvals: { pending_count: 0 },
    };
  } catch (e) {
    console.warn("⚠️ Executive sales_kpis territory fallback failed:", e);
    return null;
  }
}

async function fetchTerritoryExecutiveFallback(
  clean: Record<string, unknown>
): Promise<ExecutiveDashboard | null> {
  const terr = singleTerritory(clean);
  if (!terr) return null;

  const base = {
    company: clean.company ? String(clean.company) : undefined,
    territory: terr,
    from_date: clean.from_date ? String(clean.from_date) : undefined,
    to_date: clean.to_date ? String(clean.to_date) : undefined,
    period: clean.period ? String(clean.period) : undefined,
  };

  const fromKpis = await fetchExecutiveSalesViaSalesKpis(base);
  if (fromKpis?.sales) {
    const ytd = fromKpis.sales.ytd?.value ?? 0;
    const mtd = fromKpis.sales.mtd?.value ?? 0;
    if (ytd > 0 || mtd > 0) return fromKpis;
  }

  return fetchExecutiveSalesViaInvoices(base);
}

/**
 * Phase 3A — single payload for Executive / Home Dashboard 2.0.
 * Live only when a server URL is configured — never invents sample KPIs.
 */
export async function fetchExecutiveDashboard(
  params: ExecutiveParams = {}
): Promise<ExecutiveDashboard> {
  const demo = demoDataOnlyWhenNoServer(() =>
    getDemoExecutiveDashboard(
      useAuthStore.getState().user?.company || "Demo Company"
    )
  );
  if (demo !== undefined) return demo;

  const cfg = useAuthStore.getState().mobileConfig;
  requireBaMethodEnabled(
    "get_executive_dashboard",
    isApiEnabled(cfg, "get_executive_dashboard")
  );

  const serverUrl = useAuthStore.getState().serverConfig.serverUrl;
  http.setBaseUrl(serverUrl);
  const token = await oauthApi.getValidToken();
  if (!token) throw new Error("No valid access token available");

  const clean = filterBaParams(
    {
      company: params.company,
      from_date: params.from_date,
      to_date: params.to_date,
      period: params.period,
      territories: params.territories,
      territory: params.territory,
    },
    cfg
  );

  let lastError: unknown;
  for (const path of EXECUTIVE_PATHS) {
    try {
      return await requestExecutive(path, clean);
    } catch (error: any) {
      lastError = error;
      if (isMissingBaMethodError(error)) continue;

      const terr = singleTerritory(clean);
      if (isHttpStatus(error, 403) && terr && !clean.territory) {
        try {
          const alt: Record<string, unknown> = { ...clean, territory: terr };
          delete alt.territories;
          console.log(
            "ℹ️ Executive 403 with territories= — retrying territory=",
            terr
          );
          return await requestExecutive(path, alt);
        } catch (altErr) {
          lastError = altErr;
        }
      }

      // BA often 403s Jeddah (and sometimes others) even with View All Sales.
      // Fall back to sales_kpis / live Sales Invoices for that territory.
      if (
        (isHttpStatus(error, 403) || isHttpStatus(lastError, 403)) &&
        terr
      ) {
        const fallback = await fetchTerritoryExecutiveFallback(clean);
        if (fallback) {
          console.log(
            "✅ Executive territory fallback OK for",
            terr,
            "(BA returned 403)"
          );
          return fallback;
        }
        const err = new Error(
          `Executive data not available for ${terr} (server returned 403).`
        );
        (err as any).isBaScopeError = true;
        (err as any).status = 403;
        throw err;
      }

      throw error;
    }
  }

  // Last chance: territory SI fallback if all executive paths missing
  const terrFallback = await fetchTerritoryExecutiveFallback(clean);
  if (terrFallback) return terrFallback;

  console.warn("⚠️ Executive dashboard API unavailable:", lastError);
  throw new BaApiUnavailableError("get_executive_dashboard");
}
