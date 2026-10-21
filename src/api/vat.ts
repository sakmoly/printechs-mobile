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
  findVatBucket,
  getDemoVatDashboard,
  normalizeVatDashboard,
  parseVatBucketDocuments,
  type VatDocumentRow,
} from "./vatTypes";

export type VatDashboardParams = {
  company?: string;
  period?: string;
  from_date?: string;
  to_date?: string;
  /** Single territory or comma-separated — server resolves scope */
  territory?: string;
  /** Request invoice lines for drill buckets (BA optional) */
  include_documents?: boolean | number;
  bucket_key?: string;
  drill_bucket?: string;
};

async function prepare() {
  const serverUrl = useAuthStore.getState().serverConfig.serverUrl;
  http.setBaseUrl(serverUrl);
  const token = await oauthApi.getValidToken();
  if (!token) throw new Error("No valid access token available");
  return useAuthStore.getState();
}

export async function fetchVatDashboard(
  params: VatDashboardParams = {}
): Promise<VatDashboard> {
  const state = useAuthStore.getState();
  const cfg = state.mobileConfig;
  const demo = demoDataOnlyWhenNoServer(getDemoVatDashboard);
  if (demo !== undefined) return demo;

  requireBaMethodEnabled(
    "get_vat_dashboard",
    isApiEnabled(cfg, "get_vat_dashboard") ||
      isApiEnabled(cfg, "get_vat_summary")
  );

  return withBaDemoFallback(
    "get_vat_dashboard",
    async () => {
      await prepare();
      const company =
        params.company ||
        resolveCompanyName(
          state.permissions.scope?.company,
          state.user?.company
        );
      const response = await http.get<any>(
        ERP_ANALYSIS.tax.getVatDashboard,
        filterBaParams(
          {
            ...params,
            company,
            include_documents: params.include_documents ?? 1,
          },
          cfg
        )
      );
      const dash = normalizeVatDashboard(unwrapFrappeMessage(response));
      if (__DEV__ && process.env.EXPO_PUBLIC_VERBOSE_LOGS === "1") {
        const zatca = dash.not_submitted.find((b) =>
          b.key.includes("zatca_pending")
        );
        console.log("📊 VAT dashboard loaded", {
          trendMonths: dash.monthly_trend?.labels?.length ?? 0,
          zatcaDocs: zatca?.documents?.length ?? 0,
          notSubmittedBuckets: dash.not_submitted.length,
        });
      }
      return dash;
    },
    getDemoVatDashboard
  );
}

export async function fetchVatBucketDetail(
  params: VatDashboardParams & { bucket_key: string }
): Promise<VatDocumentRow[]> {
  const state = useAuthStore.getState();
  const cfg = state.mobileConfig;
  const demo = demoDataOnlyWhenNoServer(() => {
    const dash = getDemoVatDashboard();
    return findVatBucket(dash, params.bucket_key)?.documents ?? [];
  });
  if (demo !== undefined) return demo;

  requireBaMethodEnabled(
    "get_vat_dashboard",
    isApiEnabled(cfg, "get_vat_dashboard") ||
      isApiEnabled(cfg, "get_vat_summary")
  );

  return withBaDemoFallback(
    "get_vat_dashboard",
    async () => {
      await prepare();
      const company =
        params.company ||
        resolveCompanyName(
          state.permissions.scope?.company,
          state.user?.company
        );
      const response = await http.get<any>(
        ERP_ANALYSIS.tax.getVatDashboard,
        filterBaParams(
          {
            ...params,
            company,
            include_documents: 1,
            bucket_key: params.bucket_key,
            drill_bucket: params.bucket_key,
          },
          cfg
        )
      );
      return parseVatBucketDocuments(
        unwrapFrappeMessage(response),
        params.bucket_key
      );
    },
    () =>
      findVatBucket(getDemoVatDashboard(), params.bucket_key)?.documents ?? []
  );
}
