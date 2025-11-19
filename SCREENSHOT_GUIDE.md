# App Store Screenshot Guide

Guide for creating screenshots for **Printechs ERP Application** App Store submission.

## Required Screenshot Sizes

### iPhone 6.7" Display (REQUIRED)
- **Size**: 1290 x 2796 pixels
- **Devices**: iPhone 15 Pro Max, 14 Pro Max, 13 Pro Max, 12 Pro Max
- **Minimum**: 3 screenshots
- **Maximum**: 10 screenshots
- **Format**: PNG or JPEG

### iPhone 6.5" Display (Optional)
- **Size**: 1242 x 2688 pixels
- **Devices**: iPhone 11 Pro Max, XS Max
- **Optional**: Can reuse 6.7" screenshots (will be automatically resized)

### iPad Pro 12.9" Display (Optional - Recommended)
- **Size**: 2048 x 2732 pixels
- **Devices**: iPad Pro 12.9"
- **Note**: Your app supports tablets (`supportsTablet: true`), so iPad screenshots are recommended

---

## How to Create Screenshots

### Method 1: iOS Simulator (Recommended)

1. **Open iOS Simulator**:
   ```bash
   # Run your app in Expo
   npm start
   # Then press 'i' to open iOS simulator
   ```

2. **Set Simulator Size**:
   - Device: iPhone 15 Pro Max (for 6.7" screenshots)
   - Or iPad Pro 12.9" (for tablet screenshots)

3. **Navigate to Screens**:
   - Login screen
   - Dashboard
   - Inventory by Category
   - Sales/Orders
   - Reports

4. **Take Screenshots**:
   - **Mac**: Press `Cmd + S` in simulator
   - Screenshots saved to: `~/Desktop` (usually)
   - Or use: File → Save Screen

### Method 2: Physical iPhone/iPad

1. **Connect Device**:
   - Connect iPhone/iPad to your computer
   - Trust the computer when prompted

2. **Run App**:
   ```bash
   npm start
   # Then press device-specific key or scan QR code
   ```

3. **Take Screenshots**:
   - **iPhone X or later**: Side button + Volume Up
   - **iPhone 8 or earlier**: Home button + Side button
   - Screenshots appear in Photos app

4. **Export to Computer**:
   - Use Photos app on Mac
   - Or use Image Capture
   - Or use AirDrop

### Method 3: Screenshot Tools

**Recommended Tools:**
- **Fastlane Screenshot** (Command line)
- **Screenshots.pro** (Online tool)
- **App Store Screenshot Generator** (Online)

---

## Screenshot Order (Recommended)

Upload screenshots in this order for best impact:

1. **Dashboard/Home Screen** ⭐
   - Shows main navigation
   - Highlights key features
   - First impression!

2. **Inventory by Category**
   - Shows inventory management
   - Demonstrates data visualization
   - Key selling point

3. **Sales/Orders Screen**
   - Shows order management
   - Business functionality

4. **Reports/Analytics**
   - Shows data insights
   - Professional appearance

5. **Approval Workflows** (if applicable)
   - Shows workflow features

6. **Settings/Profile** (optional)
   - Completes the picture

---

## Screenshot Best Practices

### ✅ DO:
- Use real app screens with actual data
- Show your best features first
- Ensure text is readable
- Use consistent navigation state
- Show a variety of screens
- Remove sensitive data
- Use clean, professional UI states

### ❌ DON'T:
- Use mockups or design files
- Show placeholder text everywhere
- Include test/fake data that looks unprofessional
- Show error states
- Include personal/sensitive information
- Use outdated UI
- Show loading states

---

## Editing Screenshots (If Needed)

### Resize to Exact Dimensions:
```bash
# Using ImageMagick (if installed)
magick input.png -resize 1290x2796! output.png

# Using online tools:
# - https://www.iloveimg.com/resize-image
# - https://resizeimage.net
```

### Remove Status Bar Time (Optional):
- Some prefer clean screenshots without status bar
- Use screenshot tools that can remove status bar
- Or use Photoshop/GIMP

---

## File Naming Convention

For organization, name files like:
```
screenshot-1-dashboard.png
screenshot-2-inventory.png
screenshot-3-sales.png
screenshot-4-reports.png
```

Or use numbers:
```
1.png
2.png
3.png
4.png
```

---

## Upload Process

1. **Go to App Store Connect**: https://appstoreconnect.apple.com
2. **Select Your App**: "Printechs ERP Application"
3. **Go to "App Store" Tab**
4. **Select Version** (or create new version)
5. **Scroll to "Screenshots" Section**
6. **Drag and Drop Images**:
   - Drag files into the upload area
   - Or click "Choose Files"
7. **Order Screenshots**:
   - Drag to reorder
   - First screenshot is the hero image
8. **Save Changes**

---

## Checklist Before Upload

- [ ] All screenshots are correct size (1290 x 2796 for iPhone)
- [ ] At least 3 screenshots prepared
- [ ] Screenshots show actual app functionality
- [ ] No sensitive/personal data visible
- [ ] Text is readable
- [ ] UI looks professional
- [ ] Screenshots are in preferred order
- [ ] Files are named clearly

---

## Alternative: App Preview Videos

Instead of (or in addition to) screenshots, you can upload:
- **App Preview Videos** (30 seconds max)
- Same sizes as screenshots
- Shows app in action
- Highly recommended for better conversion

---

## Quick Tips

1. **Use Real Data**: Screenshots with realistic data look more professional
2. **Show Value**: Highlight what makes your app unique
3. **First Impression**: First screenshot is most important
4. **Consistency**: Use same navigation state across screenshots
5. **Update Regularly**: Update screenshots when you release new features

---

## Example Screenshot Checklist

For Printechs ERP Application:

- [ ] Screenshot 1: Login screen with logo
- [ ] Screenshot 2: Dashboard/Home showing inventory KPI
- [ ] Screenshot 3: Inventory by Category (drill-down view)
- [ ] Screenshot 4: Sales Orders list
- [ ] Screenshot 5: Order details/approval screen
- [ ] Screenshot 6: Reports/Analytics screen
- [ ] Screenshot 7: (Optional) Settings/Profile

---

**Ready to create screenshots? Start with your best screen first!**
