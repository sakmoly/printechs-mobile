# Refresh sales / home KPIs (mobile — current)

For now mobile **only** reloads widget data from the server cache — it does **not** call `refresh_sales_dashboard` or bench CLI tasks.

## What to do

**Pull down to refresh** on:

- **Home** dashboard  
- **Sales** dashboard  

That runs:

`POST erp_analysis.api.get_dashboard_board_data` with **`refresh: 1`** for that board (plus the current company, period, territory filters).

Customer 360: pull-to-refresh on the profile reloads **`get_customer_360`** / statement APIs for that customer (not the full sales table rebuild).

## Not exposed in the app (yet)

| Step | API | Status |
| ---- | --- | ------ |
| Server rebuild | `refresh_sales_dashboard` / `refresh_sales_dashboard_daily` | Not in UI |
| Widget reload | `get_dashboard_board_data` + `refresh: 1` | **Pull-to-refresh** |

Server rebuild helpers remain in `src/api/salesDashboardRefresh.ts` for a future Settings / admin action.

## Do not use from mobile

`bench execute frappeauth_app.tasks.hourly` — server CLI only.
