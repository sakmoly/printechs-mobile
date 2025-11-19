# App Store Submission Checklist

Quick checklist for submitting **Printechs ERP Application** to Apple App Store.

## Pre-Submission Checklist

### Account & Setup
- [ ] Apple Developer Account renewed ($99/year)
  - Check: https://developer.apple.com/account → Membership
- [ ] App Store Connect account active
  - Check: https://appstoreconnect.apple.com
- [ ] EAS CLI installed: `npm install -g eas-cli`
- [ ] Logged into Expo: `eas login`

### App Information to Collect
- [ ] Apple Developer Team ID (10 characters like `ABCD1234EF`)
  - Location: https://developer.apple.com/account → Membership
- [ ] App Store Connect App ID (if app already created)
  - Location: App Store Connect → Your App → App Information
- [ ] Apple ID email address

### Files to Prepare
- [ ] Screenshots ready (at least 3 for iPhone 6.7" - 1290 x 2796 pixels)
- [ ] App description written (4000 characters max)
- [ ] Keywords prepared (100 characters max)
- [ ] Privacy policy URL ready
- [ ] Support URL ready

### Code Updates
- [ ] Build number incremented in `app.json` (currently "2" → change to "3")
- [ ] `eas.json` updated with your credentials:
  - `appleId`: Your Apple ID email
  - `ascAppId`: Your App Store Connect App ID
  - `appleTeamId`: Your Apple Developer Team ID

---

## Submission Steps

### Step 1: Update Configuration
- [ ] Update `app.json` → `buildNumber: "3"`
- [ ] Update `eas.json` with your Apple credentials

### Step 2: Create App in App Store Connect (First Time Only)
- [ ] Go to https://appstoreconnect.apple.com
- [ ] Click "+" → "New App"
- [ ] Fill in app details
- [ ] Save your App ID

### Step 3: Build App
- [ ] Run: `eas build --platform ios --profile production`
- [ ] Wait for build to complete (15-30 minutes)
- [ ] Verify build succeeded

### Step 4: Submit Build
- [ ] Run: `eas submit --platform ios --profile production`
- [ ] Follow prompts to authenticate

### Step 5: Complete App Store Connect Form
- [ ] Go to App Store Connect → Your App
- [ ] Fill in App Information
- [ ] Upload screenshots
- [ ] Add app description
- [ ] Add keywords
- [ ] Add privacy policy URL
- [ ] Add support URL
- [ ] Select build
- [ ] Fill in review information
- [ ] Submit for review

### Step 6: Monitor
- [ ] Check review status in App Store Connect
- [ ] Respond to any reviewer questions
- [ ] Release when approved

---

## Screenshot Requirements

**Required:**
- [ ] iPhone 6.7" Display (iPhone 15 Pro Max, 14 Pro Max)
  - Size: 1290 x 2796 pixels
  - Minimum: 3 screenshots
  - Maximum: 10 screenshots

**Optional (but recommended):**
- [ ] iPad Pro 12.9" Display
  - Size: 2048 x 2732 pixels

**Best Screenshots to Include:**
1. Login/Dashboard screen
2. Inventory by Category screen
3. Sales/Orders screen
4. Reports/Analytics screen
5. Any unique features

---

## Current Configuration Status

- **Bundle ID**: `com.printechs.erpnext` ✅
- **App Name**: `Printechs ERP Application` ✅
- **Version**: `1.0.1` ✅
- **Build Number**: `2` → **Needs update to `3`** ⚠️
- **EAS Submit Config**: Placeholder values → **Needs your credentials** ⚠️

---

## Quick Commands

```bash
# Update build number first
# (Edit app.json manually)

# Then build
eas build --platform ios --profile production

# Then submit
eas submit --platform ios --profile production

# Check status
eas build:list
eas submit:list
```

---

## Important Notes

1. **Build Number**: Must be unique and incrementing. Each App Store submission needs a new number.
2. **Screenshots**: Required! App Store will not accept without them.
3. **Review Time**: Typically 24-48 hours, can take up to 7 days.
4. **Test Account**: If your app requires login, provide demo credentials in App Store Connect.

---

**Ready to start? Begin with Step 1: Update Configuration!**
