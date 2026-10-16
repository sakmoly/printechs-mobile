# Mobile Sales Dashboard — Test Guide (Phase 1A + 1B)

**Upstream guide:** BA Phase 1A (widget engine + batch API) + Phase 1B (8 boards + Printechs dimensions)  
**Profiles:** `PRINTECHS-B2B` (e.g. `site1.local`) — also validate on **live** (`www.printechs.com`) if that is the app target  
**Test user:** `sakeer@printechs.com`

This copy lives in the mobile repo and adds **mobile implementation notes** (routing, company, cache, known gaps).

---

## 1. Scope

This guide covers the **new Sales dashboard boards** opened from **More** menu tiles with:

```text
screen_type: dashboard
config.dashboard_id: <board_key>   # required even when module_key == board_key
```

These are **separate** from:

| Screen | Module key | Notes |
|--------|------------|-------|
| Legacy purple **Sales** | `sales` | Unchanged — `/sales-dashboard` (YTD Overview / Performance / Trends) |
| **Home** dashboard | `home` | Unchanged — bootstrap home widgets + batch board |
| Tabbed shell (optional) | e.g. `sales_dashboard_test` | `feature_key: board_tabs:…` → `/board-tabs/…` — **not** the Phase 1B 8-tile model |

**Mobile route for Phase 1B tiles:** `/dashboard-board/<dashboard_id>`  
Resolved as: `config.dashboard_id` → else `route_key` → else `module_key`.

---

## 2. Deploy / refresh backend

### site1.local

```bash
bench --site site1.local migrate
bench --site site1.local execute erp_analysis.patches.ensure_b2b_sales_phase1.execute
bench --site site1.local execute erp_analysis.patches.register_dashboard_batch_api.execute
bench --site site1.local clear-cache
```

### Live / other sites

Run the same patches on the site the app actually calls. If tiles work on `site1.local` but not on `www.printechs.com`, the Phase 1B fixtures are not deployed there yet.

After deploy: **logout / login** (or pull-to-refresh More) so `get_mobile_bootstrap` picks up modules.

---

## 3. More menu — dashboard tiles

Bootstrap should expose these enabled modules:

| More menu label | `module_key` | `dashboard_id` (set in config) |
|-----------------|--------------|--------------------------------|
| Sales Overview | `sales_overview` | `sales_overview` |
| Sales Trends | `sales_trend` | `sales_trend` |
| Sales Performance | `sales_dash_performance` | `sales_performance` |
| Sales Customers | `sales_customer` | `sales_customer` |
| Sales Products | `sales_product` | `sales_product` |
| Sales Order Book | `sales_order_book` | `sales_order_book` |
| Sales Profitability | `sales_dash_profitability` | `sales_profitability` |
| Sales Attention | `sales_attention` | `sales_attention` |

### Desk checklist (required)

For each row:

1. **Enabled** = checked  
2. **`screen_type`** = `dashboard`  
3. **Config JSON** includes `"dashboard_id": "<board_key>"` when `module_key` ≠ board key (e.g. `sales_dash_performance` → `sales_performance`)  
4. Do **not** set `route_key` / module key to legacy `sales` (that opens the purple Sales Dashboard)

**Naming:** Prefer board key `sales_trend` (singular) everywhere. Older mobile fallbacks used `sales_trends` only for `board_tabs` defaults — Phase 1B tiles should use the keys in the table above.

---

## 4. Required API flow (correct)

### Step A — Bootstrap (once per session / pull-to-refresh profile)

```
GET /api/method/erp_analysis.api.get_mobile_bootstrap
```

Use for:

- More menu modules (`modules[]`)
- Board layout (`dashboards[]` — widget keys, types, order)
- **Do not** treat bootstrap widget rows as loaded data (no KPI values, no chart series)

Mobile may hydrate bootstrap from **disk cache** for fast start, then refresh in background.

### Step B — Batch load (on every dashboard open)

```
GET /api/method/erp_analysis.api.get_dashboard_board_data
    ?dashboard_id=sales_overview
```

Optional params:

| Param | Default | Purpose | Mobile sends? |
|-------|---------|---------|----------------|
| `company` | user default | Company filter | **Yes** (Access Profile / bootstrap `context.company`) |
| `from_date` / `to_date` / `period` | — | Date range | **Yes** (default YTD) |
| `refresh` | `0` | Pull-to-refresh bypass | **Yes** (`1` on pull) |
| `use_cache` | `1` | Server cache TTL ~180s | No — relies on server default |
| `limit` | `10` | Chart/table row limit | No — relies on server default |

**Mobile note:** Batch is **not** called until `company` is known. Fetching without company often returns **zeros / empty** widgets. Company comes from Access Profile scope, with bootstrap `context.company` as a fast-start fallback.

### Step C — Single widget (drill-down only)

```
GET /api/method/erp_analysis.api.get_dashboard_widget_data
    ?widget_key=sales_dash_by_group
    &drill_depth=1
    &filters={"group":["IND"]}
```

Use after the user taps a chart slice — **not** for initial board load.

---

## 5. Batch response shape

```json
{
  "dashboard_id": "sales_overview",
  "widgets": {
    "sales_dash_net_ytd_kpi": {
      "widget_key": "sales_dash_net_ytd_kpi",
      "widget_type": "KPI",
      "kpi": {
        "value": 16044275.65,
        "value_ly": 22560945.66,
        "change_pct": -28.88,
        "direction": "down",
        "format": "currency_compact"
      }
    },
    "sales_dash_territory": {
      "widget_type": "DONUT",
      "chart": { "series": [...] }
    }
  },
  "errors": null,
  "meta": { "schema_version": 1, "widget_count": 7 }
}
```

**Important:** `widgets` is an **object keyed by `widget_key`**, not an array.

Partial failures:

```json
"errors": {
  "sales_dash_order_book": "PermissionError: ..."
}
```

**Mobile:** Successful keys still render. Per-key inline error UI for `errors` is **not** fully wired yet — failed keys may look empty. Do **not** treat `errors != null` as “clear the whole board.”

---

## 6. Widget types mobile must render

| `widget_type` | Data key | Mobile renderer |
|---------------|----------|-----------------|
| `KPI` | `kpi` / `kpis` (+ LY fields) | KPI card (`kpi` normalized to `kpis[]`) |
| `DONUT` / `PIE` / `BAR` / `LINE` | `chart.series[]` | Chart widgets |
| `TABLE` / `RANKING` | `table.columns` + `table.rows` | Table / ranking |
| `LINK` | `action` | Navigation tile |
| `LIST` | prefer `table` / `rows`; legacy `data` | List — **smoke-test** order book / GP / exceptions |

Render by **type / `render_hint` / `drill_views`**, not by hardcoding widget keys.

---

## 7. Per-board test checklist

### sales_overview (7 widgets)

- [ ] Net Sales KPI (YTD + LY + Δ%)
- [ ] Total Invoices KPI
- [ ] Average Invoice KPI
- [ ] Sales by Territory (donut)
- [ ] Sales by Group (donut — Industrial, Retail, …)
- [ ] Performance link → `sales_performance` board
- [ ] Trends link → `sales_trend` board

**Drill:** Sales by Group → sub groups → brand table

```
get_dashboard_widget_data?widget_key=sales_dash_by_group&drill_depth=1
```

### sales_trend (3 widgets)

- [ ] Sales by Group (bar)
- [ ] Sales by Territory (bar)
- [ ] Sales by Sub Group (bar)

### sales_performance (4 widgets)

- [ ] Top Customers (ranking table)
- [ ] Sales by Brand (table)
- [ ] Sales by Territory (ranking)
- [ ] Salespersons link → legacy salesperson module

### sales_customer (2 widgets)

- [ ] Top Customers ranking
- [ ] Customer 360 link

### sales_product (3 widgets)

- [ ] Sales by Brand (table)
- [ ] Sales by Group (bar + drill)
- [ ] Sales by Item Group (table)

### sales_order_book (2 widgets)

- [ ] Order Book (LIST)
- [ ] Open Sales Orders link

### sales_profitability (2 widgets)

- [ ] Gross Profit (LIST)
- [ ] Profitability link

### sales_attention (2 widgets)

- [ ] Management Exceptions (LIST)
- [ ] View All Exceptions link

---

## 8. Known issue — dashboard flashes then disappears

### Symptom A — More tile vanishes

Tile appears after login, then disappears after More focus / bootstrap refresh.

**Likely cause:** `get_mobile_bootstrap` returns the module once, then omits it on the next call (Access Profile / cache / patch not stable).

**Check:** Compare two bootstrap payloads — is `sales_overview` (etc.) still in `modules[]`?

### Symptom B — Board screen goes blank after load

Widgets/skeleton appear, then blank with no error.

### Likely causes (mobile + backend)

#### A. Layout rendered, batch fails or skipped

Keep bootstrap layout; show error banner; **do not** clear layout on batch failure.

#### B. Treating `widgets` as an array / over-filtering types

Batch returns an **object**. Filter only unknown types after merge by key — don’t keep only `PIE`.

#### C. Unsupported widget types

Phase 1 boards use KPI, TABLE, RANKING, DONUT, BAR, LINK, LIST. Mobile registry supports these; if a board looks empty, log `widget_type` + payload shape.

#### D. Access / 403 on batch API

Allow in Access Profile:

```text
erp_analysis.api.get_dashboard_board_data
```

Browser smoke (as test user):

```
/api/method/erp_analysis.api.get_dashboard_board_data?dashboard_id=sales_overview
```

#### E. Race / company change

Don’t reset widgets to `[]` at refresh start. Mobile waits for **company** before batch to avoid zero payloads.

#### F. `errors` treated as total failure

Render keys present in `widgets`; don’t blank the board when `errors` is non-null.

#### G. Wrong `dashboard_id`

`module_key` `sales_dash_performance` without `config.dashboard_id: sales_performance` loads the wrong board or an empty one.

---

## 9. Debugging steps (mobile team)

### 9.1 Network log

On dashboard open:

1. `get_mobile_bootstrap` (if not cached)
2. `get_dashboard_board_data?dashboard_id=<id>` **with company**

### 9.2 Compare bootstrap vs batch keys

```javascript
bootstrap.dashboards.find(d => d.key === 'sales_overview')?.widgets?.map(w => w.key)
Object.keys(batchResponse.widgets)
```

### 9.3 Console (Metro)

Useful existing logs:

- `[more-hub]` — bootstrap modules vs hub tiles  
- `[board-data]` — `dashboard_id` + batch keys  
- `[home-widgets]` — layout keys vs batch keys  

### 9.4 Backend smoke test

```bash
bench --site site1.local console
```

```python
import frappe
frappe.set_user("sakeer@printechs.com")
from erp_analysis.services.mobile_widgets import get_dashboard_board_data
r = get_dashboard_board_data(dashboard_id="sales_overview", use_cache=False)
print(len(r["widgets"]), r.get("errors"))
print(list(r["widgets"].keys()))
```

Expected for overview: `7` widgets, `errors` null (or only non-blocking partial errors).

---

## 10. Recommended mobile flow (implemented)

```text
User taps More tile (screen_type=dashboard)
        │
        ▼
Open /dashboard-board/<dashboard_id>
        │
        ▼
Bootstrap dashboards[] → layout / order
        │
        ▼
Wait for company → GET get_dashboard_board_data
        │
        ├── success → merge layout + batch by key → render by widget_type
        │
        └── failure → keep layout / show error (no full clear)
```

**Do not:**

- N× `get_dashboard_widget_data` on board open  
- Treat bootstrap rows as KPI/chart data  
- Hide all widgets when one key fails  

**Do:**

- Batch for initial load  
- Single-widget API for drill only  
- Pull-to-refresh with `refresh=1`  

---

## 11. Sample URLs

```text
GET <host>/api/method/erp_analysis.api.get_mobile_bootstrap

GET <host>/api/method/erp_analysis.api.get_dashboard_board_data?dashboard_id=sales_overview&company=<Company>

GET <host>/api/method/erp_analysis.api.get_dashboard_widget_data?widget_key=sales_dash_by_group&drill_depth=1&filters={"group":["IND"]}
```

---

## 12. Pass criteria

- [ ] All 8 More dashboard tiles open without blank screen  
- [ ] Batch API called **once** per board open (after company ready)  
- [ ] KPI cards show value + LY + change %  
- [ ] Charts show series (territory, group)  
- [ ] Tables show rows (brand, customers)  
- [ ] LINK tiles navigate correctly  
- [ ] LIST widgets show data (order book, profitability, exceptions)  
- [ ] Group drill-down works (group → sub_group → brand)  
- [ ] Dashboard does not disappear after initial load  
- [ ] More tile does not vanish after bootstrap refresh  
- [ ] Pull-to-refresh reloads without blank flash  
- [ ] Values are non-zero when server smoke test returns non-zero (company present)  

---

## 13. Mobile implementation map

| Concern | Location |
|---------|----------|
| More hub / `screen_type: dashboard` | `src/modules/resolveHubItems.ts` |
| Board screen | `app/dashboard-board/[boardKey].tsx` |
| Batch client | `src/api/dashboardBoardData.ts`, `src/hooks/useDashboardBoardData.ts` |
| Normalize KPI/chart/table | `src/api/dashboardWidgetData.ts` |
| Render by type | `src/widgets/WidgetRenderer.tsx`, `resolveRenderType.ts` |
| Drill | `src/widgets/useWidgetDrill.ts` |
| Session cache (bootstrap + board) | `src/api/sessionCache.ts` |
| Contract (home + widgets) | `docs/MOBILE_DASHBOARD_CONTRACT.md` |

---

## 14. Backend contacts / files

| Topic | File |
|-------|------|
| Widget engine | `erp_analysis/services/mobile_widgets.py` |
| Batch API | `erp_analysis/api.py` → `get_dashboard_board_data` |
| Fixtures | `erp_analysis/fixtures/sales_dashboard_widgets.py` |
| Dimensions | `erp_analysis/fixtures/profile_dimensions.py` |
| Deploy patch | `erp_analysis/patches/ensure_b2b_sales_phase1.py` |

---

*Mobile repo notes added for Phase 1B testing. Upstream: Phase 1B — site1.local, PRINTECHS-B2B.*
