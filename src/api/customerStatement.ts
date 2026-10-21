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
import {
  extractFrappeErrorMessage,
  isBaPermissionDeniedError,
  isMissingBaMethodError,
} from "./baErrors";
import { logger } from "../utils/logger";
import type { StatementSoaBranding } from "./statementSoaBranding";
import { brandingFromStatementRoot } from "./statementSoaBranding";

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
  /** Display name for SOA “Bill To” (when different from customer id). */
  customer_display_name?: string;
  customer_address_lines?: string[];
  /** Letterhead / footer from get_customer_statement when server sends it. */
  branding?: Partial<StatementSoaBranding>;
  meta?: {
    source?: "ba" | "frappe";
    /** e.g. outstanding_invoices — server PDF / desk SOA scope */
    statement_scope?: string;
    print_format?: string;
    requested_from_date?: string;
    requested_to_date?: string;
  };
};

const STATEMENT_PATHS = [
  ERP_ANALYSIS.receivables.getCustomerStatement,
  "/api/method/printechs_utility.receivables.get_customer_statement",
] as const;

import { parseStatementLineOutstanding } from "../utils/statementLineUtils";

export { parseStatementLineOutstanding };

/** Desk SOA running balance column (cumulative), when server sends it. */
export function parseStatementRunningBalance(it: unknown): number | null {
  if (!it || typeof it !== "object") return null;
  const raw = it as Record<string, unknown>;
  for (const key of ["balance", "running_balance", "cumulative_balance"]) {
    const n = Number(raw[key]);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export function parseStatementLineAmount(it: unknown): number {
  if (!it || typeof it !== "object") return 0;
  const raw = it as Record<string, unknown>;
  const n = Number(
    raw.amount ?? raw.grand_total ?? raw.invoice_amount ?? raw.debit ?? raw.credit
  );
  return Number.isFinite(n) ? n : 0;
}

/** Full open-AR SOA — server must not filter by calendar year for outstanding lines. */
export function defaultStatementFromDate(): string {
  const y = new Date().getFullYear();
  return `${y - 15}-01-01`;
}

function sumLineOutstanding(items: CustomerStatementLine[]): number {
  return items.reduce((s, l) => s + parseStatementLineOutstanding(l), 0);
}

/** Normalize desk / API dates to ISO yyyy-mm-dd for comparisons. */
export function parseFlexibleIsoDate(raw: unknown): string | null {
  const s = String(raw || "").trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const dmy = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmy) {
    const d = dmy[1].padStart(2, "0");
    const m = dmy[2].padStart(2, "0");
    return `${dmy[3]}-${m}-${d}`;
  }
  return null;
}

function isBeforeAsOf(dateIso: string | null, asOfIso: string): boolean {
  if (!dateIso || asOfIso.length < 10 || dateIso.length < 10) return false;
  return dateIso < asOfIso.slice(0, 10);
}

/** Sum open invoice outstanding with due date before as-of (excludes credits). */
export function computeStatementOverdueFromItems(
  items: unknown[] | undefined,
  asOf: string
): number {
  if (!Array.isArray(items)) return 0;
  const ref = parseFlexibleIsoDate(asOf) || String(asOf || "").trim().slice(0, 10);
  return items.reduce((acc: number, it) => {
    const amt = parseStatementLineOutstanding(it);
    if (amt <= 0) return acc;
    const row = it as Record<string, unknown>;
    if (row.is_overdue === true || row.is_overdue === 1 || row.overdue_flag) {
      return acc + amt;
    }
    const dueIso =
      parseFlexibleIsoDate(row.due_date) ??
      parseFlexibleIsoDate(row.posting_date) ??
      parseFlexibleIsoDate(row.posting);
    if (dueIso && isBeforeAsOf(dueIso, ref)) {
      return acc + amt;
    }
    return acc;
  }, 0);
}

export function reconcileStatementOverdue(
  totalOutstanding: number | null | undefined,
  totalOverdueFromServer: number | null | undefined,
  overdueFromItems: number
): number | null {
  const o = totalOutstanding != null ? Number(totalOutstanding) : null;
  const serverOd =
    totalOverdueFromServer != null &&
    Number.isFinite(Number(totalOverdueFromServer))
      ? Number(totalOverdueFromServer)
      : null;
  let od = overdueFromItems;
  if (serverOd != null && serverOd > 0) {
    od = serverOd;
  } else if (serverOd === 0 && overdueFromItems > 0) {
    od = overdueFromItems;
  } else if (serverOd === 0 && overdueFromItems === 0) {
    od = 0;
  }
  if (o != null && o >= 0 && od > o) {
    od = overdueFromItems > 0 && overdueFromItems <= o ? overdueFromItems : o;
  }
  return Number.isFinite(od) ? od : null;
}

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
    ? itemsRaw.map((it: any) => {
        const outstanding = parseStatementLineOutstanding(it);
        return {
          invoice: String(it.invoice || it.name || it.voucher_no || ""),
          posting_date: it.posting_date || it.posting || undefined,
          due_date: it.due_date || undefined,
          amount: parseStatementLineAmount(it),
          outstanding,
          outstanding_amount: outstanding,
        };
      })
    : [];

  const openItems = items.filter((l) => parseStatementLineOutstanding(l) !== 0);

  const total_invoiced =
    Number((root as any).total_invoiced ?? (root as any).invoiced) ||
    items.reduce((s, l) => s + (l.amount || 0), 0);
  const serverTotal = Number(
    (root as any).total_outstanding ??
      (root as any).outstanding ??
      (root as any).customer_outstanding
  );
  const sumOpen = sumLineOutstanding(openItems);
  let total_outstanding = Number.isFinite(serverTotal) && serverTotal !== 0
    ? serverTotal
    : sumOpen;
  if (
    Number.isFinite(serverTotal) &&
    serverTotal > 0 &&
    sumOpen > 0 &&
    Math.abs(serverTotal - sumOpen) / serverTotal > 0.02
  ) {
    total_outstanding = serverTotal;
    if (__DEV__) {
      console.warn("[customer-statement] Line outstanding sum ≠ server total", {
        serverTotal,
        sumOpen,
      });
    }
  } else if (!Number.isFinite(serverTotal) || serverTotal === 0) {
    total_outstanding = sumOpen;
  }

  const r = root as Record<string, unknown>;
  const billName = String(
    r.customer_display_name || r.customer_name || r.party_name || ""
  ).trim();
  let customer_address_lines: string[] | undefined;
  const addrRaw = r.customer_address ?? r.billing_address ?? r.address;
  if (typeof addrRaw === "string" && addrRaw.trim()) {
    customer_address_lines = addrRaw
      .split(/\n|<br\s*\/?>/i)
      .map((l) => l.replace(/<[^>]+>/g, "").trim())
      .filter(Boolean);
  } else if (Array.isArray(r.address_lines)) {
    customer_address_lines = (r.address_lines as unknown[])
      .map(String)
      .filter(Boolean);
  }

  const embeddedBranding = brandingFromStatementRoot(raw);
  const scope = String(
    r.statement_pdf_scope ?? r.statement_scope ?? ""
  ).trim();
  const printFormat = String(r.print_format ?? "").trim();
  const reqPeriod =
    r.requested_period && typeof r.requested_period === "object"
      ? (r.requested_period as Record<string, unknown>)
      : null;

  return {
    customer: String(r.customer || customer),
    from_date: String(r.from_date || from_date),
    to_date: String(r.to_date || to_date),
    total_invoiced,
    total_outstanding,
    items,
    customer_display_name: billName || undefined,
    customer_address_lines,
    branding: embeddedBranding || undefined,
    meta: {
      source: "ba",
      ...(scope ? { statement_scope: scope } : {}),
      ...(printFormat ? { print_format: printFormat } : {}),
      ...(reqPeriod?.from_date
        ? { requested_from_date: String(reqPeriod.from_date) }
        : {}),
      ...(reqPeriod?.to_date
        ? { requested_to_date: String(reqPeriod.to_date) }
        : {}),
    },
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

  const openItems = items.filter((l) => parseStatementLineOutstanding(l) !== 0);
  const total_invoiced = items.reduce((s, l) => s + l.amount, 0);
  const total_outstanding = openItems.reduce(
    (s, l) => s + parseStatementLineOutstanding(l),
    0
  );

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
  const status = (error as { response?: { status?: number } })?.response?.status;
  const frappeMsg = extractFrappeErrorMessage(error);
  const data = (error as { response?: { data?: unknown } })?.response?.data as
    | Record<string, unknown>
    | undefined;
  const excType = String(data?.exc_type || "");
  const exception = String(data?.exception || "");
  if (
    excType.includes("DoesNotExist") ||
    exception.includes("DoesNotExist")
  ) {
    return "Customer record not found on the server. Open the customer in ERPNext and try again from Customer 360.";
  }
  if (frappeMsg && !frappeMsg.includes("status code")) {
    return frappeMsg;
  }
  if (status === 417) {
    if (isMissingBaMethodError(error)) {
      return (
        "Statement email is not enabled on this server yet. Ask your admin to deploy " +
        "printechs_utility.customer_notifications.send_statement_pdf (or erp_analysis equivalent) and restart the site."
      );
    }
    return (
      "The server rejected the statement email request (HTTP 417). " +
      "Common causes: API not whitelisted, wrong parameter names, or missing email on the Customer record."
    );
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
  const today = new Date();
  const toIso = (d: Date) => d.toISOString().slice(0, 10);
  const from_date = `${today.getFullYear()}-01-01`;
  const to_date = toIso(today);
  // Postman contract: customer_name + optional company. Try minimal bodies first —
  // some sites 417 when both customer and customer_name are sent.
  const payloads: Record<string, unknown>[] = [
    filterBaParams({ customer_name: party, company }, cfg),
    filterBaParams({ customer: party, company }, cfg),
    filterBaParams(
      { customer_name: party, company, from_date, to_date },
      cfg
    ),
    filterBaParams({ customer: party, customer_name: party, company }, cfg),
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
        if (status === 404 || status === 417) continue;
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
  const from_date = params.from_date || defaultStatementFromDate();
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
      customer_name: customer,
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
      if (normalized) {
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
