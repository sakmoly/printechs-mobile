# App Store Screenshots & App Previews Guide

## Required Sizes for iPhone

Your app needs screenshots for different iPhone screen sizes:

### Required Screenshot Sizes:

1. **iPhone 6.7" (iPhone 14 Pro Max, 15 Pro Max)** - Required

   - **Size**: 1290 × 2796 pixels
   - **Portrait**: 1290 × 2796px
   - **Landscape**: 2796 × 1290px

2. **iPhone 6.5" (iPhone 11 Pro Max, XS Max)** - Optional but Recommended

   - **Size**: 1242 × 2688 pixels
   - **Portrait**: 1242 × 2688px
   - **Landscape**: 2688 × 1242px

3. **iPhone 6.1" (iPhone 14 Pro, 15 Pro)** - Optional
   - **Size**: 1179 × 2556 pixels
   - **Portrait**: 1179 × 2556px
   - **Landscape**: 2556 × 1179px

**Note**: The sizes you see in App Store Connect (1242 × 2688px, 1284 × 2778px) are alternative measurements for the same devices.

### App Previews (Video):

- **Optional**: Up to 3 videos (15-30 seconds each)
- **Sizes**: Same as screenshots
- **Format**: MP4, MOV, or M4V
- **Maximum file size**: 500 MB per preview

---

## How to Create Screenshots

### Method 1: Using iPhone Simulator (Recommended)

1. **Open iPhone Simulator**:

   ```bash
   # On Mac, run:
   open -a Simulator
   ```

2. **Choose the right device**:

   - **iPhone 15 Pro Max** (6.7") - For 1290 × 2796px screenshots
   - **iPhone 14 Pro Max** (6.7") - Alternative
   - **iPhone 13 Pro Max** (6.7") - Alternative

3. **Run your app in the simulator**:

   ```bash
   npx expo start
   ```

   Then press `i` to open in iOS simulator

4. **Take screenshots**:

   - Navigate to the screens you want to showcase
   - Press `Cmd + S` (Mac) to save screenshot
   - Or: Device → Screenshot (from menu)

5. **Crop and resize**:
   - Screenshots from simulator are already the correct size
   - You can use Preview (Mac) or any image editor to verify dimensions

### Method 2: Using Physical iPhone

1. **Take screenshots** on your iPhone:

   - Press **Power + Volume Up** (iPhone X and later)
   - Press **Power + Home** (iPhone 8 and earlier)

2. **Transfer to computer**:

   - Via AirDrop, iCloud, or USB

3. **Resize using tools**:
   - **Mac**: Use Preview → Tools → Adjust Size
   - **Online**: Use [Canva](https://www.canva.com) or [FastStone Image Resizer](https://www.faststone.org/)

### Method 3: Using Design Tools (Canva, Figma, Photoshop)

1. **Create mockups** using design tools
2. **Export at exact dimensions**:
   - 1290 × 2796px (portrait)
   - 2796 × 1290px (landscape)

---

## What Screenshots to Include

### Recommended Screenshots (10 maximum):

1. **Home/Dashboard** - Show main features
2. **Login Screen** - Show clean, branded UI
3. **Inventory Dashboard** - Key feature showcase
4. **Drill-down Navigation** - Show hierarchy functionality
5. **Category View** - Show data visualization
6. **Item Details** - Show detailed information
7. **Dashboard KPIs** - Show analytics/statistics
8. **Additional Feature** - Sales, Receivables, etc.
9. **Settings/Profile** - Show user management
10. **Another Key Feature** - Your most important feature

### Tips for Good Screenshots:

- ✅ **Show value**: Highlight key features and benefits
- ✅ **Clean UI**: Remove personal data or use dummy data
- ✅ **Consistent design**: Use similar style across all screenshots
- ✅ **Add text overlays**: Consider adding brief descriptions (optional)
- ✅ **No status bar distractions**: Hide sensitive info in status bar

---

## How to Create App Previews (Optional)

### Using iPhone Simulator:

1. **Record screen**:

   - **Mac**: Press `Cmd + R` in Simulator
   - Or use QuickTime Player → File → New Screen Recording

2. **Edit the video**:

   - Trim to 15-30 seconds
   - Add narration (optional)
   - Export as MP4 or MOV

3. **Resize if needed**:
   - Use tools like [HandBrake](https://handbrake.fr/) or [FFmpeg](https://ffmpeg.org/)

---

## Quick Steps: Using Expo/React Native

### Step 1: Run App in Simulator

```bash
cd d:\mobile
npx expo start
```

Then press `i` to open iOS simulator

### Step 2: Navigate to Key Screens

1. Login screen
2. Dashboard
3. Inventory dashboard
4. Category drill-down
5. Item details
6. Other important features

### Step 3: Take Screenshots

- **Mac**: `Cmd + S` in Simulator
- **Windows**: Use a Mac or physical device (simulator not available on Windows)

**⚠️ Note**: iOS Simulator is only available on macOS. If you're on Windows:

**Option A**: Use a physical iPhone

- Take screenshots on device
- Transfer to computer
- Resize if needed

**Option B**: Use a Mac (or ask someone with a Mac)

- Follow Method 1 above

**Option C**: Use design mockups

- Create screenshots in Figma/Canva
- Export at exact dimensions

---

## Upload to App Store Connect

### Steps:

1. **Go to App Store Connect**:

   - https://appstoreconnect.apple.com
   - Select your app
   - Go to **"App Store"** tab
   - Scroll to **"App Preview and Screenshots"**

2. **Upload Screenshots**:

   - Click **"+"** or drag and drop
   - Select your screenshot files
   - **Order matters**: First screenshot is the primary one (shown first)

3. **Upload App Previews** (Optional):

   - Click **"App Preview"**
   - Upload up to 3 videos (15-30 seconds each)

4. **Add Captions** (Optional):
   - Add brief descriptions for accessibility
   - Not required but recommended

---

## Screenshot Checklist

- [ ] Login screen (1290 × 2796px)
- [ ] Dashboard/Home (1290 × 2796px)
- [ ] Inventory Dashboard (1290 × 2796px)
- [ ] Category view (1290 × 2796px)
- [ ] Drill-down navigation (1290 × 2796px)
- [ ] Item details (1290 × 2796px)
- [ ] KPI/Analytics screen (1290 × 2796px)
- [ ] Additional feature 1 (1290 × 2796px)
- [ ] Additional feature 2 (1290 × 2796px)
- [ ] Additional feature 3 (1290 × 2796px)

---

## Tools & Resources

### Free Tools:

- **Preview (Mac)**: Built-in image editor
- **Canva**: https://www.canva.com (Online design tool)
- **FastStone Image Resizer**: https://www.faststone.org/ (Windows)
- **HandBrake**: https://handbrake.fr/ (Video editing)

### Paid Tools:

- **Sketch**: Design tool
- **Figma**: Design tool (Free tier available)
- **Photoshop**: Professional image editing

---

## Troubleshooting

### "Image dimensions are incorrect"

- **Fix**: Verify exact dimensions using Preview (Mac) or image viewer
- Required: 1290 × 2796px (portrait) or 2796 × 1290px (landscape)

### "File size too large"

- **Fix**: Compress images using online tools or image editor
- Max file size: Usually 500 MB per image (rarely an issue for screenshots)

### "Can't take screenshots on Windows"

- **Solution**: Use physical iPhone or ask someone with a Mac
- Alternative: Create mockups using design tools

---

## Quick Summary

1. **Required**: At least 1 screenshot set (1290 × 2796px for iPhone 6.7")
2. **Recommended**: 5-10 screenshots showing key features
3. **Optional**: Up to 3 app preview videos (15-30 seconds each)
4. **Best method**: Use iPhone Simulator on Mac, or physical iPhone
5. **Upload**: Drag and drop in App Store Connect → App Store → App Preview and Screenshots

---

## Need Help?

- **Expo Screenshot Tool**: Not directly available, use Simulator or physical device
- **Windows Users**: Use physical iPhone or design mockups
- **Mac Users**: Use iPhone Simulator (easiest method)
