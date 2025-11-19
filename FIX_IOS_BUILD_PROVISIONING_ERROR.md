# Fix iOS Build Error: Provisioning Profile Missing Capabilities

## Error Message

```
Provisioning profile doesn't support the Associated Domains and Push Notifications capability.
Provisioning profile doesn't include the aps-environment and com.apple.developer.associated-domains entitlements.
```

## Root Cause

Your app uses **Push Notifications** (`expo-notifications` plugin), but the App ID in Apple Developer Portal doesn't have the **Push Notifications** capability enabled.

---

## Solution: Enable Capabilities in App ID

### Step 1: Go to Apple Developer Portal

1. Go to: **https://developer.apple.com/account**
2. Sign in with your Apple Developer account
3. Click **"Certificates, Identifiers & Profiles"** (left sidebar)
4. Click **"Identifiers"** (under "Identifiers")

### Step 2: Find Your App ID

1. Search for or find: `com.printechs.erpnext`
2. Click on it to open/edit

### Step 3: Enable Push Notifications

1. Scroll down to **"Capabilities"** section
2. Check the box for **"Push Notifications"**
   - ⚠️ **Important**: This requires additional setup:
     - You'll need to create a Push Notification certificate (optional for now)
     - For EAS builds, this is usually handled automatically

### Step 4: Enable Associated Domains (If Needed)

1. If you plan to use Associated Domains later, check **"Associated Domains"**
2. **Note**: Your `app.json` currently has `associatedDomains: []`, so this is optional
3. If you don't use it, you can leave it unchecked

### Step 5: Save Changes

1. Click **"Save"** or **"Continue"** → **"Register"**
2. The App ID will be updated with the new capabilities

### Step 6: Rebuild

After enabling capabilities, rebuild:

```bash
eas build --platform ios --profile production
```

**Note**: EAS may need to regenerate the provisioning profile with the new capabilities. This happens automatically.

---

## Alternative Solution: Remove Associated Domains (Quick Fix)

If you're not using Associated Domains and want a quicker fix:

### Option 1: Remove from app.json (If not using)

Since your `app.json` has `associatedDomains: []` (empty), you can remove this field entirely to avoid the error.

However, **Push Notifications is required** if you use `expo-notifications`, so you still need to enable it in the App ID.

### Option 2: Remove Associated Domains Entitlement

The error mentions Associated Domains, but your app.json shows it's empty. This might be a default EAS behavior. You can try removing it from the build configuration, but **Push Notifications must still be enabled**.

---

## Recommended Approach

**Best Solution**: Enable Push Notifications in App ID (as described in Step 3 above)

**Why**: 
- Your app uses `expo-notifications` plugin
- Push Notifications capability is required for this to work
- Associated Domains can be left disabled if not needed

---

## Step-by-Step: Enable Push Notifications in App ID

1. **Go to Apple Developer Portal**:
   ```
   https://developer.apple.com/account → Certificates, Identifiers & Profiles → Identifiers
   ```

2. **Find your App ID**:
   - Search: `com.printechs.erpnext`
   - Click to edit

3. **Enable Push Notifications**:
   - Scroll to **Capabilities** section
   - ✅ Check **"Push Notifications"**
   - (Optional) Check **"Associated Domains"** if you'll use it

4. **Save and wait**:
   - Click **Save** or **Continue** → **Register**
   - Wait 1-2 minutes for changes to propagate

5. **Rebuild**:
   ```bash
   eas build --platform ios --profile production
   ```

---

## Verify App ID Capabilities

After enabling, verify your App ID has:
- ✅ **Push Notifications** - Enabled
- ⬜ **Associated Domains** - Optional (enable if needed)

---

## If Error Persists

If you still get the error after enabling capabilities:

1. **Wait 2-3 minutes** - Changes may take time to sync
2. **Clear EAS credentials** (if needed):
   ```bash
   eas credentials
   ```
   Then select iOS → Production → Remove credentials → Let EAS regenerate

3. **Rebuild**:
   ```bash
   eas build --platform ios --profile production
   ```

---

## Quick Checklist

- [ ] Go to Apple Developer Portal
- [ ] Navigate to Identifiers
- [ ] Find App ID: `com.printechs.erpnext`
- [ ] Enable "Push Notifications" capability
- [ ] Save changes
- [ ] Wait 1-2 minutes
- [ ] Rebuild: `eas build --platform ios --profile production`

---

## Summary

**The issue**: Your App ID doesn't have Push Notifications enabled, but your app requires it.

**The fix**: Enable Push Notifications capability in Apple Developer Portal → Identifiers → Your App ID.

**After fix**: Rebuild and the provisioning profile will include the required entitlements.
