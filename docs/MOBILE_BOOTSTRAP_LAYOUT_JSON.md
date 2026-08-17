# Mobile bootstrap JSON — layout & widgets (for BA / backend)

**Endpoint:** `GET /api/method/erp_analysis.api.get_mobile_bootstrap`  
**Auth:** Bearer  
**Used by:** Home widgets, Explore strip, More hub (schema v2)

Mobile never executes server JS or React paths. Send **metadata only**.

---

## Minimal envelope

```json
{
  "schema_version": 2,
  "api_version": "2.0.0",
  "context": {
    "company": "Printechs Advanced Printing Trading Co.",
    "profile": "PRINTECHS-B2B",
    "business_type": "B2B"
  },
  "branding": {
    "app_title": "Business Insight",
    "app_subtitle": null,
    "logo_url": null
  },
  "capabilities": {
    "dynamic_modules": true
  },
  "modules": [],
  "dimensions": [],
  "dashboards": []
}
```

---

## 1) Modules (Explore strip + More menu)

Explore chips = enabled modules (minus tab-only / unshipped), ordered by `sort_order`.

```json
{
  "modules": [
    {
      "key": "sales",
      "label": "Sales",
      "enabled": true,
      "sort_order": 10,
      "icon_key": "trending_up",
      "route_key": "sales",
      "section": "sales",
      "section_label": "SALES & CUSTOMERS",
      "subtitle": "YTD performance",
      "screen_type": "module",
      "feature_key": null,
      "config": null
    },
    {
      "key": "receivables",
      "label": "Receivables",
      "enabled": true,
      "sort_order": 20,
      "route_key": "receivables",
      "section": "finance",
      "section_label": "FINANCE",
      "screen_type": "module"
    },
    {
      "key": "my_reports",
      "label": "My Reports",
      "enabled": true,
      "sort_order": 90,
      "route_key": "my_reports",
      "section": "insights",
      "section_label": "INSIGHTS",
      "screen_type": "dashboard",
      "config": {
        "dashboard_id": "my_reports_home"
      }
    }
  ]
}
```

| Field | Required | Notes |
|--------|----------|--------|
| `key` | yes | Stable id (`sales`, `receivables`, …) |
| `label` | yes | Shown on Explore / More |
| `enabled` | yes | `false` hides from mobile |
| `route_key` | yes | Logical key resolved in **app registry** (not a URL/path) |
| `sort_order` | no | Lower = first |
| `screen_type` | no | `module` \| `dashboard` \| `report_list` (default `module`) |
| `section` / `section_label` | no | More hub grouping |
| `config.dashboard_id` | for `dashboard` | Board key under `dashboards[]` |
| `icon_key` | no | Hint only; app maps to local icons |

**Do not send:** React component paths, deep links outside allowlist, executable JS.

---

## 2) Dashboards & widgets (Home “Widgets”)

Home renders board **`key: "home"`**.

Prefer explicit **`widget_rows`** for layout. If omitted, mobile synthesizes rows from `size` / MTD+YTD pairs.

```json
{
  "dashboards": [
    {
      "key": "home",
      "title": "Home",
      "widgets": [
        {
          "key": "sales_mtd_kpi",
          "label": "Net Sales MTD",
          "type": "KPI",
          "size": "sm",
          "metric_key": "net_sales",
          "dimension_key": "territory",
          "sort_order": 10,
          "period": "mtd",
          "show_ly": true,
          "dashboard_id": "home",
          "layout": "header",
          "header_align": "left",
          "header_compact": true,
          "config": {
            "layout": "header",
            "layout_mode": "header",
            "header_align": "left",
            "header_compact": true,
            "period": "mtd",
            "show_ly": true,
            "dashboard_id": "home"
          }
        },
        {
          "key": "sales_ytd_kpi",
          "label": "Net Sales YTD",
          "type": "KPI",
          "size": "sm",
          "metric_key": "net_sales",
          "dimension_key": "territory",
          "sort_order": 20,
          "period": "ytd",
          "show_ly": true,
          "dashboard_id": "home",
          "layout": "header",
          "header_align": "left",
          "header_compact": true,
          "config": {
            "layout": "header",
            "header_align": "left",
            "header_compact": true,
            "period": "ytd",
            "show_ly": true,
            "dashboard_id": "home"
          }
        },
        {
          "key": "sales_card",
          "label": "Sales Performance",
          "type": "LIST",
          "size": "md",
          "metric_key": "net_sales",
          "dimension_key": "territory",
          "sort_order": 30,
          "show_ly": true,
          "dashboard_id": "home"
        }
      ],
      "widget_rows": [
        {
          "type": "row",
          "columns": 2,
          "widgets": [
            { "key": "sales_mtd_kpi", "label": "Net Sales MTD", "type": "KPI", "size": "sm", "metric_key": "net_sales", "period": "mtd", "show_ly": true, "layout": "header", "header_compact": true },
            { "key": "sales_ytd_kpi", "label": "Net Sales YTD", "type": "KPI", "size": "sm", "metric_key": "net_sales", "period": "ytd", "show_ly": true, "layout": "header", "header_compact": true }
          ]
        },
        {
          "type": "widget",
          "widget": {
            "key": "sales_card",
            "label": "Sales Performance",
            "type": "LIST",
            "metric_key": "net_sales",
            "dimension_key": "territory",
            "show_ly": true
          }
        }
      ]
    },
    {
      "key": "my_reports_home",
      "title": "My Reports",
      "widgets": [
        {
          "key": "my_reports_net_sales_mtd",
          "label": "Net Sales MTD",
          "type": "KPI",
          "metric_key": "net_sales",
          "period": "mtd",
          "dashboard_id": "my_reports_home"
        }
      ],
      "widget_rows": null
    }
  ]
}
```

### Widget fields mobile reads

| Field | Where | Purpose |
|--------|--------|---------|
| `key` | top-level | Unique id (`sales_mtd_kpi`). **Must be unique** on a board (avoid repeating `widget_0`) |
| `label` / `title` | top-level | UI title (e.g. `Net Sales MTD`) |
| `type` / `widget_type` | top-level | `KPI` \| `BAR` \| `LINE` \| `PIE` \| `DONUT` \| `TABLE` \| `RANKING` \| `LIST` \| `MATRIX` \| `HEADER` \| `LINK` |
| `size` | top-level or `config` | `sm` = share row (side by side); `md`/`lg` = full width |
| `metric_key` | top-level | e.g. `net_sales`, `gross_profit` |
| `dimension_key` | top-level | e.g. `territory`, `brand` |
| `sort_order` / `idx` | top-level | Display order |
| `period` | top-level or `config` | `mtd` \| `ytd` \| `today` \| … (widget-fixed dates) |
| `show_ly` | top-level or `config` | LY comparison UI |
| `dashboard_id` | top-level or `config` | Board id (`home`, `my_reports_home`) |
| `layout` / `layout_mode` | top-level or `config` | See layout modes below |
| `header_align` | top-level or `config` | `left` \| `right` \| `center` |
| `header_compact` | top-level or `config` | boolean |
| `config` / `config_json` | object or JSON string | Merged into widget config |

### Layout modes (Desk → JSON)

| Desk UI | Send as | Mobile effect |
|---------|---------|----------------|
| **Standard** | `"layout": "standard"` | Full-width card; title above value |
| **Side by Side Row** | `"layout": "row"` **or** `"size": "sm"` | Pair with next sm/row widget in one horizontal row (2 columns) |
| **Screen Header / header** | `"layout": "header"`, `"header_compact": true`, `"header_align": "left"` | Compact KPI chrome inside the card |

**Recommended for Net Sales MTD | YTD side by side:**

```json
{
  "type": "row",
  "columns": 2,
  "widgets": [
    { "key": "sales_mtd_kpi", "label": "Net Sales MTD", "type": "KPI", "size": "sm", "layout": "header", "header_compact": true, "period": "mtd", "show_ly": true },
    { "key": "sales_ytd_kpi", "label": "Net Sales YTD", "type": "KPI", "size": "sm", "layout": "header", "header_compact": true, "period": "ytd", "show_ly": true }
  ]
}
```

Or omit `widget_rows` but set both widgets `"size": "sm"` with consecutive `sort_order`.

### `widget_rows` item types

```json
{ "type": "section", "title": "Sales" }

{ "type": "row", "columns": 2, "widgets": [ /* 2 widgets */ ] }

{ "type": "widget", "widget": { /* one full-width widget */ } }
```

### Widget types mobile supports

| `type` | Behavior |
|--------|----------|
| `KPI` | KPI tile / header chrome |
| `BAR` / `LINE` / `PIE` / `DONUT` | Charts |
| `TABLE` / `RANKING` / `LIST` | Tables / lists |
| `MATRIX` | Matrix / analysis link |
| `HEADER` / `section` | Section title only (no data fetch) |
| `LINK` / `shortcut` | Navigate to module / `dashboard_id` / `module_key` in config |

**LINK example:**

```json
{
  "key": "goto_receivables",
  "label": "Receivables Dashboard",
  "type": "LINK",
  "config": {
    "module_key": "receivables"
  }
}
```

or `"dashboard_id": "receivables_home"`.

---

## 3) Widget data API (separate from bootstrap)

**Method:** `erp_analysis.api.get_dashboard_widget_data`  
**Request (typical):**

```json
{
  "widget_key": "sales_mtd_kpi",
  "company": "Printechs Advanced Printing Trading Co.",
  "from_date": "2026-08-01",
  "to_date": "2026-08-14",
  "period": "mtd"
}
```

Mobile also accepts KPI/chart payloads with `show_ly`, `chart.summary` (`value`, `value_ly`, `change_pct`, `display`), etc.

---

## 4) Checklist for backend

1. `schema_version`: **2** (or `capabilities.dynamic_modules: true`) for Option A modules.  
2. Every Home widget has `dashboard_id: "home"` **or** lives under `dashboards[].key = "home"`.  
3. **Unique** `key` per widget (no repeated `widget_0`).  
4. Real **`label`** (not empty / not `widget_0`).  
5. Side-by-side: send **`widget_rows` type `row`** with 2 widgets, **or** both `"size": "sm"`.  
6. Header chrome: `"layout": "header"`, `"header_align": "left"`, `"header_compact": true` on the widget (top-level **and/or** inside `config`).  
7. Periods: `"period": "mtd"` / `"ytd"` on the widget so Home filter does not override.  
8. Never send React paths or remote component URLs.

---

## 5) Full example (copy-paste for BA)

```json
{
  "schema_version": 2,
  "context": {
    "company": "Printechs Advanced Printing Trading Co.",
    "profile": "PRINTECHS-B2B",
    "business_type": "B2B"
  },
  "capabilities": { "dynamic_modules": true },
  "modules": [
    {
      "key": "sales",
      "label": "Sales",
      "enabled": true,
      "sort_order": 10,
      "route_key": "sales",
      "screen_type": "module",
      "section_label": "SALES & CUSTOMERS"
    },
    {
      "key": "receivables",
      "label": "Receivables",
      "enabled": true,
      "sort_order": 20,
      "route_key": "receivables",
      "screen_type": "module",
      "section_label": "FINANCE"
    },
    {
      "key": "inventory",
      "label": "Inventory",
      "enabled": true,
      "sort_order": 30,
      "route_key": "inventory",
      "screen_type": "module",
      "section_label": "OPERATIONS"
    }
  ],
  "dimensions": [
    { "key": "territory", "label": "Territory", "filterable": true, "groupable": true },
    { "key": "brand", "label": "Brand", "filterable": true, "groupable": true }
  ],
  "dashboards": [
    {
      "key": "home",
      "title": "Home",
      "widgets": [],
      "widget_rows": [
        {
          "type": "row",
          "columns": 2,
          "widgets": [
            {
              "key": "sales_mtd_kpi",
              "label": "Net Sales MTD",
              "type": "KPI",
              "size": "sm",
              "metric_key": "net_sales",
              "dimension_key": "territory",
              "sort_order": 10,
              "period": "mtd",
              "show_ly": 1,
              "layout": "header",
              "header_align": "left",
              "header_compact": 1,
              "dashboard_id": "home"
            },
            {
              "key": "sales_ytd_kpi",
              "label": "Net Sales YTD",
              "type": "KPI",
              "size": "sm",
              "metric_key": "net_sales",
              "dimension_key": "territory",
              "sort_order": 20,
              "period": "ytd",
              "show_ly": 1,
              "layout": "header",
              "header_align": "left",
              "header_compact": 1,
              "dashboard_id": "home"
            }
          ]
        },
        {
          "type": "widget",
          "widget": {
            "key": "goto_receivables",
            "label": "Receivables Dashboard",
            "type": "LINK",
            "config": { "module_key": "receivables" }
          }
        },
        {
          "type": "widget",
          "widget": {
            "key": "sales_card",
            "label": "Sales Performance",
            "type": "LIST",
            "metric_key": "net_sales",
            "dimension_key": "territory",
            "show_ly": 1
          }
        }
      ]
    }
  ]
}
```

After BA deploys this shape, mobile: login or pull-to-refresh Home so bootstrap reloads.
