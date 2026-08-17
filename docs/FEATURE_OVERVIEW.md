# Printechs Mobile — Complete Feature Overview

**Purpose:** Product inventory of what the app supports today, so you can compare against new client requirements and spot gaps.

| Item | Value |
| ---- | ----- |
| App name | Printechs ERP Application |
| Bundle / package | `com.printechs.erpnext` |
| Version | `2.1.0` (iOS buildNumber / Android versionCode `11`) |
| Platforms | iOS (incl. tablet), Android, Web (Expo) |
| Stack | Expo SDK 54, Expo Router, React Native 0.81 |
| Backend app | `erp_analysis` on any ERPNext site |
| Deep link scheme | `erpnext` |

**Product intent:** Business Analysis (BA) on the go — Sales, Receivables, Inventory, Approvals — branded Printechs, installable against any ERPNext customer site.

---

## How to use this document

1. Mark each feature **Keep / Change / Drop / New** for a target client.
2. Check **Availability** (Live / Demo / Hidden / Stub).
3. Use **Gaps & candidates** at the end for additional requirements brainstorming.
4. Cross-check server config with `docs/BACKEND_MULTI_CLIENT_GUIDE.md` and `docs/ERP_ANALYSIS_API_CONTRACT.md`.

**Availability legend**

| Tag | Meaning |
| --- | ------- |
| **Live** | Wired to real `erp_analysis` APIs when server URL is set |
| **Demo** | Works with empty server URL (mock data) |
| **Gated** | Exists in code; off via Phase 2, menu, or `mobileConfig` |
| **Stub / mock-only** | UI or data mostly hardcoded; not production-ready |
| **Orphan** | Screen exists but not in main navigation |

---

## 1. Access, auth & server

| Feature | Availability | Notes |
| ------- | ------------ | ----- |
| Empty server URL = Demo mode | Live | Any email + any 6-digit OTP; no email sent |
| Real server URL | Live | Disables demo; password login |
| Username / password login (OAuth2 password grant) | Live | `frappe.integrations.oauth2.get_token` |
| OTP login for real servers | Gated / unused | APIs exist (`auth_otp.*`); UI uses password on real sites |
| Remember last username per server | Live | |
| Session restore + secure token storage | Live | 401 → logout |
| Token refresh | Live | |
| Server URL configuration (login + Settings) | Live | `http(s)://…` |
| OAuth Client ID (manual or auto) | Live | `erp_analysis.config.get_client_id` |
| Health check before save | Live | `erp_analysis.api.health`; optional “Save anyway” |
| Logout | Live | Clears session; may clear access cache |

---

## 2. Navigation structure

### Bottom tabs

| Tab | Route | Module gate | Permission key | Status |
| --- | ----- | ----------- | -------------- | ------ |
| Dashboard | `/(tabs)/index` | `sales` | AO-00022 | Live |
| Approvals | `/(tabs)/approvals` | `approvals` | AO-00023 | Live |
| E-Catalogue | `/(tabs)/ecatalogue` | `catalogue` | AO-00031 | **Gated (Phase 2 off)** |
| Settings | `/(tabs)/settings` | `settings` | AO-00025 | Live |

If no tabs are allowed → Dashboard + Settings forced on.

### Stack screens (opened from cards / lists)

| Screen | Route | Status |
| ------ | ----- | ------ |
| Sales dashboard | `/sales-dashboard` | Live + Demo |
| Receivables dashboard | `/receivables-dashboard` | Live + Demo |
| Inventory dashboard | `/inventory-dashboard` | Live + Demo |
| Territory receivables detail | `/territory-details` | Live |
| Customer statement | `/customer-statement` | Live |
| Customer 360 | `/customer-360` | Live + Demo (`modules.customer_360`) |
| Collection | `/collection-dashboard` | Live + Demo (`modules.collection`) |
| Sales Orders | `/sales-order-dashboard` | Live + Demo (`modules.sales_orders`) |
| Payables | `/payables-dashboard` | Live + Demo (`modules.payables`) |
| Purchase | `/purchase-performance-dashboard` | Live + Demo (`modules.purchase`) |
| Inventory Health | `/inventory-health` | Live + Demo (`modules.inventory_health`) |
| Profitability | `/profitability-dashboard` | Live + Demo (`modules.profitability`) |
| Exceptions | `/exceptions-dashboard` | Live + Demo (`modules.exceptions`) |
| Approval Analytics | `/approval-analytics` | Live + Demo (`modules.approval_analytics`) |
| Salesperson performance | `/salesperson-performance` | Live + Demo |
| Product performance | `/product-performance` | Live + Demo |
| KPI details | `/kpi-details` | Orphan / lightly used |
| User profile + QR | `/user-profile` | Live |
| Employee list | `/(tabs)/employees` | Orphan (not in tab bar); **mock API** |
| Employee profile + QR | `/employee-profile/[id]` | Orphan / mock data |
| PDF viewer | `/pdf-viewer` | Live helper |
| Catalogue flipbook | `/flip-web` | Gated with catalogue |
| Catalogue YouTube | `/youtube-video` | Gated with catalogue |
| Payables dashboard | `/payables-dashboard` | Live + Demo (`modules.payables`) |
| Purchase performance | `/purchase-performance-dashboard` | Live + Demo (`modules.purchase`) |

---

## 3. Home dashboard

**Route:** `/(tabs)/index`

| Capability | Availability |
| ---------- | ------------ |
| Greeting header + date | Live |
| Pull-to-refresh / focus refresh | Live |
| **Phase 3A Executive Dashboard 2.0** (`modules.executive`) | Live + Demo |
| Period selector (Today / MTD / YTD / …) | Live |
| Currency / company from API `meta` | Live |
| KPI sections: Sales, GP, Collection, AR, Inventory, Orders, Purchasing, Payables, Approvals | Live (optional sections) |
| Classic expandable cards if executive API fails | Live fallback |
| Approvals bell with pending count badge | Live |
| Avatar → My Profile | Live |
| Header logout | Live |
| Expandable Sales / Receivables / Inventory (legacy) | Live + Demo |
| Payables / Purchase expandables | Gated by `modules.payables` / `modules.purchase` |
| Menu / module gating via `get_my_access` + `get_mobile_config` | Live |

---

## 4. Sales (Business Analysis)

**Route:** `/sales-dashboard`  
**Tabs:** Overview | Performance | Trends  
**Period:** YTD vs last-year YTD (typical)

### Overview
- Net sales, total invoices, average invoice value
- Gross profit, COGS, gross profit margin %
- Current vs prior year with % delta
- Currency display: **SAR** (fixed in UI today)

### Performance
- Top brands (YTD, vs last year)
- Top customers (YTD, vs last year)

### Trends
- Monthly sales trend (current vs previous)
- Territory performance (pie) — hidden if `dimensions.territory = false`
- Division performance (pie) — hidden if `dimensions.division = false`

### Backend
- Primary: `erp_analysis.dashboard.get_complete_dashboard_data`
- Also: `sales_kpis.get_dashboard_kpis`, `sales_kpis.get_sales_dashboard`

---

## 5. Receivables (AR)

**Route:** `/receivables-dashboard`  
**Tabs:** Overview | Performance | Trends

### Overview
- Total unpaid / receivable
- Aging-style summary (Current / Overdue / Old Balance buckets)
- Overdue bands: 0–30, 31–60, 61–90, 90+
- DSO, average collection period, overdue %

### Performance
- Top overdue customers
- Top overdue invoices
- Collection efficiency
- Aging breakdown bars

### Trends
- Receivable by territory → drill to territory details
- Overdue by territory → same
- Monthly overdue trend
- Sales vs collection
- AR trend series
- Territory sections gated by `dimensions.territory`

### Drill-downs
| Screen | Capability |
| ------ | ---------- |
| Territory details | Unpaid / overdue KPIs, aging, customer list |
| Customer statement | Statement lines (date range), **email PDF** via `send_statement_pdf` |

### Backend
- `get_receivables_snapshot`, `get_receivables_performance`, `get_receivables_trends`
- `get_territory_receivables`, `get_customer_statement`
- `customer_notifications.send_statement_pdf`

---

## 6. Inventory

**Route:** `/inventory-dashboard`  
**Tabs:** Snapshot | Performance | Trend | Risk

### Snapshot
- Total inventory value
- Inventory turnover ratio
- Average days in inventory
- Aging buckets
- **Inventory by Territory** (new card — does not replace Category):
  - Territory → Warehouse → Brand → Item Group → Item
  - Separate drill state from Category
  - API: `get_inventory_hierarchy` (`level=territory` …) — see `docs/INVENTORY_BY_TERRITORY_API.md`
- **Inventory by category** with hierarchical drill-down:
  - Category → Brand → Item Group → Item → Warehouse
  - Breadcrumbs / back
  - API: `get_inventory_hierarchy`

### Performance
- Top fast-moving items
- Top slow-moving items
- Reorder alerts (below reorder level)
- Overstock alerts

### Trend
- Movement in vs out (by month)
- Stock by warehouse (when data present)
- Params: typically `months` (not free-form date range)

### Risk
- Non-moving items
- Aging / critical shortage / overstock risk views

### Backend
- `get_inventory_snapshot`, `get_inventory_performance`, `get_inventory_trends`, `get_inventory_risk`, `get_inventory_hierarchy`

---

## 7. Approvals

**Route:** `/(tabs)/approvals`

| Capability | Availability |
| ---------- | ------------ |
| Pending document list | Live |
| Pull-to-refresh / focus refetch | Live |
| Doctype badge (e.g. Sales Invoice), doc #, status | Live |
| Customer, posting date, branch, territory | Live |
| Qty / amount / VAT / total | Live |
| Credit status chip + detail modal (outstanding / overdue / aging) | Live |
| **Approve** (confirm) | Live |
| **Reject** (reason required) | Live |
| Send statement via WhatsApp (deep link + PDF URL pattern) | Live-ish |
| Send statement via Email | Live (`send_statement_pdf`) |
| Local notification when pending count increases | Live |
| Push-driven refresh | **Gated (Phase 2 push off)** |
| Search / filter by doctype / status / territory | **Not implemented** |
| Multi-select / bulk approve | **Not implemented** |

### Backend
- `approvals.get_all_approvals`, `approve_document`, `reject_document`
- Also: `inbox`, `apply` (legacy / alternate paths in API map)

---

## 8. People & profile

| Feature | Availability |
| ------- | ------------ |
| My Profile (name, company, designation, branch, contact, address) | Live (`get_employee_profile`) |
| vCard QR on My Profile | Live |
| Call / email shortcuts | Live |
| Employee directory list | Orphan + **mock-only API** |
| Employee profile + QR | Orphan / mock |
| Department on employee row | Shown only if `dimensions.department` and value present |

---

## 9. Settings

| Feature | Availability |
| ------- | ------------ |
| Profile summary | Live |
| Current server URL / environment | Live |
| Configure / change server | Live |
| Logout | Live |
| App version display | Live (may lag `app.json`) |

---

## 10. E-Catalogue (Phase 2)

**Status:** Implemented in UI; **tab hidden** (`PHASE2_FEATURES.catalogue = false` and default server `modules.catalogue = false`).

| Capability | Notes |
| ---------- | ----- |
| Category cards (Industrial / Retail / Software style) | Partly hardcoded marketing metrics |
| Catalogue list from API | `get_catalogues_list` |
| Flipbook WebView | `get_catalogue_flip_url` / pages |
| YouTube video player | In-app |

---

## 11. Push notifications (Phase 2)

**Status:** Code wired; **disabled** (`PHASE2_FEATURES.push = false`).

| Capability | Notes |
| ---------- | ----- |
| Register Expo push token | `store_push_token` |
| Refresh approvals / home on notification | Listeners present |
| Background remote-notification mode (iOS) | Declared in `app.json` |

---

## 12. Multi-client / configurability

Driven by **`erp_analysis.api.get_mobile_config`** after login.

### Modules (`modules`)
`sales`, `receivables`, `inventory`, `approvals`, `catalogue`, `push`, `settings`

### Dimensions (`dimensions`)
| Dimension | Typical UI / filter impact |
| --------- | -------------------------- |
| `company` | Company scope |
| `territory` | AR/sales territory charts & filters |
| `warehouse` | Inventory warehouse filters |
| `brand` | Brand filters / hierarchy |
| `division` | Sales Division charts |
| `department` | Employee department |
| `branch` | Branch on profile / approvals |
| `cost_center` | Reserved (default off) |

### API flags (`apis`)
Set `"get_inventory_trends": false` (etc.) to skip a method without crashing the app.

### Permissions (`get_my_access`)
Menu object keys (deny-only model — missing key = allowed):

| Key | Area |
| --- | ---- |
| AO-00022 | Dashboard |
| AO-00023 | Approvals |
| AO-00025 | Settings |
| AO-00026 | Sales |
| AO-00027 | Receivables |
| AO-00028 | Inventory |
| AO-00029 | Payables (UI hard-hidden) |
| AO-00030 | Purchase (UI hard-hidden) |
| AO-00031 | E-Catalogue |

Resilience: soft response parsing; strip disabled dimension params; empty arrays OK.

---

## 13. Demo mode (App Store / offline review)

With **no server URL**:

- Login with any email + any 6-digit OTP
- Browse Sales / Receivables / Inventory / Approvals on mock data
- No live ERP dependency
- Enter a real URL anytime to switch to production login

---

## 14. API surface (`erp_analysis`)

### Config / access
- `api.health`, `api.get_mobile_config`, `config.get_client_id`
- `api.get_my_access`, `api.clear_my_access_cache`, `api.store_push_token`

### BA modules
- Dashboard: `get_complete_dashboard_data`
- Sales KPIs: `get_dashboard_kpis`, `get_sales_dashboard`
- Inventory: snapshot, performance, trends, risk, hierarchy
- Receivables: snapshot, performance, trends, territory, customer statement
- Customer 360: `search_customers`, `get_customer_360`
- Collection: `get_collection_dashboard`, `get_collection_attention`
- Sales Orders: `get_sales_order_dashboard`
- Payables: `get_payables_dashboard`, `get_payment_planning`
- Purchase: `get_purchase_dashboard`
- Inventory Health: `get_inventory_health`, `get_stock_cover`, `get_dead_stock`
- Profitability: `get_profitability_dashboard`
- Exceptions: `get_management_exceptions`
- Approval Analytics: `get_approval_analytics`
- Approvals: get all, approve, reject (+ inbox/apply)
- Employee: complete data, profile, list
- Catalogue: list, pages, flip URL
- Notifications: `send_statement_pdf`

### Auth (outside BA map)
- Frappe OAuth2 `get_token`
- Optional OTP methods under `erp_analysis.auth_otp.*` (demo / future)

---

## 15. Cross-cutting UX

- Pull-to-refresh on major screens
- Expandable home cards → full dashboards
- Charts (bars, pies, line/SVG trends)
- PDF WebView helper
- Camera / photo library / location permission strings (QR, images, territory)
- Gradient branded chrome (primary `#667eea`)
- Local approval-count notifications

---

## 16. Feature status matrix (summary)

| Area | Live | Demo | Hidden / stub |
| ---- | ---- | ---- | ------------- |
| Auth password + server config | ✓ | ✓ (OTP fake) | Real OTP unused |
| Home BA cards | ✓ | ✓ | |
| Sales dashboard | ✓ | ✓ | |
| Receivables + territory + statement email | ✓ | ✓ | |
| Customer 360 | ✓ | ✓ | |
| Collection performance + attention | ✓ | ✓ | |
| Sales Orders / order book | ✓ | ✓ | |
| Payables + payment planning | ✓ | ✓ | |
| Purchase performance | ✓ | ✓ | |
| Inventory Health / cover / dead | ✓ | ✓ | |
| Profitability (GP) | ✓ | ✓ | |
| Management exceptions | ✓ | ✓ | |
| Approval analytics | ✓ | ✓ | |
| Salesperson / Product performance | ✓ | ✓ | |
| Inventory + hierarchy drill-down | ✓ | ✓ | |
| Approvals approve/reject | ✓ | ✓ | Filters / bulk |
| Profile + QR | ✓ | partial | |
| Employee directory | | mock | Not in tabs; API disabled |
| E-Catalogue | | | Phase 2 off |
| Push | | | Phase 2 off |

---

## 17. Gaps & candidates for additional requirements

Use this as a checklist when gathering new requirements:

### Likely client asks (not fully covered today)
- [ ] Multi-company switcher / company picker UI
- [ ] Date-range picker (custom from/to) on Sales / Inventory / AR
- [ ] Currency / locale per company (today often SAR-centric)
- [ ] Approvals: search, doctype filter, status filter, bulk actions
- [ ] Approvals: more doctypes beyond SI-centric flows
- [ ] Payables (AP) live BA module
- [ ] Purchase / procurement live BA module
- [ ] Employee directory in navigation + live HR API
- [ ] Attendance / leave / expense (HR) — not present
- [ ] CRM / leads / opportunities — not present
- [ ] Stock entry / warehouse operations (transactional) — BA only today
- [ ] Order booking / POS — not present
- [ ] Offline cache / offline-first mode — limited (token + React Query cache)
- [ ] Biometric / PIN unlock
- [ ] Real OTP / SSO (Azure AD, Google) for enterprise clients
- [ ] Multi-language (Arabic RTL, etc.)
- [ ] Dark mode polish / brand theming per client
- [ ] In-app PDF generation (vs server PDF URL)
- [ ] WhatsApp Business API integration (vs `wa.me` link)
- [ ] Role-based home widgets fully driven by server `dashboards` config (today partly hard-coded)
- [ ] Cost center / project / profit center dimensions in UI
- [ ] Export / share charts as image or Excel
- [ ] Audit log of who approved what (in-app history)

### Technical / product debt to consider
- [ ] Enable or remove Payables / Purchase stub screens
- [ ] Re-enable live Employees API or remove orphan routes
- [ ] Align version strings (`app.json` vs Settings vs `package.json`)
- [ ] Enable Phase 2 catalogue / push when backend ready
- [ ] Wire `kpi-details` or remove
- [ ] Standardize statement PDF URL (`get_statement_pdf` vs `send_statement_pdf`)

### Config already available (prefer config over new code)
- [ ] Hide Division / Department / Territory via `dimensions`
- [ ] Disable unfinished APIs via `apis`
- [ ] Hide modules via `modules`
- [ ] Deny menus via `get_my_access` object keys

---

## 18. Related docs

| Doc | Use |
| --- | --- |
| `docs/ERP_ANALYSIS_API_CONTRACT.md` | Server install + method contract |
| `docs/BACKEND_MULTI_CLIENT_GUIDE.md` | Per-client `modules` / `dimensions` / `apis` |
| `docs/erp_analysis/install_erp_analysis.sh` | Bench install script |
| `docs/erp_analysis/fix_cmd_kwargs.sh` | Proxy / kwargs fix for wrappers |

---

*Generated from the current `printechs-mobile` codebase for requirements analysis. Update this file when shipping major modules.*
