# Inventory by Territory — Server API Spec (erp_analysis)

**Audience:** Server / BA (`erp_analysis.inventory`)  
**Mobile screen:** `/inventory-dashboard` → Snapshot tab  
**Status:** BA API live · Mobile Snapshot card wired (does **not** replace Category)

---

## Product requirement

On Inventory Snapshot, mobile will show **two** independent cards:

| Card | Drill path | Status |
| ---- | ---------- | ------ |
| **Inventory by Territory** | Territory → Warehouse → Brand → Item Group → Item | **NEW** — this doc |
| **Inventory by Category** | Category → Brand → Item Group → Item → Warehouse | **Keep as-is** |

Do **not** remove or change the existing Category hierarchy behaviour.

---

## Method

```text
erp_analysis.inventory.get_inventory_hierarchy
```

Whitelist: `@frappe.whitelist()` (logged-in OAuth user).  
HTTP: same as today (mobile uses GET with query params).

Existing Category levels must keep working. Extend the same method with Territory levels.

---

## Levels

### A) Territory path (new)

```text
territory → warehouse → brand → item_group → item
```

### B) Category path (existing — do not break)

```text
category → brand → item_group → item → warehouse
```

(Exact Category order may already be `category` then `brand` then `item_group` then `item` then `warehouse` on mobile — preserve current response shapes for those levels.)

---

## Parameters

| Param | Type | Required when | Notes |
| ----- | ---- | ------------- | ----- |
| `company` | string | recommended | Filter company |
| `level` | string | **always** | See allowed values below |
| `territory` | string | `warehouse`, `brand`, `item_group`, `item` on Territory path | Parent territory |
| `warehouse` | string | `brand`, `item_group`, `item` on Territory path | Parent warehouse |
| `brand` | string | `item_group`, `item` on Territory path | Parent brand |
| `item_group` | string | `item` on Territory path | Parent item group |
| `category` | string | Category path children | Existing |
| `item_code` | string | optional / leaf detail | Existing |
| `limit` | int | optional | Default `100` for `item`; higher OK for territory/warehouse |
| `territories` | string | optional | Comma-separated **view** stock territories override (see Access) |

### Allowed `level` values

**New:** `territory` | `warehouse` | `brand` | `item_group` | `item`  

**Existing (keep):** `category` | `brand` | `item_group` | `item` | `warehouse`

> Note: `brand`, `item_group`, `item`, `warehouse` are shared names. Disambiguate by **which parent filters are present**:
>
> - Territory path: `territory` (+ `warehouse` as you drill) is set.
> - Category path: `category` is set (and no territory root).
>
> When `level=brand` **with** `territory` + `warehouse` → brands **inside that warehouse**.  
> When `level=brand` **with** `category` → brands **inside that category** (existing).

---

## Warehouse ↔ Territory mapping (required decision)

Stock quantity/value lives on **Bin / Warehouse**, not on Territory. Server must map each warehouse to one territory.

**Implement in this order (first match wins):**

1. **Custom field** on Warehouse if present: `territory` or `custom_territory` (or site-specific field — document the actual field name in a comment).
2. Else Warehouse **`branch`** if values match territory names (`Riyadh`, `Jeddah`, `Dammam`, …).
3. Else **name / parent warehouse** contains a known territory name (document as fallback; least preferred).

Warehouses that cannot be mapped:

- Either put under territory `"Unassigned"`, or
- Omit from Territory path (prefer omit if value is material only under named territories).

Document which rule is active in the method docstring after inspecting live data.

---

## Access / stock scope

Honor the same Access Profile stock rules as other inventory APIs:

| Flag / field | Behaviour |
| ------------ | --------- |
| `allow_view_all_stock` | Company-wide stock; all territories with stock |
| else `view_territories` | Only those territories (and their warehouses) |
| `approve_territories` | **Do not** use for inventory browse |

Re-check on every hierarchy call (never trust client-only filters).

If the client sends `territories=Jeddah` (single filter chip later), intersect with allowed view set.

---

## Valuation

Use the **same valuation basis** as `get_inventory_snapshot` total inventory value (qty × valuation rate / stock value helper already used in inventory module). Territory row sums should reconcile to snapshot total (within rounding / unassigned omission).

Only include rows with **value > 0** (or qty ≠ 0), unless you explicitly support zero rows.

---

## Response shape

Prefer a consistent envelope:

```json
{
  "level": "territory",
  "rows": [
    {
      "id": "Jeddah",
      "name": "Jeddah",
      "value": 5200000.0,
      "qty": null,
      "percentage": 32.91,
      "sku_count": 1204
    }
  ],
  "meta": {
    "currency": "SAR",
    "company": "Printechs Advanced Printing Trading Co.",
    "total_value": 15800674.0
  }
}
```

### Row fields by level

| level | `id` / `name` | Extra |
| ----- | ------------- | ----- |
| `territory` | Territory name | `value`, `percentage`, `sku_count?` |
| `warehouse` | Warehouse name | `value`, `percentage`, `sku_count?` |
| `brand` | Brand (use `"No Brand"` if empty — pick one policy and stick to it) | `value`, `percentage` |
| `item_group` | Item Group | `value`, `percentage` |
| `item` | Item code as `id`, item name as `name` | `value`, `qty`, `percentage?`, `uom?` |

### Aliases (mobile will normalize)

Accept either style; prefer snake_case in BA:

- `value` \| `stock_value` \| `amount`
- `percentage` \| `pct`
- `qty` \| `actual_qty`
- `sku_count` \| `item_count`
- `id` \| `name` \| dimension key (`territory`, `warehouse`, `brand`, `item_group`, `item_code`)

**Backward compatibility:** If today’s Category path returns a bare **array** of rows, keep supporting that for Category levels. For Territory levels, envelope `{ level, rows, meta }` is preferred; mobile should also accept a bare array.

---

## Behaviour by `level` (Territory path)

### `level=territory`

- Params: `company?`
- Aggregate stock value by mapped territory.
- `percentage` = row.value / sum(rows.value) × 100 (or vs company total — be consistent; prefer sum of returned rows).

### `level=warehouse`

- Params: `company?`, **`territory`** (required)
- List warehouses mapped to that territory with stock value.

### `level=brand`

- Params: `company?`, **`territory`**, **`warehouse`**
- Group Bin lines in that warehouse by `Item.brand`.

### `level=item_group`

- Params: `company?`, **`territory`**, **`warehouse`**, **`brand`**
- Group by `Item.item_group` within that brand + warehouse.

### `level=item`

- Params: `company?`, **`territory`**, **`warehouse`**, **`brand`**, **`item_group`**
- Item-level stock: `item_code`, name, `qty`, `value`.
- Apply `limit` (default 100); order by `value` desc.
- Optional: `has_more: true` if truncated.

---

## Optional snapshot enrichment

Not required if mobile loads root via hierarchy `level=territory`.

If convenient, also add to `get_inventory_snapshot`:

```json
"inventory_by_territory": [
  { "territory": "Jeddah", "value": 5200000, "percentage": 32.91 }
]
```

Keep existing:

```json
"inventory_by_category": [ ... ]
```

---

## Example requests

### Root — territories

```http
GET /api/method/erp_analysis.inventory.get_inventory_hierarchy
  ?company=Printechs%20Advanced%20Printing%20Trading%20Co.
  &level=territory
```

### Warehouses under Jeddah

```http
GET /api/method/erp_analysis.inventory.get_inventory_hierarchy
  ?company=...
  &level=warehouse
  &territory=Jeddah
```

### Brands in a warehouse

```http
GET /api/method/erp_analysis.inventory.get_inventory_hierarchy
  ?company=...
  &level=brand
  &territory=Jeddah
  &warehouse=Jeddah%20Main%20-%20WHS%20-%20PRNTX
```

### Item groups

```http
GET /api/method/erp_analysis.inventory.get_inventory_hierarchy
  ?company=...
  &level=item_group
  &territory=Jeddah
  &warehouse=Jeddah%20Main%20-%20WHS%20-%20PRNTX
  &brand=SomeBrand
```

### Items

```http
GET /api/method/erp_analysis.inventory.get_inventory_hierarchy
  ?company=...
  &level=item
  &territory=Jeddah
  &warehouse=Jeddah%20Main%20-%20WHS%20-%20PRNTX
  &brand=SomeBrand
  &item_group=Retail
  &limit=100
```

---

## Error / edge cases

| Case | Response |
| ---- | -------- |
| Missing required parent filter | `400` / ValidationError with clear message |
| Territory not in user’s stock view | `403` or empty `rows` (prefer **403** if explicitly denied; empty if simply no stock) |
| No stock | `200` with `rows: []` |
| Unknown `level` | ValidationError |
| Heavy query | Cache 1–5 minutes per (company, level, filters); avoid N+1 Item fetches |

---

## Server implementation checklist

- [ ] Inspect live Warehouse docs → document mapping field (custom territory / branch / name)
- [ ] Extend `get_inventory_hierarchy` for `level=territory` and Territory-path filters
- [ ] Keep Category path responses unchanged
- [ ] Enforce `allow_view_all_stock` / `view_territories`
- [ ] Same valuation as snapshot total
- [ ] Child sums ≈ parent value (spot-check Jeddah → warehouses → one WH → brands)
- [ ] `@frappe.whitelist()` + restart / clear cache after deploy
- [ ] Re-run `form_cmd_kwargs.sh` if wrappers strip unknown kwargs (ensure `territory` is allowed through)
- [ ] Update this file’s “mapping field used” note after go-live

---

## Mobile notes

- Snapshot card **Inventory by Territory** with **separate** drill state from Category.
- Category card unchanged.
- Client: `app/inventory-dashboard.tsx`, `src/api/optimized-apis.ts` (`getInventoryHierarchy`), `src/hooks/useOptimizedApis.ts`.

---

## Related docs

- Master contract: [`ERP_ANALYSIS_API_CONTRACT.md`](./ERP_ANALYSIS_API_CONTRACT.md)
- Feature overview: [`FEATURE_OVERVIEW.md`](./FEATURE_OVERVIEW.md)
- Access scope (view vs approve): see Access Profile / `allow_view_all_stock` in the master contract
