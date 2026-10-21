# Customer 360 — Sales KPIs (backend ↔ mobile)

**Status:** Implemented on server (`erp_analysis.customer.get_customer_360`).

Mobile reads **`message.sales`** directly. **Statement / receivables are not used for sales.\***

---

## `sales` block (submitted invoice / SDB data)

| Field | Source (desk-aligned) |
| ----- | --------------------- |
| `today`, `mtd`, `ytd` | Net sales — **tabSalesDashBoard.Net_Amount** (Printechs GP path), Customer + Company + date filter; respects `to_date` / as-of when passed |
| `gp`, `gp_pct` | YTD gross profit and GP% from SDB scoped by **SI `Invoice_No`** (customer link) — Net_Amount − COGS. Must match desk **Gross Profit** report. Fixed SDB customer-name vs link mismatch — [BACKEND_CUSTOMER_360_GP_VS_DESK_REPORT.md](./BACKEND_CUSTOMER_360_GP_VS_DESK_REPORT.md). |
| `avg_invoice` | **`sales.ytd` ÷ distinct submitted invoice count** in the same YTD window (respects `to_date` / as-of). Count: **SalesDashBoard.Invoice_No** when SDB has rows; else **Sales Invoice** (docstatus = 1, excludes returns). Rounded 2 dp; **0** when no invoices |
| `last_invoice_date` | Latest submitted **Sales Invoice** posting date |

**Fallback when SDB has no rows:** submitted **Sales Invoice** `base_net_total` + COGS from Stock Ledger.

**Example (site):** LANDMARK ARABIA CO. — `ytd` 1,275,128; `gp_pct` 35.91%; `avg_invoice` 42,500.50.

---

## Example JSON

```json
{
  "message": {
    "sales": {
      "mtd": 153524.0,
      "ytd": 1275128.0,
      "gp": 457860.14,
      "gp_pct": 35.91,
      "avg_invoice": 42500.5,
      "last_invoice_date": "2026-10-08"
    },
    "receivables": {
      "outstanding": 408082.1,
      "overdue": 231529.5
    }
  }
}
```

---

## Unchanged (AR — not sales)

| Block | Use |
| ----- | --- |
| `receivables` | Outstanding / overdue / open AR |
| `statement` | Link to `get_customer_statement` only (PDF/preview) — **not** `sales.*` |

---

## Mobile behavior (printechs-mobile)

1. Parse `sales.*` in `normalizeSalesFromRoot` — **`avg_invoice` from API as-is** (including **0**).
2. When **ytd**, **mtd**, and **gp_pct** are present, skip statement/SI overrides for period KPIs (`hasAuthoritativeBaSales`).
3. SI avg fallback runs **only** when `avg_invoice` is **omitted** (null), not when backend sends **0**.
4. **YTD trend — month sales:** prefer **`charts.sales[]`** from BA (SDB net) when present; live SI fills **zero months only** (net total, not grand total). **`receivables.avg_monthly_sales`** = **`sales.ytd` ÷ months elapsed**, not the average of the trend table rows.
5. Do **not** put **`avg_invoice`** (YTD ÷ invoice count) into **`avg_monthly_sales`** — mobile recomputes monthly avg from **`sales.ytd`** when present.

**Aliases:** `sales_today`, `sales_mtd`, `sales_ytd`, `gross_profit`, `gross_profit_percent`, `gp_percent`, `ytd_invoice_count` (derive avg if avg omitted).

---

## Repo references

- Parser: `src/api/customer360Types.ts`
- Enrichment: `src/api/customer360.ts`
- UI: `app/(tabs)/customer-360.tsx`
