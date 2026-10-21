# Customer 360 — GP / GP% vs desk Gross Profit report

**Status:** **Fixed** on server (`erp_analysis/services/customer_360.py`). Mobile spec unchanged — displays `message.sales.gp` / `gp_pct` from `get_customer_360`.

See [BACKEND_CUSTOMER_360_SALES_KPIS.md](./BACKEND_CUSTOMER_360_SALES_KPIS.md) for the full `sales` block contract.

---

## Root cause (fixed)

`tabSalesDashBoard.Customer` stores **customer_name** (label). Customer 360 scoped SDB with the **Customer link** id (e.g. `USG Middle East Ltd.`).

That mismatch returned **no SDB rows** for COGS. Net sales still matched **Sales Invoice**, but COGS fell back to **Stock Ledger** (often **0**) → **`gp ≈ ytd`** → **`gp_pct: 100`** on mobile.

Desk **Gross Profit** (Printechs) scopes by **Sales Invoice `customer` link** → correct cost → **~57%** for the same customer.

---

## Fix (`erp_analysis/services/customer_360.py`)

SDB queries now scope by **invoice**, aligned with SI customer link:

```sql
Invoice_No IN (
  SELECT name FROM `tabSales Invoice`
  WHERE customer = %s AND docstatus = 1
)
```

Applied to:

- YTD/MTD **net** and **COGS** (GP / GP%)
- **`avg_invoice`** distinct invoice count
- **`charts.sales[]`** — monthly `Net_Amount` from SDB; **SI `base_net_total`** fallback only when SDB has no rows for that month

---

## Verified — USG Middle East Ltd., YTD 2026

| Metric | Before fix | After fix | Desk GP report |
| ------ | ---------- | --------- | -------------- |
| **`gp_pct`** | 100% | **56.6%** | **56.6%** |
| **`ytd`** | 181,684 | 181,684 | (net aligns) |
| **GP (implied)** | ≈ ytd | **102,838.82** | **102,838.82** |

Mobile: **pull to refresh** Customer 360 after server deploy — no app change required.

---

## Expected contract (`get_customer_360` → `message.sales`)

Same **company**, **customer** (link id passed from mobile), and **date window**:

| Field | Definition |
| ----- | ---------- |
| `ytd` | Net sales — SDB `Net_Amount` via SI-scoped `Invoice_No` (SI fallback if SDB empty) |
| `gp` | Net − COGS from same SDB scope |
| `gp_pct` | `gp ÷ ytd × 100` (2 dp) |

### Example JSON (USG, post-fix)

```json
{
  "message": {
    "sales": {
      "ytd": 181684.0,
      "gp": 102838.82,
      "gp_pct": 56.6
    }
  }
}
```

---

## QA checklist (regression)

1. **Gross Profit** report: company, customer, YTD — note net, cost, GP footer.
2. **`get_customer_360`** — same customer, company, `to_date`.
3. Assert `sales.ytd` ≈ report net; `sales.gp` ≈ report GP; `sales.gp_pct` ≈ desk.
4. Spot-check a customer that previously showed **100%** on mobile and one “normal” ~35–45% customer.

---

## Mobile behavior (printechs-mobile)

- Parses `gp`, `gp_pct` from API ([`customer360Types.ts`](../src/api/customer360Types.ts)).
- When `ytd`, `mtd`, and `gp_pct` are present, uses API as authoritative ([`hasAuthoritativeBaSales`](../src/api/customer360.ts)).
- **Safeguard:** if API still sends **~100%** (`gp_pct ≥ 99` or `gp ≥ 99%` of `ytd`), mobile recomputes GP from **Sales Invoice Item** valuation ([`reconcileSuspiciousSalesGp`](../src/api/customer360.ts)) when result is **&lt; 95%** (matches desk when SI costs are readable).
- Customer 360 query **`staleTime: 0`** — pull to refresh always hits the server.

---

## Related docs

- [BACKEND_CUSTOMER_360_SALES_KPIS.md](./BACKEND_CUSTOMER_360_SALES_KPIS.md)
- [ERP_ANALYSIS_API_CONTRACT.md](./ERP_ANALYSIS_API_CONTRACT.md)
- [MOBILE_DASHBOARDS_API.md](./MOBILE_DASHBOARDS_API.md)

**API:** `erp_analysis.customer.get_customer_360` — `/api/method/erp_analysis.customer.get_customer_360`
