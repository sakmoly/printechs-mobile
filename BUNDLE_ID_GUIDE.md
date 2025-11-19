# Bundle ID Guide for iOS App

## Your Current Bundle ID

**Bundle ID**: `com.printechs.erpnext`

This is already configured in your `app.json` file.

---

## Where to Find/Verify Bundle ID

### 1. In Your App Configuration

- **File**: `app.json`
- **Location**: `expo.ios.bundleIdentifier`
- **Current Value**: `com.printechs.erpnext` ✅

### 2. In App Store Connect

1. Go to https://appstoreconnect.apple.com
2. Sign in with your Apple Developer account
3. Click **"My Apps"** or **"+"** to create a new app
4. If creating new app:
   - Enter Bundle ID during app creation
   - It should match: `com.printechs.erpnext`
5. If app already exists:
   - Click on your app
   - Go to **App Information** → **General Information**
   - Find **Bundle ID** section

### 3. In Apple Developer Portal (Create App ID)

1. Go to https://developer.apple.com/account
2. Sign in with your Apple Developer account
3. Click **"Certificates, Identifiers & Profiles"** (left sidebar)
4. Click **"Identifiers"** (under "Identifiers")
5. Click **"+"** button (top left) to create a new identifier
6. Select **"App IDs"** → Click **Continue**
7. Select **"App"** → Click **Continue**
8. Fill in:
   - **Description**: `Printechs ERP Application` (for your reference)
   - **Bundle ID**:
     - Select **"Explicit"**
     - Enter: `com.printechs.erpnext`
9. Select **Capabilities** (if needed):
   - Push Notifications (if using)
   - Associated Domains (if using)
10. Click **Continue** → **Register**

---

## Important Notes

### ✅ Bundle ID Format Rules

- Must be in reverse domain notation: `com.company.appname`
- Must be unique across all apps in App Store
- Cannot be changed after first app submission
- Use lowercase letters, numbers, hyphens, and periods
- No spaces or special characters

### ✅ Your Bundle ID Structure

```
com.printechs.erpnext
│   │        │
│   │        └── App name
│   └─────────── Company/Organization
└─────────────── Standard domain (com/org/net)
```

### ✅ Verify Before Building

Before running `eas build`, make sure:

1. ✅ Bundle ID exists in Apple Developer Portal (App ID)
2. ✅ Bundle ID matches exactly in `app.json`
3. ✅ Bundle ID matches in App Store Connect (if app already exists)

---

## Quick Checklist

- [ ] Bundle ID in `app.json`: `com.printechs.erpnext` ✅
- [ ] App ID created in Apple Developer Portal
- [ ] App created in App Store Connect (optional - can create after build)
- [ ] Bundle ID matches across all platforms

---

## If Bundle ID Doesn't Exist Yet

**Step 1**: Create App ID in Apple Developer Portal (see steps above)

**Step 2**: After creating App ID, your Bundle ID is ready to use

**Step 3**: Proceed with EAS build - it will use the Bundle ID from `app.json`

---

## Need Help?

- **Apple Developer Support**: https://developer.apple.com/support
- **App Store Connect Help**: https://help.apple.com/app-store-connect/
