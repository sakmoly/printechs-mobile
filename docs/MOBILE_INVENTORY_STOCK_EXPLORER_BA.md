# Mobile Stock Explorer — Backend API Spec

**Audience:** BA / Frappe (`erp_analysis.inventory`, `erp_analysis.sales`)  
**Mobile:** Inventory → Stock explorer (brand → item → warehouse) + **Days of supply**

This doc lists what the app calls today, what breaks (417 / empty rows), and **recommended** APIs so stock + sales work in one fast call per step.

---

## Mobile drill flow (3 lazy steps)

| Step | UI | What mobile needs |
| ---- | -- | ----------------- |
| 1 | Brand list | Brands with rolled-up `qty` + `value` for scope (territory / all territories) |
| 2 | Item list (one brand) | Items with merged `qty` + `value` (no warehouse breakdown yet) |
| 3 | Item detail | Same item: **lines** `{ territory, warehouse, qty, value }` + **sales qty** last 12 months for days of supply |

**Days of supply (client formula):**

```text
days_of_supply = stock_qty / (sales_qty_12m / 365)
```

`stock_qty` = sum of on-hand qty for the filtered scope (all territories, or one territory / warehouse).

---

## A) Existing: `erp_analysis.inventory.get_inventory_hierarchy`

**HTTP:** `GET` (mobile also tolerates envelope in `message` or bare array)

**Whitelist:** `@frappe.whitelist()` — ensure kwargs `territory`, `territories`, `warehouse`, `brand`, `item_group`, `item_code`, `limit` are not stripped by form wrappers.

### Parameters

| Param | Required | Notes |
| ----- | -------- | ----- |
| `company` | recommended | |
| `level` | **always** | `territory` \| `warehouse` \| `brand` \| `item_group` \| `item` |
| `territory` | warehouse+ on territory path | |
| `territories` | optional | Same as territory or comma-separated view filter |
| `warehouse` | brand+ on territory path | |
| `brand` | item_group+ | |
| `item_group` | **required for `level=item`** | Missing → mobile saw **417** |
| `item_code` | optional | See extensions below |
| `limit` | optional | default 100; mobile uses up to 800 for items |

### Response (preferred envelope)

```json
{
  "level": "brand",
  "rows": [
    {
      "id": "Hitachi",
      "name": "Hitachi",
      "brand": "Hitachi",
      "value": 68900.0,
      "qty": 491,
      "percentage": 12.5
    }
  ],
  "meta": {
    "currency": "SAR",
    "company": "Printechs Advanced Printing Trading Co."
  }
}
```

Bare array of rows is also accepted.

### Row fields mobile reads

| Field | Aliases |
| ----- | ------- |
| `value` | `stock_value`, `amount`, `total_value` |
| `qty` | `actual_qty`, `stock_qty`, `quantity` |
| `id` / `name` | level-specific keys (`brand`, `warehouse`, `territory`, `item_code`) |

### Critical fixes for mobile

#### 1) `level=brand` with **territory only** (no warehouse)

Mobile uses **one call per territory** to build the brand list (fast path).

```http
GET /api/method/erp_analysis.inventory.get_inventory_hierarchy
  ?company=Printechs%20Advanced%20Printing%20Trading%20Co.
  &level=brand
  &territory=Dammam
  &territories=Dammam
  &limit=300
```

**Expected:** All brands in that territory (sum stock across warehouses mapped to Dammam). Same shape as warehouse-scoped brand rows, merged server-side.

If not supported, mobile falls back to **N ×** `level=brand` per warehouse (slow).

#### 2) `level=item` rows must include warehouse context when filtered by item

When returning item lines, each row should include **`warehouse`** and **`territory`** (or mobile only knows the request warehouse):

```json
{
  "level": "item",
  "rows": [
    {
      "id": "IND.CON.ANS.3482",
      "name": "Anser U2 Inkfinity H-AO3 ...",
      "item_code": "IND.CON.ANS.3482",
      "territory": "Dammam",
      "warehouse": "Dammam Office - WHS - PRNTX",
      "qty": 80,
      "value": 11600.0
    },
    {
      "item_code": "IND.CON.ANS.3482",
      "territory": "Dammam",
      "warehouse": "InTransit - WHS - PRNTX",
      "qty": 48,
      "value": 7000.0
    }
  ]
}
```

**Do not** use `id` as warehouse when `warehouse` is omitted (mobile previously showed item code in the warehouse column).

#### 3) Optional fast paths (highly recommended)

**Item stock by code (all territories / warehouses):**

```http
GET ...&level=item&item_code=IND.CON.ANS.3482&company=...&limit=500
```

Return **one row per (territory, warehouse)** with qty/value > 0.

**Warehouse stock for one item in one territory:**

```http
GET ...&level=warehouse&territory=Dammam&item_code=IND.CON.ANS.3482
```

Return warehouses with that item’s qty/value on each row.

---

## B) Existing: `erp_analysis.sales.get_product_performance`

**HTTP:** mobile tries **POST** then **GET** with query params.

**Used for:** last **12 months** sold **qty** for days of supply.

### Request (mobile sends)

```json
{
  "company": "Printechs Advanced Printing Trading Co.",
  "level": "item",
  "item_code": "IND.CON.ANS.3482",
  "brand": "ANSER",
  "from_date": "2024-10-10",
  "to_date": "2025-10-09",
  "period": "custom",
  "territory": "Dammam",
  "territories": "Dammam"
}
```

Mobile also retries **without** `item_code` (brand + date only) and scans rows for matching `item_code`.

### Response (required for days of supply)

```json
{
  "level": "item",
  "meta": {
    "currency": "SAR",
    "company": "Printechs Advanced Printing Trading Co.",
    "from_date": "2024-10-10",
    "to_date": "2025-10-09"
  },
  "rows": [
    {
      "id": "IND.CON.ANS.3482",
      "name": "IND.CON.ANS.3482",
      "item_code": "IND.CON.ANS.3482",
      "item_name": "Anser U2 Inkfinity H-AO3 ...",
      "qty": 420,
      "quantity": 420,
      "sales": 63000.0,
      "total_sales": 63000.0,
      "asp": 150.0
    }
  ]
}
```

**Required row fields for mobile:**

| Field | Purpose |
| ----- | ------- |
| `item_code` or `id` | Match item |
| `qty` or `quantity` or `sold_qty` | **Primary** for days of supply |
| `sales` + `asp` | Fallback: `qty ≈ sales / asp` if qty missing |

**Fix if mobile shows “sales qty not available”:**

- Stop **417** on `item_code` / `brand` / `territory` kwargs (whitelist + wrapper allowlist).
- Honor `from_date` / `to_date` for **custom** period (not only MTD/YTD presets).
- With `item_code=...`, return **one row** (or empty), not entire catalog without filter.
- Respect territory filter when `territory` / `territories` set (sales in that territory only).

---

## C) Recommended new methods (best UX + performance)

### 1) `erp_analysis.inventory.get_item_stock_by_code`

Single call for item drill step 3 (replaces hundreds of hierarchy calls).

**Request:**

```http
GET /api/method/erp_analysis.inventory.get_item_stock_by_code
  ?company=Printechs%20Advanced%20Printing%20Trading%20Co.
  &item_code=IND.CON.ANS.3482
  &brand=ANSER
  &territory=Dammam
```

| Param | Required | Notes |
| ----- | -------- | ----- |
| `item_code` | yes | |
| `company` | recommended | |
| `brand` | optional | Narrows search |
| `territory` | optional | Omit = all allowed territories |
| `warehouse` | optional | Omit = all warehouses in scope |

**Response:**

```json
{
  "item_code": "IND.CON.ANS.3482",
  "item_name": "Anser U2 Inkfinity H-AO3 (SP4-3) Ink Cartridge Black 42ml",
  "currency": "SAR",
  "total_qty": 128,
  "total_value": 18600.0,
  "lines": [
    {
      "territory": "Dammam",
      "warehouse": "Dammam Office - WHS - PRNTX",
      "qty": 80,
      "value": 11600.0
    },
    {
      "territory": "Dammam",
      "warehouse": "InTransit - WHS - PRNTX",
      "qty": 48,
      "value": 7000.0
    }
  ]
}
```

Enforce same stock access rules as hierarchy (`allow_view_all_stock` / `view_territories`).

---

### 2) `erp_analysis.sales.get_item_sales_qty`

Single call for days of supply (replaces fragile product_performance drill).

**Request:**

```http
GET /api/method/erp_analysis.sales.get_item_sales_qty
  ?company=Printechs%20Advanced%20Printing%20Trading%20Co.
  &item_code=IND.CON.ANS.3482
  &from_date=2024-10-10
  &to_date=2025-10-09
  &territory=Dammam
```

**Response:**

```json
{
  "item_code": "IND.CON.ANS.3482",
  "from_date": "2024-10-10",
  "to_date": "2025-10-09",
  "territory": "Dammam",
  "qty_sold": 420,
  "sales_value": 63000.0,
  "uom": "Nos"
}
```

Source: delivered/s invoiced qty in period (define once in docstring — SI vs DN vs POS).

---

### 3) Optional combo: `erp_analysis.inventory.get_item_stock_and_velocity`

```json
{
  "item_code": "IND.CON.ANS.3482",
  "item_name": "...",
  "stock": {
    "total_qty": 128,
    "total_value": 18600.0,
    "lines": [ { "territory": "Dammam", "warehouse": "...", "qty": 80, "value": 11600.0 } ]
  },
  "sales_last_365_days": {
    "from_date": "2024-10-10",
    "to_date": "2025-10-09",
    "qty_sold": 420,
    "sales_value": 63000.0
  },
  "days_of_supply": 111.2
}
```

Mobile can still compute `days_of_supply` client-side if you prefer.

---

## D) Access / errors

| Case | HTTP |
| ---- | ---- |
| Method not deployed / kwargs blocked | **417** (mobile caches and stops calling) |
| Territory not in view scope | **403** or empty `rows` |
| No stock / no sales | **200** with `lines: []` or `qty_sold: 0` |
| Missing `item_group` on `level=item` | **400** with clear message |

---

## E) Minimal backend checklist

- [ ] `get_inventory_hierarchy`: `level=brand` + `territory` only (rollup across warehouses)
- [ ] `level=item` rows include `territory` + `warehouse` on every line
- [ ] `level=item` requires `item_group` OR accept `item_code`-only shortcut
- [ ] `get_product_performance`: `item_code` + date range + territory; row includes `qty`
- [ ] No 417 on whitelisted kwargs after deploy (restart + clear cache)
- [ ] (Recommended) Ship `get_item_stock_by_code` + `get_item_sales_qty`

---

## F) curl smoke tests

```bash
# Brand list — one territory
curl -G 'https://YOUR_SITE/api/method/erp_analysis.inventory.get_inventory_hierarchy' \
  --data-urlencode 'company=Printechs Advanced Printing Trading Co.' \
  --data-urlencode 'level=brand' \
  --data-urlencode 'territory=Dammam' \
  -H 'Authorization: Bearer TOKEN'

# Item lines (full parent chain)
curl -G 'https://YOUR_SITE/api/method/erp_analysis.inventory.get_inventory_hierarchy' \
  --data-urlencode 'company=Printechs Advanced Printing Trading Co.' \
  --data-urlencode 'level=item' \
  --data-urlencode 'territory=Dammam' \
  --data-urlencode 'warehouse=Dammam Office - WHS - PRNTX' \
  --data-urlencode 'brand=ANSER' \
  --data-urlencode 'item_group=YOUR_ITEM_GROUP' \
  --data-urlencode 'limit=500' \
  -H 'Authorization: Bearer TOKEN'

# Sales qty — 12 months
curl -G 'https://YOUR_SITE/api/method/erp_analysis.sales.get_product_performance' \
  --data-urlencode 'company=Printechs Advanced Printing Trading Co.' \
  --data-urlencode 'level=item' \
  --data-urlencode 'item_code=IND.CON.ANS.3482' \
  --data-urlencode 'from_date=2024-10-10' \
  --data-urlencode 'to_date=2025-10-09' \
  --data-urlencode 'period=custom' \
  -H 'Authorization: Bearer TOKEN'
```

---

## Mobile wiring (app)

- Sales qty for days of supply: `src/api/itemSalesQty.ts` → `erp_analysis.sales.get_item_sales_qty` (GET, POST fallback).
- Fallback if method missing: `get_product_performance` via `src/utils/inventoryDaysOfSupply.ts`.

Ensure `get_mobile_config` does **not** set `"apis": { "get_item_sales_qty": false }`.

---

## Related mobile docs

- [`INVENTORY_BY_TERRITORY_API.md`](./INVENTORY_BY_TERRITORY_API.md) — hierarchy levels
- [`ERP_ANALYSIS_API_CONTRACT.md`](./ERP_ANALYSIS_API_CONTRACT.md) — product performance overview
