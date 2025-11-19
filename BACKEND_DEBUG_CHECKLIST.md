# Backend Debug Checklist: Why SID25-000014 is Not Appearing

## Problem
The API `get_all_approvals` is returning **0 approvals** even though Sales Invoice `SID25-000014` exists and should be visible.

## Quick Checks on Backend (Demo Site)

### 1. Check the Invoice Details

Run this SQL query on the demo site database:

```sql
SELECT 
    name,
    territory,
    company,
    branch,
    docstatus,
    workflow_state,
    status,
    customer,
    customer_name,
    total,
    grand_total
FROM `tabSales Invoice`
WHERE name = 'SID25-000014';
```

**What to verify:**
- ✅ `docstatus = 0` (Draft) - If `docstatus = 1`, it's already submitted and won't appear
- ✅ `workflow_state` - Should be in a state that requires approval
- ✅ `territory` - Note the territory value
- ✅ `company` - Note the company value
- ✅ `branch` - Note the branch value

### 2. Check User's Access Profile

Get the logged-in user's email from the mobile app logs, then run:

```sql
SELECT 
    user_id,
    company,
    territory,
    territories,
    branch
FROM `tabAccess Profile`
WHERE user_id = '<logged_in_user_email>';
```

**What to verify:**
- ✅ `territories` - Should be a list/array of allowed territories
- ✅ `company` - Should match the invoice's company
- ✅ `branch` - May or may not be used for filtering

### 3. Check User's Permissions

Run this to check approval permissions:

```sql
SELECT 
    ap.user_id,
    ap.company,
    aor.object_key,
    aor.can_approve,
    aor.can_view
FROM `tabAccess Profile` ap
LEFT JOIN `tabAccess Object Registry` aor 
    ON aor.parent = ap.name
WHERE ap.user_id = '<logged_in_user_email>'
    AND aor.object_key = 'printechs_utility.approvals.sales_invoice';
```

**What to verify:**
- ✅ `can_approve = 1` - User must have approval access
- ✅ `can_view = 1` - User must have view access

### 4. Test the Backend Function Directly

On the demo site server, open Python console or create a test script:

```python
import frappe
from printechs_utility.api.approvals import get_all_approvals

# Login as the user (use the email from mobile app)
frappe.set_user('<logged_in_user_email>')

# Call the function directly
result = get_all_approvals()

print("=== API RESULT ===")
print(f"Total approvals: {result.get('message', {}).get('total_pending', 0)}")
print(f"Sales invoices: {result.get('message', {}).get('sales_invoices', 0)}")

approvals = result.get('message', {}).get('approvals', [])
print(f"\nApprovals array length: {len(approvals)}")

# Check if SID25-000014 is in the result
found = False
for approval in approvals:
    if approval.get('name') == 'SID25-000014':
        print(f"\n✅ Found SID25-000014: {approval}")
        found = True
        break

if not found:
    print("\n❌ SID25-000014 NOT found in approvals")
    print("\nAll Sales Invoice names returned:")
    for approval in approvals:
        if approval.get('doctype') == 'Sales Invoice':
            print(f"  - {approval.get('name')} (territory: {approval.get('territory')}, company: {approval.get('company')})")

# Check what territories are being used for filtering
from printechs_utility.api.api import get_my_access
access = get_my_access()
scope = access.get('message', {}).get('scope', {})
print(f"\n=== USER SCOPE ===")
print(f"Company: {scope.get('company')}")
print(f"Territories: {scope.get('territories')}")
print(f"Branch: {scope.get('branch')}")
```

### 5. Check Backend Filtering Logic

In `printechs_utility/api/approvals.py`, check the `get_all_approvals` function:

**Key areas to check:**

1. **Territory Filtering** (in `_fetch_sales_invoices` function):
   ```python
   # Check if territories are being filtered correctly
   if company_filter and territory_filter:
       filters["company"] = company_filter
       if territory_filter:
           filters["territory"] = ["in", territory_list]  # Should use "in" operator
   ```

2. **Company Filtering**:
   ```python
   # Verify company_filter matches the invoice's company
   perm_company = scope.get("company")
   company_filter = perm_company
   ```

3. **Permission Check**:
   ```python
   # Ensure evaluate() is checking permissions correctly
   can_approve = evaluate(
       object_key="printechs_utility.approvals.sales_invoice",
       action="approve",
       company=perm_company,
       user=user
   )
   ```

### 6. Common Issues & Fixes

#### Issue 1: Territory Mismatch
**Problem**: Invoice territory doesn't match user's allowed territories.

**Solution**:
- Check invoice's `territory` field matches one of user's `territories` in Access Profile
- If invoice has no territory, the backend may filter it out
- Ensure backend uses `["in", territory_list]` for territory filtering

#### Issue 2: Company Mismatch
**Problem**: Invoice company doesn't match user's company.

**Solution**:
- Verify both have the same company value
- Check for extra spaces or case differences

#### Issue 3: Invoice Already Submitted
**Problem**: `docstatus = 1` (submitted invoices don't need approval).

**Solution**:
- Ensure invoice is in Draft (`docstatus = 0`) or workflow state requires approval
- Check if workflow is configured correctly

#### Issue 4: No Approval Permission
**Problem**: User doesn't have `can_approve = 1` for Sales Invoice approvals.

**Solution**:
- Update Access Profile to grant approval permission
- Ensure `printechs_utility.approvals.sales_invoice` object exists in Access Object Registry
- Clear cache after permission changes

#### Issue 5: Empty Territories Array
**Problem**: User has empty `territories` array, so backend filters out everything.

**Solution**:
- Check if `territories` is `[]` or `None`
- Backend should handle empty territories gracefully
- Consider returning all invoices if user has no territory restriction

### 7. Quick Fix Test

To test if it's a territory issue, temporarily modify the backend:

```python
# In _fetch_sales_invoices function, temporarily comment out territory filter:
# if territory_filter:
#     filters["territory"] = ["in", territory_list]

# Or temporarily bypass territory filtering for this invoice:
if filters.get("territory"):
    # Don't filter by territory for now
    filters.pop("territory")
```

If invoices appear after removing territory filter, the issue is territory matching.

### 8. Expected Backend Response

When the invoice should appear, the backend should return:

```json
{
  "message": {
    "approvals": [
      {
        "id": "SID25-000014",
        "doctype": "Sales Invoice",
        "name": "SID25-000014",
        "territory": "...",
        "company": "...",
        ...
      }
    ],
    "total_pending": 1,
    "sales_invoices": 1,
    ...
  }
}
```

## Next Steps

After checking the above:

1. Share the invoice's `territory`, `company`, and `docstatus` values
2. Share the user's `territories` and `company` from Access Profile
3. Share the permission check result for `printechs_utility.approvals.sales_invoice`
4. Test the backend function directly and share the output

This will help identify the exact filtering issue.

