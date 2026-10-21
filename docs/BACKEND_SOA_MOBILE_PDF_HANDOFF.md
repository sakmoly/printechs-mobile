# Backend handoff — Mobile WhatsApp Statement of Account (SOA)

**Status:** Backend deployed (Printechs). WhatsApp share **requires `get_statement_pdf`** for all customers (one Print Format — no per-customer mobile layouts).

**Cursor prompt for ERP team:** [BACKEND_CURSOR_SOA_GET_STATEMENT_PDF.md](./BACKEND_CURSOR_SOA_GET_STATEMENT_PDF.md) — copy-paste into Cursor on the server repo.

---

## API methods (canonical)

| Method | Purpose |
| ------ | ------- |
| `erp_analysis.customer_notifications.get_statement_branding` | Header/footer, `footer_lines`, bank block, logo URL |
| `erp_analysis.receivables.get_statement_branding` | Same (alias) |
| `printechs_utility.customer_notifications.get_statement_branding` | Delegates to `erp_analysis` |
| `erp_analysis.receivables.get_customer_statement` | Live lines + totals + embedded **branding** |

| Method | Notes |
| ------ | ----- |
| `get_statement_pdf` | **Primary for WhatsApp share.** Same Print Format as email SOA. Return `{ file_url }` or `{ pdf_base64 }`. Whitelist + Access Profile. |

### Backend fix for footer / letterhead (recommended)

On-device HTML PDF **does not** render desk `footer_html` (partner strip) reliably — mobile omits that banner by default and keeps **`footer_lines`** (bank / IBAN) only.

**ERP action:** expose **`get_statement_pdf`** that returns the same PDF bytes as **`send_statement_pdf`** (Print Format *Customer Outstanding SOA*), without sending email:

```json
POST /api/method/erp_analysis.customer_notifications.get_statement_pdf
{
  "customer_name": "CUST-00042",
  "company": "Printechs Advanced Printing Trading Co.",
  "from_date": "2026-01-01",
  "to_date": "2026-10-21"
}
```

```json
{
  "message": {
    "file_url": "/files/Statement_CUST-00042.pdf"
  }
}
```

Mobile downloads that file and skips HTML layout entirely.

---

## Mobile flow (implemented)

```
WhatsApp PDF (production)
  → get_statement_pdf (or send_statement_pdf with send_email=0) — download PDF
  → same file as desktop for every customer

Dev only (EXPO_PUBLIC_SOA_PDF_ALLOW_LOCAL=1):
  → HTML PDF on device — different layout; do not use for go-live
```

### Why USG matches desk but another customer looked different

That was **not** intentional. Mobile had been falling back to a **simplified on-device PDF** when `get_statement_pdf` failed (417, whitelist, or wrong params). USG may have hit the server PDF path; others got the fallback. **Fix:** enable server PDF for **all** customers; mobile no longer falls back in production.

---

## Branding content (server)

- **Header:** Letter Head if set; else company name, address, VAT, logo, “Statement of Account”.
- **Footer:** Desk SOA payment wording + bank from **Company `default_bank_account`** (fallback: latest company bank with IBAN).
- **`footer_lines`:** Remittance only — `Company`, `Account`, `Bank`, `IBAN` (same as desk Print Format / Company **default bank account**). Not company postal address. Example: `Company :Advanced Printing Trading Co. (PRINTECHS)`, `Bank :Al Rajhi Bank`.

On-device PDF uses server **`footer_html` / `footer_lines`** when provided. Bank text may differ from old hardcoded Print Format HTML; server branding is source of truth.

---

## Date / scope (important)

| | Server PDF (`get_statement_pdf`) | Mobile on-device PDF |
| -- | -------------------------------- | -------------------- |
| Line set | Outstanding invoices (desk scope) | Same intent: **open outstanding** from `get_customer_statement` |
| `from_date` / `to_date` | Metadata / `requested_period`; **do not filter** outstanding SOA lines on server PDF | Shown on PDF as **period / statement date**; line logic follows statement API |

---

## Sample: `get_statement_branding`

**Request:**

```json
{
  "company": "Printechs Advanced Printing Trading Co.",
  "customer": "CUST-00042",
  "customer_name": "CUST-00042",
  "from_date": "2026-01-01",
  "to_date": "2026-10-21"
}
```

**Response:**

```json
{
  "message": {
    "company_name": "Printechs Advanced Printing Trading Co.",
    "tax_id": "300767166800003",
    "logo_url": "/files/printechs-logo.png",
    "header_html": "<div>… letterhead … Statement of Account …</div>",
    "footer_html": "<div>… desk payment wording …</div>",
    "footer_lines": [
      "Company: Printechs Advanced Printing Trading Co.",
      "Account: …",
      "Bank: …",
      "IBAN: SA…"
    ]
  }
}
```

---

## Sample: enriched `get_customer_statement`

Mobile parses top-level fields, nested `branding`, and duplicate `message` payload:

```json
{
  "message": {
    "customer": "CUST-00042",
    "customer_display_name": "LANDMARK ARABIA CO.",
    "from_date": "2026-01-01",
    "to_date": "2026-10-21",
    "total_invoiced": 1466397.2,
    "total_outstanding": 408082.1,
    "statement_pdf_scope": "outstanding_invoices",
    "print_format": "Customer Outstanding SOA",
    "requested_period": { "from_date": "2026-01-01", "to_date": "2026-10-21" },
    "items": [
      {
        "invoice": "SIR26-000566",
        "posting_date": "2026-05-17",
        "due_date": "2026-06-16",
        "amount": 16832.55,
        "outstanding": 16832.55
      }
    ],
    "header_html": "…",
    "footer_html": "…",
    "footer_lines": ["Company: …", "IBAN: …"],
    "branding": {
      "header_html": "…",
      "footer_html": "…",
      "footer_lines": ["…"]
    }
  }
}
```

---

**Related:** Customer 360 Sales KPIs (MTD/YTD/GP) — [BACKEND_CUSTOMER_360_SALES_KPIS.md](./BACKEND_CUSTOMER_360_SALES_KPIS.md)

---

## Mobile code references

- `src/api/statementSoaBranding.ts` — `get_statement_branding` paths + parsing
- `src/api/customerStatement.ts` — enriched statement + `branding` on payload
- `src/utils/statementPdfLocal.ts` — merge layout + live table → PDF
- `src/api/customerStatementPdf.ts` — WhatsApp entry (mobile PDF only)
