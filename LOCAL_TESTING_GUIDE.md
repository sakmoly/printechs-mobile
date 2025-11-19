# Local Flipbook Testing Guide

## 🚀 Quick Start

### Step 1: Start Local HTTP Server

1. **Navigate to Zebra folder:**
   ```bash
   cd D:\Zebra
   ```

2. **Start HTTP server:**
   ```bash
   python -m http.server 8000
   ```
   
   Or simply **double-click** `start-server.bat` in the Zebra folder.

3. **Server should be running:**
   - URL: `http://localhost:8000/index.html`
   - You should see: "Serving HTTP on :: port 8000"

### Step 2: Test in Mobile App

The mobile app is already configured to use local testing in development mode:

- **For Web/Emulator:** Uses `http://localhost:8000/index.html`
- **For Physical Device:** You need your computer's IP address (see below)

## 📱 Testing on Physical Device

When testing on a real mobile device, `localhost` won't work. You need to use your computer's IP address:

### Find Your Computer's IP Address:

**Windows:**
```bash
ipconfig
```
Look for "IPv4 Address" (usually something like `192.168.1.100`)

**Mac/Linux:**
```bash
ifconfig
# or
ip addr
```

### Update the Flipbook Viewer:

1. Open `app/flipbook-viewer.tsx`
2. Find this line:
   ```typescript
   const LOCAL_FLIPBOOK_URL = "http://localhost:8000/index.html";
   ```
3. Replace `localhost` with your IP address:
   ```typescript
   const LOCAL_FLIPBOOK_URL = "http://192.168.1.100:8000/index.html";
   ```

### Important:
- Make sure your phone and computer are on the same Wi-Fi network
- Windows Firewall might block port 8000 - you may need to allow it

## 🔧 Configuration

The app uses `USE_LOCAL_TEST = __DEV__` which means:
- ✅ **Development mode:** Uses local HTTP server
- ❌ **Production mode:** Uses cloud server URLs

To disable local testing, change:
```typescript
const USE_LOCAL_TEST = false; // Set to false to use server URLs
```

## ✅ Testing Checklist

- [ ] Python is installed on your computer
- [ ] HTTP server is running on port 8000
- [ ] Can access `http://localhost:8000/index.html` in browser
- [ ] If using physical device, updated IP address in code
- [ ] Phone and computer on same Wi-Fi network (for physical device)
- [ ] Firewall allows port 8000 (if needed)

## 🐛 Troubleshooting

### "Connection refused" or "Cannot connect"
- Make sure the HTTP server is running
- Check that port 8000 is not blocked by firewall
- If using physical device, verify IP address is correct

### "Local server not responding"
- Verify server is running: Open `http://localhost:8000/index.html` in browser
- Check console logs in the app for more details
- Try restarting the HTTP server

### CORS Errors
- The local HTTP server should serve files without CORS issues
- If you see CORS errors, the files might be loading from a different origin

## 📝 Next Steps

Once local testing works:
1. ✅ Verify flipbook displays correctly
2. ✅ Test page navigation
3. ✅ Test on different devices
4. 🔄 Upload HTML files to cloud server
5. 🔄 Update API to provide flipbook URLs
6. 🔄 Test with production URLs

