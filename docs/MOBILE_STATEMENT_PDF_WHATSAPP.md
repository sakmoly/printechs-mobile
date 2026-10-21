# Statement PDF → WhatsApp (mobile Option 3)

**Backend spec (share with ERP team):** [BACKEND_SOA_MOBILE_PDF_HANDOFF.md](./BACKEND_SOA_MOBILE_PDF_HANDOFF.md) — API contract + samples. **Cursor instructions:** [BACKEND_CURSOR_SOA_GET_STATEMENT_PDF.md](./BACKEND_CURSOR_SOA_GET_STATEMENT_PDF.md).

The app obtains a **PDF** (from ERPNext when available, otherwise **generated on the device**), then opens the **native share sheet** so the user can pick **WhatsApp** (or Mail, Drive, etc.). WhatsApp deep links (`wa.me`) cannot attach files; sharing a local PDF is the supported pattern.

## Mobile API calls (WhatsApp PDF — current product path)

1. `get_customer_statement` — live lines, totals, embedded `branding` / `header_html` / `footer_lines`
2. `get_statement_branding` — only if layout not complete on statement (`customer_notifications`, then `receivables` alias)

Mobile **always uses server `get_statement_pdf`** (Print Format **Customer Outstanding SOA**) — **same PDF for every customer** as desktop/email. On-device HTML PDF runs **only** if `EXPO_PUBLIC_SOA_PDF_ALLOW_LOCAL=1` (dev). See [BACKEND_SOA_MOBILE_PDF_HANDOFF.md](./BACKEND_SOA_MOBILE_PDF_HANDOFF.md).

### Request body (typical)

```json
{
  "customer_name": "CUST-00001",
  "company": "Printechs",
  "from_date": "2026-01-01",
  "to_date": "2026-10-18"
}
```

### Response (any of these shapes work)

```json
{
  "message": {
    "file_url": "/files/Statement_CUST-00001.pdf"
  }
}
```

```json
{
  "message": {
    "pdf_url": "https://printechs.com/files/Statement.pdf"
  }
}
```

```json
{
  "message": {
    "pdf_base64": "<base64-encoded PDF>"
  }
}
```

When the server includes **`soa_body_present: true`** or **`soa_pdf_verified: true`**, mobile accepts the PDF without scanning file bytes (needed for compressed desk PDFs).

```json
{
  "message": {
    "file_url": "/private/files/Statement_LANDMARK.pdf",
    "soa_body_present": true,
    "soa_pdf_verified": true
  }
}
```

Mobile resolves relative `/files/…` paths with the configured server URL and uses  
`/api/method/frappe.utils.file_manager.download_file?file_url=…` with the OAuth **Bearer** token when downloading.

## Recommended server method

Add `get_statement_pdf(customer_name, company=None, from_date=None, to_date=None)` in  
`printechs_utility.customer_notifications` (and mirror in `erp_analysis`):

1. Reuse the same PDF generation as `send_statement_pdf`.
2. Do **not** send email.
3. Return `{ "file_url": "…" }` or `{ "pdf_base64": "…" }`.

Whitelist the method and run `fix_cmd_kwargs.sh` if kwargs are stripped by the wrapper.

## On-device fallback (no `get_statement_pdf` on server)

If steps 1–3 above return no `file_url` / `pdf_base64`, the app:

1. Calls the same **customer statement** API used on the Statement screen.
2. Renders HTML and uses **`expo-print`** (`printToFileAsync`) to create a PDF in cache.
3. Opens the share sheet as usual.

On-device PDF uses server **header** + **`footer_lines`** (bank / IBAN). The desk **`footer_html`** logo strip is **omitted** by default (expo-print layout). Set `EXPO_PUBLIC_SOA_PDF_FOOTER_BANNER=1` to show it again. For full header+footer as email, use **`get_statement_pdf`** on the server.

### SOA header / footer (match email PDF)

Return any of these from `get_customer_statement`, `get_statement_branding`, or `get_statement_pdf` metadata:

```json
{
  "message": {
    "header_html": "<div>… same as Print Format letterhead …</div>",
    "footer_html": "<div>… bank / remittance block …</div>",
    "footer_lines": ["Bank: …", "IBAN: …"],
    "company_name": "Printechs Advanced Printing Trading Co.",
    "company_address_html": "Riyadh …",
    "logo_url": "/files/company-logo.png"
  }
}
```

Whitelisted methods (mobile tries in order):

- `erp_analysis.customer_notifications.get_statement_branding`
- `erp_analysis.receivables.get_statement_branding`

**Best match to desk/email:** implement `get_statement_pdf` using the same Print Format as `send_statement_pdf` — mobile will download that PDF and skip on-device HTML entirely.

Deploy `get_statement_pdf` on the server for pixel-perfect Print Format output when the API is available.

## User flow

1. Tap **Share PDF (WhatsApp)** (Approvals credit modal) or **WhatsApp PDF** (Customer 360).
2. App shows **Preparing PDF…** / **PDF…**, saves PDF to cache (server download or on-device).
3. OS share sheet opens → user selects **WhatsApp** → picks chat → PDF is sent as a document.

## Files (mobile)

- `src/api/customerStatementPdf.ts` — server fetch + download; local fallback
- `src/utils/statementPdfLocal.ts` — HTML → PDF via `expo-print`
- `src/utils/statementPdfShare.ts` — `expo-sharing` share sheet
