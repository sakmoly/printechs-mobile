# Apple App Store Submission Guide (Without Xcode)

This guide will help you submit your **Printechs ERP Application** to the Apple App Store using EAS Build and EAS Submit, **without needing Xcode**.

## Prerequisites

### 1. Apple Developer Account
- **Cost**: $99 USD per year
- **Website**: https://developer.apple.com/programs/
- **Renewal**: Go to https://developer.apple.com/account → Membership → Renew

**To Renew/Check Status:**
1. Go to https://developer.apple.com/account
2. Log in with your Apple ID
3. Click on "Membership" in the sidebar
4. Check expiration date
5. If expired, click "Renew Membership" and complete payment

### 2. App Store Connect Access
- Go to https://appstoreconnect.apple.com
- Log in with your Apple Developer account
- Ensure you have **Admin** or **App Manager** role

### 3. EAS CLI Installed
```bash
npm install -g eas-cli
```

### 4. Login to Expo Account
```bash
eas login
```

---

## Step-by-Step Submission Process

### **STEP 1: Update Build Number** (IMPORTANT!)

Before building, increment the build number in `app.json`:

```json
"ios": {
  "buildNumber": "3",  // Increment from current "2" to "3"
  ...
}
```

**Update this now** - each App Store submission requires a unique, incrementing build number.

---

### **STEP 2: Prepare App Store Connect**

1. **Go to App Store Connect**: https://appstoreconnect.apple.com

2. **Create New App** (if first time):
   - Click "+" → "New App"
   - Platform: iOS
   - Name: **Printechs ERP Application**
   - Primary Language: English (or your preference)
   - Bundle ID: **com.printechs.erpnext**
   - SKU: `printechs-erp-ios-001` (unique identifier)
   - User Access: Full Access
   - Click "Create"

3. **Note Your App ID**:
   - After creating the app, you'll see an **App ID** (e.g., `1234567890`)
   - **Save this number** - you'll need it later

4. **Get Your Apple Team ID**:
   - Go to https://developer.apple.com/account
   - Click "Membership" in sidebar
   - Find your **Team ID** (10-character code like `ABCD1234EF`)
   - **Save this** - you'll need it

---

### **STEP 3: Update EAS Configuration**

Update your `eas.json` file with your Apple credentials:

```json
{
  "submit": {
    "production": {
      "ios": {
        "appleId": "your-apple-id@example.com",  // Your Apple ID email
        "ascAppId": "1234567890",  // Your App Store Connect App ID
        "appleTeamId": "ABCD1234EF"  // Your Apple Team ID
      }
    }
  }
}
```

**Replace:**
- `your-apple-id@example.com` → Your Apple ID email
- `1234567890` → Your App Store Connect App ID
- `ABCD1234EF` → Your Apple Team ID

---

### **STEP 4: Configure App Store Metadata** (In App Store Connect)

Before submitting, prepare these in App Store Connect:

1. **App Information**:
   - Name: **Printechs ERP Application**
   - Subtitle: (Optional) "Enterprise Resource Planning"
   - Category: Business
   - Privacy Policy URL: (Required - add your privacy policy URL)

2. **Pricing and Availability**:
   - Price: Free
   - Availability: Select countries

3. **App Privacy**:
   - Answer privacy questions about data collection
   - Required by Apple

4. **Screenshots** (You mentioned you'll create these):
   - Required sizes:
     - **iPhone 6.7" Display**: 1290 x 2796 pixels (at least 3 screenshots)
     - **iPhone 6.5" Display**: 1242 x 2688 pixels (optional)
     - **iPad Pro 12.9"**: 2048 x 2732 pixels (optional, since supportsTablet: true)
   - **How to create screenshots**:
     - Run the app on a simulator or device
     - Take screenshots using Cmd+S (simulator) or device
     - Or use screenshot tools
     - Use screenshots showing your best features

5. **App Preview Videos** (Optional but recommended):
   - Create a 30-second video showing app functionality
   - Upload in same sizes as screenshots

---

### **STEP 5: Build the iOS App for App Store**

Run this command to create a production build:

```bash
eas build --platform ios --profile production
```

**This will:**
- Build your app on Expo's cloud servers
- Take 15-30 minutes
- Create an `.ipa` file ready for App Store submission
- Automatically handle code signing

**Options you'll be asked:**
- "Would you like to automatically manage credentials?" → **Yes**
- "Would you like to use an existing certificate?" → **No** (if first time)

---

### **STEP 6: Submit to App Store**

Once the build completes, submit it:

```bash
eas submit --platform ios --profile production
```

**This will:**
- Upload the build to App Store Connect
- Link it to your app
- Handle all the technical submission process

**You'll be asked to:**
- Log in to App Store Connect (if not already)
- Select your app
- Confirm submission

---

### **STEP 7: Complete App Store Connect Submission**

After `eas submit` completes:

1. **Go to App Store Connect**: https://appstoreconnect.apple.com
2. **Select your app**: "Printechs ERP Application"
3. **Go to "App Store" tab**
4. **Select version**: Click "+ Version or Platform" if first time
5. **Fill in required fields**:

   **Version Information:**
   - Version Number: `1.0.1` (from your app.json)
   - Copyright: `© 2025 Printechs` (or your company)
   - What's New in This Version: Describe your app's features

   **App Icon:**
   - Upload 1024x1024 icon (already in your assets/icon.png)

   **Screenshots:**
   - Upload the screenshots you prepared
   - Drag and drop them in order (best features first)

   **Description:**
   ```
   Printechs ERP Application is a comprehensive mobile solution for 
   enterprise resource planning. Manage your business operations on 
   the go with features including:
   
   • Sales Management
   • Inventory Tracking
   • Receivables Management
   • Approval Workflows
   • Real-time Dashboard Analytics
   
   Perfect for business professionals who need to stay connected 
   with their ERP system anywhere, anytime.
   ```

   **Keywords:**
   - Enter relevant keywords (e.g., "ERP, business, inventory, sales, management")
   - Maximum 100 characters, comma-separated

   **Support URL:**
   - Your website or support page URL

   **Marketing URL** (Optional):
   - Your website URL

   **Promotional Text** (Optional):
   - Up to 170 characters highlighting new features

6. **Build Selection:**
   - You should see your build from Step 6
   - Select it
   - If you don't see it, wait a few minutes and refresh

7. **App Review Information:**
   - First Name, Last Name
   - Phone Number
   - Email
   - Demo Account (if app requires login):
     - Username: `demo@printechs.com`
     - Password: `demo123`
     - Notes: Any special instructions for reviewers

8. **Version Release:**
   - Choose "Manually release this version" (recommended)
   - Or "Automatically release this version"

9. **Submit for Review:**
   - Click "Submit for Review" button
   - Answer any export compliance questions
   - Confirm submission

---

### **STEP 8: Monitor Review Status**

After submission:

1. **Check Status in App Store Connect**:
   - Status will show: "Waiting for Review" → "In Review" → "Ready for Sale" (or rejected)

2. **Review Timeline**:
   - Usually 24-48 hours for first review
   - Can take up to 7 days

3. **If Rejected**:
   - You'll receive an email with rejection reasons
   - Fix the issues
   - Update build number in app.json
   - Rebuild and resubmit

4. **If Approved**:
   - If you chose "Manual Release", click "Release This Version"
   - App will be live on App Store within a few hours

---

## Troubleshooting

### **Issue: "No Apple Team ID found"**
**Solution**: 
- Go to https://developer.apple.com/account → Membership
- Copy your Team ID
- Update `eas.json` with correct `appleTeamId`

### **Issue: "App ID not found"**
**Solution**:
- Go to App Store Connect → Your App
- Copy the App ID (not Bundle ID)
- Update `eas.json` with correct `ascAppId`

### **Issue: "Build failed"**
**Solution**:
- Check error message in EAS build logs
- Common issues:
  - Invalid credentials
  - Missing permissions in infoPlist
  - Build number conflict (already used)

### **Issue: "Missing screenshots"**
**Solution**:
- Screenshots are mandatory
- Create at least 3 screenshots (iPhone 6.7")
- Use actual app screenshots, not mockups

---

## Required Screenshots Checklist

Before submission, ensure you have:

- [ ] **iPhone 6.7" screenshots** (1290 x 2796) - **At least 3 required**
- [ ] **iPad Pro 12.9" screenshots** (2048 x 2732) - **Optional** (if tablet support)
- [ ] **App Icon** (1024 x 1024) - Already in your assets
- [ ] **App Preview Video** - Optional but recommended

**Screenshot Ideas:**
1. Dashboard/Home screen showing inventory
2. Sales/Order management screen
3. Inventory detail screen
4. Reports/Analytics screen
5. Approval workflow screen

---

## Quick Command Reference

```bash
# 1. Login to Expo
eas login

# 2. Update build number in app.json (increment buildNumber)

# 3. Build for App Store
eas build --platform ios --profile production

# 4. Submit to App Store
eas submit --platform ios --profile production

# 5. Check build status
eas build:list

# 6. View submission status
eas submit:list
```

---

## Cost Breakdown

- **Apple Developer Account**: $99/year (one-time annual fee)
- **EAS Build**: Free tier available (limited builds per month)
  - Free: 30 builds/month
  - Production builds: May require paid plan ($29/month) for more builds

---

## Next Steps After Approval

1. **Monitor Downloads**: Check analytics in App Store Connect
2. **Respond to Reviews**: Engage with user feedback
3. **Plan Updates**: Prepare version 1.0.2 with improvements
4. **Marketing**: Share your app on social media, website

---

## Support Resources

- **EAS Documentation**: https://docs.expo.dev/submit/introduction/
- **App Store Connect Help**: https://help.apple.com/app-store-connect/
- **Apple Developer Support**: https://developer.apple.com/support/

---

**Good luck with your submission! 🚀**
