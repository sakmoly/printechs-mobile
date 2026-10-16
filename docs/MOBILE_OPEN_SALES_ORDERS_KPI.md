# Mobile — Open Sales Orders KPI & Drill (Sales Dashboard)

**Audience:** Backend / BA (`erp_analysis`)  
**Mobile:** Sales Dashboard → **Total Orders** card (repurpose `sales_orders_kpi`)  
**Goal:** Show **count of open Sales Orders** (not delivered or partially delivered), honour the **same scope** as the Sales filter bar, then drill **SO + Customer** → **line items**.

---

## 1. Business definition

| Term | Rule |
| ---- | ---- |
| **Open Sales Order** | Submitted Sales Order, **not** Cancelled / Closed / Completed, with **`per_delivered` &lt; 100** (or equivalent: delivery status **Not Delivered** or **Partially Delivered**). |
| **Include** | Orders with pending delivery qty on at least one line. |
| **Exclude** | Fully delivered SOs, draft SOs, stopped SOs (unless product requires them). |
| **KPI value** | **Integer count** of distinct open SO names matching scope (`format: integer`). Optional secondary metric: open SO **value** (sum of pending delivery amount) — mobile can show count only unless bootstrap adds a second KPI slot. |
| **Territory** | Same as Sales Dashboard: `filters.territory[]`, `territory`, and `view_all_sales=1` when user picks All Territories with allow-all. |
| **Date range** | Mobile sends **`from_date`**, **`to_date`**, **`period`** on every board/widget call. **BA must fix one rule** and document it in bootstrap `config.date_scope`: |

**Recommended `date_scope` options (pick one):**

| `date_scope` | SQL intent |
| ------------ | ---------- |
| `open_snapshot` **(recommended for order book)** | All open SOs **as of today** in territory scope; **ignore** dashboard dates for inclusion (still accept params for logging/cache keys). |
| `order_date_in_period` | Open SOs where **`transaction_date`** is between `from_date` and `to_date`. |
| `delivery_date_in_period` | Open SOs where **`delivery_date`** (or max line schedule) is in range. |

Mobile does not interpret `date_scope`; it only forwards dates. Wrong totals usually mean BA date rule ≠ user expectation.

**Last Year (`show_ly=1`):** Optional. If supported, compare **open SO count** (or open value) vs the same calendar point last year (`previous` / `value_ly`). If not meaningful, omit LY fields; mobile shows **—** for comparison.

---

## 2. API surface (preferred)

Use the **standard dashboard APIs** (same as other Sales widgets). No new HTTP route required if drill is implemented inside `get_dashboard_widget_data`.

| Step | Method | `widget_key` |
| ---- | ------ | ------------ |
| KPI on board load | `erp_analysis.api.get_dashboard_board_data` | `sales_orders_kpi` |
| Tap KPI → order list | `erp_analysis.api.get_dashboard_widget_data` | `sales_open_orders_list` **or** same key with `drill_depth=1` |
| Tap order → items | `erp_analysis.api.get_dashboard_widget_data` | `sales_open_orders_list` with `drill_depth=2` |

**Alternative (optional dedicated methods)** — mobile can call these from drill screens if batch/drill widget is heavy:

| Method | Purpose |
| ------ | ------- |
| `erp_analysis.sales_orders.get_open_sales_orders` | Paginated SO list (level 1) |
| `erp_analysis.sales_orders.get_open_sales_order_items` | Lines for one SO (level 2) |

Params for dedicated methods: same as **§3** plus `sales_order` (level 2), `limit`, `offset`, `search` (optional).

Existing `get_sales_order_dashboard` may stay for the **Order Book** module; Sales Dashboard KPI should still use **`sales_orders_kpi`** + drill for consistent filters.

---

## 3. Request parameters (all levels)

Mobile sends the **same params** as [`MOBILE_DASHBOARDS_API.md`](./MOBILE_DASHBOARDS_API.md) board/widget calls:

| Param | Required | Example |
| ----- | -------- | ------- |
| `company` | Yes | From Access Profile |
| `from_date` / `to_date` | No | `2026-01-01` / `2026-08-18` |
| `period` | No | `ytd`, `mtd`, … |
| `filters` | No | JSON string: `{"territory":["Dammam"]}` |
| `territory` | No | Legacy single territory (mobile sends both) |
| `view_all_sales` | No | `1` when All Territories + allow-all |
| `show_ly` | No | `1` when “Last Year” compare is on |
| `refresh` | No | `1` on pull-to-refresh |
| `drill_depth` | Drill only | `0` (KPI), `1` (orders), `2` (items) |
| `limit` | No | Default **500** for list; mobile may send `100` |

### Drill filters (accumulated)

| Depth | Mobile sends in `filters` (JSON string) | Server returns |
| ----- | --------------------------------------- | -------------- |
| `0` | Territory (+ dates via top-level params) | KPI count |
| `1` | `{"territory":["Dammam"]}` | Table: one row per SO |
| `2` | `{"territory":["Dammam"],"sales_order":["SO-2026-01234"]}` | Table: one row per SO line item |

Logical keys only: `territory`, `sales_order`, `customer` (optional). **Do not** use ERPNext field names in `filters`.

### Example — batch (KPI only)

```http
POST /api/method/erp_analysis.api.get_dashboard_board_data
```

```json
{
  "dashboard_id": "sales_overview",
  "company": "Printechs Advanced Printing Trading Co.",
  "from_date": "2026-01-01",
  "to_date": "2026-08-18",
  "period": "ytd",
  "filters": "{\"territory\":[\"Dammam\"]}",
  "territory": "Dammam",
  "show_ly": "1"
}
```

### Example — drill level 1 (order list)

```http
GET /api/method/erp_analysis.api.get_dashboard_widget_data
```

Query (or POST body):

```json
{
  "widget_key": "sales_open_orders_list",
  "company": "Printechs Advanced Printing Trading Co.",
  "from_date": "2026-01-01",
  "to_date": "2026-08-18",
  "period": "ytd",
  "filters": "{\"territory\":[\"Dammam\"]}",
  "territory": "Dammam",
  "drill_depth": 1,
  "limit": 500
}
```

### Example — drill level 2 (items for one SO)

```json
{
  "widget_key": "sales_open_orders_list",
  "company": "Printechs Advanced Printing Trading Co.",
  "from_date": "2026-01-01",
  "to_date": "2026-08-18",
  "period": "ytd",
  "filters": "{\"territory\":[\"Dammam\"],\"sales_order\":[\"SO-26-00123\"]}",
  "territory": "Dammam",
  "drill_depth": 2,
  "limit": 200
}
```

---

## 4. Response JSON

### 4.1 Level 0 — KPI (`sales_orders_kpi` in batch)

Widget type **KPI**, integer count. Label on mobile: **Total Orders** or bootstrap **Open Sales Orders**.

```json
{
  "widget_key": "sales_orders_kpi",
  "widget_type": "KPI",
  "label": "Open Sales Orders",
  "show_ly": true,
  "config": {
    "format": "integer",
    "date_scope": "open_snapshot",
    "drill_widget_key": "sales_open_orders_list",
    "drill_path": ["sales_order", "item"],
    "drill_views": { "0": "kpi", "1": "table", "2": "table" }
  },
  "kpis": [
    {
      "value": 86,
      "previous": 72,
      "change_pct": 19.44,
      "format": "integer",
      "label": "Open Sales Orders"
    }
  ],
  "meta": {
    "open_so_count": 86,
    "open_so_value": 4200000,
    "currency": "SAR",
    "date_scope": "open_snapshot"
  }
}
```

| Field | Required | Notes |
| ----- | -------- | ----- |
| `kpis[0].value` | **Yes** | Open SO **count** (must match drill list row count) |
| `meta.open_so_count` | Recommended | Same as drill `table.rows.length` |
| `meta.open_so_value` | **Yes** | Sum of pending delivery — shown on KPI card with count |
| `kpis[0].format` | Yes | `integer` |
| `kpis[0].previous` | No | LY open count when `show_ly=1` |
| `meta.open_so_value` | No | Optional; for future subtitle |
| `config.drill_widget_key` | **Yes** for tap | `sales_open_orders_list` |

Alias keys mobile accepts for count: `value`, `open_so_count`, `open_count`, `count` (normalized in widget layer).

---

### 4.2 Level 1 — Orders table (`drill_depth=1`)

`widget_type`: **RANKING** or **TABLE**. One row per Sales Order.

```json
{
  "widget_key": "sales_open_orders_list",
  "widget_type": "RANKING",
  "label": "Open Sales Orders",
  "drill_depth": 1,
  "drill_path": ["sales_order", "item"],
  "table": {
    "currency_display": { "show_symbol": false },
    "columns": [
      { "key": "label", "label": "Sales Order", "flex": 1.2 },
      { "key": "customer_name", "label": "Customer", "flex": 1.6 },
      {
        "key": "pending_delivery_value",
        "label": "Pending delivery",
        "format": "currency_compact",
        "align": "right",
        "flex": 1
      },
      { "key": "delivery_status", "label": "Status", "flex": 1 }
    ],
    "rows": [
      {
        "id": "SO-26-00123",
        "label": "SO-26-00123",
        "customer_name": "Your Shoes Trading Est.",
        "customer": "Your Shoes Trading Est.",
        "value": 185000,
        "pending_delivery_value": 185000,
        "grand_total": 240000,
        "delivery_status": "Partially Delivered",
        "per_delivered": 22.5,
        "transaction_date": "2026-07-28",
        "delivery_date": "2026-08-15",
        "territory": "Dammam",
        "salesperson": "Ahmed Al-Rashid",
        "meta": {
          "sales_order": "SO-26-00123",
          "customer": "Your Shoes Trading Est.",
          "drillable": true
        }
      }
    ]
  },
  "meta": {
    "total_rows": 86,
    "open_so_count": 86,
    "open_so_value": 4200000,
    "currency": "SAR"
  }
}
```

**Row fields (level 1)**

| Field | Required | Notes |
| ----- | -------- | ----- |
| `id` / `label` | Yes | Sales Order name (ERPNext `name`) |
| `customer_name` | **Yes** | Shown under SO as **Customer · Del &lt;date&gt;** |
| `delivery_date` | **Yes** | Header-level SO delivery date (`YYYY-MM-DD`); also `schedule_date` |
| `customer` | Yes | Party id for drill/filter |
| `meta.sales_order` | Yes | Same as SO name; used for depth 2 filter |
| `delivery_status` | Recommended | `Not Delivered` / `Partially Delivered` / ERPNext status label |
| `per_delivered` | Optional | 0–100 |
| `pending_delivery_value` | Recommended | Amount still to deliver (mobile sort/display) |
| `grand_total` | Optional | Order total |
| `transaction_date` | Optional | ISO `YYYY-MM-DD` |
| `territory`, `salesperson` | Optional | Subtitle |

**Sort:** Mobile sorts **delivery_date ascending** (earliest first; missing dates last), then SO name. Server may use the same order; mobile always re-sorts client-side.

---

### 4.3 Level 2 — Item lines (`drill_depth=2`)

Same `widget_key`, `drill_depth=2`, filters include `sales_order`.

```json
{
  "widget_key": "sales_open_orders_list",
  "widget_type": "RANKING",
  "label": "SO-26-00123",
  "drill_depth": 2,
  "table": {
    "currency_display": { "show_symbol": false },
    "columns": [
      { "key": "item_code", "label": "Item", "flex": 1 },
      { "key": "item_name", "label": "Description", "flex": 1.8 },
      {
        "key": "qty",
        "label": "Ordered",
        "format": "number",
        "align": "right",
        "flex": 0.7
      },
      {
        "key": "delivered_qty",
        "label": "Delivered",
        "format": "number",
        "align": "right",
        "flex": 0.7
      },
      {
        "key": "pending_qty",
        "label": "Pending",
        "format": "number",
        "align": "right",
        "flex": 0.7
      },
      {
        "key": "pending_amount",
        "label": "Pending (SAR)",
        "format": "currency_compact",
        "align": "right",
        "flex": 1
      }
    ],
    "rows": [
      {
        "id": "SO-26-00123-1",
        "item_code": "SKU-1001",
        "item_name": "Industrial Label Roll 100mm",
        "qty": 500,
        "delivered_qty": 100,
        "pending_qty": 400,
        "rate": 12.5,
        "pending_amount": 5000,
        "delivery_date": "2026-08-12",
        "schedule_date": "2026-08-12",
        "uom": "Roll",
        "warehouse": "Dammam - PWH",
        "meta": {
          "sales_order": "SO-26-00123",
          "so_detail": "abc123"
        }
      }
    ]
  },
  "meta": {
    "sales_order": "SO-26-00123",
    "customer_name": "Your Shoes Trading Est.",
    "currency": "SAR"
  }
}
```

**Row fields (level 2)**

| Field | Required | Notes |
| ----- | -------- | ----- |
| `item_code` | **Yes** | Primary line title (do **not** use warehouse as `label` only) |
| `item_name` | **Yes** | Subtitle with delivery date |
| `delivery_date` | **Yes** | Line schedule / delivery date (`YYYY-MM-DD`); mobile shows **Del &lt;date&gt;** |
| `qty` | Yes | Ordered qty |
| `delivered_qty` | Yes | |
| `pending_qty` | Yes | `qty - delivered_qty` (or BA computed) |
| `pending_amount` | Recommended | Pending value for line (`rate × pending_qty` if omitted) |
| `uom` | Optional | |
| `warehouse` | Optional | Optional subtitle only — not a substitute for `item_code` / `item_name` |

Only include lines with **`pending_qty` > 0** unless mobile asks for full SO.

**Common bug:** Returning warehouse name in `label` without `item_code` / `item_name` — mobile cannot show product lines correctly.

---

## 5. Bootstrap (`get_mobile_bootstrap`)

Register KPI + list widget on `sales_overview`:

```json
{
  "key": "sales_orders_kpi",
  "label": "Open Sales Orders",
  "type": "KPI",
  "sort_order": 20,
  "config": {
    "format": "integer",
    "show_ly": true,
    "date_scope": "open_snapshot",
    "drill_widget_key": "sales_open_orders_list",
    "drill_path": ["sales_order", "item"],
    "drill_views": { "0": "kpi", "1": "table", "2": "table" }
  }
},
{
  "key": "sales_open_orders_list",
  "label": "Open Sales Orders",
  "type": "RANKING",
  "sort_order": 999,
  "config": {
    "hidden_on_board": true,
    "drill_path": ["sales_order", "item"]
  }
}
```

`hidden_on_board`: list widget is **not** shown on the dashboard grid; only fetched on KPI tap / drill.

---

## 6. Optional dedicated list API (if not using widget drill)

### `get_open_sales_orders`

**Request:**

```json
{
  "company": "Printechs Advanced Printing Trading Co.",
  "from_date": "2026-01-01",
  "to_date": "2026-08-18",
  "period": "ytd",
  "territory": "Dammam",
  "filters": "{\"territory\":[\"Dammam\"]}",
  "view_all_sales": 0,
  "limit": 500,
  "offset": 0,
  "search": "GLADOS"
}
```

**Response:**

```json
{
  "meta": {
    "currency": "SAR",
    "open_so_count": 86,
    "open_so_value": 4200000,
    "total_rows": 86
  },
  "orders": [
    {
      "sales_order": "SO-26-00123",
      "customer": "CUST-001",
      "customer_name": "Your Shoes Trading Est.",
      "transaction_date": "2026-07-28",
      "delivery_date": "2026-08-15",
      "grand_total": 240000,
      "pending_delivery_value": 185000,
      "per_delivered": 22.5,
      "delivery_status": "Partially Delivered",
      "territory": "Dammam",
      "salesperson": "Ahmed Al-Rashid"
    }
  ]
}
```

### `get_open_sales_order_items`

**Request:**

```json
{
  "company": "Printechs Advanced Printing Trading Co.",
  "sales_order": "SO-26-00123",
  "territory": "Dammam",
  "limit": 200
}
```

**Response:**

```json
{
  "meta": {
    "sales_order": "SO-26-00123",
    "customer_name": "Your Shoes Trading Est.",
    "currency": "SAR"
  },
  "items": [
    {
      "item_code": "SKU-1001",
      "item_name": "Industrial Label Roll 100mm",
      "qty": 500,
      "delivered_qty": 100,
      "pending_qty": 400,
      "rate": 12.5,
      "pending_amount": 5000,
      "uom": "Roll",
      "warehouse": "Dammam - PWH",
      "so_detail": "abc123"
    }
  ]
}
```

Mobile can map `orders[]` / `items[]` into the same table shape as **§4.2** / **§4.3**.

---

## 7. Mobile wiring (after backend is ready)

| Item | Action |
| ---- | ------ |
| Catalog | `sales_orders_kpi` label → “Open Sales Orders”; `config.format: integer` |
| KPI tap | Same pattern as Receivables Customer Advances: `drill_widget_key` → list screen with search |
| List screen | Reuse ranking/table renderer + search on `label`, `customer_name`, `sales_order` |
| Row tap @ depth 1 | `get_dashboard_widget_data` with `drill_depth=2` and `filters.sales_order` |
| Empty KPI | Return `value: 0` or omit widget; do not return invoice count |

---

## 8. BA checklist

1. [ ] Define **open SO** SQL (`per_delivered` / delivery status) and **`date_scope`**.  
2. [ ] Implement **`sales_orders_kpi`** count on `get_dashboard_board_data` with territory + `view_all_sales`.  
3. [ ] Implement **`sales_open_orders_list`** at `drill_depth` 1 and 2 on `get_dashboard_widget_data`.  
4. [ ] Set bootstrap **`drill_widget_key`** + hidden list widget.  
5. [ ] Smoke: Dammam filter → KPI &gt; 0; list rows match ERPNext; tap SO → items with pending qty only.  
6. [ ] Confirm KPI is **not** invoice count / booked orders in period unless product explicitly changes definition.

---

## Related

- [`MOBILE_DASHBOARDS_API.md`](./MOBILE_DASHBOARDS_API.md) — common params, batch shape, drill rules  
- [`ERP_ANALYSIS_API_CONTRACT.md`](./ERP_ANALYSIS_API_CONTRACT.md) — Phase 3E `get_sales_order_dashboard` (order book module)  
- Mobile types reference: `src/api/salesOrderTypes.ts` (`SalesOrderLine`, open KPI fields)
