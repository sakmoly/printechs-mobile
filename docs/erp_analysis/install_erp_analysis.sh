#!/usr/bin/env bash
# =============================================================================
# install_erp_analysis.sh
#
# Creates / updates the erp_analysis Frappe app, installs it on a site,
# migrates, ensures OAuth Client (password grant), and restarts bench.
#
# Usage (on the ERPNext / bench server):
#   export SITE="erp.example.com"
#   export BENCH_PATH="$HOME/frappe-bench"   # optional
#   export MIGRATE_FROM_PRINTECHS=1          # optional: wrap printechs_utility
#   chmod +x install_erp_analysis.sh
#   ./install_erp_analysis.sh
# =============================================================================
set -euo pipefail

SITE="${SITE:-}"
BENCH_PATH="${BENCH_PATH:-$HOME/frappe-bench}"
APP_NAME="erp_analysis"
APP_VERSION="1.0.0"
MIGRATE_FROM_PRINTECHS="${MIGRATE_FROM_PRINTECHS:-0}"
OAUTH_APP_NAME="${OAUTH_APP_NAME:-Printechs Mobile}"

if [[ -z "$SITE" ]]; then
  echo "ERROR: Set SITE to your bench site name, e.g.:"
  echo "  export SITE=erp.example.com"
  exit 1
fi

if [[ ! -d "$BENCH_PATH" ]]; then
  echo "ERROR: Bench path not found: $BENCH_PATH"
  echo "  export BENCH_PATH=/path/to/frappe-bench"
  exit 1
fi

cd "$BENCH_PATH"
APP_ROOT="$BENCH_PATH/apps/$APP_NAME"
PKG="$APP_ROOT/$APP_NAME"

echo "==> Bench: $BENCH_PATH"
echo "==> Site:  $SITE"
echo "==> App:   $APP_NAME"
echo "==> Migrate wrappers from printechs_utility: $MIGRATE_FROM_PRINTECHS"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
write_file() {
  local path="$1"
  local dir
  dir="$(dirname "$path")"
  mkdir -p "$dir"
  cat > "$path"
  echo "    wrote $path"
}

# ---------------------------------------------------------------------------
# 1. Scaffold app if missing
# ---------------------------------------------------------------------------
if [[ ! -d "$APP_ROOT" ]]; then
  echo "==> Creating app scaffold at $APP_ROOT"
  mkdir -p "$PKG"
else
  echo "==> App folder exists — refreshing Python modules"
  mkdir -p "$PKG"
fi

# Minimal setup.py / pyproject so bench recognizes the app
if [[ ! -f "$APP_ROOT/setup.py" && ! -f "$APP_ROOT/pyproject.toml" ]]; then
  write_file "$APP_ROOT/pyproject.toml" <<EOF
[project]
name = "erp_analysis"
authors = [{ name = "Printechs", email = "support@printechs.com" }]
description = "Mobile Business Analysis APIs for ERPNext"
requires-python = ">=3.10"
readme = "README.md"
dynamic = ["version"]

[build-system]
requires = ["flit_core >=3.4,<4"]
build-backend = "flit_core.buildapi"
EOF

  write_file "$APP_ROOT/README.md" <<EOF
# erp_analysis

Frappe app exposing Business Analysis APIs for the Printechs / ERPNext mobile client.
EOF
fi

write_file "$PKG/__init__.py" <<EOF
__version__ = "${APP_VERSION}"
EOF

write_file "$PKG/modules.txt" <<EOF
ERP Analysis
EOF

write_file "$PKG/patches.txt" <<EOF
EOF

write_file "$PKG/hooks.py" <<EOF
app_name = "erp_analysis"
app_title = "ERP Analysis"
app_publisher = "Printechs"
app_description = "Mobile Business Analysis APIs for ERPNext"
app_email = "support@printechs.com"
app_license = "mit"

# Required for Frappe to import whitelisted methods under erp_analysis.*
EOF

# ---------------------------------------------------------------------------
# Wrapper vs stub body
# ---------------------------------------------------------------------------
# When MIGRATE_FROM_PRINTECHS=1, generate a thin call-through if import works.
gen_method() {
  local module_path="$1"   # e.g. dashboard
  local func="$2"          # e.g. get_complete_dashboard_data
  local old_module="$3"    # e.g. printechs_utility.dashboard
  local allow_guest="${4:-0}"

  local guest_arg=""
  if [[ "$allow_guest" == "1" ]]; then
    guest_arg="allow_guest=True"
  fi

  if [[ "$MIGRATE_FROM_PRINTECHS" == "1" && -n "$old_module" ]]; then
    cat <<EOF
@frappe.whitelist(${guest_arg})
def ${func}(**kwargs):
    """Proxy to ${old_module}.${func} while migrating."""
    import inspect
    for _k in ("cmd", "method", "csrf_token", "args", "kwargs"):
        kwargs.pop(_k, None)
    try:
        mod = frappe.get_module("${old_module}")
        impl = getattr(mod, "${func}")
        try:
            sig = inspect.signature(impl)
            if not any(p.kind == inspect.Parameter.VAR_KEYWORD for p in sig.parameters.values()):
                allowed = set(sig.parameters.keys())
                kwargs = {k: v for k, v in kwargs.items() if k in allowed}
        except (TypeError, ValueError):
            pass
        return impl(**kwargs)
    except Exception as e:
        frappe.log_error(title="erp_analysis.${module_path}.${func}", message=frappe.get_traceback())
        frappe.throw("erp_analysis.${module_path}.${func} failed: {0}".format(str(e)))
EOF
  else
    cat <<EOF
@frappe.whitelist(${guest_arg})
def ${func}(**kwargs):
    """Stub — replace with real BA logic or migrate from printechs_utility."""
    for _k in ("cmd", "method", "csrf_token", "args", "kwargs"):
        kwargs.pop(_k, None)
    return {"ok": True, "stub": True, "method": "erp_analysis.${module_path}.${func}", "kwargs": kwargs}
EOF
  fi
}

# ---------------------------------------------------------------------------
# 2. Core API modules
# ---------------------------------------------------------------------------
echo "==> Writing API modules"

write_file "$PKG/api.py" <<EOF
import frappe

APP_VERSION = "${APP_VERSION}"


@frappe.whitelist(allow_guest=True)
def health():
    return {
        "ok": True,
        "status": "ok",
        "version": APP_VERSION,
        "message": "erp_analysis is available",
    }


@frappe.whitelist()
def get_mobile_config(**kwargs):
    return {
        "app": "erp_analysis",
        "version": APP_VERSION,
        "modules": {
            "sales": True,
            "receivables": True,
            "inventory": True,
            "approvals": True,
            "catalogue": False,
            "push": False,
            "settings": True,
        },
        "dimensions": {
            "company": True,
            "territory": True,
            "warehouse": True,
            "brand": True,
            "division": True,
            "department": True,
            "cost_center": False,
            "branch": True,
        },
        "apis": {},
        "dashboards": [
            {
                "id": "home",
                "title": "Dashboard",
                "module": "sales",
                "widgets": [
                    {"id": "sales_card", "type": "expandable", "title": "Sales Performance"},
                    {"id": "receivables_card", "type": "expandable", "title": "Receivables"},
                    {"id": "inventory_card", "type": "expandable", "title": "Inventory"},
                ],
            }
        ],
    }


@frappe.whitelist()
def get_my_access(**kwargs):
$( if [[ "$MIGRATE_FROM_PRINTECHS" == "1" ]]; then
  cat <<'PY'
    try:
        from printechs_utility.api import get_my_access as _impl
        return _impl(**kwargs)
    except Exception:
        return {"scope": kwargs, "profiles": []}
PY
else
  cat <<'PY'
    # Return empty profiles → mobile treats missing keys as allowed (deny-only model)
    return {"scope": kwargs, "profiles": []}
PY
fi )


@frappe.whitelist()
def clear_my_access_cache(user=None):
$( if [[ "$MIGRATE_FROM_PRINTECHS" == "1" ]]; then
  cat <<'PY'
    try:
        from printechs_utility.api import clear_my_access_cache as _impl
        return _impl(user=user)
    except Exception:
        return {"ok": True}
PY
else
  cat <<'PY'
    return {"ok": True}
PY
fi )


@frappe.whitelist()
def store_push_token(**kwargs):
    # Phase 2 — accept and no-op for now
    return {"ok": True, "stored": False, "phase": 2}
EOF

write_file "$PKG/config.py" <<EOF
import frappe

OAUTH_APP_NAME = "${OAUTH_APP_NAME}"


@frappe.whitelist(allow_guest=True)
def get_client_id():
    name = frappe.db.get_value("OAuth Client", {"app_name": OAUTH_APP_NAME}, "name")
    if not name:
        name = frappe.db.get_value("OAuth Client", {}, "name", order_by="creation asc")
    if not name:
        return {"client_id": None, "message": "No OAuth Client found. Run erp_analysis.oauth_setup.ensure_oauth_client"}
    client_id = frappe.db.get_value("OAuth Client", name, "client_id")
    return {"client_id": client_id}
EOF

write_file "$PKG/oauth_setup.py" <<EOF
import frappe

OAUTH_APP_NAME = "${OAUTH_APP_NAME}"


def ensure_oauth_client():
    """Create OAuth Client with password grant for mobile login. Returns client_id."""
    existing = frappe.db.get_value("OAuth Client", {"app_name": OAUTH_APP_NAME}, "name")
    if existing:
        doc = frappe.get_doc("OAuth Client", existing)
    else:
        doc = frappe.get_doc({
            "doctype": "OAuth Client",
            "app_name": OAUTH_APP_NAME,
            "scopes": "all openid",
            "redirect_uris": "erpnext://oauth",
            "default_redirect_uri": "erpnext://oauth",
            "grant_type": "Password",
            "response_type": "Code",
        })
        try:
            doc.insert(ignore_permissions=True)
        except Exception:
            frappe.log_error(frappe.get_traceback(), "erp_analysis.ensure_oauth_client")
            frappe.throw(
                "Could not create OAuth Client. Create one manually in Desk "
                "(Grant Type: Password)."
            )

    for field, value in (
        ("grant_type", "Password"),
        ("skip_authorization", 1),
    ):
        if hasattr(doc, field):
            setattr(doc, field, value)
    try:
        doc.save(ignore_permissions=True)
    except Exception:
        pass

    frappe.db.commit()
    client_id = doc.get("client_id") or frappe.db.get_value("OAuth Client", doc.name, "client_id")
    print("OAuth Client: {0}".format(doc.name))
    print("client_id: {0}".format(client_id))
    return client_id
EOF

# Module files
write_file "$PKG/dashboard.py" <<EOF
import frappe

$(gen_method dashboard get_complete_dashboard_data printechs_utility.dashboard)
EOF

write_file "$PKG/sales_kpis.py" <<EOF
import frappe

$(gen_method sales_kpis get_dashboard_kpis printechs_utility.sales_kpis)
$(gen_method sales_kpis get_sales_dashboard printechs_utility.sales_kpis)
EOF

write_file "$PKG/receivables.py" <<EOF
import frappe

$(gen_method receivables get_receivables_snapshot printechs_utility.receivables)
$(gen_method receivables get_receivables_performance printechs_utility.receivables)
$(gen_method receivables get_receivables_trends printechs_utility.receivables)
$(gen_method receivables get_receivables_dashboard printechs_utility.receivables)
$(gen_method receivables get_territory_receivables printechs_utility.receivables)
$(gen_method receivables get_customer_statement printechs_utility.receivables)
EOF

write_file "$PKG/inventory.py" <<EOF
import frappe

$(gen_method inventory get_inventory_snapshot printechs_utility.inventory)
$(gen_method inventory get_inventory_performance printechs_utility.inventory)
$(gen_method inventory get_inventory_trends printechs_utility.inventory)
$(gen_method inventory get_inventory_risk printechs_utility.inventory)
$(gen_method inventory get_inventory_hierarchy printechs_utility.inventory)
EOF

write_file "$PKG/approvals.py" <<EOF
import frappe

$(gen_method approvals get_all_approvals printechs_utility.approvals)
$(gen_method approvals approve_document printechs_utility.approvals)
$(gen_method approvals reject_document printechs_utility.approvals)
$(gen_method approvals inbox printechs_utility.approvals)
$(gen_method approvals apply printechs_utility.approvals)
EOF

write_file "$PKG/employee.py" <<EOF
import frappe

$(gen_method employee get_complete_employees_data printechs_utility.employee)
$(gen_method employee get_employee_profile printechs_utility.employee)
$(gen_method employee get_employees printechs_utility.employee)
EOF

write_file "$PKG/catalogue.py" <<EOF
import frappe

$(gen_method catalogue get_catalogues_list printechs_utility.catalogue)
$(gen_method catalogue get_catalogue_pages printechs_utility.catalogue)
$(gen_method catalogue get_catalogue_flip_url printechs_utility.catalogue)
EOF

write_file "$PKG/customer_notifications.py" <<EOF
import frappe

$(gen_method customer_notifications send_statement_pdf printechs_utility.customer_notifications)
EOF

# ---------------------------------------------------------------------------
# 3. Ensure app is on bench apps path / sites/apps.txt
# ---------------------------------------------------------------------------
echo "==> Registering app with bench"
if ! grep -qx "$APP_NAME" "$BENCH_PATH/sites/apps.txt" 2>/dev/null; then
  echo "$APP_NAME" >> "$BENCH_PATH/sites/apps.txt"
  echo "    added $APP_NAME to sites/apps.txt"
fi

# Install Python package in editable mode when possible
if command -v bench >/dev/null 2>&1; then
  if [[ -f "$APP_ROOT/pyproject.toml" || -f "$APP_ROOT/setup.py" ]]; then
    echo "==> pip install -e apps/$APP_NAME (best effort)"
    bench pip install -e "apps/$APP_NAME" || true
  fi
fi

# ---------------------------------------------------------------------------
# 4. Install app on site + migrate
# ---------------------------------------------------------------------------
echo "==> Installing app on site $SITE"
if bench --site "$SITE" list-apps 2>/dev/null | grep -qw "$APP_NAME"; then
  echo "    already installed"
else
  bench --site "$SITE" install-app "$APP_NAME"
fi

echo "==> Migrating site $SITE"
bench --site "$SITE" migrate

# ---------------------------------------------------------------------------
# 5. OAuth client
# ---------------------------------------------------------------------------
echo "==> Ensuring OAuth Client (Password grant)"
bench --site "$SITE" execute erp_analysis.oauth_setup.ensure_oauth_client || {
  echo "WARNING: Could not auto-create OAuth Client."
  echo "  Create manually in Desk → OAuth Client (Grant Type: Password)."
}

# ---------------------------------------------------------------------------
# 6. Restart
# ---------------------------------------------------------------------------
echo "==> Restarting bench"
bench restart || true

# ---------------------------------------------------------------------------
# 7. Verify
# ---------------------------------------------------------------------------
echo "==> Verifying health method"
bench --site "$SITE" execute erp_analysis.api.health || true

CLIENT_ID="$(bench --site "$SITE" execute erp_analysis.config.get_client_id 2>/dev/null || true)"
echo ""
echo "============================================================================="
echo " DONE"
echo " App:      $APP_NAME v$APP_VERSION"
echo " Site:     $SITE"
echo " Health:   /api/method/erp_analysis.api.health"
echo " Config:   /api/method/erp_analysis.api.get_mobile_config"
echo " Client:   /api/method/erp_analysis.config.get_client_id"
echo " get_client_id result: $CLIENT_ID"
echo ""
echo " Mobile steps:"
echo "  1. Open app → Server settings"
echo "  2. Enter https://$SITE  (use your real URL / port)"
echo "  3. Confirm client_id if prompted"
echo "  4. Login with ERPNext username + password"
echo "============================================================================="
