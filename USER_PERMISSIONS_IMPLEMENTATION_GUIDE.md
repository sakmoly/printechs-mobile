# User Permissions & Role-Based Access Control (RBAC) Implementation Guide

## Overview

This guide outlines the best approach to implement user-level permissions and role-based access control (RBAC) for:

1. **Dashboard Access Control**: Restrict users to specific dashboards (e.g., Sales only, Receivables only, or All)
2. **Territory-Based Approvals**: Control which territories users can approve (e.g., Dammam only, Riyadh only, or All)

---

## Recommended Approach: Backend-Driven Permissions

### ✅ **Why Backend-Driven?**

1. **Security**: Permissions must be enforced on the backend - never trust frontend-only checks
2. **Single Source of Truth**: Centralized permission management in ERPNext
3. **Easy Maintenance**: Update permissions in one place (backend), not across multiple devices
4. **Audit Trail**: Backend can log permission checks for compliance
5. **Consistency**: Same permission logic for web app and mobile app

---

## Architecture Design

### **1. Database Schema (ERPNext Backend)**

#### **Option A: Use ERPNext's Built-in Role & Permission System** (Recommended)

ERPNext already has a robust permission system. Leverage it:

**Tables to Use:**

- `tabUser` - User master data
- `tabRole` - Role definitions
- `tabHas Role` - User-Role assignments
- `tabUser Permission` - User-specific permissions (for territories)
- `tabDocPerm` - Document-level permissions

**Advantages:**

- ✅ Already integrated with ERPNext
- ✅ Uses ERPNext's permission engine
- ✅ Easy to manage via ERPNext UI
- ✅ Supports complex permission rules

#### **Option B: Custom Permission Tables** (If more flexibility needed)

Create custom DocTypes in ERPNext:

**1. Mobile Dashboard Permission (Custom DocType)**

```
DocType: Mobile Dashboard Permission
Fields:
- user (Link: User) - Mandatory
- dashboard_name (Select) - Options: "Sales", "Receivables", "Inventory", "Payables", "All"
- enabled (Check) - Enable/disable access
```

**2. Territory Approval Permission (Custom DocType)**

```
DocType: Territory Approval Permission
Fields:
- user (Link: User) - Mandatory
- territory (Link: Territory) - Can have multiple records per user
- can_approve_all (Check) - If checked, user can approve all territories
```

**Advantages:**

- ✅ Complete control over permission logic
- ✅ Easy to query and filter
- ✅ Can add custom fields as needed

---

## Implementation Strategy

### **Phase 1: Backend API Development**

#### **Step 1.1: Create User Permissions API**

**Endpoint**: `/api/method/printechs_utility.permissions.get_user_permissions`

**Purpose**: Return all permissions for the logged-in user

**Response Structure**:

```json
{
  "message": {
    "user": "user@example.com",
    "dashboards": {
      "sales": true,
      "receivables": false,
      "inventory": false,
      "payables": false,
      "all_dashboards": false // If true, user can access all dashboards
    },
    "approval_territories": ["Dammam", "Riyadh"],
    "can_approve_all_territories": false, // If true, can approve all
    "roles": ["Sales Manager", "Territory Manager"]
  }
}
```

**Backend Implementation** (Python/Frappe):

```python
@frappe.whitelist(allow_guest=False)
def get_user_permissions():
    """
    Get all permissions for the current logged-in user
    """
    user = frappe.session.user

    # Get dashboard permissions
    dashboards = get_dashboard_permissions(user)

    # Get territory approval permissions
    territories = get_territory_permissions(user)

    return {
        "user": user,
        "dashboards": dashboards,
        "approval_territories": territories,
        "can_approve_all_territories": check_approve_all_territories(user),
        "roles": frappe.get_roles(user)
    }
```

#### **Step 1.2: Update Approvals API to Enforce Territory Filters**

**Current Endpoint**: `/api/method/printechs_utility.approvals.get_complete_approvals_data`

**Enhancement**: Automatically filter by user's territory permissions

**Backend Logic**:

```python
def get_approval_territories(user):
    """
    Get list of territories user can approve
    Returns: List of territory names, or ["ALL"] if user can approve all
    """
    # Check if user has "approve all territories" permission
    if can_approve_all_territories(user):
        return ["ALL"]

    # Get specific territories from Territory Approval Permission DocType
    territories = frappe.get_all(
        "Territory Approval Permission",
        filters={"user": user, "enabled": 1},
        fields=["territory"]
    )

    return [t.territory for t in territories]

# In get_complete_approvals_data function:
territories = get_approval_territories(frappe.session.user)
if "ALL" not in territories:
    # Add territory filter to SQL query
    where_clause += " AND territory IN ({})".format(
        ",".join(["%s"] * len(territories))
    )
    params.extend(territories)
```

#### **Step 1.3: Create Permission Check Middleware**

**Purpose**: Reusable function to check permissions across all APIs

```python
def check_dashboard_access(user, dashboard_name):
    """
    Check if user has access to a specific dashboard
    Returns: True if allowed, False otherwise
    """
    permissions = get_user_permissions_internal(user)

    # If user has "all_dashboards" permission, allow access
    if permissions.get("dashboards", {}).get("all_dashboards"):
        return True

    # Check specific dashboard permission
    return permissions.get("dashboards", {}).get(dashboard_name, False)
```

---

### **Phase 2: Frontend Implementation** (Mobile App)

#### **Step 2.1: Create Permission Store/Context**

**Location**: `src/store/permissions.ts` or `src/context/PermissionsContext.tsx`

**Purpose**: Store user permissions in app state

**Data Structure**:

```typescript
interface UserPermissions {
  dashboards: {
    sales: boolean;
    receivables: boolean;
    inventory: boolean;
    payables: boolean;
    all_dashboards: boolean;
  };
  approval_territories: string[];
  can_approve_all_territories: boolean;
  roles: string[];
}
```

#### **Step 2.2: Fetch Permissions on Login**

**Flow**:

1. User logs in successfully
2. After token is stored, fetch user permissions
3. Store permissions in permission store/context
4. Use permissions throughout app

**Integration Point**: After `login()` in `src/store/auth.ts`

#### **Step 2.3: Hide/Show Dashboard Tabs**

**Location**: `app/(tabs)/_layout.tsx`

**Logic**:

```typescript
// Pseudo-code (don't implement yet)
const { permissions } = usePermissions();

// Hide tabs user doesn't have access to
const visibleTabs = tabs.filter((tab) => {
  if (permissions.dashboards.all_dashboards) return true;
  return permissions.dashboards[tab.name];
});
```

#### **Step 2.4: Hide Dashboard Cards/Sections**

**Location**: `app/(tabs)/index.tsx` (Main Dashboard)

**Logic**:

- Check permissions before rendering each dashboard card
- Hide "Sales Dashboard" card if user doesn't have `sales` permission
- Hide "Receivables Dashboard" card if user doesn't have `receivables` permission

#### **Step 2.5: Enforce Territory Filtering in Approvals**

**Location**: `src/hooks/useOptimizedApis.ts` - `useApprovalsData` hook

**Current Behavior**: Already fetches territory from user profile

**Enhancement**:

- Get territories from permission store (not just profile)
- Pass allowed territories to API
- Backend will filter automatically

---

## Permission Management UI (ERPNext Backend)

### **Recommended Setup in ERPNext**

#### **1. Dashboard Permissions Management**

**Option A: Using ERPNext Roles**

- Create roles: "Sales Dashboard User", "Receivables Dashboard User", "All Dashboards User"
- Assign roles to users via User → Roles tab

**Option B: Custom DocType Form**

- Create custom DocType: "Mobile Dashboard Permission"
- Create form to assign dashboard permissions to users
- Admin can manage via ERPNext list view

#### **2. Territory Approval Permissions Management**

**Option A: Using ERPNext User Permissions**

- Go to User → User Permissions
- Add Territory restrictions for specific users
- ERPNext will automatically enforce in queries

**Option B: Custom DocType Form**

- Create "Territory Approval Permission" DocType
- Create form with:
  - User (Link field)
  - Territories (Multi-select or child table)
  - "Approve All" checkbox
- Admin can manage via ERPNext list view

---

## Data Flow Diagram

```
┌─────────────────┐
│   User Login    │
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│  Fetch User Permissions │
│  (Backend API)          │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  Store in Permission    │
│  Context/Store          │
└────────┬────────────────┘
         │
         ├─────────────────────┐
         │                     │
         ▼                     ▼
┌──────────────────┐  ┌──────────────────────┐
│  Hide/Show Tabs  │  │  Filter Dashboard    │
│  Based on Perms  │  │  Cards/Sections      │
└──────────────────┘  └──────────────────────┘
         │
         ▼
┌─────────────────────────┐
│  API Calls with         │
│  Territory Filters      │
│  (Auto-applied)         │
└─────────────────────────┘
```

---

## Recommended Implementation Order

### **Priority 1: Backend Foundation**

1. ✅ Create `get_user_permissions` API endpoint
2. ✅ Update Approvals API to enforce territory filtering
3. ✅ Test APIs with Postman/manual testing
4. ✅ Create permission management UI in ERPNext

### **Priority 2: Frontend Integration**

1. ✅ Create permission store/context
2. ✅ Fetch permissions on login
3. ✅ Hide/show dashboard tabs
4. ✅ Hide/show dashboard cards
5. ✅ Apply territory filters to approvals

### **Priority 3: Testing & Refinement**

1. ✅ Test with different user roles
2. ✅ Verify territory filtering works
3. ✅ Test edge cases (no permissions, all permissions)
4. ✅ Performance testing

---

## Best Practices

### **1. Security Principles**

- ✅ **Never trust frontend**: Always verify permissions on backend
- ✅ **Least privilege**: Grant minimum required permissions
- ✅ **Principle of defense in depth**: Check permissions at multiple layers
- ✅ **Audit logging**: Log permission checks for security audits

### **2. Performance Considerations**

- ✅ **Cache permissions**: Store in app state, refresh on login
- ✅ **Minimize API calls**: Fetch permissions once per session
- ✅ **Lazy loading**: Only check permissions when needed
- ✅ **Optimize queries**: Use indexed fields for territory filters

### **3. User Experience**

- ✅ **Hide, don't disable**: Hide inaccessible features entirely
- ✅ **Clear messaging**: Show "Access Denied" if user tries to access restricted area
- ✅ **Consistent behavior**: Apply same rules across all screens
- ✅ **Fast feedback**: Check permissions quickly, don't delay app startup

---

## Example Scenarios

### **Scenario 1: Sales Manager (Dammam Territory)**

**Permissions**:

```json
{
  "dashboards": {
    "sales": true,
    "receivables": false,
    "inventory": false,
    "payables": false,
    "all_dashboards": false
  },
  "approval_territories": ["Dammam"],
  "can_approve_all_territories": false
}
```

**Experience**:

- ✅ Can see "Sales Dashboard" tab
- ❌ Cannot see "Receivables", "Inventory", "Payables" tabs
- ✅ Can approve only Dammam territory documents
- ❌ Cannot see/approve Riyadh territory documents

### **Scenario 2: Finance Manager (All Territories)**

**Permissions**:

```json
{
  "dashboards": {
    "sales": true,
    "receivables": true,
    "inventory": true,
    "payables": true,
    "all_dashboards": true
  },
  "approval_territories": [],
  "can_approve_all_territories": true
}
```

**Experience**:

- ✅ Can see all dashboard tabs
- ✅ Can see all dashboard cards
- ✅ Can approve documents from all territories
- ✅ Full access to all features

### **Scenario 3: Territory Manager (Riyadh Only)**

**Permissions**:

```json
{
  "dashboards": {
    "sales": true,
    "receivables": true,
    "inventory": false,
    "payables": false,
    "all_dashboards": false
  },
  "approval_territories": ["Riyadh"],
  "can_approve_all_territories": false
}
```

**Experience**:

- ✅ Can see "Sales" and "Receivables" tabs
- ❌ Cannot see "Inventory" and "Payables" tabs
- ✅ Can approve only Riyadh territory documents

---

## Alternative Approaches Considered

### **❌ Frontend-Only Permissions**

**Why Not**: Security risk - users can modify app code to bypass restrictions

### **❌ Hard-coded User Lists**

**Why Not**: Not scalable, hard to maintain, requires app updates for permission changes

### **❌ Separate Permission API for Each Check**

**Why Not**: Too many API calls, performance impact, complex to manage

### **✅ Backend-Driven with Cached Frontend State** (Chosen)

**Why**: Secure, scalable, performant, single source of truth

---

## Questions to Answer Before Implementation

1. **Where to store permissions in ERPNext?**

   - ✅ Use custom DocTypes (recommended for flexibility)
   - OR use ERPNext Roles + User Permissions (simpler but less flexible)

2. **How to handle permission changes?**

   - ✅ Permissions refresh on login (simplest)
   - OR add "Refresh Permissions" button in app
   - OR push notification when permissions change

3. **What happens if user loses permission while logged in?**

   - ✅ Keep current session, apply restrictions on next login
   - OR check permissions on each API call (more secure, slower)

4. **Should permissions be role-based or user-specific?**

   - ✅ **Both**: Use roles for common patterns, user-specific for exceptions
   - Example: Role "Sales Manager" gets Sales dashboard, but user-specific territory restrictions

5. **How to handle "All Territories" vs specific territories?**
   - ✅ Store as boolean flag `can_approve_all_territories`
   - OR store `["ALL"]` in territory list (simpler for filtering)

---

## Next Steps

1. **Review this guide** and decide on approach (custom DocTypes vs ERPNext built-in)
2. **Design database schema** for permission storage
3. **Create backend APIs** (`get_user_permissions`, update approvals API)
4. **Create permission management UI** in ERPNext
5. **Test backend APIs** with Postman
6. **Implement frontend** permission store and UI hiding logic
7. **Test with different user roles** and territories
8. **Deploy and monitor**

---

## Support & Resources

- **ERPNext Permissions Docs**: https://docs.erpnext.com/docs/user/en/using-erpnext/articles/user-permissions
- **Frappe Framework Docs**: https://frappeframework.com/docs
- **React Context API**: For permission state management
- **Zustand/Redux**: For permission store (if using state management)

---

**This guide provides the architecture and approach. Once you approve this approach, we can proceed with implementation step by step.**
