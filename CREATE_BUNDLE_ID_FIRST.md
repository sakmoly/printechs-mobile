# How to Create Bundle ID (App ID) First

## Problem

In App Store Connect, the **Bundle ID field is a dropdown** (not a text input). You cannot type or paste a Bundle ID. You must **create it first** in Apple Developer Portal as an **App ID**, then it will appear in the dropdown.

---

## Solution: Create App ID First

### Step 1: Go to Apple Developer Portal

1. Go to: **https://developer.apple.com/account**
2. Sign in with your Apple Developer account
3. Click **"Certificates, Identifiers & Profiles"** in the left sidebar

### Step 2: Navigate to Identifiers

1. In the left sidebar, under **"Identifiers"**, click **"Identifiers"**
2. You'll see a list of existing identifiers (if any)

### Step 3: Create New App ID

1. Click the **"+"** button (top left, blue plus icon)
2. Select **"App IDs"** → Click **"Continue"**
3. Select **"App"** → Click **"Continue"**

### Step 4: Configure App ID

Fill in the form:

**Description:**

- Enter: `Printechs ERP Application` (or any name for your reference)

**Bundle ID:**

- Select **"Explicit"** (radio button)
- In the text field, enter: **`com.printechs.erpnext`**
  - ⚠️ **Important**: Enter exactly `com.printechs.erpnext` (must match your `app.json`)

**Capabilities (Optional):**

- Check any capabilities you need:
  - ✅ **Push Notifications** (if your app uses notifications)
  - ✅ **Associated Domains** (if using)
  - Leave others unchecked if not needed

### Step 5: Register

1. Click **"Continue"** at the bottom
2. Review the summary
3. Click **"Register"**
4. You'll see a confirmation: "Your App ID has been registered"

---

## Step 6: Return to App Store Connect

1. Go back to **App Store Connect**: https://appstoreconnect.apple.com
2. Refresh the page (if the form is still open)
3. Click the **Bundle ID dropdown** again
4. You should now see **`com.printechs.erpnext`** in the list
5. Select it from the dropdown

---

## Important Notes

### ✅ Bundle ID Must Match Exactly

Your `app.json` has:

```json
"bundleIdentifier": "com.printechs.erpnext"
```

The App ID you create **must match exactly**:

- ✅ Correct: `com.printechs.erpnext`
- ❌ Wrong: `com.sakeer.printechs`
- ❌ Wrong: `com.printechs.erp-next`

### ✅ Current Status

From your screenshot, I see:

- Existing Bundle ID in dropdown: `com.sakeer.printechs`
- **You need to create**: `com.printechs.erpnext`

### ✅ Why Two Different Bundle IDs?

- `com.sakeer.printechs` - Existing/old Bundle ID
- `com.printechs.erpnext` - New Bundle ID for this app (from your `app.json`)

**Decision needed**:

- **Option A**: Create new App ID `com.printechs.erpnext` (recommended if you want separate Bundle ID)
- **Option B**: Update `app.json` to use `com.sakeer.printechs` (if you want to use existing Bundle ID)

---

## Quick Checklist

- [ ] Go to Apple Developer Portal
- [ ] Navigate to Certificates, Identifiers & Profiles → Identifiers
- [ ] Click "+" → App IDs → App
- [ ] Enter Description: `Printechs ERP Application`
- [ ] Select "Explicit" Bundle ID
- [ ] Enter Bundle ID: `com.printechs.erpnext`
- [ ] Select capabilities (Push Notifications, etc.)
- [ ] Click Continue → Register
- [ ] Go back to App Store Connect
- [ ] Refresh page
- [ ] Select `com.printechs.erpnext` from Bundle ID dropdown

---

## Alternative: Use Existing Bundle ID

If you want to use the existing Bundle ID `com.sakeer.printechs`:

1. **Update `app.json`**:

   ```json
   "bundleIdentifier": "com.sakeer.printechs"
   ```

2. **Select it from dropdown** in App Store Connect

⚠️ **Note**: Changing Bundle ID in `app.json` means you'll need to rebuild the app.

---

## Troubleshooting

### Problem: Bundle ID still not showing in dropdown

**Solutions**:

1. Wait 1-2 minutes (Apple's systems may take time to sync)
2. Refresh the App Store Connect page
3. Clear browser cache and try again
4. Make sure you're using the same Apple Developer account in both portals

### Problem: "Bundle ID already exists" error

**Solution**: The Bundle ID is already registered. Check your existing App IDs list - it might be there with a different description.

### Problem: "Invalid Bundle ID format"

**Solution**:

- Must be in format: `com.company.appname`
- Use lowercase only
- No spaces or special characters (except dots and hyphens)

---

## Next Steps After Creating App ID

1. ✅ App ID created in Apple Developer Portal
2. ✅ Bundle ID appears in App Store Connect dropdown
3. ✅ Select it and complete the app creation form
4. ✅ Fill in SKU (required field - e.g., `printechs-erp-ios-001`)
5. ✅ Click "Create"

Then proceed with your EAS build!
