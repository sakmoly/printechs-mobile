# TABLE widget — column width & format (BA → mobile)

Mobile honors column layout from **any** of these places:

1. **Data API:** `message.table.columns` from `get_dashboard_board_data` / `get_dashboard_widget_data`
2. **Desk widget Config JSON:** `columns` **or** `table_columns`
3. Top-level `columns` / `table_columns` on the widget payload

Desk layout overlays API columns (by key alias: `dimension`↔`territory`, `metric`↔`net_sales`).

## Where widths actually come from (live site)

Metro log on your device showed:

```text
hasDeskColumns: false
deskConfigKeys: ["section_title", "compare", "drill_path", "show_ly", "period"]
resolvedColumns: territory:flex=1.4, net_sales:flex=1.1, net_sales_ly:flex=1.3, change_pct:w=56
source: api
```

So **Desk Config JSON is not reaching mobile**. Layout comes from:

`get_dashboard_board_data` → `widgets.sales_card.table.columns`

Editing a local JSON snippet in Desk has **no effect** until either:

1. **BA puts `columns` on the board/widget data API** (works today), or  
2. **Bootstrap includes `config.columns`** for `sales_card` (then mobile overlays flex/width onto API columns).

### Test width change right now

Update server response for `sales_card.table.columns`, then **pull-to-refresh Home** (2‑min cache otherwise). Use extreme values so the change is obvious:

```json
"columns": [
  {"key": "territory", "label": "Territory", "width": 56, "align": "left"},
  {"key": "net_sales", "label": "Net Sales", "format": "currency_compact", "flex": 1, "align": "right"},
  {"key": "net_sales_ly", "label": "Net Sales LY", "format": "currency_compact", "width": 120, "align": "right"},
  {"key": "change_pct", "label": "Δ%", "format": "percent", "width": 56, "align": "right"}
]
```

Note live keys are `territory` / `net_sales` / `net_sales_ly` (not `dimension` / `metric`).

### If you want Desk Config to drive layout

Bootstrap widget must include:

```json
"config": {
  "columns": [ ... ]
}
```

Mobile will then merge Desk flex/width onto API columns (`api+desk` in logs).

Or on the **data** response:

```json
{
  "widget_key": "sales_card",
  "widget_type": "TABLE",
  "table": {
    "columns": [ /* same array */ ],
    "currency_display": { "show_symbol": false },
    "total": 15940000,
    "rows": [
      { "dimension": "Jeddah", "metric": 7520000, "metric_ly": 9100000, "change_pct": -17.1 }
    ]
  }
}
```

## Column keys must match row fields

| Column `key` | Row field |
| --- | --- |
| `dimension` | `row.dimension` (Territory name) |
| `metric` | `row.metric` (Net Sales) |
| `metric_ly` | `row.metric_ly` |
| `change_pct` | `row.change_pct` |

## Sizing fields

| Field | Meaning |
| --- | --- |
| `flex` | Share of leftover width |
| `width` | Fixed px |
| `min_width` | Floor in px (**use ≥ 24**; `min_width: 2` is ignored) |
| `align` | `left` \| `right` \| `center` |

## After changing Desk config

Log out / log in (or pull-to-refresh Home) so bootstrap + board data reload.
