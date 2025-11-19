# What is ascAppId? (App Store Connect App ID)

## What is ascAppId?

**ascAppId** = **App Store Connect App ID**

- It's a **unique numeric identifier** for your app in App Store Connect
- Example: `1234567890` (just numbers, usually 8-10 digits)
- **Different from Bundle ID**: Bundle ID is like `com.printechs.erpnext`, but ascAppId is just numbers

---

## When Do You Need It?

You need `ascAppId` when running:
```bash
eas submit --platform ios --profile production
```

This tells EAS which app in App Store Connect to upload your build to.

---

## Where to Find ascAppId

### Method 1: After Creating App in App Store Connect (Recommended)

**Step 1**: Go to App Store Connect
- URL: https://appstoreconnect.apple.com
- Sign in with your Apple Developer account

**Step 2**: Create or Open Your App
- Click **"My Apps"** or **"+"** to create a new app
- If creating new: Fill in the form and click **"Create"**
- After creation, you'll see your app in the list

**Step 3**: Find the App ID
- Click on your app name to open it
- Go to **"App Information"** tab (left sidebar)
- Scroll down to **"General Information"** section
- Look for **"App Store Connect App ID"** or **"Apple ID"**
- This is your `ascAppId` (numeric value like `1234567890`)

### Method 2: From App URL

After creating the app, the URL will look like:
```
https://appstoreconnect.apple.com/apps/1234567890/appstore
                                       ^^^^^^^^^^
                                       This is your ascAppId
```

### Method 3: From App List View

1. Go to **"My Apps"** in App Store Connect
2. You'll see a list of apps
3. The App ID is shown in the URL or sometimes displayed in the app card

---

## Important: You Need to Create the App First!

**⚠️ You can only get `ascAppId` AFTER creating the app in App Store Connect.**

If you haven't created the app yet:
1. **Create the app first** in App Store Connect (using the Bundle ID you created)
2. **Then get the App ID** from the app's information page
3. **Then update** `eas.json` with the App ID

---

## Current Status in Your eas.json

Looking at your `eas.json`, you currently have:
```json
"ascAppId": "your-asc-app-id"
```

This is a placeholder. You need to:
1. ✅ Create the app in App Store Connect (if not done)
2. ✅ Get the numeric App ID from App Store Connect
3. ✅ Replace `"your-asc-app-id"` with the actual number

---

## Example

**Before** (placeholder):
```json
"ascAppId": "your-asc-app-id"
```

**After** (actual App ID):
```json
"ascAppId": "1234567890"
```

---

## Visual Guide: Where to Find in App Store Connect

```
App Store Connect
└── My Apps
    └── Printechs ERP Application (click here)
        └── App Information (left sidebar)
            └── General Information
                └── App Store Connect App ID: 1234567890 ← This is your ascAppId
```

---

## When to Update eas.json

**Option 1: Now (Before Build)**
- If you've already created the app in App Store Connect
- Get the App ID and update `eas.json` now

**Option 2: Later (After Build)**
- You can build without `ascAppId`
- But you'll need it when you run `eas submit`
- Update `eas.json` before running the submit command

---

## Quick Checklist

- [ ] App created in App Store Connect
- [ ] Navigated to App Information page
- [ ] Found "App Store Connect App ID" (numeric value)
- [ ] Updated `eas.json` with the numeric App ID
- [ ] Removed quotes if it's just numbers (it should be a string in JSON)

---

## Example: Complete eas.json After Update

```json
{
  "submit": {
    "production": {
      "ios": {
        "appleId": "sakeer@printechs.com",
        "ascAppId": "1234567890",  // ← Replace with your actual App ID
        "appleTeamId": "ABCD1234EF"  // ← Replace with your Team ID
      }
    }
  }
}
```

---

## Need Help?

If you can't find the App ID:
1. Make sure you've created the app in App Store Connect
2. Check that you're looking in the correct section (App Information → General Information)
3. The App ID is always numeric (no letters)
4. If still stuck, check the browser URL when viewing your app
