/**
 * Letterhead + footer for on-device Statement of Account PDFs.
 * Prefer server-provided HTML (same as email SOA); fallback to Company master.
 */

import {
  cacheDirectory,
  downloadAsync,
  EncodingType,
  readAsStringAsync,
} from "expo-file-system/legacy";
import { http } from "./http";
import { oauthApi } from "./oauth";
import { filterBaParams, unwrapFrappeMessage } from "./apiResilience";
import { ERP_ANALYSIS } from "./endpoints";
import { resolveServerBaseUrl } from "./serverUrl";
import { useAuthStore } from "../store/auth";

export type StatementSoaBranding = {
  companyName: string;
  companyAddressLines: string[];
  phone?: string;
  email?: string;
  website?: string;
  taxId?: string;
  /** Embedded data URI for expo-print (avoids auth on remote img). */
  logoDataUri?: string;
  /** Raw HTML from ERP — matches desk/email SOA when provided. */
  headerHtml?: string;
  footerHtml?: string;
  /** Plain lines below table (bank / remittance) when footerHtml absent. */
  footerLines: string[];
  /** `/files/…` from ERP — resolved to logoDataUri before print when needed. */
  logoUrl?: string;
};

/** Backend canonical order — customer_notifications, receivables alias, printechs_utility delegate */
const BRANDING_PATHS = [
  ERP_ANALYSIS.customerNotifications.getStatementBranding,
  ERP_ANALYSIS.receivables.getStatementBranding,
  "/api/method/printechs_utility.customer_notifications.get_statement_branding",
  "/api/method/printechs_utility.receivables.get_statement_branding",
  ERP_ANALYSIS.customerNotifications.getStatementSoaLayout,
  "/api/method/printechs_utility.customer_notifications.get_statement_soa_layout",
] as const;

type BrandingParseResult = Partial<StatementSoaBranding> & { logoUrl?: string };

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function linesFromHtml(html: string): string[] {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

function pickString(obj: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = asString(obj[k]);
    if (v) return v;
  }
  return "";
}

/** Desk SOA remittance block — not company postal address. */
function isBankRemittanceLine(line: string): boolean {
  return /^(company|account|bank|iban)\s*[.:]/i.test(line.trim());
}

function deskBankLine(label: string, value: string): string {
  const v = value.trim();
  if (!v) return "";
  return `${label} :${v}`;
}

function bankLinesFromObject(obj: Record<string, unknown>): string[] {
  const company = pickString(obj, [
    "company",
    "company_name",
    "account_name",
    "beneficiary",
  ]);
  const account = pickString(obj, [
    "account",
    "account_no",
    "account_number",
    "bank_account",
  ]);
  const bank = pickString(obj, ["bank", "bank_name"]);
  const iban = pickString(obj, ["iban", "iban_no", "iban_number"]);
  return [
    deskBankLine("Company", company),
    deskBankLine("Account", account),
    deskBankLine("Bank", bank),
    deskBankLine("IBAN", iban),
  ].filter(Boolean);
}

function parseBankFooterLines(nested: Record<string, unknown>): string[] {
  const raw =
    nested.footer_lines ??
    nested.bank_lines ??
    nested.bank_details ??
    nested.remittance_lines ??
    nested.footer;

  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return bankLinesFromObject(raw as Record<string, unknown>);
  }

  let lines: string[] = [];
  if (Array.isArray(raw)) {
    lines = raw.map((x) => String(x).trim()).filter(Boolean);
  } else if (typeof raw === "string" && raw.trim()) {
    lines = linesFromHtml(raw);
  }

  const bankOnly = lines.filter(isBankRemittanceLine);
  if (bankOnly.length) return normalizeDeskBankLines(bankOnly);
  if (lines.length) return normalizeDeskBankLines(lines);

  const loose = bankLinesFromObject(nested);
  return loose;
}

/** Prefer `Label :value` spacing like desk Print Format. */
function normalizeDeskBankLines(lines: string[]): string[] {
  return lines.map((line) => {
    const m = line.match(/^(\s*(?:company|account|bank|iban)\s*)\s*[.:]\s*(.*)$/i);
    if (!m) return line.trim();
    const label = m[1].trim();
    const cap =
      label.charAt(0).toUpperCase() + label.slice(1).toLowerCase();
    return `${cap} :${m[2].trim()}`;
  });
}

function parseBrandingPayload(raw: unknown): BrandingParseResult | null {
  const root = unwrapFrappeMessage(raw);
  if (!root || typeof root !== "object") return null;
  const r = root as Record<string, unknown>;
  const nested =
    r.layout && typeof r.layout === "object"
      ? (r.layout as Record<string, unknown>)
      : r.branding && typeof r.branding === "object"
        ? (r.branding as Record<string, unknown>)
        : r.soa && typeof r.soa === "object"
          ? (r.soa as Record<string, unknown>)
          : r.soa_layout && typeof r.soa_layout === "object"
            ? (r.soa_layout as Record<string, unknown>)
            : r;

  let headerHtml = pickString(nested, [
    "header_html",
    "soa_header_html",
    "letterhead_html",
  ]);
  let footerHtml = pickString(nested, [
    "footer_html",
    "soa_footer_html",
    "letter_footer_html",
  ]);

  const headerImage = pickString(nested, [
    "header_image_url",
    "letterhead_image_url",
    "header_image",
    "letterhead_url",
  ]);
  const footerImage = pickString(nested, [
    "footer_image_url",
    "footer_image",
  ]);
  if (headerImage && !headerHtml) {
    headerHtml = `<div class="soa-letterhead-img"><img src="${headerImage.replace(/"/g, "&quot;")}" alt="" style="width:100%;max-height:140px;object-fit:contain"/></div>`;
  }
  if (footerImage && !footerHtml) {
    footerHtml = `<div class="soa-footer-img"><img src="${footerImage.replace(/"/g, "&quot;")}" alt="" style="width:100%;max-height:100px;object-fit:contain"/></div>`;
  }

  let footerLines = parseBankFooterLines(nested);

  const addressHtml = pickString(nested, [
    "company_address_html",
    "address_html",
    "company_address",
  ]);
  const addressLines = addressHtml
    ? linesFromHtml(addressHtml)
    : Array.isArray(nested.address_lines)
      ? (nested.address_lines as unknown[]).map(String).filter(Boolean)
      : [];

  const companyName = pickString(nested, [
    "company_name",
    "company",
    "title",
  ]);

  if (
    !companyName &&
    !headerHtml &&
    !footerHtml &&
    !footerLines.length &&
    !addressLines.length
  ) {
    return null;
  }

  const logoUrl = pickString(nested, [
    "logo_url",
    "company_logo_url",
    "company_logo",
    "logo",
  ]);

  return {
    companyName: companyName || "",
    companyAddressLines: addressLines,
    phone: pickString(nested, ["phone", "phone_no", "company_phone"]) || undefined,
    email: pickString(nested, ["email", "company_email"]) || undefined,
    website: pickString(nested, ["website", "company_website"]) || undefined,
    taxId: pickString(nested, ["tax_id", "vat_no", "vat_number", "cr_no"]) || undefined,
    headerHtml: headerHtml || undefined,
    footerHtml: footerHtml || undefined,
    footerLines,
    logoDataUri: undefined,
    logoUrl: logoUrl || undefined,
  };
}

function mergeBrandingPartsLight(
  ...parts: Array<BrandingParseResult | Partial<StatementSoaBranding> | null | undefined>
): Partial<StatementSoaBranding> {
  const out: Partial<StatementSoaBranding> = {
    companyAddressLines: [],
    footerLines: [],
  };
  for (const p of parts) {
    if (!p) continue;
    if (p.companyName) out.companyName = p.companyName;
    if (p.companyAddressLines?.length) {
      out.companyAddressLines = p.companyAddressLines;
    }
    if (p.phone) out.phone = p.phone;
    if (p.email) out.email = p.email;
    if (p.website) out.website = p.website;
    if (p.taxId) out.taxId = p.taxId;
    if (p.logoDataUri) out.logoDataUri = p.logoDataUri;
    const logoUrl = (p as BrandingParseResult).logoUrl;
    if (logoUrl) out.logoUrl = logoUrl;
    if (p.headerHtml) out.headerHtml = p.headerHtml;
    if (p.footerHtml) out.footerHtml = p.footerHtml;
    if (p.footerLines?.length) out.footerLines = p.footerLines;
  }
  return out;
}

/** Merge branding fragments from get_customer_statement (top-level + branding object). */
export function mergeStatementBrandingParts(
  ...parts: Array<BrandingParseResult | Partial<StatementSoaBranding> | null | undefined>
): Partial<StatementSoaBranding> | undefined {
  const merged = mergeBrandingPartsLight(...parts);
  const hasLayout =
    merged.headerHtml?.trim() ||
    merged.footerHtml?.trim() ||
    (merged.footerLines?.length ?? 0) > 0 ||
    (merged.companyAddressLines?.length ?? 0) > 0;
  return hasLayout ? merged : undefined;
}

async function attachLogoDataUri(
  part: BrandingParseResult | null,
  serverUrl: string
): Promise<Partial<StatementSoaBranding> | null> {
  if (!part) return null;
  if (part.logoDataUri || !part.logoUrl || !serverUrl) {
    const { logoUrl: _drop, ...rest } = part;
    return rest;
  }
  const logoDataUri = await logoToDataUri(serverUrl, part.logoUrl);
  const { logoUrl: _drop, ...rest } = part;
  return logoDataUri ? { ...rest, logoDataUri } : rest;
}

/** Extract branding embedded in get_customer_statement (fields + branding + nested message). */
export function brandingFromStatementRoot(raw: unknown): Partial<StatementSoaBranding> | null {
  const root = unwrapFrappeMessage(raw);
  if (!root || typeof root !== "object") return null;
  const r = root as Record<string, unknown>;
  const parts: Array<BrandingParseResult | null> = [parseBrandingPayload(root)];
  if (r.branding && typeof r.branding === "object") {
    parts.push(parseBrandingPayload({ message: r.branding }));
  }
  const inner = r.message;
  if (inner && typeof inner === "object" && !Array.isArray(inner)) {
    parts.push(parseBrandingPayload({ message: inner }));
  }
  return mergeStatementBrandingParts(...parts) ?? null;
}

function toAbsoluteFileUrl(serverUrl: string, pathOrUrl: string): string {
  const t = pathOrUrl.trim();
  if (t.startsWith("http://") || t.startsWith("https://")) return t;
  const base = resolveServerBaseUrl(serverUrl).replace(/\/$/, "");
  if (t.startsWith("/")) return `${base}${t}`;
  return `${base}/${t}`;
}

function frappeDownloadUrl(serverUrl: string, fileUrl: string): string {
  const path = fileUrl.startsWith("http")
    ? fileUrl.replace(/^https?:\/\/[^/]+/i, "")
    : fileUrl.startsWith("/")
      ? fileUrl
      : `/${fileUrl}`;
  const base = resolveServerBaseUrl(serverUrl).replace(/\/$/, "");
  return `${base}/api/method/frappe.utils.file_manager.download_file?file_url=${encodeURIComponent(path)}`;
}

function mimeFromFilePath(path: string): string {
  const p = path.toLowerCase().split("?")[0] || "";
  if (p.endsWith(".png")) return "image/png";
  if (p.endsWith(".webp")) return "image/webp";
  if (p.endsWith(".gif")) return "image/gif";
  if (p.endsWith(".svg")) return "image/svg+xml";
  return "image/jpeg";
}

async function fileToDataUri(
  serverUrl: string,
  filePath: string
): Promise<string | undefined> {
  const path = String(filePath || "").trim();
  if (!path || path.startsWith("data:")) return path || undefined;

  const url = path.startsWith("http")
    ? frappeDownloadUrl(serverUrl, path)
    : frappeDownloadUrl(serverUrl, path);
  const token = await oauthApi.getValidToken();
  const mime = mimeFromFilePath(path);
  const tmpBase = `${cacheDirectory || ""}soa_file_${Date.now()}`;

  if (token) {
    try {
      const result = await downloadAsync(url, tmpBase, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const b64 = await readAsStringAsync(result.uri, {
        encoding: EncodingType.Base64,
      });
      return `data:${mime};base64,${b64}`;
    } catch {
      /* try public URL */
    }
  }
  try {
    const publicUrl = toAbsoluteFileUrl(serverUrl, path);
    const result = await downloadAsync(publicUrl, `${tmpBase}_pub`);
    const b64 = await readAsStringAsync(result.uri, {
      encoding: EncodingType.Base64,
    });
    return `data:${mime};base64,${b64}`;
  } catch {
    return undefined;
  }
}

/** expo-print cannot load OAuth-protected /files URLs — inline as data URIs. */
export async function embedAuthenticatedImagesInHtml(
  html: string,
  serverUrl: string
): Promise<string> {
  if (!html?.trim() || !serverUrl?.trim()) return html;

  let out = html;
  const imgRe = /<img\b([^>]*)\ssrc=(["'])([^"']+)\2([^>]*)>/gi;
  const imgMatches: Array<{
    full: string;
    before: string;
    q: string;
    src: string;
    after: string;
  }> = [];
  let m: RegExpExecArray | null;
  while ((m = imgRe.exec(html)) !== null) {
    imgMatches.push({
      full: m[0],
      before: m[1],
      q: m[2],
      src: m[3],
      after: m[4],
    });
  }
  for (const item of imgMatches) {
    if (item.src.startsWith("data:")) continue;
    const dataUri = await fileToDataUri(serverUrl, item.src);
    if (!dataUri) continue;
    const replacement = `<img${item.before} src=${item.q}${dataUri}${item.q}${item.after}>`;
    out = out.replace(item.full, replacement);
  }

  const urlRe = /url\(\s*(["']?)([^"')]+)\1\s*\)/gi;
  const urlMatches: Array<{ full: string; q: string; src: string }> = [];
  while ((m = urlRe.exec(html)) !== null) {
    const src = m[2].trim();
    if (src.startsWith("data:")) continue;
    urlMatches.push({ full: m[0], q: m[1], src });
  }
  for (const item of urlMatches) {
    const dataUri = await fileToDataUri(serverUrl, item.src);
    if (!dataUri) continue;
    const replacement = `url(${item.q}${dataUri}${item.q})`;
    out = out.replace(item.full, replacement);
  }

  return out;
}

async function logoToDataUri(
  serverUrl: string,
  logoPath: string
): Promise<string | undefined> {
  return fileToDataUri(serverUrl, logoPath);
}

async function fetchCompanyBranding(
  company: string,
  serverUrl: string
): Promise<Partial<StatementSoaBranding>> {
  try {
    const res = await http.get<unknown>(
      "/api/method/frappe.client.get",
      {
        doctype: "Company",
        name: company,
      },
      { silentError: true }
    );
    const doc = unwrapFrappeMessage(res) as Record<string, unknown> | null;
    if (!doc) return {};

    const companyName = asString(doc.company_name || doc.name || company);
    const lines: string[] = [];

    try {
      const addrRes = await http.get<unknown>(
        "/api/method/frappe.client.get_list",
        {
          doctype: "Address",
          fields: JSON.stringify([
            "address_line1",
            "address_line2",
            "city",
            "state",
            "pincode",
            "country",
          ]),
          filters: JSON.stringify([
            ["Dynamic Link", "link_doctype", "=", "Company"],
            ["Dynamic Link", "link_name", "=", company],
          ]),
          limit_page_length: 1,
        },
        { silentError: true }
      );
      const list = unwrapFrappeMessage(addrRes);
      const row = Array.isArray(list) ? list[0] : null;
      if (row && typeof row === "object") {
        const a = row as Record<string, unknown>;
        for (const k of [
          "address_line1",
          "address_line2",
          "city",
          "state",
          "pincode",
          "country",
        ]) {
          const v = asString(a[k]);
          if (v) lines.push(v);
        }
      }
    } catch {
      /* optional */
    }

    const logoPath = asString(doc.company_logo);
    let logoDataUri: string | undefined;
    if (logoPath) {
      logoDataUri = await logoToDataUri(serverUrl, logoPath);
    }

    return {
      companyName,
      companyAddressLines: lines,
      phone: asString(doc.phone_no) || undefined,
      email: asString(doc.email) || undefined,
      website: asString(doc.website) || undefined,
      taxId: asString(doc.tax_id) || undefined,
      logoDataUri,
      // Bank / IBAN only from get_statement_branding — not company_description or address.
      footerLines: [],
    };
  } catch {
    return { companyName: company };
  }
}

async function fetchBrandingApi(
  company: string,
  customer: string,
  range?: { from_date?: string; to_date?: string }
): Promise<Partial<StatementSoaBranding> | null> {
  const cfg = useAuthStore.getState().mobileConfig;
  const base = {
    company,
    customer_name: customer,
    customer,
    from_date: range?.from_date,
    to_date: range?.to_date,
  };
  const payloads = [
    filterBaParams(base, cfg),
    filterBaParams({ company, customer_name: customer, customer }, cfg),
    filterBaParams({ company }, cfg),
  ];
  for (const path of BRANDING_PATHS) {
    for (const body of payloads) {
      for (const call of [
        () => http.get<unknown>(path, body, { silentError: true }),
        () => http.post<unknown>(path, body, { silentError: true }),
      ]) {
        try {
          const res = await call();
          const parsed = parseBrandingPayload(res);
          if (parsed) return parsed;
        } catch {
          /* next */
        }
      }
    }
  }
  return null;
}

function mergeBranding(
  ...parts: Array<Partial<StatementSoaBranding> | null | undefined>
): StatementSoaBranding {
  const out: StatementSoaBranding = {
    companyName: "",
    companyAddressLines: [],
    footerLines: [],
  };
  for (const p of parts) {
    if (!p) continue;
    if (p.companyName) out.companyName = p.companyName;
    if (p.companyAddressLines?.length) {
      out.companyAddressLines = p.companyAddressLines;
    }
    if (p.phone) out.phone = p.phone;
    if (p.email) out.email = p.email;
    if (p.website) out.website = p.website;
    if (p.taxId) out.taxId = p.taxId;
    if (p.logoDataUri) out.logoDataUri = p.logoDataUri;
    const logoUrl = (p as BrandingParseResult).logoUrl;
    if (logoUrl) out.logoUrl = logoUrl;
    if (p.headerHtml) out.headerHtml = p.headerHtml;
    if (p.footerHtml) out.footerHtml = p.footerHtml;
    if (p.footerLines?.length) {
      const next = normalizeDeskBankLines(p.footerLines);
      if (next.length) out.footerLines = next;
    }
  }
  if (!out.companyName) out.companyName = "Company";
  if (!out.footerLines.length && !out.footerHtml) {
    out.footerLines = [
      "Please remit payment against the invoices listed above.",
      "For bank details or payment queries, contact your account manager or accounts receivable.",
    ];
  }
  return out;
}

export async function loadStatementSoaBranding(params: {
  company?: string;
  customer?: string;
  from_date?: string;
  to_date?: string;
  /** From get_customer_statement when present */
  embedded?: Partial<StatementSoaBranding> | null;
}): Promise<StatementSoaBranding> {
  const state = useAuthStore.getState();
  const serverUrl = state.serverConfig.serverUrl;
  const company = (params.company || "").trim();
  http.setBaseUrl(serverUrl);

  let apiPart: Partial<StatementSoaBranding> | null = null;
  if (company) {
    const raw = await fetchBrandingApi(company, params.customer || "", {
      from_date: params.from_date,
      to_date: params.to_date,
    });
    apiPart = await attachLogoDataUri(raw, serverUrl);
  }

  let companyPart: Partial<StatementSoaBranding> = {};
  const hasServerHeader = Boolean(
    apiPart?.headerHtml?.trim() ||
      params.embedded?.headerHtml?.trim()
  );
  if (company && serverUrl && !hasServerHeader) {
    companyPart = await fetchCompanyBranding(company, serverUrl);
  }

  let embedded = params.embedded;
  if (embedded && !embedded.logoDataUri && serverUrl) {
    const withLogo = await attachLogoDataUri(
      embedded as BrandingParseResult,
      serverUrl
    );
    embedded = withLogo || embedded;
  }

  const merged = mergeBranding(embedded, apiPart, companyPart, {
    companyName: company || "Company",
  });

  if (serverUrl) {
    if (merged.headerHtml?.trim()) {
      merged.headerHtml = await embedAuthenticatedImagesInHtml(
        merged.headerHtml,
        serverUrl
      );
    }
    if (merged.footerHtml?.trim()) {
      merged.footerHtml = await embedAuthenticatedImagesInHtml(
        merged.footerHtml,
        serverUrl
      );
    }
  }

  if (__DEV__ && (merged.headerHtml || merged.footerHtml)) {
    console.log("[soa-branding] layout ready", {
      headerLen: merged.headerHtml?.length ?? 0,
      footerLen: merged.footerHtml?.length ?? 0,
      footerLines: merged.footerLines?.length ?? 0,
      hasLogo: Boolean(merged.logoDataUri),
    });
  }

  return merged;
}
