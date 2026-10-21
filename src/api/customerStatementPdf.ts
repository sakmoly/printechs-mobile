/**
 * Fetch customer statement PDF from BA / printechs_utility for native share (WhatsApp, etc.).
 */

import {
  cacheDirectory,
  downloadAsync,
  getInfoAsync,
  readAsStringAsync,
  writeAsStringAsync,
  EncodingType,
} from "expo-file-system/legacy";
import {
  filterBaParams,
  pickBaParams,
  resolveCompanyName,
  unwrapFrappeMessage,
} from "./apiResilience";
import type { Customer360StatementPdfHint } from "./customer360Types";
import { extractFrappeErrorMessage, isMissingBaMethodError } from "./baErrors";
import { oauthApi } from "./oauth";
import { resolveServerBaseUrl } from "./serverUrl";
import { useAuthStore } from "../store/auth";
import { http } from "./http";
import { resolveCustomerParty } from "./customer360";
import {
  defaultStatementFromDate,
  fetchCustomerStatement,
} from "./customerStatement";
import { parseStatementLineOutstanding } from "../utils/statementLineUtils";
import { ERP_ANALYSIS } from "./endpoints";
import { generateLocalStatementPdfFile } from "../utils/statementPdfLocal";
import { pdfLikelyHasStatementBody } from "../utils/statementPdfValidate";

const DESK_PRINT_FORMAT = "Customer Outstanding SOA";

/** WhatsApp SOA = desk PDF only unless explicitly allowed (dev / offline). */
function allowLocalStatementPdfFallback(): boolean {
  return process.env.EXPO_PUBLIC_SOA_PDF_ALLOW_LOCAL === "1";
}

export const STATEMENT_PDF_SERVER_REQUIRED_MESSAGE =
  "Could not download the official statement PDF from ERP. WhatsApp share uses the same Print Format as desktop for every customer. Ask IT to enable get_statement_pdf (Customer Outstanding SOA) on your Access Profile and confirm it works for this customer in Postman.";

const GET_STATEMENT_PDF_PATHS = [
  "/api/method/erp_analysis.customer_notifications.get_statement_pdf",
  "/api/method/printechs_utility.customer_notifications.get_statement_pdf",
] as const;

const SEND_STATEMENT_PDF_PATHS = [
  "/api/method/erp_analysis.customer_notifications.send_statement_pdf",
  "/api/method/printechs_utility.customer_notifications.send_statement_pdf",
] as const;

export type CustomerStatementPdfParams = {
  customer: string;
  /** When Customer 360 already resolved the ERP Customer name, skip search_customers. */
  resolvedCustomer?: string;
  company?: string;
  from_date?: string;
  to_date?: string;
  /** Customer display name — sent as alternate customer_name for server PDF. */
  customerDisplayName?: string;
  /** From get_customer_360.statement (backend contract after SOA PDF fix). */
  statementPdfHint?: Customer360StatementPdfHint | null;
  /** When true, reject header-only PDFs and try other payloads / clear cache. */
  expectOpenStatementLines?: boolean;
  /** Skip session cache (e.g. after backend deploy). */
  bypassPdfCache?: boolean;
};

const PDF_API_TIMEOUT_MS = 120_000;
/** Re-share same customer/date without re-hitting ERP. */
const STATEMENT_PDF_CACHE_MS = 15 * 60 * 1000;
/** Bump when PDF accept rules change (invalidates stale letterhead-only cache). */
const STATEMENT_PDF_CACHE_VERSION = "v7";

type CachedStatementPdf = {
  uri: string;
  filename: string;
  cachedAt: number;
  serverSoaVerified?: boolean;
};
const statementPdfCache = new Map<string, CachedStatementPdf>();

export function clearStatementPdfSessionCache(): void {
  statementPdfCache.clear();
}

function statementPdfCacheKey(
  party: string,
  company: string | undefined,
  toDate: string
): string {
  return `${STATEMENT_PDF_CACHE_VERSION}\0${party}\0${company || ""}\0${toDate}`;
}

const GET_PDF_PARAM_KEYS = [
  "customer_name",
  "customer",
  "company",
  "from_date",
  "to_date",
  "print_format",
] as const;

function isStatementPdfMethodId(methodId: string): boolean {
  const lower = methodId.toLowerCase();
  return (
    lower.includes("get_statement_pdf") || lower.includes("send_statement_pdf")
  );
}

function methodPathFromHint(hint?: Customer360StatementPdfHint | null): string[] {
  const paths: string[] = [];
  // Do not use hint.method — that is often get_customer_statement (JSON), not PDF.
  for (const raw of [hint?.pdf_method, hint?.pdf_share_method]) {
    const m = String(raw || "").trim();
    if (!m || !isStatementPdfMethodId(m)) continue;
    if (m.startsWith("/api/method/")) paths.push(m);
    else if (m.includes(".")) paths.push(`/api/method/${m}`);
  }
  return paths;
}

/** ERP PDF methods expect customer_name — not Frappe `party` kwargs. */
function normalizeServerStatementPdfParams(
  raw: Record<string, unknown> | undefined | null,
  resolvedCustomer: string
): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, unknown> = { ...raw };
  if (
    out.party != null &&
    out.party !== "" &&
    out.customer_name == null &&
    out.customer == null
  ) {
    out.customer_name = out.party;
  }
  delete out.party;
  delete out.party_type;
  delete out.party_name;
  if (!out.customer_name && !out.customer && resolvedCustomer) {
    out.customer_name = resolvedCustomer;
  }
  return out;
}

function dedupePdfPayloads(
  payloads: Record<string, unknown>[]
): Record<string, unknown>[] {
  const seen = new Set<string>();
  const out: Record<string, unknown>[] = [];
  for (const p of payloads) {
    const key = JSON.stringify(p);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

function buildMinimalGetPdfPayloads(
  resolvedCustomer: string,
  company: string | undefined,
  range: { from_date: string; to_date: string },
  cfg: ReturnType<typeof useAuthStore.getState>["mobileConfig"],
  opts?: { displayLabel?: string; serverParams?: Record<string, unknown> }
): Record<string, unknown>[] {
  const label = String(opts?.displayLabel || resolvedCustomer).trim();
  const out: Record<string, unknown>[] = [];
  const serverRaw = normalizeServerStatementPdfParams(
    opts?.serverParams,
    resolvedCustomer
  );
  if (Object.keys(serverRaw).length) {
    const pdfKwargs = {
      send_email: 0,
      return_pdf: true,
      return_file_url: true,
    };
    out.push(
      filterBaParams(
        {
          print_format: DESK_PRINT_FORMAT,
          ...serverRaw,
          ...pdfKwargs,
        },
        cfg
      )
    );
    out.push(
      filterBaParams(
        {
          print_format: DESK_PRINT_FORMAT,
          ...range,
          ...serverRaw,
          ...pdfKwargs,
        },
        cfg
      )
    );
  }
  const bases = [
    {
      customer_name: resolvedCustomer,
      company,
      ...range,
      print_format: DESK_PRINT_FORMAT,
    },
    { customer_name: label, company, ...range, print_format: DESK_PRINT_FORMAT },
    {
      customer: resolvedCustomer,
      customer_name: resolvedCustomer,
      company,
      ...range,
    },
  ];
  for (const b of bases) {
    out.push(pickBaParams(b, [...GET_PDF_PARAM_KEYS], cfg));
  }
  return dedupePdfPayloads(out);
}

function statementDateRange(params: CustomerStatementPdfParams): {
  from_date: string;
  to_date: string;
} {
  const today = new Date();
  const toIso = (d: Date) => d.toISOString().slice(0, 10);
  return {
    from_date: params.from_date || defaultStatementFromDate(),
    to_date: params.to_date || toIso(today),
  };
}

function buildStatementPdfPayloads(
  party: string,
  company: string | undefined,
  cfg: ReturnType<typeof useAuthStore.getState>["mobileConfig"],
  range: { from_date: string; to_date: string },
  opts?: { displayLabel?: string }
): Record<string, unknown>[] {
  const label = String(opts?.displayLabel || party).trim();
  const core = { company, ...range, print_format: DESK_PRINT_FORMAT };
  const noEmail = {
    send_email: 0,
    skip_email: 1,
    email: "",
    return_pdf: true,
    return_file_url: true,
    delivery: "download",
  };
  const variants = [
    { customer_name: party, customer: party, ...core },
    { customer_name: label, customer: party, ...core },
    { customer: party, customer_name: party, ...core },
    { customer_name: party, company, ...range },
    { customer_name: label, company, ...range },
  ];
  const out: Record<string, unknown>[] = [];
  for (const v of variants) {
    out.push(filterBaParams({ ...v, ...noEmail }, cfg));
    out.push(filterBaParams({ ...v, send_email: false, return_pdf: true }, cfg));
    out.push(filterBaParams({ ...v, send_email: 0, return_file_url: true }, cfg));
    out.push(filterBaParams({ ...v, delivery: "download" }, cfg));
    out.push(filterBaParams(v, cfg));
  }
  return out;
}

function looksLikePdfPath(value: string): boolean {
  const s = value.trim().toLowerCase();
  return (
    s.endsWith(".pdf") ||
    s.includes("/files/") ||
    s.includes("/private/files/") ||
    s.includes("download_file")
  );
}

function pickPdfUrlFromValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const s = value.trim();
  if (!s) return null;
  if (looksLikePdfPath(s) || s.startsWith("http://") || s.startsWith("https://")) {
    return s;
  }
  return null;
}

function scorePdfUrlCandidate(url: string): number {
  const lower = url.toLowerCase();
  let score = 0;
  if (lower.includes("statement")) score += 12;
  if (lower.includes("soa")) score += 8;
  if (lower.includes("outstanding")) score += 6;
  if (lower.endsWith(".pdf")) score += 2;
  if (lower.includes("letter_head") || lower.includes("letterhead")) score -= 30;
  if (lower.includes("letter%20head")) score -= 30;
  if (lower.includes("/logo") || lower.includes("letter-head")) score -= 20;
  return score;
}

function pickBestPdfUrl(candidates: string[]): string | null {
  const unique = [...new Set(candidates.map((u) => u.trim()).filter(Boolean))];
  if (!unique.length) return null;
  const ranked = unique
    .map((url) => ({ url, score: scorePdfUrlCandidate(url) }))
    .sort((a, b) => b.score - a.score);
  return ranked[0]?.url ?? null;
}

function collectPdfUrlsInTree(obj: unknown, depth = 0, acc: string[] = []): string[] {
  if (depth > 8 || obj == null) return acc;
  if (typeof obj === "string") {
    const hit = pickPdfUrlFromValue(obj);
    if (hit) acc.push(hit);
    return acc;
  }
  if (typeof obj !== "object") return acc;
  const record = obj as Record<string, unknown>;

  for (const key of [
    "file_url",
    "pdf_url",
    "statement_pdf_url",
    "download_url",
    "absolute_url",
  ]) {
    const hit = pickPdfUrlFromValue(record[key]);
    if (hit) acc.push(hit);
  }
  for (const key of ["url", "file", "file_name"]) {
    const hit = pickPdfUrlFromValue(record[key]);
    if (hit) acc.push(hit);
  }

  for (const v of Object.values(record)) {
    collectPdfUrlsInTree(v, depth + 1, acc);
  }
  return acc;
}

function findPdfUrlInTree(obj: unknown): string | null {
  return pickBestPdfUrl(collectPdfUrlsInTree(obj));
}

function isTruthyServerFlag(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (typeof value === "string") {
    const t = value.trim().toLowerCase();
    return t === "true" || t === "1" || t === "yes";
  }
  return false;
}

/** ERP confirms SOA rows in PDF (compressed PDFs may not expose text to mobile). */
export function parseSoaPdfServerVerified(obj: unknown): boolean {
  const root = unwrapFrappeMessage(obj);
  if (!root || typeof root !== "object") return false;

  const recordHasSoaFlag = (r: Record<string, unknown>): boolean =>
    isTruthyServerFlag(r.soa_body_present) ||
    isTruthyServerFlag(r.soa_pdf_verified);

  const r = root as Record<string, unknown>;
  if (recordHasSoaFlag(r)) return true;

  const message = r.message;
  if (message && typeof message === "object" && !Array.isArray(message)) {
    return recordHasSoaFlag(message as Record<string, unknown>);
  }
  return false;
}

function normalizePdfBase64(raw: string): string {
  return String(raw || "")
    .replace(/^data:application\/pdf;base64,/i, "")
    .replace(/\s/g, "");
}

function isPdfBase64(raw: string): boolean {
  const cleaned = normalizePdfBase64(raw);
  return cleaned.length > 200 && cleaned.startsWith("JVBERi0");
}

function findPdfBase64(obj: unknown): string | null {
  const root = unwrapFrappeMessage(obj);
  if (!root || typeof root !== "object") return null;
  const r = root as Record<string, unknown>;
  for (const key of [
    "pdf_base64",
    "file_base64",
    "content",
    "pdf",
    "data",
    "filedata",
  ]) {
    const v = r[key];
    if (typeof v === "string" && isPdfBase64(v)) return v;
  }
  const nested = r.message;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    return findPdfBase64({ message: nested });
  }
  return null;
}

async function pdfFileByteSize(uri: string): Promise<number> {
  const info = await getInfoAsync(uri);
  if (!info.exists) return 0;
  const sized = info as { size?: number };
  return typeof sized.size === "number" ? sized.size : 0;
}

/** First bytes of a PDF are %PDF — base64 prefix JVBERi0. */
async function isPdfFileUri(uri: string): Promise<boolean> {
  try {
    const head = await readAsStringAsync(uri, {
      encoding: EncodingType.Base64,
    });
    return head.startsWith("JVBERi0");
  } catch {
    return false;
  }
}

function toAbsoluteFileUrl(serverUrl: string, pathOrUrl: string): string {
  const t = pathOrUrl.trim();
  if (t.startsWith("http://") || t.startsWith("https://")) return t;
  const base = resolveServerBaseUrl(serverUrl).replace(/\/$/, "");
  if (t.startsWith("/")) return `${base}${t}`;
  return `${base}/${t}`;
}

/** Frappe private files often need the download_file helper with Bearer auth. */
function frappeDownloadUrl(serverUrl: string, fileUrl: string): string {
  const absolute = toAbsoluteFileUrl(serverUrl, fileUrl);
  if (absolute.includes("/api/method/")) return absolute;
  const base = resolveServerBaseUrl(serverUrl).replace(/\/$/, "");
  const path = fileUrl.startsWith("http")
    ? fileUrl.replace(/^https?:\/\/[^/]+/i, "")
    : fileUrl.startsWith("/")
      ? fileUrl
      : `/${fileUrl}`;
  return `${base}/api/method/frappe.utils.file_manager.download_file?file_url=${encodeURIComponent(path)}`;
}

function sanitizeFilenamePart(raw: string): string {
  return String(raw || "customer")
    .replace(/[^\w.-]+/g, "_")
    .slice(0, 48);
}

async function writeBase64PdfToCache(
  base64: string,
  filename: string
): Promise<string> {
  if (!cacheDirectory) {
    throw new Error("Device storage is not available for PDF download.");
  }
  const uri = `${cacheDirectory}${filename}`;
  const cleaned = normalizePdfBase64(base64);
  await writeAsStringAsync(uri, cleaned, { encoding: EncodingType.Base64 });
  return uri;
}

async function downloadPdfToCache(
  downloadUrl: string,
  filename: string,
  token: string
): Promise<string> {
  if (!cacheDirectory) {
    throw new Error("Device storage is not available for PDF download.");
  }
  const dest = `${cacheDirectory}${filename}`;
  const result = await downloadAsync(downloadUrl, dest, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`PDF download failed (HTTP ${result.status}).`);
  }
  return result.uri;
}

async function downloadStatementPdfFromUrl(
  serverUrl: string,
  fileUrl: string,
  filename: string,
  token: string
): Promise<string | null> {
  const attempts = [
    frappeDownloadUrl(serverUrl, fileUrl),
    toAbsoluteFileUrl(serverUrl, fileUrl),
  ];
  const seen = new Set<string>();
  for (const downloadUrl of attempts) {
    if (seen.has(downloadUrl)) continue;
    seen.add(downloadUrl);
    try {
      const uri = await downloadPdfToCache(downloadUrl, filename, token);
      if (await isPdfFileUri(uri)) return uri;
    } catch {
      /* try next URL */
    }
  }
  return null;
}

type MaterializedPdf = {
  uri: string;
  bytes: number;
  source: string;
  fileUrl?: string;
  /** From get_statement_pdf message.soa_body_present / soa_pdf_verified. */
  serverSoaVerified?: boolean;
};

function shouldAcceptStatementPdf(bytes: number, fileUrl?: string | null): boolean {
  const urlScore = fileUrl ? scorePdfUrlCandidate(fileUrl) : 0;
  if (urlScore <= -15) return false;
  if (urlScore >= 8) return true;
  return bytes >= 6_000;
}

function notePdfFetchFailure(
  last: { path: string; detail: string } | null,
  path: string,
  error: unknown
): { path: string; detail: string } {
  const status = (error as { response?: { status?: number } })?.response?.status;
  if (isMissingBaMethodError(error) || status === 417) {
    return { path, detail: "HTTP 417 — method missing or kwargs stripped" };
  }
  if (status === 403) {
    return { path, detail: "HTTP 403 — not on Access Profile / permission" };
  }
  if (status === 404) {
    return { path, detail: "HTTP 404 — method not found" };
  }
  const msg = extractFrappeErrorMessage(error);
  return {
    path,
    detail: msg ? `${status ?? "?"}: ${msg}` : `HTTP ${status ?? "error"}`,
  };
}

async function materializePdfCandidate(
  ref: { base64?: string; downloadUrl?: string },
  filename: string,
  serverUrl: string,
  token: string,
  source: string,
  serverSoaVerified = false
): Promise<MaterializedPdf | null> {
  const fileUrl = ref.downloadUrl?.trim() || undefined;
  const verified = { serverSoaVerified: serverSoaVerified || undefined };
  if (ref.base64 && isPdfBase64(ref.base64)) {
    const uri = await writeBase64PdfToCache(ref.base64, filename);
    if (await isPdfFileUri(uri)) {
      const bytes = await pdfFileByteSize(uri);
      return { uri, bytes, source, fileUrl, ...verified };
    }
  }
  if (fileUrl) {
    const uri = await downloadStatementPdfFromUrl(
      serverUrl,
      fileUrl,
      filename,
      token
    );
    if (uri) {
      const bytes = await pdfFileByteSize(uri);
      return { uri, bytes, source, fileUrl, ...verified };
    }
  }
  return null;
}

function buildStatementPdfPathOrder(
  hint?: Customer360StatementPdfHint | null
): string[] {
  const out: string[] = [];
  const add = (path: string) => {
    const p = String(path || "").trim();
    if (p && !out.includes(p)) out.push(p);
  };
  for (const p of methodPathFromHint(hint)) add(p);
  add(ERP_ANALYSIS.customerNotifications.getStatementPdf);
  add(GET_STATEMENT_PDF_PATHS[0]);
  add(GET_STATEMENT_PDF_PATHS[1]);
  return out;
}

async function postStatementPdfOnce(
  path: string,
  body: Record<string, unknown>,
  filename: string,
  serverUrl: string,
  token: string,
  source: string
): Promise<MaterializedPdf | null> {
  if (__DEV__) {
    console.log("[statement-pdf] POST", path, JSON.stringify(body));
  }
  const response = await http.post<unknown>(path, body, {
    silentError: true,
    timeout: PDF_API_TIMEOUT_MS,
  });
  const payload = unwrapFrappeMessage(response) ?? response;
  const serverSoaVerified = parseSoaPdfServerVerified(payload);
  const base64 = findPdfBase64(payload);
  const downloadUrl = findPdfUrlInTree(payload);
  if (!base64 && !downloadUrl) return null;
  if (__DEV__ && serverSoaVerified) {
    console.log("[statement-pdf] Server SOA verified (soa_body_present / soa_pdf_verified)");
  }
  return materializePdfCandidate(
    { base64: base64 ?? undefined, downloadUrl: downloadUrl ?? undefined },
    filename,
    serverUrl,
    token,
    source,
    serverSoaVerified
  );
}

/**
 * One ERP PDF generation per tap when possible (POST only, early exit).
 * Extra paths/payloads only when the first response is missing or clearly wrong.
 */
type StatementPdfCustomerContext = {
  customer: string;
  company: string | undefined;
  range: { from_date: string; to_date: string };
};

async function pdfIsUsableForShare(
  hit: MaterializedPdf,
  expectOpenStatementLines: boolean,
  ctx: StatementPdfCustomerContext
): Promise<boolean> {
  if (!shouldAcceptStatementPdf(hit.bytes, hit.fileUrl)) return false;
  if (!expectOpenStatementLines) return true;

  if (hit.serverSoaVerified) return true;

  const bodyCheck = await pdfLikelyHasStatementBody(hit.uri);
  if (bodyCheck === true) return true;

  try {
    const stmt = await fetchCustomerStatement({
      customer: ctx.customer,
      company: ctx.company,
      from_date: ctx.range.from_date,
      to_date: ctx.range.to_date,
    });
    const openLines = stmt.items.filter(
      (it) => parseStatementLineOutstanding(it) !== 0
    ).length;
    if (openLines === 0) return true;
    if (bodyCheck === false) {
      if (__DEV__) {
        console.warn("[statement-pdf] API has open lines but PDF body empty", {
          openLines,
          bytes: hit.bytes,
        });
      }
      return false;
    }
    return true;
  } catch {
    return bodyCheck !== false;
  }
}

async function tryFetchStatementPdf(
  paths: readonly string[],
  payloads: Record<string, unknown>[],
  filename: string,
  serverUrl: string,
  token: string,
  expectOpenStatementLines: boolean,
  ctx: StatementPdfCustomerContext
): Promise<(MaterializedPdf & { lastFailure?: string }) | null> {
  let lastFailure: { path: string; detail: string } | null = null;
  let emptyResponsePath: string | null = null;
  let fallback: MaterializedPdf | null = null;
  let emptyBodyPath: string | null = null;
  const uniquePaths = [...new Set(paths.filter(Boolean))];
  const bodies = payloads.filter((p) => p && Object.keys(p).length > 0);
  if (!uniquePaths.length || !bodies.length) return null;

  const tryPath = async (
    path: string,
    payloadLimit: number
  ): Promise<MaterializedPdf | null> => {
    for (const body of bodies.slice(0, payloadLimit)) {
      try {
        const hit = await postStatementPdfOnce(
          path,
          body,
          filename,
          serverUrl,
          token,
          `${path} POST`
        );
        if (hit) return hit;
        if (!emptyResponsePath) emptyResponsePath = path;
      } catch (error) {
        lastFailure = notePdfFetchFailure(lastFailure, path, error);
      }
    }
    return null;
  };

  for (let i = 0; i < uniquePaths.length; i++) {
    const path = uniquePaths[i];
    const payloadLimit = i === 0 ? Math.min(bodies.length, 3) : 1;
    const hit = await tryPath(path, payloadLimit);
    if (!hit) continue;

    if (await pdfIsUsableForShare(hit, expectOpenStatementLines, ctx)) {
      return hit;
    }
    if (expectOpenStatementLines) {
      emptyBodyPath = path;
      if (__DEV__) {
        console.warn("[statement-pdf] PDF has no detectable SOA body", {
          bytes: hit.bytes,
          source: hit.source,
        });
      }
    }
    if (!fallback || hit.bytes > fallback.bytes) {
      fallback = hit;
    }
    if (i === 0 && payloadLimit < bodies.length) {
      const extra = await tryPath(path, Math.min(bodies.length, 5));
      if (extra && (await pdfIsUsableForShare(extra, expectOpenStatementLines, ctx))) {
        return extra;
      }
      if (extra && expectOpenStatementLines) emptyBodyPath = path;
      if (extra && (!fallback || extra.bytes > fallback.bytes)) {
        fallback = extra;
      }
    }
  }

  if (
    fallback &&
    !expectOpenStatementLines &&
    shouldAcceptStatementPdf(fallback.bytes, fallback.fileUrl)
  ) {
    return fallback;
  }

  if (fallback && expectOpenStatementLines && emptyBodyPath) {
    return {
      uri: "",
      bytes: 0,
      source: "",
      lastFailure: `${emptyBodyPath} — PDF returned but SOA body is empty (letterhead only). Server get_statement_pdf must use the same data path as desk SOA.`,
    };
  }

  if (lastFailure) {
    return {
      uri: "",
      bytes: 0,
      source: "",
      lastFailure: `${lastFailure.path} — ${lastFailure.detail}`,
    };
  }
  if (emptyResponsePath) {
    return {
      uri: "",
      bytes: 0,
      source: "",
      lastFailure: `${emptyResponsePath} — HTTP 200 but no file_url or pdf_base64 in response`,
    };
  }
  return null;
}

/**
 * Downloads statement PDF to app cache. Returns local file URI for Sharing API.
 */
export async function downloadCustomerStatementPdf(
  params: CustomerStatementPdfParams
): Promise<{ uri: string; filename: string }> {
  const resolvedCustomer = String(
    params.resolvedCustomer?.trim() ||
      (await resolveCustomerParty(params.customer))
  ).trim();
  if (!resolvedCustomer) throw new Error("Customer is required");

  const state = useAuthStore.getState();
  const company =
    params.company ||
    resolveCompanyName(state.permissions.scope?.company, state.user?.company);
  const serverUrl = state.serverConfig.serverUrl;
  if (!serverUrl?.trim()) {
    throw new Error("Configure your ERP server in Settings first.");
  }

  http.setBaseUrl(serverUrl);
  const token = await oauthApi.getValidToken();
  if (!token) throw new Error("No valid access token available");

  const range = statementDateRange(params);
  const displayLabel = String(
    params.customerDisplayName || params.customer || resolvedCustomer
  ).trim();

  const cfg = state.mobileConfig;
  const pdfCtx: StatementPdfCustomerContext = {
    customer: resolvedCustomer,
    company,
    range,
  };
  const minimalPayloads = buildMinimalGetPdfPayloads(
    resolvedCustomer,
    company,
    range,
    cfg,
    {
      displayLabel,
      serverParams: params.statementPdfHint?.params,
    }
  );
  const pdfPaths = buildStatementPdfPathOrder(params.statementPdfHint);
  const filename = `Statement_${sanitizeFilenamePart(resolvedCustomer)}_${range.to_date}.pdf`;
  const expectOpenStatementLines =
    params.expectOpenStatementLines !== undefined
      ? Boolean(params.expectOpenStatementLines)
      : true;

  const cacheKey = statementPdfCacheKey(resolvedCustomer, company, range.to_date);
  const cached = statementPdfCache.get(cacheKey);
  if (
    !params.bypassPdfCache &&
    cached &&
    Date.now() - cached.cachedAt < STATEMENT_PDF_CACHE_MS &&
    (await isPdfFileUri(cached.uri)) &&
    (cached.serverSoaVerified ||
      (await pdfLikelyHasStatementBody(cached.uri)) !== false)
  ) {
    if (__DEV__) {
      console.log("[statement-pdf] Using cached PDF");
    }
    return { uri: cached.uri, filename: cached.filename };
  }
  if (cached) statementPdfCache.delete(cacheKey);

  let serverPdf = await tryFetchStatementPdf(
    pdfPaths,
    minimalPayloads,
    filename,
    serverUrl,
    token,
    expectOpenStatementLines,
    pdfCtx
  );
  if (!serverPdf?.uri) {
    const legacyPayloads = buildStatementPdfPayloads(
      resolvedCustomer,
      company,
      cfg,
      range,
      {
        displayLabel,
      }
    ).slice(0, 3);
    serverPdf = await tryFetchStatementPdf(
      [...pdfPaths.slice(0, 2), SEND_STATEMENT_PDF_PATHS[0]],
      legacyPayloads,
      filename,
      serverUrl,
      token,
      expectOpenStatementLines,
      pdfCtx
    );
  }
  if (serverPdf?.uri) {
    if (__DEV__) {
      console.log(
        `[statement-pdf] Using server PDF (${serverPdf.bytes} bytes, ${serverPdf.source})`
      );
    }
    if (
      serverPdf.serverSoaVerified ||
      (await pdfLikelyHasStatementBody(serverPdf.uri)) !== false
    ) {
      statementPdfCache.set(cacheKey, {
        uri: serverPdf.uri,
        filename,
        cachedAt: Date.now(),
        serverSoaVerified: serverPdf.serverSoaVerified,
      });
    }
    return { uri: serverPdf.uri, filename };
  }

  if (__DEV__) {
    console.warn("[statement-pdf] Server PDF failed:", {
      customer: resolvedCustomer,
      company,
      lastFailure: serverPdf?.lastFailure ?? "no API response",
    });
  }

  if (!allowLocalStatementPdfFallback()) {
    const detail = serverPdf?.lastFailure
      ? `\n\nServer: ${serverPdf.lastFailure}`
      : "";
    throw new Error(STATEMENT_PDF_SERVER_REQUIRED_MESSAGE + detail);
  }

  if (__DEV__) {
    console.warn(
      "[statement-pdf] Server PDF unavailable — EXPO_PUBLIC_SOA_PDF_ALLOW_LOCAL=1, using HTML PDF (not same as desk)."
    );
  }

  // Dev-only fallback: live statement + branding → HTML PDF (see docs/BACKEND_SOA_MOBILE_PDF_HANDOFF.md)
  try {
    const stmt = await fetchCustomerStatement({
      customer: resolvedCustomer,
      company,
      from_date: range.from_date,
      to_date: range.to_date,
    });
    return generateLocalStatementPdfFile(stmt, {
      company,
      customerLabel: params.customer,
      filenameBase: filename.replace(/\.pdf$/i, ""),
    });
  } catch (localErr) {
    const localMsg =
      localErr instanceof Error ? localErr.message : String(localErr);
    throw new Error(
      "Could not build the statement PDF. " +
        `${localMsg} — Check get_customer_statement and get_statement_branding on the server (Access Profile / no HTTP 417).`
    );
  }
}
