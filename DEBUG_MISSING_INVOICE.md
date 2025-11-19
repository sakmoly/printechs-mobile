# Debug Guide: Missing Sales Invoice SID25-000014

## Issue
Sales Invoice `SID25-000014` is not appearing in the approvals session on the demo site.

## Enhanced Debugging Added
I've added enhanced logging to the mobile app that will:
1. Log the exact API request being sent (including territories)
2. Check if SID25-000014 exists in the API response
3. List all Sales Invoice names returned by the API
4. Log permission scope details

## Common Causes & Solutions

### 1. **Territory Filtering** (Most Common)
**Problem**: The invoice's territory doesn't match the user's allowed territories.

**Check on Backend**:
```python
# In get_all_approvals function, check:
# - What territory is assigned to SID25-000014?
# - What territories does the logged-in user have access to?
# - Are territories being matched correctly?
```

**Solution**: 
- Verify the Sales Invoice has a `territory` field that matches one of the user's allowed territories
- Check if the backend is correctly filtering by territory

### 2. **Workflow State**
**Problem**: The invoice is not in a state that requires approval.

**Check on Backend**:
- Ensure the Sales Invoice has `docstatus = 0` (Draft) or is in a workflow state that requires approval
- Check if the invoice has been submitted already (`docstatus = 1`)

**Solution**:
```python
# In _fetch_sales_invoices function:
# Ensure you're checking:
filters["docstatus"] = 0  # Draft status
# OR check workflow state for pending approval
```

### 3. **Permission Issues**
**Problem**: The user doesn't have approval access for this invoice.

**Check on Backend**:
- Verify the user has `can_approve: true` for `printechs_utility.approvals.sales_invoice`
- Check if `evaluate()` function is correctly checking permissions
- Ensure the user's Access Profile includes this approval permission

**Solution**: 
- Check Access Profile permissions for the logged-in user
- Verify the approval permission is enabled for Sales Invoice documents

### 4. **Company/Branch Filtering**
**Problem**: The invoice belongs to a different company or branch than the user has access to.

**Check on Backend**:
- Verify the Sales Invoice's `company` field matches the user's company
- Check if branch filtering is excluding this invoice

**Solution**:
```python
# In get_all_approvals, check company filter:
perm_company = scope.get("company")
# Ensure SID25-000014's company matches perm_company
```

### 5. **Invoice Name Format**
**Problem**: The invoice might be stored with a different name format.

**Check on Backend**:
- Query the database directly: `SELECT name, territory, company, docstatus FROM `tabSales Invoice` WHERE name = 'SID25-000014'`
- Verify the `name` field in the response matches exactly

## How to Debug

### Step 1: Check Mobile App Logs
After refreshing the approvals screen, check the console logs for:
- `📤 Approvals API Request:` - Shows what territories are being sent
- `✅ Found SID25-000014:` - Confirms if the invoice is in the response
- `❌ SID25-000014 NOT found in approvals response` - Invoice is missing
- `📋 All invoice names in response:` - Lists all returned invoices

### Step 2: Check Backend Directly
On the demo site backend, test the API:

```bash
# Using Postman or curl:
POST https://demo.printechs.com/api/method/printechs_utility.approvals.get_all_approvals
Headers:
  Authorization: Bearer <your_token>

Body:
{
  "territories": "Dammam,Riyadh"  # Use the user's allowed territories
}
```

### Step 3: Query Database Directly
```sql
-- Check the invoice details
SELECT 
    name,
    territory,
    company,
    branch,
    docstatus,
    workflow_state,
    modified_by
FROM `tabSales Invoice`
WHERE name = 'SID25-000014';

-- Check user's territories
SELECT 
    user_id,
    company,
    territory,
    branch
FROM `tabAccess Profile`
WHERE user_id = '<logged_in_user_email>';
```

### Step 4: Test Backend Function Directly
In Python console on the server:
```python
import frappe
from printechs_utility.api.approvals import get_all_approvals

# Login as the user
frappe.set_user('<user_email>')

# Call the function directly
result = get_all_approvals()

# Check if SID25-000014 is in the result
for approval in result.get('message', {}).get('approvals', []):
    if approval.get('name') == 'SID25-000014':
        print("✅ Found:", approval)
        break
else:
    print("❌ Not found in approvals")
    print("All invoices:", [a['name'] for a in result.get('message', {}).get('approvals', []) if a.get('doctype') == 'Sales Invoice'])
```

## Quick Fixes to Try

1. **Check Territory Assignment**:
   - Open Sales Invoice SID25-000014 in ERPNext
   - Verify it has a `territory` field set
   - Ensure the territory matches one of the user's allowed territories

2. **Check Workflow State**:
   - Verify the invoice is in Draft status (docstatus = 0)
   - If using workflow, ensure it's in a "Pending Approval" state

3. **Verify Permissions**:
   - Check the user's Access Profile
   - Ensure `can_approve: true` for Sales Invoice approvals

4. **Clear Cache**:
   - On mobile app: Logout and login again
   - On backend: Clear Access Profile cache

## Next Steps

After checking the logs, share:
1. What territories are being sent in the API request
2. Whether SID25-000014 appears in the response or not
3. The invoice's territory, company, and docstatus from the database
4. The user's allowed territories from Access Profile

This will help identify the exact cause of the filtering issue.

