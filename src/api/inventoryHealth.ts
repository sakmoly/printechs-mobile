import { http } from "./http";
import { useAuthStore } from "../store/auth";
import { oauthApi } from "./oauth";
import { ERP_ANALYSIS } from "./endpoints";
import { isApiEnabled } from "./mobileConfig";
import {
  demoDataOnlyWhenNoServer,
  filterBaParams,
  requireBaMethodEnabled,
  resolveCompanyName,
  unwrapFrappeMessage,
  withBaDemoFallback,
} from "./apiResilience";
import {
  getDemoDeadStock,
  getDemoInventoryHealth,
  getDemoStockCover,
  normalizeDeadStock,
  normalizeInventoryHealth,
  normalizeStockCover,
  type DeadStock,
  type InventoryHealth,
  type StockCover,
} from "./inventoryHealthTypes";

export type InventoryHealthParams = {
  company?: string;
  warehouse?: string;
  category?: string;
  brand?: string;
  limit?: number;
  old_days?: number;
};

async function prepare() {
  const serverUrl = useAuthStore.getState().serverConfig.serverUrl;
  http.setBaseUrl(serverUrl);
  const token = await oauthApi.getValidToken();
  if (!token) throw new Error("No valid access token available");
  return useAuthStore.getState();
}

export async function fetchInventoryHealth(
  params: InventoryHealthParams = {}
): Promise<InventoryHealth> {
  const state = useAuthStore.getState();
  const cfg = state.mobileConfig;
  const demo = demoDataOnlyWhenNoServer(getDemoInventoryHealth);
  if (demo !== undefined) return demo;
  requireBaMethodEnabled(
    "get_inventory_health",
    isApiEnabled(cfg, "get_inventory_health")
  );

  return withBaDemoFallback(
    "get_inventory_health",
    async () => {
      await prepare();
      const company =
        params.company ||
        resolveCompanyName(
          state.permissions.scope?.company,
          state.user?.company
        );
      const response = await http.get<any>(
        ERP_ANALYSIS.inventoryHealth.getHealth,
        filterBaParams({ ...params, company }, cfg)
      );
      return normalizeInventoryHealth(unwrapFrappeMessage(response));
    },
    getDemoInventoryHealth
  );
}

export async function fetchStockCover(
  params: InventoryHealthParams = {}
): Promise<StockCover> {
  const state = useAuthStore.getState();
  const cfg = state.mobileConfig;
  const demo = demoDataOnlyWhenNoServer(getDemoStockCover);
  if (demo !== undefined) return demo;
  requireBaMethodEnabled(
    "get_stock_cover",
    isApiEnabled(cfg, "get_stock_cover")
  );

  return withBaDemoFallback(
    "get_stock_cover",
    async () => {
      await prepare();
      const company =
        params.company ||
        resolveCompanyName(
          state.permissions.scope?.company,
          state.user?.company
        );
      const response = await http.get<any>(
        ERP_ANALYSIS.inventoryHealth.getStockCover,
        filterBaParams({ ...params, company, limit: params.limit ?? 50 }, cfg)
      );
      return normalizeStockCover(unwrapFrappeMessage(response));
    },
    getDemoStockCover
  );
}

export async function fetchDeadStock(
  params: InventoryHealthParams = {}
): Promise<DeadStock> {
  const state = useAuthStore.getState();
  const cfg = state.mobileConfig;
  const demo = demoDataOnlyWhenNoServer(getDemoDeadStock);
  if (demo !== undefined) return demo;
  requireBaMethodEnabled("get_dead_stock", isApiEnabled(cfg, "get_dead_stock"));

  return withBaDemoFallback(
    "get_dead_stock",
    async () => {
      await prepare();
      const company =
        params.company ||
        resolveCompanyName(
          state.permissions.scope?.company,
          state.user?.company
        );
      const response = await http.get<any>(
        ERP_ANALYSIS.inventoryHealth.getDeadStock,
        filterBaParams(
          {
            ...params,
            company,
            old_days: params.old_days ?? 90,
            limit: params.limit ?? 50,
          },
          cfg
        )
      );
      return normalizeDeadStock(unwrapFrappeMessage(response));
    },
    getDemoDeadStock
  );
}
