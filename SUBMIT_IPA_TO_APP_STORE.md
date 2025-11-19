# How to Submit IPA File to App Store

## Method 1: Using EAS Submit (Recommended for Expo)

EAS Submit is the easiest way to submit your IPA to the App Store.

### Step 1: Install EAS CLI (if not already installed)

```bash
npm install -g eas-cli
```

### Step 2: Login to EAS

```bash
eas login
```

### Step 3: Submit the IPA File

```bash
eas submit --platform ios --latest
```

**Or if you have a specific IPA file:**

```bash
eas submit --platform ios --path path/to/your/app.ipa
```

**Example:**
```bash
eas submit --platform ios --path ./builds/app.ipa
```

### Step 4: Follow Prompts

- EAS will ask for your Apple ID credentials if not already configured
- It will upload the IPA to App Store Connect
- The app will appear in App Store Connect → TestFlight → Builds (for review)

---

## Method 2: Using Apple Transporter (Official Apple Tool)

Transporter is Apple's official app for uploading IPA files.

### Step 1: Download Transporter

1. Go to: **https://apps.apple.com/us/app/transporter/id1450874784**
2. Download from Mac App Store (macOS only)
3. Install Transporter

### Step 2: Open Transporter

1. Launch **Transporter** app
2. Sign in with your Apple ID (`sakeer@printechs.com`)

### Step 3: Upload IPA

1. Click **"+"** or **"Add"** button
2. Select your `.ipa` file
3. Click **"Deliver"**
4. Wait for upload to complete

**Note**: You'll need a Mac to use Transporter.

---

## Method 3: Using Command Line (xcrun altool)

If you have a Mac, you can use command line tools:

### Step 1: Find your IPA file

```bash
# Navigate to your IPA file location
cd /path/to/your/ipa
```

### Step 2: Upload using xcrun altool

```bash
xcrun altool --upload-app \
  --type ios \
  --file "YourApp.ipa" \
  --username "sakeer@printechs.com" \
  --password "@keychain:Application Loader: saker@printechs.com"
```

**Or use app-specific password:**

```bash
xcrun altool --upload-app \
  --type ios \
  --file "YourApp.ipa" \
  --username "sakeer@printechs.com" \
  --password "your-app-specific-password"
```

**To generate app-specific password:**
1. Go to: https://appleid.apple.com
2. Sign in → Security → App-Specific Passwords
3. Generate a new password

---

## Method 4: Using EAS Submit with Specific Build

If your IPA was built by EAS:

### Step 1: List your builds

```bash
eas build:list --platform ios
```

### Step 2: Submit the latest build

```bash
eas submit --platform ios --latest
```

### Step 3: Or submit a specific build ID

```bash
eas submit --platform ios --id BUILD_ID
```

---

## After Upload: Complete App Store Connect Setup

After the IPA is uploaded, you need to complete the submission in App Store Connect:

### Step 1: Go to App Store Connect

1. Visit: **https://appstoreconnect.apple.com**
2. Sign in
3. Click **"My Apps"**
4. Select your app: **Printechs ERP Application**

### Step 2: Wait for Processing

1. Go to **"TestFlight"** tab
2. Wait for the build to appear (can take 10-30 minutes)
3. The build will show "Processing" → "Ready to Submit"

### Step 3: Submit for Review

1. Go to **"App Store"** tab (left sidebar)
2. Select **"1.0 Prepare for Submission"** or **"+ Version"**
3. Fill in required information:
   - **Version**: `1.0.0` (or your version)
   - **Build**: Select your uploaded build
   - **Screenshots**: Upload screenshots (see `APP_STORE_SCREENSHOTS_GUIDE.md`)
   - **Description**: App description
   - **Keywords**: App keywords
   - **Support URL**: Your support website
   - **Marketing URL**: (Optional)
   - **Privacy Policy URL**: Required
   - **Category**: Select appropriate categories
   - **Age Rating**: Complete the questionnaire

### Step 4: Submit for Review

1. Scroll to bottom
2. Click **"Add for Review"** or **"Submit for Review"**
3. Answer any export compliance questions
4. Click **"Submit"**

---

## Quick Steps Summary

### Using EAS Submit (Easiest):

```bash
# 1. Login to EAS
eas login

# 2. Submit IPA
eas submit --platform ios --path path/to/app.ipa

# Or submit latest EAS build
eas submit --platform ios --latest
```

### Using Transporter (Mac only):

1. Download Transporter from Mac App Store
2. Open Transporter
3. Sign in with Apple ID
4. Add IPA file
5. Click "Deliver"

---

## Configuration in eas.json

Your `eas.json` already has the submit configuration:

```json
{
  "submit": {
    "production": {
      "ios": {
        "appleId": "sakeer@printechs.com",
        "ascAppId": "6754874820",
        "appleTeamId": "F5QDGEAY77"
      }
    }
  }
}
```

This means EAS Submit will use these credentials automatically.

---

## Troubleshooting

### "IPA file not found"
- **Fix**: Check the file path is correct
- Use absolute path: `C:\path\to\app.ipa` (Windows) or `/path/to/app.ipa` (Mac)

### "Authentication failed"
- **Fix**: Make sure your Apple ID credentials are correct
- If using 2FA, you may need an app-specific password
- Generate at: https://appleid.apple.com → Security → App-Specific Passwords

### "Build already exists"
- **Fix**: You need to increment the build number in `app.json`
- Current build number: `3`
- Change to `4` and rebuild

### "IPA not compatible with App Store"
- **Fix**: Make sure the IPA was built with the correct provisioning profile
- Use `eas build --platform ios --profile production` to create a production build

---

## After Submission

1. **Build Processing**: Wait 10-30 minutes for Apple to process
2. **TestFlight**: Build will appear in TestFlight (if configured)
3. **App Review**: Review typically takes 24-48 hours
4. **Status Updates**: Check App Store Connect for review status
5. **Approval**: Once approved, your app will be live on the App Store!

---

## Next Steps After Upload

1. ✅ Upload screenshots (if not already done)
2. ✅ Complete app metadata (description, keywords, etc.)
3. ✅ Set up pricing and availability
4. ✅ Submit for review
5. ✅ Monitor review status in App Store Connect

---

## Recommended: Use EAS Submit

Since you're using Expo and EAS, **EAS Submit is the recommended method**:

```bash
eas submit --platform ios --latest
```

This will:
- Automatically use your configured credentials from `eas.json`
- Handle authentication
- Upload to App Store Connect
- Show upload progress
- Confirm when complete
