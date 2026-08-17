# Mobile dashboard contract (Home + widgets)

Contract for Printechs mobile against Frappe `erp_analysis` board APIs.

## Load Home (2 API calls)

| Step | Method | Role |
|------|--------|------|
| 1 | `get_mobile_bootstrap` | Layout only (widget keys, types, Desk config, drill_path / drill_views) |
| 2 | `get_dashboard_board_data?dashboard_id=home` | All root widget payloads in one batch |

- **No** per-widget loop on Home root.
- **No** legacy `get_dashboard_kpis` / complete / executive dashboard on Home.
- Drill (e.g. territory → brand) uses **`get_dashboard_widget_data`** for that widget only.
- Pull-to-refresh: bootstrap + board with `refresh=1`.
- Show skeleton after bootstrap while board loads.
- Optional client cache: React Query staleTime (~2 min board, ~5 min drill).

## Render rules (by type / hint — never by widget key)

| Type | Data path |
|------|-----------|
| KPI | `payload.kpi` (or `kpis[]`) |
| Donut / Pie | `payload.chart.series` |
| Table | `payload.table.columns` + `payload.table.rows` |
| Link | `payload.action` |

Do **not** hardcode keys (e.g. always pie for `sales_card`).

### Effective renderer priority

1. Desk `config.drill_views[drill_depth]` — e.g. `{"0":"donut","1":"table"}`
2. `meta.render_hint`
3. `payload.widget_type`
4. Payload shape (table / chart / kpi / action)
5. Bootstrap `widget_type`

If the preferred type has no matching data, fall back to the available shape.

## Donut → Table drill (Territory → Brand)

Same `widget_key`, increase `drill_depth`, pass filters:

```http
GET /api/method/erp_analysis…get_dashboard_widget_data
  ?widget_key=sales_card
  &drill_depth=1
  &filters={"territory":["Jeddah"]}
```

| Level | UI | Typical payload |
|-------|-----|-----------------|
| 0 | Chart (donut) | `chart.series` |
| 1 | Table (brand) | `table.columns` + `table.rows` |

Desk example:

```json
{
  "drill_path": ["territory", "brand"],
  "drill_views": { "0": "donut", "1": "table" },
  "show_ly": true
}
```

## Currency (no hardcoded SAR)

- Backend sends **raw numbers** only.
- Format via column `format`: `currency_compact` → `2.28M`, `currency`, `number`, etc.
- Honor `table.currency_display.show_symbol` (default **false**).

## Auth

On **401** (after refresh fails / non-recoverable):

1. Clear tokens + stored user
2. Clear React Query cache
3. Navigate to login

Do **not** remain “logged in” as Guest.

## TypeScript pseudocode

```ts
// Home load
const bootstrap = await get_mobile_bootstrap();
const board = await get_dashboard_board_data({
  dashboard_id: "home",
  // refresh: 1 on pull-to-refresh
});

for (const widget of bootstrap.home_widgets) {
  const root = board.widgets[widget.key];
  renderWidget(widget, root, { drillDepth: 0 });
}

async function onDonutSliceTap(widget, territoryValue, stack) {
  const depth = stack.length + 1;
  const payload = await get_dashboard_widget_data({
    widget_key: widget.key,
    drill_depth: depth,
    filters: { territory: [territoryValue] },
  });
  renderWidget(widget, payload, { drillDepth: depth });
}

function resolveType(widget, payload, drillDepth: number) {
  const views = widget.config?.drill_views;
  const fromViews = views?.[String(drillDepth)] ?? views?.[drillDepth];
  return (
    mapHint(fromViews) ||
    mapHint(payload.meta?.render_hint) ||
    mapHint(payload.widget_type) ||
    inferFromShape(payload) ||
    mapHint(widget.type)
  );
}

function renderWidget(widget, payload, { drillDepth }) {
  const type = resolveType(widget, payload, drillDepth);
  switch (type) {
    case "KPI":
      return renderKpi(payload.kpi ?? payload.kpis);
    case "DONUT":
    case "PIE":
      return renderPie(payload.chart?.series);
    case "TABLE":
      return renderTable(payload.table);
    case "LINK":
      return renderLink(payload.action);
  }
}
```

## Error handling

| Case | Behavior |
|------|----------|
| Board 404 / missing method | Soft fallback to per-widget fetch (dev / older servers only) |
| Widget missing from board | Skeleton / empty; optional single-widget fetch |
| Drill API error | Keep previous level visible (`keepPreviousData`); show error banner |
| 401 | Logout + login (see Auth) |
| Network / timeout on refresh | Recoverable: fail request, stay logged in |
| Invalid refresh token | Logout |

## Deploy / ops checklist

1. Deploy `erp_analysis` with `get_dashboard_board_data` + `get_dashboard_widget_data` (drill_depth + filters).
2. Desk Access Profile / Mobile Dashboard: set `drill_views` for multi-view widgets.
3. Confirm Home widgets appear in bootstrap layout and board batch under the same keys.
4. Smoke: cold start → 2 network calls; tap donut slice → one widget call with `drill_depth=1`; pull refresh → `refresh=1`.
5. Smoke: expire token → app lands on login, not Guest Home.
6. Smoke: table cells use compact currency without forced `SAR ` prefix when `show_symbol` is false.

## Mobile implementation map

| Concern | Location |
|---------|----------|
| Board batch | `src/api/dashboardBoardData.ts`, `src/hooks/useDashboardBoardData.ts` |
| Single widget + normalize | `src/api/dashboardWidgetData.ts` |
| Drill stack | `src/widgets/useWidgetDrill.ts` |
| Type resolution | `src/widgets/resolveRenderType.ts`, `WidgetRenderer.tsx` |
| Home shell | `app/(tabs)/index.tsx` |
| 401 → login | `app/_layout.tsx` + `src/api/http.ts` |
| Currency | `src/utils/currency.ts`, `AnalysisTable` |
