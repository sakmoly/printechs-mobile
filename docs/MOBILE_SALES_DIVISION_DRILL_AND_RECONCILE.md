# Sales Division drill + KPI vs Division total (server / BA)

**Audience:** `erp_analysis` backend, Printechs BA  
**Mobile:** Sales Overview → **Sales By → Division** (drill) + **Total Sales** KPI  
**Test user:** `sakeer@printechs.com`  
**Company:** `Printechs Advanced Printing Trading Co.`

---

## 1. KPI vs Division total (Sales Overview)

Mobile sends **one** `get_dashboard_board_data` call per visit with the **same** `company`, `from_date`, `to_date`, `period`, and territory params for every widget on `sales_overview`. It does **not** recompute or filter division rows client-side.

**Mobile UI note:** Blue bars under division names are scaled to the **largest row in the list** (Industrial), not to Total Sales KPI.

**BA acceptance rule:** For the same board request,  
`abs(kpi_total - sum(division_rows)) / kpi_total < 0.02`  
OR return an explicit **`Other`** / **`Unassigned`** division row for the gap.

### 1.1 All Territories + `allow_view_all_sales` (Sakeer) — expected **~20M**

Per **Access Profile** and `ERP_ANALYSIS_API_CONTRACT.md`, when the user picks **All Territories** and has **`allow_view_all_sales`**, totals must be **company-wide** (same order of magnitude as invoice / Home **~20M YTD**), **not** only `view_territories` (~8.66M on Dammam + Riyadh + Jeddah).

**Mobile request** (Sales Overview):

```json
{
  "dashboard_id": "sales_overview",
  "company": "Printechs Advanced Printing Trading Co.",
  "from_date": "2026-01-01",
  "to_date": "2026-10-13",
  "period": "ytd",
  "view_all_sales": 1
}
```

No `filters.territory` / `territory` / `territories` on this path.

**BA must:** When `view_all_sales=1` (or session `allow_view_all_sales` and no territory filter), **do not** restrict `sales_total_kpi`, GP, COGS, and `sales_by_division` to `get_view_territories` only. Use the same company-wide sales source for all widgets on the board (COGS **17.32M** with Total Sales **8.66M** on one board is invalid).

**Wrong server behaviour (current prod replay):** KPI + division both **~8.66M** (SalesDashBoard + view scope). That aligns KPI with division but **violates** Allow View All Sales — user correctly expects **~20M** on Total Sales.

**Last Year chip:** LY / % on KPIs only; division **amounts** stay YTD for the same `from_date` / `to_date` / `period`.

### 1.2 Mobile cache

Pull-to-refresh sends **`refresh: 1`**. After BA deploys company-wide logic, refresh Sales Overview once (or log out/in if disk cache is stale).

### 1.3 If mismatch returns (regression checklist)

| Cause | What to check |
| ----- | ------------- |
| **Different fact table** | KPI back on Sales Invoice vs division on SalesDashBoard |
| **Unassigned division** | SalesDashBoard rows with blank `Division` not in Top N |
| **Wrong screen** | Home invoice total vs Sales Overview dashboard widgets |
| **Period mismatch** | Widget config period vs mobile date pill (not “Last Year” chip) |
| **Stale mobile cache** | Pull-to-refresh Sales; avoid comparing cached board JSON |

---

## 2. Deploy division drill (Printechs B2B)

Already validated on `site1.local` with patch `fix_division_widget_drill`:

```bash
bench --site <site> migrate
bench --site <site> execute erp_analysis.patches.fix_division_widget_drill.execute
bench --site <site> clear-cache
bench restart
```

**Desk / Mobile App Profile — both widgets:**

- `sales_by_division`
- `sales_donut_division`

**Required config:**

```json
{
  "drill_path": ["division", "sub_group", "brand"],
  "show_ly": true
}
```

**Dimension mapping (PRINTECHS-B2B):**

- Item groups live in **`SalesDashBoard.Sub_Group`**, not `Group`.
- API aliases: `item_group`, `group` → **`sub_group`**.

**Analytics:** Apply the same filters on drill as on the board batch: `company`, `from_date`, `to_date`, `period`, `territory` / access scope, `division` when drilled.

---

## 3. Bench script — smoke drill + reconcile totals

Save as `erp_analysis/scripts/sales_division_drill_smoke.py` (or run via `bench execute` one-liner below).

```python
"""
Smoke: division list, drill to sub_group, reconcile KPI vs sum(division).
Run:
  bench --site <site> execute erp_analysis.scripts.sales_division_drill_smoke.run
"""
from __future__ import annotations

import json

import frappe
from frappe.utils import flt, getdate

COMPANY = "Printechs Advanced Printing Trading Co."
USER = "sakeer@printechs.com"
FROM_DATE = "2026-01-01"  # align with mobile date pill (YTD example)
TO_DATE = getdate().strftime("%Y-%m-%d")
PERIOD = "ytd"
TERRITORY = None  # None = access scope / all territories; or "Dammam"


def run():
    frappe.set_user(USER)
    filters = {"company": COMPANY, "from_date": FROM_DATE, "to_date": TO_DATE, "period": PERIOD}
    if TERRITORY:
        filters["filters"] = json.dumps({"territory": [TERRITORY]})

    board = frappe.call(
        "erp_analysis.api.get_dashboard_board_data",
        dashboard_id="sales_overview",
        **filters,
    )
    widgets = (board or {}).get("widgets") or board.get("message", {}).get("widgets") or {}

    def rows(wkey):
        w = widgets.get(wkey) or {}
        if w.get("table", {}).get("rows"):
            return w["table"]["rows"]
        if w.get("chart", {}).get("series"):
            return w["chart"]["series"]
        return w.get("rows") or []

    kpi_w = widgets.get("sales_total_kpi") or widgets.get("sales_dash_net_ytd_kpi") or {}
    kpi_val = flt(
        (kpi_w.get("kpis") or [{}])[0].get("value")
        or kpi_w.get("value")
        or (kpi_w.get("kpi") or {}).get("value")
    )

    div_rows = rows("sales_by_division") or rows("sales_donut_division")
    div_sum = sum(flt(r.get("value") or r.get("amount") or r.get("total_sales")) for r in div_rows)

    print("=== Board batch ===")
    print("KPI total (sales_total_kpi):", kpi_val)
    print("Division rows:", len(div_rows), "sum:", div_sum, "gap:", kpi_val - div_sum)
    for r in div_rows:
        print(" ", r.get("label") or r.get("dimension_value"), flt(r.get("value")))

    # Drill Industrial → sub_group (match mobile: drill_depth=1, dimension=sub_group)
    division = "Industrial"
    drill_filters = {"division": [division]}
    if TERRITORY:
        drill_filters["territory"] = [TERRITORY]

    drill = frappe.call(
        "erp_analysis.api.get_dashboard_widget_data",
        widget_key="sales_by_division",
        company=COMPANY,
        from_date=FROM_DATE,
        to_date=TO_DATE,
        period=PERIOD,
        drill_depth=1,
        dimension="sub_group",
        filters=json.dumps(drill_filters),
        limit=10,
        show_ly=0,
    )
    drill_rows = (
        (drill.get("table") or {}).get("rows")
        or (drill.get("chart") or {}).get("series")
        or drill.get("rows")
        or []
    )
    print("\n=== Drill Industrial → sub_group ===")
    print("rows:", len(drill_rows))
    for r in drill_rows:
        print(" ", r.get("label"), flt(r.get("value")))

    # SQL reconciliation on SalesDashBoard (adjust table/field names if different on site)
    if frappe.db.table_exists("SalesDashBoard"):
        cond = "company = %s AND posting_date BETWEEN %s AND %s"
        params = [COMPANY, FROM_DATE, TO_DATE]
        if TERRITORY:
            cond += " AND territory = %s"
            params.append(TERRITORY)

        total = frappe.db.sql(
            f"SELECT SUM(net_sales) FROM `tabSalesDashBoard` WHERE {cond}",
            params,
        )[0][0]

        by_div = frappe.db.sql(
            f"""
            SELECT IFNULL(division, '(blank)') AS division, SUM(net_sales) AS sales
            FROM `tabSalesDashBoard`
            WHERE {cond}
            GROUP BY division
            ORDER BY sales DESC
            """,
            params,
            as_dict=True,
        )
        div_sql_sum = sum(flt(r.sales) for r in by_div if r.division != "(blank)")
        blank = next((r for r in by_div if r.division == "(blank)"), None)

        print("\n=== SQL SalesDashBoard (net_sales) ===")
        print("Grand total:", flt(total))
        print("Sum division (non-blank):", div_sql_sum)
        print("Blank division:", flt(blank.sales) if blank else 0)
        for r in by_div[:15]:
            print(f"  {r.division}: {flt(r.sales):,.2f}")

    frappe.set_user("Administrator")


if __name__ == "__main__":
    run()
```

**Install on server:** add the file under the `erp_analysis` app, e.g.  
`erp_analysis/erp_analysis/scripts/sales_division_drill_smoke.py` with `run()` as above (and empty `__init__.py` in `scripts/` if needed).

**One-liner:**

```bash
bench --site printechs.com execute erp_analysis.scripts.sales_division_drill_smoke.run
```

Adjust `FROM_DATE` / `TO_DATE` / `TERRITORY` to match the app filters.

**Regression:** If KPI and division sum diverge in **one** board JSON, compare `widgets.sales_total_kpi` with `widgets.sales_by_division` — not Home **`sales_card`**.

---

## 4. curl examples (production)

Replace `<token>`, dates, and territory to match the app.

### 4.1 Board batch (same as mobile Sales screen)

```bash
curl -s -X POST "https://printechs.com/api/method/erp_analysis.api.get_dashboard_board_data" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "dashboard_id": "sales_overview",
    "company": "Printechs Advanced Printing Trading Co.",
    "from_date": "2026-01-01",
    "to_date": "2026-10-13",
    "period": "ytd"
  }'
```

From the JSON (Sakeer, All Territories + `view_all_sales: 1`):

- `widgets.sales_total_kpi` → **~20M SAR** company-wide YTD
- `widgets.sales_by_division` → rows summing to the **same** total as KPI

### 4.2 Division drill — Industrial → sub_group

```bash
curl -s -G "https://printechs.com/api/method/erp_analysis.api.get_dashboard_widget_data" \
  -H "Authorization: Bearer <token>" \
  --data-urlencode "widget_key=sales_by_division" \
  --data-urlencode "company=Printechs Advanced Printing Trading Co." \
  --data-urlencode "from_date=2026-01-01" \
  --data-urlencode "to_date=2026-10-12" \
  --data-urlencode "period=ytd" \
  --data-urlencode "drill_depth=1" \
  --data-urlencode "dimension=sub_group" \
  --data-urlencode 'filters={"division":["Industrial"]}' \
  --data-urlencode "limit=10" \
  --data-urlencode "show_ly=0"
```

Repeat with `"division":["Retail"]`. If Industrial returns rows and Retail does not, check **Retail** lines in `SalesDashBoard` and filter application (not mobile).

### 4.3 All Territories + access scope (verified mobile)

| Access Profile | **All Territories** chip — board + widget fallback |
| -------------- | --------------------------------------------------- |
| `allow_view_all_sales: true` | **No** territory filters; **`view_all_sales: 1`** — server must return **company-wide** sales, not `view_territories` only |
| otherwise | `filters={"territory":["Dammam","Riyadh","Jeddah",…]}` + `territories=Dammam,Riyadh,Jeddah` |

**Division tab rows** come only from the board batch (`sales_by_division` in that response). Mobile does **not** rescale, re-sum, or filter division rows client-side.

**Sales By ranking metrics:** **`gp_pct`** as `32.1% GP` when present on the row; **`change_pct`** as `±% LY` when the filter compare is **Last Year** and the board sent LY fields. Drill widget calls use `show_ly: 0`, so LY often appears only on the top-level tab list, not drill rows.

If **Total Sales KPI** and **sum(Division rows)** disagree on the same screen with the same chip, replay **§4.1** once and compare `widgets.sales_total_kpi` vs `widgets.sales_by_division` in the JSON — both widgets must use the same metric and territory scope on the server.

**Drill** uses the same territory rules as the board (including company-wide when allow-all).

**Division filter (mobile):** On tap **Industrial** / **Retail**, widget POST must include `filters` with **`division`** (not `sub_group` for the division value), e.g. `{"division":["Industrial"],"territory":[…]}`, plus optional `drill_crumbs` `[{"dimension":"division","value":"Industrial",…}]`, `drill_depth=1`, `dimension=sub_group`. Item group step sends **`sub_group` only** (not duplicated `item_group`). Brand step: `drill_depth=2`, `filters.division` + `filters.sub_group`, `dimension=brand`. Mobile **does not** use `get_product_performance` for brand drill when the widget returns empty — that API returns company-wide top brands (wrong scope). If brands look global (Hitachi + FEC POS under Industrial › Systems), BA must return brand rows from **widget drill** or fix scoped brand SQL.

---

## 5. Fix checklist for BA

1. [ ] **All Territories + allow_view_all_sales:** `sales_total_kpi` ≈ **20M** YTD (company-wide), not ~8.66M view-scoped.
2. [ ] **Reconcile:** KPI total = sum(division rows) on the **same** board JSON after (1).
3. [ ] **One scope:** GP / COGS / orders KPIs on `sales_overview` use the same territory scope as Total Sales (no COGS > Total Sales).
4. [ ] **drill_path** on `sales_by_division` and `sales_donut_division`.
5. [ ] Drill uses **`sub_group`**; aliases `item_group` / `group`.
6. [ ] Drill applies **division**, **territory**, **dates** same as batch.
7. [ ] **Retail** drill returns sub_groups when SQL shows Retail division sales > 0.
8. [ ] Optimize drill query (indexes on `company`, `posting_date`, `territory`, `division`, `sub_group`).

---

## 6. Mobile reference

| Item | Value |
| ---- | ----- |
| Board | `dashboard_id=sales_overview` |
| All Territories + allow-all | `view_all_sales: 1`, no territory filters |
| Division tab widget keys | `sales_by_division`, `sales_donut_division` |
| Drill depth | `1` = sub_group, `2` = brand |
| Mobile `dimension` | `sub_group` (via `drill_path[1]`) |
| Compare chip “Last Year” | LY on KPIs only — **not** calendar period |

See also: [MOBILE_DASHBOARDS_API.md](./MOBILE_DASHBOARDS_API.md), [MOBILE_SALES_DASHBOARD_TEST.md](./MOBILE_SALES_DASHBOARD_TEST.md).

---

## 7. Division → Item group → Brand — requests & response JSON (BA)

### 7.1 Is it separate JSON?

| Level | API | When |
| ----- | --- | ---- |
| **Division** (root list) | **`get_dashboard_board_data`** | One batch; widget `sales_by_division` inside `message.widgets` |
| **Item group** (`sub_group`) | **`get_dashboard_widget_data`** | After user taps a division row (`drill_depth=1`) |
| **Brand** | **`get_dashboard_widget_data`** | After user taps an item group row (`drill_depth=2`) |

So: **one JSON for division (board batch)** + **one JSON per drill tap** (item group, then brand). Not three widgets in one drill call.

Desk **`drill_path`**: `["division", "sub_group", "brand"]`  
Printechs maps **item group** → logical key **`sub_group`** (aliases `item_group`, `group` in `filters`).

**Sakeer / All Territories / allow_view_all_sales:** add `"view_all_sales": 1` to every request below; omit `filters.territory` unless testing a single territory chip.

---

### 7.2 Level 0 — Division (board batch)

**POST** `/api/method/erp_analysis.api.get_dashboard_board_data`

```json
{
  "dashboard_id": "sales_overview",
  "company": "Printechs Advanced Printing Trading Co.",
  "from_date": "2026-01-01",
  "to_date": "2026-10-13",
  "period": "ytd",
  "view_all_sales": 1
}
```

**Read division rows from:**

```json
{
  "message": {
    "widgets": {
      "sales_by_division": {
        "widget_key": "sales_by_division",
        "widget_type": "RANKING",
        "currency": "SAR",
        "meta": {
          "drill_path": ["division", "sub_group", "brand"],
          "drill_depth": 0,
          "drillable": true
        },
        "chart": {
          "series": [
            {
              "label": "Industrial",
              "dimension_value": "Industrial",
              "value": 10270000,
              "change_pct": -36.5
            }
          ]
        },
        "table": {
          "rows": [
            {
              "label": "Industrial",
              "value": 10270000,
              "change_pct": -36.5
            }
          ]
        }
      }
    }
  }
}
```

Mobile accepts **`chart.series`** or **`table.rows`** (either is enough). Each row needs at least **`label`** + **`value`** (number). Optional: `change_pct`, `dimension_value`, `value_ly`.

---

### 7.3 Level 1 — Item group (after tap **Industrial**)

**POST** `/api/method/erp_analysis.api.get_dashboard_widget_data`

```json
{
  "widget_key": "sales_by_division",
  "company": "Printechs Advanced Printing Trading Co.",
  "from_date": "2026-01-01",
  "to_date": "2026-10-13",
  "period": "ytd",
  "drill_depth": 1,
  "dimension": "sub_group",
  "limit": 10,
  "show_ly": 0,
  "view_all_sales": 1,
  "filters": "{\"division\":[\"Industrial\"],\"sub_group\":[\"<optional if retry>\"],\"item_group\":[\"<same as sub_group when mirrored>\"]}"
}
```

Mobile sends **`filters` as a JSON string**. For depth 1, only **`division`** is required in filters (example):

```json
{"division":["Industrial"]}
```

**Expected response shape** (same as §7.2 — series or table rows; labels = item group / sub_group names):

```json
{
  "message": {
    "widget_key": "sales_by_division",
    "meta": {
      "drill_path": ["division", "sub_group", "brand"],
      "drill_depth": 1,
      "next_dimension": "brand"
    },
    "chart": {
      "series": [
        { "label": "IC - Industrial Chemicals", "value": 2500000, "change_pct": -12.1 }
      ]
    }
  }
}
```

---

### 7.4 Level 2 — Brand (Industrial → Industrial Systems)

**POST** `erp_analysis.api.get_dashboard_widget_data`

**Canonical body (BA PASS — site1.local / sakeer / YTD 2026-01-01 → 2026-10-13):**

```json
{
  "widget_key": "sales_by_division",
  "company": "Printechs Advanced Printing Trading Co.",
  "from_date": "2026-01-01",
  "to_date": "2026-10-13",
  "period": "ytd",
  "drill_depth": 2,
  "dimension": "brand",
  "filters": "{\"division\":[\"Industrial\"],\"sub_group\":[\"Industrial Systems\"]}"
}
```

| Check | PASS |
| ----- | ---- |
| `meta.drill_depth` | `2` |
| `meta.dimension` | `brand` |
| `table.filters` | division + sub_group (no duplicate `item_group`) |
| Row count | 10 — Hitachi, Kezojet, OHAUS, Hiweigh, TSC, … |
| Scope signal | Hitachi **≈ 1.82M** (item group). **≈ 9.35M** = division/global — **FAIL** |

**Mobile sends:** same shape + optional `drill_crumbs` JSON; `show_ly: 0` on drill; `view_all_sales: 1` when All Territories + allow-all. Renders **`table.rows` / `rows` / `chart.series`** — **no** `get_product_performance` at brand depth (avoids global top brands).

**Negative cases (BA confirmed):**

| Scenario | Expected |
| -------- | -------- |
| `filters: "{}"` | `rows: []`, `meta.empty_state: missing_drill_filter` |
| Division only (no `sub_group`) at depth 2 | Wrong scope — Hitachi ~9.35M (division-wide), not item-group brands |

**Filter keys:** Use **`sub_group` only** in widget drill filters (do not mirror `item_group`). Item-group tap must send the **full** `Sub_Group` from `tabSalesDashBoard` (e.g. `Industrial Consumables`, `Industrial Systems`) — not the short breadcrumb title `Consumables` alone.

**Primary API:** `get_sales_by_division_drill` — same filter rules as widget drill.

**Server (resolved filters):** Short `sub_group` values may be expanded when `division` is set (e.g. `Consumables` + `Industrial` → `Industrial Consumables`). Response should echo resolved filters:

```json
"filters": {
  "division": ["Industrial"],
  "sub_group": ["Industrial Consumables"]
}
```

**Depth 1 row (mobile must use for next tap):**

```json
{
  "label": "Industrial Consumables",
  "dimension_value": "Industrial Consumables",
  "sub_group": "Industrial Consumables",
  "drill_filter": { "sub_group": ["Industrial Consumables"] }
}
```

Mobile tap order: `row.sub_group` → `row.drill_filter.sub_group[0]` → `row.dimension_value` — **never** the shortened display title alone.

**Depth 2 example (Industrial → Consumables group):**

```json
{
  "drill_depth": 2,
  "filters": {
    "division": ["Industrial"],
    "sub_group": ["Industrial Consumables"]
  }
}
```

Sending only `"Consumables"` without `division` (or without the full `sub_group` name) is ambiguous (Industrial vs Retail vs Food) — **always** send `division` + full `sub_group`.

**Brand scope (mobile — do not use fixed Hitachi caps):**

| Server field | Mobile action |
| ------------ | ------------- |
| `accept_response: true` or `drill_scope_status: "scoped"` | **Use** `rows` — no reject, no product performance |
| `is_division_wide_brand_mix: true` or `scope_check.matches_division_wide_hitachi: true` | Reject (~9.35M division-wide pattern) |
| No flags (widget fallback only) | Legacy: reject only if top brand / Hitachi ≥ ~**8.5M** (~9.35M reference), **not** ~6M under `Industrial Consumables` |

Implementation: `src/utils/salesDrillScope.ts`, `fetchSalesDashboardDrillOnce` in `src/utils/salesByDivisionDrill.ts`.

---

### 7.5 Local cache on mobile

| Data | Cached on disk? | Where |
| ---- | ---------------- | ----- |
| **Division list** (board) | **Yes** | AsyncStorage `@printechs/cache/board/v3:…` (up to **24h**), keyed by user + company + dates + period + territory/`view_all_sales` |
| **Drill (item group / brand)** | **No (disk)** | In-memory **`drillRowsCache`** only for the app session; cleared when territory, dates, or Sales By tab changes |
| **Widget fallback** (if board missing widget) | **Yes** | `@printechs/cache/widget/v3:…` — root widget only (**no** `drill_depth` / drill filters in key) |

To force fresh division data: **pull-to-refresh** on Sales (`refresh: 1` on board). Drill levels always refetch from network unless the same drill path was already loaded **in this session** (memory cache).

BA can validate availability with the three POST bodies above (board + drill_depth 1 + drill_depth 2) without the mobile app.
