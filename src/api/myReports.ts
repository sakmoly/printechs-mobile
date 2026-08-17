/**
 * Safe call to Desk-configured report list APIs (Option A report_list).
 * Only erp_analysis.* methods are allowed.
 */

import { http } from "./http";
import { logger } from "../utils/logger";

export type MyReportRow = {
  id: string;
  title: string;
  module?: string;
  ref_doctype?: string;
  report_type?: string;
};

export type MyReportsPayload = {
  company?: string;
  reports: MyReportRow[];
  count?: number;
};

const ALLOWED_METHOD = /^erp_analysis\.[a-zA-Z0-9_.]+$/;

export function assertSafeErpAnalysisMethod(method: unknown): string {
  const m = String(method || "").trim();
  if (!ALLOWED_METHOD.test(m)) {
    throw new Error("Unsupported API method");
  }
  return m;
}

function unwrapMessage(response: unknown): any {
  if (!response || typeof response !== "object") return response;
  if ("message" in response) return (response as any).message ?? response;
  return response;
}

/**
 * Fetch report list for a bootstrap module config.
 * GET /api/method/{api_method}?limit=
 */
export async function fetchReportList(config?: Record<string, unknown> | null): Promise<MyReportsPayload> {
  const method = assertSafeErpAnalysisMethod(config?.api_method);
  const limit = Number(config?.limit) > 0 ? Number(config?.limit) : 30;
  const url = `/api/method/${method}`;
  try {
    const response = await http.get(url, { limit });
    const payload = unwrapMessage(response);
    const reportsRaw = Array.isArray(payload?.reports)
      ? payload.reports
      : Array.isArray(payload)
        ? payload
        : [];
    const reports: MyReportRow[] = reportsRaw.map((r: any, i: number) => ({
      id: String(r?.id || r?.name || r?.title || `report_${i}`),
      title: String(r?.title || r?.name || r?.id || "Report"),
      module: r?.module != null ? String(r.module) : undefined,
      ref_doctype:
        r?.ref_doctype != null ? String(r.ref_doctype) : undefined,
      report_type:
        r?.report_type != null ? String(r.report_type) : undefined,
    }));
    return {
      company: payload?.company != null ? String(payload.company) : undefined,
      reports,
      count: Number(payload?.count) || reports.length,
    };
  } catch (e) {
    logger.warn("fetchReportList failed", { method, error: e });
    throw e;
  }
}
