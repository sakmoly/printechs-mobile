/**
 * On-device Statement of Account PDF when server get_statement_pdf is not deployed.
 * Layout aligns with desk/email SOA when branding HTML is returned from ERP.
 */

import * as Print from "expo-print";
import { cacheDirectory, copyAsync } from "expo-file-system/legacy";
import type { CustomerStatementData } from "../api/customerStatement";
import { parseStatementLineOutstanding } from "./statementLineUtils";
import { formatStatementDateDdMmYyyy } from "./statementDateFormat";
import {
  loadStatementSoaBranding,
  type StatementSoaBranding,
} from "../api/statementSoaBranding";

/**
 * Partner logo / contact strip from `footer_html` — off for on-device PDF until
 * `get_statement_pdf` is used (desk Print Format). Bank lines from API stay.
 * Set EXPO_PUBLIC_SOA_PDF_FOOTER_BANNER=1 to re-enable the banner in HTML PDF.
 */
function localPdfIncludeFooterBanner(): boolean {
  return process.env.EXPO_PUBLIC_SOA_PDF_FOOTER_BANNER === "1";
}

function escHtml(raw: string): string {
  return String(raw || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtSar(n: number): string {
  return (Number(n) || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function openStatementLines(data: CustomerStatementData) {
  const asOf = data.to_date;
  return data.items
    .filter((it) => parseStatementLineOutstanding(it) !== 0)
    .slice()
    .sort((a, b) =>
      [
        String(a.posting_date || ""),
        String(a.due_date || ""),
        String(a.invoice || ""),
      ].join("|")
        .localeCompare(
          [
            String(b.posting_date || ""),
            String(b.due_date || ""),
            String(b.invoice || ""),
          ].join("|")
        )
    )
    .map((it) => {
      const outstanding = parseStatementLineOutstanding(it);
      const due = String(it.due_date || "").slice(0, 10);
      const overdue = due.length >= 10 && due < asOf.slice(0, 10);
      return {
        invoice: it.invoice,
        posting_date: it.posting_date,
        due_date: it.due_date,
        amount: it.amount,
        outstanding,
        overdue,
      };
    });
}

function companyContactLine(b: StatementSoaBranding): string {
  const parts: string[] = [];
  if (b.phone) parts.push(`Tel: ${b.phone}`);
  if (b.email) parts.push(b.email);
  if (b.website) parts.push(b.website);
  if (b.taxId) parts.push(`VAT: ${b.taxId}`);
  return parts.map(escHtml).join(" · ");
}

function buildDefaultHeaderHtml(
  b: StatementSoaBranding,
  docTitle: string
): string {
  const logoCell = b.logoDataUri
    ? `<td class="logo-cell"><img src="${b.logoDataUri}" alt="" class="logo"/></td>`
    : `<td class="logo-cell logo-placeholder">${escHtml(b.companyName.slice(0, 1))}</td>`;
  const address = b.companyAddressLines.map(escHtml).join("<br/>");
  const contact = companyContactLine(b);

  return `
  <div class="soa-header">
    <table class="letterhead"><tr>
      ${logoCell}
      <td class="company-block">
        <div class="company-name">${escHtml(b.companyName)}</div>
        ${address ? `<div class="company-address">${address}</div>` : ""}
        ${contact ? `<div class="company-contact">${contact}</div>` : ""}
      </td>
    </tr></table>
    <div class="doc-title">${escHtml(docTitle)}</div>
  </div>`;
}

function buildBankDetailsHtml(lines: string[]): string {
  if (!lines.length) return "";
  return `<div class="bank-details">${lines
    .map((l) => `<p class="bank-line">${escHtml(l)}</p>`)
    .join("")}</div>`;
}

function buildDefaultFooterInner(b: StatementSoaBranding, asOf: string): string {
  const lines = b.footerLines.map((l) => `<div>${escHtml(l)}</div>`).join("");
  return `
  <div class="soa-footer-inner">
    ${lines}
    <div class="footer-meta">Statement as of ${escHtml(formatStatementDateDdMmYyyy(asOf))} · Amounts in SAR</div>
  </div>`;
}

/** Desk print-format HTML often has fixed heights — breaks expo-print layout. */
function softenServerPrintHtml(html: string): string {
  return String(html || "")
    .replace(/\sheight\s*=\s*["'][^"']*["']/gi, "")
    .replace(/min-height\s*:\s*[^;"']+;?/gi, "")
    .replace(/height\s*:\s*\d+px;?/gi, "height:auto;")
    .replace(/padding-bottom\s*:\s*\d+px;?/gi, "")
    .replace(/margin-bottom\s*:\s*\d+px;?/gi, "")
    .replace(/<div[^>]*>\s*<\/div>/gi, "");
}

function buildBillToBlock(
  data: CustomerStatementData,
  opts: { company?: string; customerLabel?: string }
): string {
  const id = escHtml(data.customer);
  const name = escHtml(
    data.customer_display_name || opts.customerLabel || data.customer
  );
  const addr = (data.customer_address_lines || [])
    .map(escHtml)
    .join("<br/>");
  const company = opts.company ? escHtml(opts.company) : "";

  return `
  <table class="bill-to"><tr>
    <td>
      <div class="bill-label">Bill To</div>
      <div class="bill-name">${name}</div>
      <div class="bill-id">${id}</div>
      ${addr ? `<div class="bill-address">${addr}</div>` : ""}
    </td>
    <td class="bill-meta">
      ${company ? `<div><span class="meta-k">Company</span> ${company}</div>` : ""}
      <div><span class="meta-k">Period</span> ${escHtml(formatStatementDateDdMmYyyy(data.from_date))} – ${escHtml(formatStatementDateDdMmYyyy(data.to_date))}</div>
      <div><span class="meta-k">Statement date</span> ${escHtml(formatStatementDateDdMmYyyy(data.to_date))}</div>
    </td>
  </tr></table>`;
}

function buildStatementHtml(
  data: CustomerStatementData,
  opts: {
    company?: string;
    customerLabel?: string;
    branding: StatementSoaBranding;
  }
): string {
  const lines = openStatementLines(data);
  let running = 0;
  const rowsHtml = lines
    .map((row) => {
      running += row.outstanding;
      const rowClass = row.overdue ? "row-overdue" : "";
      return `<tr class="${rowClass}">
        <td class="inv">${escHtml(row.invoice || "—")}</td>
        <td>${escHtml(formatStatementDateDdMmYyyy(row.posting_date))}</td>
        <td class="due">${escHtml(formatStatementDateDdMmYyyy(row.due_date))}</td>
        <td class="num">${fmtSar(row.amount)}</td>
        <td class="num">${fmtSar(row.outstanding)}</td>
        <td class="num bal">${fmtSar(running)}</td>
      </tr>`;
    })
    .join("");

  const docTitle = "Statement of Account";
  const serverHeader = opts.branding.headerHtml?.trim();
  const serverFooter = opts.branding.footerHtml?.trim();
  const headerBlock = serverHeader
    ? `<header class="soa-header server-header">${softenServerPrintHtml(serverHeader)}</header>`
    : `<header class="soa-header default-header">${buildDefaultHeaderHtml(opts.branding, docTitle)}</header>`;

  const bankBlock = buildBankDetailsHtml(opts.branding.footerLines);
  const includeBanner = localPdfIncludeFooterBanner() && Boolean(serverFooter);

  let closingInner = bankBlock
    ? `<section class="soa-remittance">${bankBlock}</section>`
    : "";
  if (includeBanner) {
    closingInner += `
      <footer class="soa-page-footer">
        <div class="server-footer-banner">${softenServerPrintHtml(serverFooter!)}</div>
      </footer>`;
  } else if (!bankBlock) {
    closingInner += `
      <footer class="soa-page-footer default-footer">
        ${buildDefaultFooterInner(opts.branding, data.to_date)}
      </footer>`;
  } else {
    closingInner += `<p class="soa-closing-meta">Statement as of ${escHtml(formatStatementDateDdMmYyyy(data.to_date))} · Amounts in SAR</p>`;
  }

  const closingBlock = `<div class="soa-page-bottom">${closingInner}</div>`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=595, initial-scale=1"/>
<style>
  @page { size: A4 portrait; margin: 10mm 12mm 12mm 12mm; }
  @media print {
    html, body { width: 595px; max-width: 595px; }
  }
  * { box-sizing: border-box; }
  html, body {
    font-family: Helvetica, Arial, sans-serif;
    font-size: 10px;
    color: #111827;
    margin: 0;
    padding: 0;
    width: 100%;
  }
  .page-wrap {
    width: 100%;
    max-width: 595px;
    margin: 0 auto;
    padding: 0;
  }
  .soa-main {
    width: 100%;
  }
  .soa-page-bottom {
    width: 100%;
    margin-top: 14px;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .soa-closing-meta {
    margin: 8px 0 0;
    font-size: 8px;
    color: #94a3b8;
    text-align: center;
  }
  .soa-header {
    flex: 0 0 auto;
    width: 100%;
    margin-bottom: 10px;
  }
  .default-header {
    border-bottom: 2px solid #1e3a8a;
    padding-bottom: 8px;
  }
  .server-header {
    border-bottom: none;
    padding: 0;
    margin-bottom: 6px;
    overflow: hidden;
  }
  .server-header table,
  .server-footer-banner table {
    width: 100% !important;
    max-width: 100% !important;
    border-collapse: collapse !important;
    height: auto !important;
    table-layout: fixed;
  }
  .server-header td,
  .server-header th,
  .server-footer-banner td,
  .server-footer-banner th {
    padding: 0 2px !important;
    vertical-align: middle !important;
    height: auto !important;
  }
  .server-header img,
  .server-footer-banner img {
    display: block;
    max-width: 100% !important;
    width: 100% !important;
    height: auto !important;
    max-height: 88px !important;
    object-fit: contain;
    margin: 0 auto;
  }
  .server-footer-banner img { max-height: 72px !important; }
  .server-header div:empty,
  .server-footer-banner div:empty { display: none; }
  .letterhead { width: 100%; border-collapse: collapse; }
  .logo-cell { width: 88px; vertical-align: top; padding-right: 12px; }
  .logo { max-width: 80px; max-height: 56px; object-fit: contain; }
  .logo-placeholder {
    width: 56px; height: 56px; background: #eff6ff; color: #1e40af;
    font-size: 22px; font-weight: bold; text-align: center; line-height: 56px;
    border-radius: 8px;
  }
  .company-name { font-size: 16px; font-weight: bold; color: #1e3a8a; }
  .company-address { margin-top: 4px; color: #475569; line-height: 1.35; }
  .company-contact { margin-top: 6px; color: #64748b; font-size: 9px; }
  .doc-title {
    margin-top: 10px;
    text-align: center;
    font-size: 13px;
    font-weight: bold;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #0f172a;
  }
  .bill-to { width: 100%; margin-bottom: 10px; border-collapse: collapse; }
  .bill-to td { vertical-align: top; width: 50%; }
  .bill-label { font-size: 8px; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; }
  .bill-name { font-size: 12px; font-weight: bold; margin-top: 2px; }
  .bill-id { color: #64748b; margin-top: 2px; }
  .bill-address { margin-top: 4px; color: #475569; line-height: 1.35; }
  .bill-meta { text-align: right; font-size: 9px; color: #334155; line-height: 1.5; }
  .meta-k { color: #64748b; font-weight: 600; }
  .summary-row { display: flex; gap: 12px; margin-bottom: 10px; }
  .summary-box {
    flex: 1; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px;
    border-left: 3px solid #2563eb;
  }
  .summary-box.due { border-left-color: #dc2626; }
  .summary-box label { font-size: 8px; text-transform: uppercase; color: #64748b; }
  .summary-box val { display: block; font-size: 14px; font-weight: bold; margin-top: 4px; }
  table.lines { width: 100%; border-collapse: collapse; }
  table.lines th {
    text-align: left; background: #f1f5f9; border-bottom: 1px solid #94a3b8;
    padding: 6px 4px; font-size: 8px; text-transform: uppercase; color: #475569;
  }
  table.lines td { border-bottom: 1px solid #e2e8f0; padding: 5px 4px; vertical-align: top; }
  table.lines td.num { text-align: right; white-space: nowrap; }
  table.lines tr:nth-child(even) td { background: #fafafa; }
  table.lines tr.row-overdue td {
    background: #fef2f2 !important;
    color: #b91c1c;
  }
  table.lines tr.row-overdue td.inv,
  table.lines tr.row-overdue td.due,
  table.lines tr.row-overdue td.bal {
    font-weight: 700;
  }
  table.lines thead { display: table-header-group; }
  table.lines tr { page-break-inside: avoid; }
  .footnote { margin: 8px 0 0; font-size: 8px; color: #94a3b8; }
  .soa-remittance {
    width: 100%;
    page-break-inside: avoid;
  }
  .soa-page-footer {
    width: 100%;
    padding-top: 6px;
    page-break-inside: avoid;
  }
  .default-footer {
    border-top: 1px solid #cbd5e1;
    font-size: 9px;
    color: #475569;
    line-height: 1.45;
  }
  .server-footer-banner {
    width: 100%;
    text-align: center;
    overflow: hidden;
  }
  .bank-details {
    margin: 12px 0 8px;
    padding: 0;
    width: 100%;
    font-family: Georgia, "Times New Roman", serif;
    font-size: 9px;
    line-height: 1.55;
    color: #111827;
    text-align: left;
  }
  .bank-line { margin: 0 0 4px; }
  .footer-meta { margin-top: 8px; color: #94a3b8; font-size: 8px; }
</style>
</head>
<body>
<div class="page-wrap">
  ${headerBlock}
  <main class="soa-main">
    ${buildBillToBlock(data, opts)}
    <div class="summary-row">
      <div class="summary-box"><label>Total invoiced (SAR)</label><val>${fmtSar(data.total_invoiced)}</val></div>
      <div class="summary-box due"><label>Total outstanding (SAR)</label><val>${fmtSar(data.total_outstanding)}</val></div>
    </div>
    <table class="lines">
      <thead>
        <tr>
          <th>Invoice</th>
          <th>Posting</th>
          <th>Due</th>
          <th class="num">Amount</th>
          <th class="num">Outstanding</th>
          <th class="num">Balance</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml || `<tr><td colspan="6">No open items</td></tr>`}
      </tbody>
    </table>
    <p class="footnote">Overdue invoices are highlighted in red. Open outstanding lines as of the statement date.</p>
  </main>
  ${closingBlock}
</div>
</body>
</html>`;
}

function sanitizeFilenamePart(raw: string): string {
  return String(raw || "customer")
    .replace(/[^\w.-]+/g, "_")
    .slice(0, 48);
}

export async function generateLocalStatementPdfFile(
  data: CustomerStatementData,
  opts: { company?: string; customerLabel?: string; filenameBase?: string }
): Promise<{ uri: string; filename: string }> {
  const branding = await loadStatementSoaBranding({
    company: opts.company,
    customer: data.customer,
    from_date: data.from_date,
    to_date: data.to_date,
    embedded: data.branding,
  });

  const html = buildStatementHtml(data, { ...opts, branding });
  const { uri: tmpUri } = await Print.printToFileAsync({
    html,
    width: 595,
    height: 842,
    orientation: Print.Orientation.portrait,
    margins: {
      top: 28,
      bottom: 18,
      left: 24,
      right: 24,
    },
  });
  const filename = `${opts.filenameBase || `Statement_${sanitizeFilenamePart(data.customer)}_${data.to_date}`}.pdf`;
  if (!cacheDirectory) {
    return { uri: tmpUri, filename };
  }
  const dest = `${cacheDirectory}${filename}`;
  await copyAsync({ from: tmpUri, to: dest });
  return { uri: dest, filename };
}

