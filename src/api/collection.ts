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
  getDemoCollectionAttention,
  getDemoCollectionDashboard,
  normalizeCollectionAttention,
  normalizeCollectionDashboard,
  type CollectionAttention,
  type CollectionDashboard,
} from "./collectionTypes";

export type CollectionParams = {
  company?: string;
  from_date?: string;
  to_date?: string;
  period?: string;
  territory?: string;
  salesperson?: string;
  customer?: string;
  limit?: number;
};

async function prepare() {
  const serverUrl = useAuthStore.getState().serverConfig.serverUrl;
  http.setBaseUrl(serverUrl);
  const token = await oauthApi.getValidToken();
  if (!token) throw new Error("No valid access token available");
  return useAuthStore.getState();
}

export async function fetchCollectionDashboard(
  params: CollectionParams = {}
): Promise<CollectionDashboard> {
  const state = useAuthStore.getState();
  const cfg = state.mobileConfig;
  const demo = demoDataOnlyWhenNoServer(getDemoCollectionDashboard);
  if (demo !== undefined) return demo;
  requireBaMethodEnabled(
    "get_collection_dashboard",
    isApiEnabled(cfg, "get_collection_dashboard")
  );

  return withBaDemoFallback(
    "get_collection_dashboard",
    async () => {
      await prepare();
      const company =
        params.company ||
        resolveCompanyName(
          state.permissions.scope?.company,
          state.user?.company
        );
      const response = await http.get<any>(
        ERP_ANALYSIS.collection.getDashboard,
        filterBaParams({ ...params, company }, cfg)
      );
      return normalizeCollectionDashboard(unwrapFrappeMessage(response));
    },
    getDemoCollectionDashboard
  );
}

export async function fetchCollectionAttention(
  params: CollectionParams = {}
): Promise<CollectionAttention> {
  const state = useAuthStore.getState();
  const cfg = state.mobileConfig;
  const demo = demoDataOnlyWhenNoServer(getDemoCollectionAttention);
  if (demo !== undefined) return demo;
  requireBaMethodEnabled(
    "get_collection_attention",
    isApiEnabled(cfg, "get_collection_attention")
  );

  return withBaDemoFallback(
    "get_collection_attention",
    async () => {
      await prepare();
      const company =
        params.company ||
        resolveCompanyName(
          state.permissions.scope?.company,
          state.user?.company
        );
      const response = await http.get<any>(
        ERP_ANALYSIS.collection.getAttention,
        filterBaParams({ ...params, company }, cfg)
      );
      return normalizeCollectionAttention(unwrapFrappeMessage(response));
    },
    getDemoCollectionAttention
  );
}
