/**
 * Customer statement — BA API with Frappe Sales Invoice fallback when Access Profile 403s.
 */

import { http } from "./http";
import { useAuthStore } from "../store/auth";
import { oauthApi } from "./oauth";
import { ERP_ANALYSIS } from "./endpoints";
import {
  filterBaParams,
  resolveCompanyName,
  unwrapFrappeMessage,
} from "./apiResilience";
import { isBaPermissionDeniedError } from "./baErrors";
import { logger } from "../utils/logger";

export type CustomerStatementLine = {
  invoice: string;
  posting_date?: string;
  due_date?: string;
  amount: number;
  outstanding: number;
  outstanding_amount?: number;
};

export type CustomerStatementData = {
  customer: string;
  from_date: string;
  to_date: string;
  total_invoiced: number;
  total_outstanding: number;
  items: CustomerStatementLine[];
  meta?: { source?: "ba" | "frappe" };
};

const STATEMENT_PATHS = [
  ERP_ANALYSIS.receivables.getCustomerStatement,
  "/api/method/printechs_utility.receivables.get_customer_statement",
] as const;

function normalizeStatementPayload(
  raw: unknown,
  customer: string,
  from_date: string,
  to_date: string
): CustomerStatementData | null {
  const root =
    raw && typeof raw === "object" && "message" in (raw as object)
      ? (raw as any).message
      : raw;
  if (!root || typeof root !== "object") return null;

  const itemsRaw = (root as any).items;
  const items: CustomerStatementLine[] = Array.isArray(itemsRaw)
    ? itemsRaw.map((it: any) => ({
        invoice: String(it.invoice || it.name || it.voucher_no || ""),
        posting_date: it.posting_date || it.posting || undefined,
        due_date: it.due_date || undefined,
        amount: Number(it.amount ?? it.grand_total ?? it.invoice_amount) || 0,
        outstanding:
          Number(it.outstanding ?? it.outstanding_amount ?? it.balance) || 0,
        outstanding_amount:
          Number(it.outstanding_amount ?? it.outstanding) || 0,
      }))
    : [];

  const total_invoiced =
    Number((root as any).total_invoiced ?? (root as any).invoiced) ||
    items.reduce((s, l) => s + (l.amount || 0), 0);
  const total_outstanding =
    Number(
      (root as any).total_outstanding ??
        (root as any).outstanding ??
        (root as any).customer_outstanding
    ) ||
    items.reduce((s, l) => s + (l.outstanding || 0), 0);

  return {
    customer: String((root as any).customer || customer),
    from_date: String((root as any).from_date || from_date),
    to_date: String((root as any).to_date || to_date),
    total_invoiced,
    total_outstanding,
    items,
    meta: { source: "ba" },
  };
}

export async function fetchCustomerStatementFromInvoices(params: {
  customer: string;
  company?: string;
  from_date: string;
  to_date: string;
}): Promise<CustomerStatementData> {
  http.setBaseUrl(useAuthStore.getState().serverConfig.serverUrl);
  const token = await oauthApi.getValidToken();
  if (!token) throw new Error("No valid access token available");

  const filters: unknown[] = [
    ["customer", "=", params.customer],
    ["docstatus", "=", 1],
    ["posting_date", ">=", params.from_date],
    ["posting_date", "<=", params.to_date],
  ];
  if (params.company) {
    filters.push(["company", "=", params.company]);
  }

  const res = await http.get<any>(
    "/api/method/frappe.client.get_list",
    {
      doctype: "Sales Invoice",
      fields: JSON.stringify([
        "name",
        "posting_date",
        "due_date",
        "grand_total",
        "base_grand_total",
        "outstanding_amount",
        "base_outstanding_amount",
      ]),
      filters: JSON.stringify(filters),
      limit_page_length: 500,
      order_by: "posting_date asc",
    },
    { silentError: true }
  );

  const raw = unwrapFrappeMessage(res);
  const rows = Array.isArray(raw)
    ? raw
    : Array.isArray(res?.message)
      ? res.message
      : [];

  const items: CustomerStatementLine[] = rows.map((row: any) => {
    const amount =
      Number(row.base_grand_total ?? row.grand_total) || 0;
    const outstanding =
      Number(row.base_outstanding_amount ?? row.outstanding_amount) || 0;
    return {
      invoice: String(row.name || ""),
      posting_date: row.posting_date || undefined,
      due_date: row.due_date || undefined,
      amount,
      outstanding,
      outstanding_amount: outstanding,
    };
  });

  const openItems = items.filter((l) => l.outstanding > 0);
  const total_invoiced = items.reduce((s, l) => s + l.amount, 0);
  const total_outstanding = openItems.reduce((s, l) => s + l.outstanding, 0);

  return {
    customer: params.customer,
    from_date: params.from_date,
    to_date: params.to_date,
    total_invoiced,
    total_outstanding,
    items: openItems,
    meta: { source: "frappe" },
  };
}

const SEND_STATEMENT_PATHS = [
  "/api/method/erp_analysis.customer_notifications.send_statement_pdf",
  "/api/method/printechs_utility.customer_notifications.send_statement_pdf",
] as const;

function parseSendStatementError(error: unknown): string {
  const data = (error as { response?: { data?: unknown } })?.response?.data as
    | Record<string, unknown>
    | undefined;
  const excType = String(data?.exc_type || "");
  const exception = String(data?.exception || "");
  if (
    excType.includes("DoesNotExist") ||
    exception.includes("DoesNotExist")
  ) {
    return "Customer record not found on the server. The app will use the ERP customer ID — try again from Customer 360 or search.";
  }
  const msg = String(data?.message || (error as Error)?.message || "").trim();
  if (msg && msg !== "Request failed with status code 403") return msg;
  return "Failed to send statement via email. Please try again.";
}

export async function sendCustomerStatementEmail(params: {
  customer: string;
  company?: string;
}): Promise<unknown> {
  const { resolveCustomerParty } = await import("./customer360");
  const party = await resolveCustomerParty(params.customer);
  if (!party) throw new Error("Customer is required");

  const state = useAuthStore.getState();
  const company =
    params.company ||
    resolveCompanyName(state.permissions.scope?.company, state.user?.company);

  http.setBaseUrl(state.serverConfig.serverUrl);
  const token = await oauthApi.getValidToken();
  if (!token) throw new Error("No valid access token available");

  const cfg = state.mobileConfig;
  const payloads: Record<string, unknown>[] = [
    filterBaParams({ customer: party, customer_name: party, company }, cfg),
    filterBaParams({ customer_name: party, company }, cfg),
    filterBaParams({ customer: party, company }, cfg),
  ];

  let lastError: unknown;
  for (const path of SEND_STATEMENT_PATHS) {
    for (const body of payloads) {
      try {
        const response = await http.post<unknown>(path, body, {
          silentError: true,
        });
        return (response as { message?: unknown })?.message ?? response;
      } catch (error) {
        lastError = error;
        const status = (error as { response?: { status?: number } })?.response
          ?.status;
        if (status === 404) continue;
      }
    }
  }

  throw new Error(parseSendStatementError(lastError));
}

export async function fetchCustomerStatement(params: {
  customer: string;
  company?: string;
  from_date?: string;
  to_date?: string;
}): Promise<CustomerStatementData> {
  const state = useAuthStore.getState();
  const cfg = state.mobileConfig;
  const customer = String(params.customer || "").trim();
  if (!customer) throw new Error("Customer is required");

  const today = new Date();
  const toIso = (d: Date) => d.toISOString().slice(0, 10);
  const from_date =
    params.from_date || `${today.getFullYear()}-01-01`;
  const to_date = params.to_date || toIso(today);
  const company =
    params.company ||
    resolveCompanyName(state.permissions.scope?.company, state.user?.company);

  http.setBaseUrl(state.serverConfig.serverUrl);
  const token = await oauthApi.getValidToken();
  if (!token) throw new Error("No valid access token available");

  const query = filterBaParams(
    {
      customer,
      company,
      from_date,
      to_date,
    },
    cfg
  );

  let lastError: unknown;
  for (const path of STATEMENT_PATHS) {
    try {
      const response = await http.get<unknown>(path, query, {
        silentError: true,
      });
      const normalized = normalizeStatementPayload(
        response,
        customer,
        from_date,
        to_date
      );
      if (normalized && (normalized.items.length || normalized.total_outstanding)) {
        return normalized;
      }
    } catch (error) {
      lastError = error;
      const status = (error as { response?: { status?: number } })?.response
        ?.status;
      if (status === 403 || isBaPermissionDeniedError(error)) {
        logger.info(
          `[customer-statement] ${path} denied — trying fallback`
        );
        break;
      }
      if (status === 404) continue;
    }
  }

  try {
    logger.info(
      "[customer-statement] Building from Sales Invoice list (Frappe fallback)"
    );
    return await fetchCustomerStatementFromInvoices({
      customer,
      company,
      from_date,
      to_date,
    });
  } catch (fallbackErr) {
    if (isBaPermissionDeniedError(lastError)) {
      throw new Error(
        "Statement is not enabled on your Access Profile. Ask admin to allow receivables / customer statement."
      );
    }
    throw fallbackErr;
  }
}
