# App Store Screenshots Guide

## Required Screenshots for Apple App Store

### Devices and Sizes Required:

#### iPhone Screenshots:

1. **iPhone 6.7" Display** (e.g., iPhone 14 Pro Max)

   - Size: 1290 x 2796 pixels
   - Number needed: 1-10 screenshots

2. **iPhone 6.5" Display** (e.g., iPhone 11 Pro Max)

   - Size: 1284 x 2778 pixels
   - Number needed: 1-10 screenshots

3. **iPhone 5.5" Display** (e.g., iPhone 8 Plus)
   - Size: 1242 x 2208 pixels
   - Number needed: 1-10 screenshots

#### iPad Screenshots:

4. **iPad Pro 12.9" Display**
   - Size: 2048 x 2732 pixels
   - Number needed: 1-10 screenshots

---

## How to Create Screenshots

### Option 1: Using iOS Simulator (Recommended)

1. **Open iOS Simulator:**

   ```bash
   # Start Expo on iOS simulator
   npx expo start
   # Press 'i' to open iOS simulator
   ```

2. **Take Screenshots:**

   - Navigate to each key screen in your app
   - In Simulator: `Device` → `Screenshots` → Select device type
   - Or use keyboard shortcut: `Cmd + S`

3. **Key Screens to Capture:**
   - Login/OTP Screen
   - Dashboard with KPIs
   - Sales Dashboard
   - Approvals List
   - Employee Directory
   - User Profile
   - Receivables Dashboard

### Option 2: Using Actual Device

1. Use the iOS simulator to capture screenshots
2. Or manually take screenshots on a physical iPhone/iPad
3. Use screenshot editing tools to ensure proper dimensions

### Option 3: Using Tools

1. **App Store Screenshot Builder Tools:**

   - AppsPanel
   - Stitch (Mac app)
   - Screenshot Builder websites

2. **Design Tools:**
   - Figma
   - Photoshop
   - Sketch

---

## Creating Screenshots - Step by Step

### Quick Steps:

1. **Start your app:**

   ```bash
   npx expo start
   ```

2. **Open iOS Simulator:**

   - Press `i` in the terminal, or
   - Manually open Xcode → Open Developer Tool → Simulator

3. **Set Simulator Device:**

   - Device → Manage Devices
   - Select iPhone 14 Pro Max (6.7")
   - Take screenshots of key screens

4. **Repeat for other sizes:**

   - Switch to iPhone 11 Pro Max (6.5")
   - Switch to iPhone 8 Plus (5.5")
   - Switch to iPad Pro 12.9"

5. **Save screenshots:**
   - Save with descriptive names
   - Example: `iphone-67-dashboard.png`

---

## Recommended Screenshot Flow

### Screenshot 1: Login Screen

- Clean login interface
- Show OTP input (optional)
- Highlights security features

### Screenshot 2: Dashboard Overview

- KPIs and metrics
- Sales overview
- Professional business dashboard

### Screenshot 3: Sales Dashboard

- Charts and analytics
- Territory breakdown
- Top customers/brands

### Screenshot 4: Approvals Management

- Approval cards
- Credit information
- Quick actions

### Screenshot 5: Employee Directory

- Team members
- Contact information
- Professional interface

### Screenshot 6: User Profile

- Profile information
- QR code feature
- Settings options

### Screenshot 7: Receivables Dashboard (Optional)

- Outstanding amounts
- Aging analysis
- Customer insights

---

## Tools You Can Use

### Automated Tools:

1. **fastlane snapshot** (if using fastlane)
2. **Maestro** - UI testing tool that can capture screenshots
3. **Screenshotting scripts** - Custom automation

### Manual Tools:

1. **iOS Simulator** - Built-in screenshot
2. **Xcode** - Developer tools
3. **Screenshot apps** - Various Mac apps available

---

## Uploading to App Store Connect

1. Go to App Store Connect
2. Select your app
3. Go to "App Store" tab
4. Under "App Preview and Screenshots"
5. Upload screenshots for each device type
6. Add captions/descriptions (optional)

---

## Tips:

- Use the actual app interface (realistic)
- Show key features and value proposition
- Keep text readable
- Use clean, professional UI
- Don't add fake data overlays (Apple may reject)
- Match the actual app experience

---

## Example Screenshot Locations:

After capturing, save to:

```
assets/screenshots/
  - iPhone_6.7_Dashboard.png
  - iPhone_6.7_Approvals.png
  - iPhone_6.5_Dashboard.png
  - iPhone_5.5_Dashboard.png
  - iPad_12.9_Dashboard.png
```

---

## Notes:

- Screenshots must be PNG or JPEG format
- Maximum file size: 500MB per screenshot
- Cannot contain placeholder text like "Lorem ipsum"
- Must show actual app functionality
- Can include device frame or not (your choice)
