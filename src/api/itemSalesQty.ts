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
} from "./apiResilience";
import { trailingTwelveMonthsRange } from "../utils/period";

export type ItemSalesQtyParams = {
  company?: string;
  item_code: string;
  from_date?: string;
  to_date?: string;
  territory?: string;
  brand?: string;
};

function numQty(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseSalesQtyPayload(raw: unknown): number | null {
  if (raw == null) return null;
  const root =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  const direct =
    numQty(root.qty_sold) ??
    numQty(root.quantity_sold) ??
    numQty(root.sales_qty) ??
    numQty(root.qty) ??
    numQty(root.quantity);

  if (direct != null) return direct;

  const nested = root.sales_last_365_days;
  if (nested && typeof nested === "object") {
    const bag = nested as Record<string, unknown>;
    const q =
      numQty(bag.qty_sold) ??
      numQty(bag.quantity_sold) ??
      numQty(bag.qty) ??
      numQty(bag.quantity);
    if (q != null) return q;
  }

  const data = root.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return parseSalesQtyPayload(data);
  }

  return null;
}

/**
 * Preferred path for days-of-supply — `erp_analysis.sales.get_item_sales_qty`.
 */
export async function fetchItemSalesQty(
  params: ItemSalesQtyParams
): Promise<number | null> {
  const code = String(params.item_code || "").trim();
  if (!code) return null;

  const cfg = useAuthStore.getState().mobileConfig;
  if (!isApiEnabled(cfg, "get_item_sales_qty")) return null;

  const serverUrl = useAuthStore.getState().serverConfig.serverUrl;
  http.setBaseUrl(serverUrl);
  const token = await oauthApi.getValidToken();
  if (!token) return null;

  const state = useAuthStore.getState();
  const range = trailingTwelveMonthsRange();
  const company =
    params.company ||
    resolveCompanyName(
      state.permissions?.scope?.company,
      state.user?.company
    );

  const territory = String(params.territory || "").trim();
  const raw = {
    company,
    item_code: code,
    from_date: params.from_date || range.from_date,
    to_date: params.to_date || range.to_date,
    brand: params.brand,
    ...(territory ? { territory, territories: territory } : {}),
  };

  const clean = filterBaParams(raw, cfg);

  try {
    let payload: unknown;
    try {
      const response = await http.get<unknown>(
        ERP_ANALYSIS.sales.getItemSalesQty,
        clean,
        { silentError: true }
      );
      payload = unwrapFrappeMessage(response);
    } catch (getErr) {
      const status = (getErr as { response?: { status?: number } })?.response
        ?.status;
      if (status !== 405 && status !== 404) throw getErr;
      const response = await http.post<unknown>(
        ERP_ANALYSIS.sales.getItemSalesQty,
        clean,
        { silentError: true }
      );
      payload = unwrapFrappeMessage(response);
    }
    const qty = parseSalesQtyPayload(payload);
    return qty != null && qty >= 0 ? qty : null;
  } catch (e) {
    if (isMissingBaMethodError(e)) return null;
    return null;
  }
}
