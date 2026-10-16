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
import type { ItemStockLine, ItemStockResult } from "../utils/inventoryItemStock";

export type ItemStockByCodeParams = {
  company?: string;
  item_code: string;
  brand?: string;
  territory?: string;
  warehouse?: string;
};

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function parseStockPayload(raw: unknown, itemCode: string): ItemStockResult | null {
  if (raw == null) return null;
  const root =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const data =
    root.data && typeof root.data === "object" && !Array.isArray(root.data)
      ? (root.data as Record<string, unknown>)
      : root;

  const code = String(data.item_code || itemCode).trim();
  const linesRaw = data.lines;
  if (!Array.isArray(linesRaw) || !linesRaw.length) return null;

  const lines: ItemStockLine[] = [];
  for (const row of linesRaw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const warehouse = String(r.warehouse || r.warehouse_name || "").trim();
    if (!warehouse) continue;
    lines.push({
      territory: String(r.territory || r.branch || "").trim(),
      warehouse,
      qty: num(r.qty ?? r.quantity ?? r.stock_qty),
      value: num(r.value ?? r.stock_value ?? r.amount),
    });
  }
  if (!lines.length) return null;

  const totalQty =
    data.total_qty != null
      ? num(data.total_qty)
      : lines.reduce((s, l) => s + l.qty, 0);
  const totalValue =
    data.total_value != null
      ? num(data.total_value)
      : lines.reduce((s, l) => s + l.value, 0);

  return {
    itemCode: code,
    itemName: String(data.item_name || data.item_label || code).trim(),
    totalQty,
    totalValue,
    lines,
  };
}

/** Single-call item warehouse breakdown — `erp_analysis.inventory.get_item_stock_by_code`. */
export async function fetchItemStockByCode(
  params: ItemStockByCodeParams
): Promise<ItemStockResult | null> {
  const code = String(params.item_code || "").trim();
  if (!code) return null;

  const cfg = useAuthStore.getState().mobileConfig;
  if (!isApiEnabled(cfg, "get_item_stock_by_code")) return null;

  const serverUrl = useAuthStore.getState().serverConfig.serverUrl;
  http.setBaseUrl(serverUrl);
  const token = await oauthApi.getValidToken();
  if (!token) return null;

  const state = useAuthStore.getState();
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
    brand: params.brand,
    warehouse: params.warehouse,
    ...(territory ? { territory, territories: territory } : {}),
  };

  const clean = filterBaParams(raw, cfg);

  try {
    let payload: unknown;
    try {
      const response = await http.get<unknown>(
        ERP_ANALYSIS.inventory.getItemStockByCode,
        clean,
        { silentError: true }
      );
      payload = unwrapFrappeMessage(response);
    } catch (getErr) {
      const status = (getErr as { response?: { status?: number } })?.response
        ?.status;
      if (status !== 405 && status !== 404) throw getErr;
      const response = await http.post<unknown>(
        ERP_ANALYSIS.inventory.getItemStockByCode,
        clean,
        { silentError: true }
      );
      payload = unwrapFrappeMessage(response);
    }
    return parseStockPayload(payload, code);
  } catch (e) {
    if (isMissingBaMethodError(e)) return null;
    return null;
  }
}
