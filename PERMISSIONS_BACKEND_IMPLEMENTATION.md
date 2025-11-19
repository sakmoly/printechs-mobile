# ERPNext Dashboard Permission – Dedicated DocType Blueprint

This document outlines how to implement a dedicated permission DocType for dashboard access control. It covers schema design, backend logic, caching, and rollout suggestions. Adapt the names to match your ERPNext app/namespace (`printechs_utility` used as example).

---

## 1. Goal

- Control who can *view* or *approve* each dashboard.
- Allow territory-scoped access (optional).
- Keep a clear audit trail and easy admin UI.

---

## 2. DocType Design

| Field              | Type                    | Notes                                                   |
|--------------------|-------------------------|---------------------------------------------------------|
| `title`            | Data (Autoname optional)| Human-readable record name (`Dashboard - Territory`).   |
| `user`             | Link → User             | Required.                                               |
| `dashboard_type`   | Select / Link           | e.g. Receivables, Sales, Inventory (enum is cleaner).   |
| `territory`        | Link → Territory        | Optional. Leave blank for “all territories.”            |
| `company`          | Link → Company (optional)| Helpful if dashboards are company specific.           |
| `can_view`         | Check                   | Default 1.                                              |
| `can_approve`      | Check                   | Default 0.                                              |
| `from_date` / `to_date` (optional) | Date   | Future-proof if access is time-bound.                   |
| `notes`            | Small Text              | Free-form comment.                                      |

**DocType options**
- `Module`: keep inside your analytics app (e.g. *Printechs Utility*).
- `Custom Permissions`: Use standard Frappe doc permissions (System Manager, etc.).
- Add a *List Filter* by `user` for quick searches.
- Optional: Use *Unique* constraint on `(user, dashboard_type, territory)` via `validate` method to avoid duplicates.

---

## 3. Backend API Hook-Up

### 3.1 Helper Service `dashboard_permission.py`

```python
# printechs_utility/permissions/dashboard_permission.py
import frappe
from functools import lru_cache

DOCNAME = "Dashboard Access"

@lru_cache(maxsize=512)
def _fetch_permissions(user: str) -> list[dict]:
    filters = {"user": user, "disabled": ["!=", 1]}
    fields = [
        "name",
        "dashboard_type",
        "territory",
        "company",
        "can_view",
        "can_approve",
    ]
    return frappe.get_all(DOCNAME, filters=filters, fields=fields)

def get_permissions(user: str) -> list[dict]:
    return _fetch_permissions(user)

def user_can_view(user: str, dashboard: str, territory: str | None = None) -> bool:
    for perm in get_permissions(user):
        if perm.dashboard_type != dashboard:
            continue
        if territory and perm.territory and perm.territory != territory:
            continue
        if perm.get("can_view"):
            return True
    return False

def user_can_approve(user: str, dashboard: str, territory: str | None = None) -> bool:
    for perm in get_permissions(user):
        if perm.dashboard_type != dashboard:
            continue
        if territory and perm.territory and perm.territory != territory:
            continue
        if perm.get("can_approve"):
            return True
    return False

def clear_cache(user: str | None = None):
    if user:
        _fetch_permissions.cache_clear()
        # Re-seed specific user if needed
    else:
        _fetch_permissions.cache_clear()
```

### 3.2 Invalidate cache when records change

```python
# dashboard_access.py (DocType controller)
from printechs_utility.permissions.dashboard_permission import clear_cache

class DashboardAccess(Document):
    def validate(self):
        if not (self.can_view or self.can_approve):
            frappe.throw("Enable at least one of Can View or Can Approve.")
        # enforce uniqueness per (user, dashboard, territory)
        existing = frappe.db.exists(
            "Dashboard Access",
            {
                "user": self.user,
                "dashboard_type": self.dashboard_type,
                "territory": self.territory,
                "name": ["!=", self.name],
            },
        )
        if existing:
            frappe.throw("Permission already exists for this user/dashboard/territory.")

    def on_update(self):
        clear_cache(self.user)

    def on_trash(self):
        clear_cache(self.user)
```

---

## 4. Securing APIs

Example: Receivables dashboard endpoint.

```python
@frappe.whitelist()
def get_receivables_trend(territory=None):
    user = frappe.session.user
    if not user_can_view(user, "Receivables", territory):
        frappe.throw("Not permitted to view Receivables dashboard.", frappe.PermissionError)

    filters = {}
    if territory:
        filters["territory"] = territory

    return fetch_data(filters)
```

For approval actions:

```python
@frappe.whitelist()
def approve_receivable(docname, territory=None):
    user = frappe.session.user
    if not user_can_approve(user, "Receivables", territory):
        frappe.throw("Approval rights missing.", frappe.PermissionError)
    # proceed with approval
```

---

## 5. Caching Strategy

- The `lru_cache` keeps perms in memory per worker.  
- Also consider making a Redis cache if you expect many users.
- Run `clear_cache(user)` on login:

```python
# hooks.py
login_hooks = ["printechs_utility.permissions.hooks.reset_dashboard_cache"]
```

```python
# permissions/hooks.py
from .dashboard_permission import clear_cache, get_permissions

def reset_dashboard_cache(login_manager):
    user = login_manager.user
    clear_cache(user)
    # Optionally warm up cache
    get_permissions(user)
```

---

## 6. Admin UI Enhancements

1. **Dashboard Access List**
   - Add List view fields: `user`, `dashboard_type`, `territory`, `can_view`, `can_approve`.
   - Add filters for quick search (User, Dashboard).

2. **User Form Dashboard**
   - Create a child table (via *Customize Form*) on User to show related access records (`Dashboard Access` DocType as child table read-only).
   - Add a button “Add Dashboard Access” opening a new DocType entry.

3. **Quick Actions**
   - Add Bulk Assignment: `frappe.new_doc("Dashboard Access", {"user": user, ...})`.
   - Use server script or background job if you need to seed default permissions for all users in a role.

---

## 7. Territory Enforcement Patterns

- If `territory` is blank: treat as “All territories”; else only allow matches.
- Some dashboards aggregate multiple territories: filter to `WHERE territory IN user_territories`.
- Example utility:

```python
def get_authorized_territories(user, dashboard):
    perms = [
        p for p in get_permissions(user)
        if p.dashboard_type == dashboard and p.can_view
    ]

    specific = {p.territory for p in perms if p.territory}
    if not specific:
        return None  # means all territories
    return list(specific)
```

Usage in SQL:

```python
territories = get_authorized_territories(user, "Receivables")
if territories:
    filters["territory"] = ["in", territories]
```

---

## 8. Rollout Checklist

1. **Create DocType**
   - Use ERPNext UI → DocType → New.
   - Add fields described above.
   - Deploy to app (`bench migrate`).

2. **Seed Permissions**
   - For each dashboard, create records for pilot users/admins.
   - Verify `Dashboard Access` list and ensure duplicates are blocked.

3. **Update Backend**
   - Add helper module, caching, and guard logic to each dashboard API.
   - Add tests (optional) to ensure blocked users receive `PermissionError`.

4. **Frontend Handling**
   - Update mobile app to hide dashboards cards the user cannot view (use new API endpoint `GET /dashboard-access` or introspect HTTP 403).
   - For approval actions, show nice error message when backend rejects.

5. **Training / SOP**
   - Document for admins: “To grant dashboard access, go to Dashboard Access, create record with user + dashboard + territory.”

---

## 9. Future Enhancements

- Add `role_profile` field to inherit from Frappe Role Profiles when record is created.
- Add automation to clone permissions from another user.
- Add timeline logging (DocType already logs changes by default).
- Add “effective_from / effective_to” to automate temporary access.

---

## 10. Summary

Creating a dedicated `Dashboard Access` DocType gives you:

- Full control over which user sees which dashboard/territory.
- Clear separation of view vs approve rights.
- Central place to audit and manage permissions.
- Easy to extend as new dashboards or dimensions appear.

Once this DocType and backend guard is in place, the mobile/frontend only needs to respect the API responses—no sensitive data leaves the server unless the user is authorized.

