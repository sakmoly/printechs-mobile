# Permissions Implementation - Quick Reference

## 🎯 Goal

Implement user-level permissions for:
1. **Dashboard Access**: Control which dashboards users can see (Sales, Receivables, Inventory, Payables, or All)
2. **Territory Approvals**: Control which territories users can approve (Dammam, Riyadh, or All)

---

## 🏗️ Architecture: Backend-Driven Permissions

**Key Principle**: ✅ Backend enforces permissions, frontend only displays/hides UI

### Why Backend-Driven?
- 🔒 **Security**: Can't be bypassed by modifying app code
- 📍 **Single Source of Truth**: Manage in ERPNext, works for web + mobile
- 🚀 **Easy Updates**: Change permissions without app update
- 📊 **Audit Trail**: Log all permission checks

---

## 📋 Implementation Phases

### **Phase 1: Backend (ERPNext)**

1. **Create Custom DocTypes** (Recommended):
   - `Mobile Dashboard Permission` - Stores dashboard access per user
   - `Territory Approval Permission` - Stores territory approval rights per user

2. **Create API Endpoint**:
   - `/api/method/printechs_utility.permissions.get_user_permissions`
   - Returns user's permissions (dashboards + territories)

3. **Update Approvals API**:
   - Automatically filter by user's territory permissions
   - User can only see/approve documents from allowed territories

### **Phase 2: Frontend (Mobile App)**

1. **Create Permission Store** (`src/store/permissions.ts`)
   - Store user permissions in app state

2. **Fetch on Login**:
   - After successful login, fetch permissions
   - Store in permission store

3. **Hide/Show UI Elements**:
   - Hide dashboard tabs user can't access
   - Hide dashboard cards user can't access
   - Filter approvals by territory

---

## 📊 Data Structure

```typescript
interface UserPermissions {
  dashboards: {
    sales: boolean;
    receivables: boolean;
    inventory: boolean;
    payables: boolean;
    all_dashboards: boolean;  // If true, access to all
  };
  approval_territories: string[];  // ["Dammam", "Riyadh"]
  can_approve_all_territories: boolean;  // If true, can approve all
  roles: string[];
}
```

---

## 🔄 Data Flow

```
User Login
    ↓
Fetch Permissions (Backend API)
    ↓
Store in Permission Store
    ↓
Hide/Show Dashboard Tabs
    ↓
Hide/Show Dashboard Cards
    ↓
Filter Approvals by Territory (Backend)
```

---

## 💡 Example Scenarios

### Scenario 1: Sales Manager (Dammam Only)
- ✅ Sales Dashboard
- ❌ Other Dashboards
- ✅ Approve Dammam only
- ❌ Cannot see Riyadh documents

### Scenario 2: Finance Manager (All Access)
- ✅ All Dashboards
- ✅ Approve All Territories

### Scenario 3: Territory Manager (Riyadh, Sales + Receivables)
- ✅ Sales & Receivables Dashboards
- ❌ Inventory & Payables
- ✅ Approve Riyadh only

---

## ⚡ Quick Start Checklist

### Backend:
- [ ] Create custom DocTypes for permissions
- [ ] Create `get_user_permissions` API
- [ ] Update Approvals API with territory filtering
- [ ] Test APIs with Postman

### Frontend:
- [ ] Create permission store/context
- [ ] Fetch permissions on login
- [ ] Hide dashboard tabs
- [ ] Hide dashboard cards
- [ ] Test with different user roles

---

## 🎨 Where Permissions Are Applied

| Location | What to Do |
|----------|-----------|
| `app/(tabs)/_layout.tsx` | Hide dashboard tabs |
| `app/(tabs)/index.tsx` | Hide dashboard cards |
| `src/hooks/useOptimizedApis.ts` | Pass territory filter to API |
| Backend API | Enforce territory filtering in queries |

---

## 📝 Key Decisions Needed

1. **Storage Method**: Custom DocTypes OR ERPNext Roles?
   - ✅ **Recommendation**: Custom DocTypes (more flexible)

2. **Permission Refresh**: On login OR on each API call?
   - ✅ **Recommendation**: On login (better performance)

3. **All Territories**: Boolean flag OR special value?
   - ✅ **Recommendation**: `can_approve_all_territories: true` flag

---

## 🔐 Security Notes

- ⚠️ **Never trust frontend-only checks** - Backend must enforce
- ⚠️ **Backend filters data** - User only receives allowed data
- ⚠️ **Frontend hides UI** - Better UX, but not security
- ✅ **Defense in depth** - Check at multiple layers

---

## 📚 Full Details

See `USER_PERMISSIONS_IMPLEMENTATION_GUIDE.md` for complete documentation.

---

**Next Step**: Review the full guide and approve the approach before implementation.
