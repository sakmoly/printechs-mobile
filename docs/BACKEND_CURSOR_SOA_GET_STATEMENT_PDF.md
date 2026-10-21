# Cursor instructions — Server `get_statement_pdf` (WhatsApp SOA)

**Give this entire section to your ERP / Frappe developer** (paste into Cursor on the **erp_analysis** or **printechs_utility** repo).

Mobile app repo: `printechs-mobile` — see [BACKEND_SOA_MOBILE_PDF_HANDOFF.md](./BACKEND_SOA_MOBILE_PDF_HANDOFF.md) for API contract.

---

## Copy-paste prompt for Cursor (server)

```text
You are working on Printechs ERPNext (Frappe) — erp_analysis and/or printechs_utility.

GOAL
Mobile WhatsApp "Share statement PDF" must download the EXACT same PDF as desktop/email for EVERY customer — Print Format "Customer Outstanding SOA". No per-customer mobile layouts.

Implement or fix:

1) erp_analysis.customer_notifications.get_statement_pdf
   - Whitelisted @frappe.whitelist(allow_guest=False)
   - Mirror in printechs_utility.customer_notifications.get_statement_pdf (delegate to erp_analysis)
   - Accept kwargs (run fix_cmd_kwargs / BA wrapper if kwargs are stripped):
     customer_name (required) — Customer link name OR accept alias `customer`
     company (optional, default user default company)
     from_date, to_date (optional — metadata only; do NOT filter outstanding SOA lines by calendar period)
     print_format (optional, default "Customer Outstanding SOA")
     send_email=0, return_pdf=true, return_file_url=true, delivery="download" (ignore for PDF generation)

2) PDF generation
   - Reuse the SAME code path as send_statement_pdf / desk "Statement Of Account" report
   - Scope: open outstanding invoices for customer (same as desktop SOA), NOT YTD sales-only filter
   - Do NOT send email when called from get_statement_pdf
   - Return ONE of:
     { "file_url": "/files/Statement_<customer>.pdf" }   (preferred)
     { "pdf_base64": "<base64>" }
     Optional nested under message: { "message": { "file_url": "..." } }
   - file_url MUST be the full SOA PDF (all open invoice lines), NOT Letter Head / logo-only PDF.
     Do not put letter_head file paths in file_url or nested url fields.

3) get_statement_branding / footer_lines (already used when HTML fallback exists)
   - footer_lines must match Print Format bank block: Company, Account, Bank, IBAN from Company default_bank_account (same as desk — e.g. Al Rajhi), NOT random SAB unless that is the default account
   - Not company postal address in footer_lines

4) Access
   - Add get_statement_pdf to mobile Access Profile / API whitelist (same as get_customer_statement)
   - OAuth Bearer must work; mobile downloads via frappe.utils.file_manager.download_file?file_url=...

5) Tests (manual)
   - Postman POST get_statement_pdf for:
     a) USG Middle East Ltd. (or Factory of USG…) — must match desktop PDF layout
     b) Apparel Trading Co. Ltd. — same Print Format, not a different layout
   - Compare file to desktop SOA for same customer + company + As On date
   - Confirm HTTP 200, not 417 (method missing / kwargs stripped)

REFERENCE — mobile calls (printechs-mobile src/api/customerStatementPdf.ts):
  POST /api/method/erp_analysis.customer_notifications.get_statement_pdf
  Fallback paths tried: printechs_utility.customer_notifications.get_statement_pdf,
    send_statement_pdf with send_email=0 and return_pdf=true

Sample request body:
{
  "customer_name": "CUST-00042",
  "customer": "CUST-00042",
  "company": "Printechs Advanced Printing Trading Co.",
  "from_date": "2011-01-01",
  "to_date": "2026-10-21",
  "print_format": "Customer Outstanding SOA",
  "send_email": 0,
  "return_pdf": true,
  "return_file_url": true
}

Sample response:
{
  "message": {
    "file_url": "/private/files/Statement_CUST-00042.pdf",
    "print_format": "Customer Outstanding SOA",
    "statement_pdf_scope": "outstanding_invoices",
    "soa_body_present": true,
    "soa_pdf_verified": true
  }
}

Mobile accepts the PDF when `message.soa_body_present === true` OR `message.soa_pdf_verified === true`
(without scanning PDF bytes — compressed desk PDFs often hide plain text).
Set both flags false only when the PDF is letterhead-only.

6) get_customer_360.statement block (mobile reads this after deploy)
     Return so WhatsApp uses the same method/params as desk:
   {
     "statement": {
       "method": "erp_analysis.receivables.get_customer_statement",
       "pdf_method": "erp_analysis.customer_notifications.get_statement_pdf",
       "pdf_share_method": "erp_analysis.customer_notifications.get_statement_pdf",
       "params": { "customer_name": "<Customer link name>", "company": "..." }
     }
   }
   Mobile uses pdf_method / pdf_share_method only for PDF — not `method` (JSON statement).

Do not change mobile app code in this task — server only. After deploy: bench restart, clear cache if used, verify whitelist.
```

---

## Postman checklist (after deploy)

| Step | Action |
| ---- | ------ |
| 1 | OAuth token (same as mobile user) |
| 2 | `POST .../erp_analysis.customer_notifications.get_statement_pdf` with USG customer id |
| 3 | `POST` again with Apparel (or any customer that failed on mobile) |
| 4 | Download `file_url` with Bearer token |
| 5 | Open PDF — must match desk SOA (header, As On dd-mm-yyyy, PO column if on desk, footer logos, bank block) |

---

## If mobile PDF is letterhead only (blank body)

If **`soa_body_present`** / **`soa_pdf_verified`** are absent or false, mobile may compare the file to **`get_customer_statement`** open lines and block share when the PDF looks empty.

When the server sets **`soa_body_present: true`** (or **`soa_pdf_verified: true`**) after the same checks as desk SOA, mobile **trusts that flag** and shares the PDF.

Postman (Landmark): confirm flags are true when desk SOA has lines; if true but mobile still errors, update the app build.

---

## If mobile still shows an error

Mobile production **does not** build HTML PDF unless `EXPO_PUBLIC_SOA_PDF_ALLOW_LOCAL=1`.

User sees: *"Could not download the official statement PDF from ERP…"*

Check server logs for that customer: 403 Access Profile, 417 method/kwargs, 404 Customer, or empty PDF.

---

## Related docs

- [BACKEND_SOA_MOBILE_PDF_HANDOFF.md](./BACKEND_SOA_MOBILE_PDF_HANDOFF.md) — full contract + samples
- [MOBILE_STATEMENT_PDF_WHATSAPP.md](./MOBILE_STATEMENT_PDF_WHATSAPP.md) — mobile user flow
