# FlipBuilder HTML5 Flipbook Analysis & Integration Plan

## 📋 Overview
The Zebra folder contains a **FlipBuilder/FlipHTML5** HTML5 flipbook implementation. This is a standalone web application that creates a page-flip experience using JavaScript and HTML.

## 🔍 Structure Analysis

### Key Files:
1. **`index.html`** - Main entry point
   - Loads configuration (`config.js`)
   - Loads JavaScript libraries (`resource_skeleton.js`, `editor.js`, `BookPreview.js`)
   - References `files/search/book_config.js` for page configuration

2. **`files/search/book_config.js`** - Page Configuration
   - Contains page URLs: `files/page/X.jpg` (full images)
   - Contains thumbnail URLs: `files/thumb/X.jpg` (thumbnails)
   - Defines page order, text search positions, etc.

3. **JavaScript Files:**
   - `resource_skeleton.js` - Dynamically loads CSS/JS files
   - `book.min.js` - Core flipbook engine
   - `editor.js` - Editor functionality
   - `BookPreview.js` - Main preview/reader
   - `main.min.js` - Additional features

4. **Assets:**
   - `files/page/` - Full-size page images (1.jpg, 2.jpg, etc.)
   - `files/thumb/` - Thumbnail images
   - `style/` - CSS files for styling
   - `javascript/` - All JavaScript libraries

## 🎯 How It Works

1. **Initialization:**
   - `index.html` loads `config.js` and `resource_skeleton.js`
   - `resource_skeleton.js` dynamically loads required CSS/JS files
   - `book_config.js` provides page configuration (image URLs, thumbnails)
   - Flipbook engine (`book.min.js`) initializes and renders pages

2. **Page Rendering:**
   - Images are loaded from `files/page/X.jpg`
   - Thumbnails from `files/thumb/X.jpg`
   - Flip animation handled by JavaScript/CSS
   - Navigation controls built into the HTML

3. **Features:**
   - Page flip animation
   - Thumbnail navigation
   - Full-screen mode
   - Search functionality
   - Print support
   - Responsive design

## 💡 Integration Strategy

### Option 1: Cloud-Hosted HTML Files (Recommended)
**Pros:**
- Easy updates (change files on server)
- Smaller app size
- Can update flipbooks without app updates
- Single source of truth

**Implementation:**
1. Upload FlipBuilder HTML files to cloud server (ERPNext file system)
2. API returns base URL: `https://demo.printechs.com/files/catalogues/{catalogue_id}/`
3. Mobile app loads `index.html` in WebView
4. Modify `book_config.js` to use API-provided image URLs

### Option 2: Local HTML Bundle
**Pros:**
- Works completely offline
- Faster loading
- No server dependency

**Cons:**
- Larger app size
- Requires app update to change catalogues
- Each catalogue = separate HTML bundle

## 🚀 Implementation Plan

### Phase 1: Basic Integration
1. ✅ Remove old `flipbook-viewer.tsx` (React Native implementation)
2. ✅ Create new `flipbook-viewer.tsx` using `react-native-webview`
3. ✅ Load HTML from cloud server URL
4. ✅ Pass `catalogue_id` to determine which flipbook to load

### Phase 2: API Integration
1. Update backend API to return flipbook base URL
   ```json
   {
     "catalogue_id": "CAT-2025-00001",
     "title": "Datalogic Skorpio X5",
     "flipbook_url": "https://demo.printechs.com/files/catalogues/CAT-2025-00001/index.html"
   }
   ```

2. Modify mobile app to:
   - Fetch catalogue details including `flipbook_url`
   - Load the URL in WebView
   - Handle offline caching (optional)

### Phase 3: Dynamic Configuration
1. Option A: Generate `book_config.js` from API
   - Backend creates `book_config.js` dynamically
   - Uses image URLs from `get_catalogue_pages` API

2. Option B: Modify existing `book_config.js`
   - Backend updates `book_config.js` when catalogue is created/updated
   - Static file, but updated via API

## 📱 Mobile App Changes

### New File: `app/flipbook-viewer.tsx`
- Uses `react-native-webview` to display HTML
- Handles loading states
- Supports deep linking (optional)
- Handles back navigation

### Updated File: `app/(tabs)/ecatalogue.tsx`
- Already calls `/flipbook-viewer` route
- No changes needed initially
- Later: pass `flipbook_url` instead of `catalogue_id`

## 🔧 Backend Changes Needed

1. **API Enhancement:**
   ```python
   @frappe.whitelist()
   def get_catalogues_list():
       return {
           "catalogues": [
               {
                   "id": "CAT-2025-00001",
                   "title": "Datalogic Skorpio X5",
                   "item_group": "Retail",
                   "flipbook_url": "/files/catalogues/CAT-2025-00001/index.html",  # NEW
                   # OR
                   "flipbook_base_url": "https://demo.printechs.com/files/catalogues/CAT-2025-00001/"  # NEW
               }
           ]
       }
   ```

2. **File Structure on Server:**
   ```
   /files/catalogues/
     CAT-2025-00001/
       index.html
       javascript/
       style/
       files/
         page/
         thumb/
         search/
           book_config.js
   ```

## ✅ Next Steps

1. Create WebView-based flipbook viewer
2. Test with locally hosted HTML files
3. Update backend API to provide flipbook URLs
4. Upload FlipBuilder files to cloud server
5. Test end-to-end flow

