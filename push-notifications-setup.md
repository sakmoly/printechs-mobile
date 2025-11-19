# Push Notifications Setup for Approval Alerts

This document explains how to set up push notifications to receive alerts when new documents require approval, even when the app is not open.

## Overview

Push notifications will alert users when:

- A new Sales Invoice needs approval
- A new Delivery Note needs approval
- A new Material Request needs approval

## Implementation Options

### Option 1: Expo Push Notifications (Recommended for Expo apps)

**Package:** `expo-notifications`

**Installation:**

```bash
npx expo install expo-notifications
```

**Setup Required:**

1. **Configure app.json:**

```json
{
  "expo": {
    "plugins": [
      [
        "expo-notifications",
        {
          "icon": "./assets/notification-icon.png",
          "color": "#ffffff",
          "sounds": ["./assets/notification-sound.wav"]
        }
      ]
    ],
    "notification": {
      "icon": "./assets/notification-icon.png",
      "color": "#ffffff"
    }
  }
}
```

2. **Register for push notifications:**

```typescript
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// Request permissions
async function requestPermissions() {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

// Get push token
async function getPushToken() {
  const token = await Notifications.getExpoPushTokenAsync({
    projectId: "your-expo-project-id",
  });
  return token.data; // Send this to your backend
}

// Register for notifications
async function setupNotifications() {
  const hasPermission = await requestPermissions();
  if (hasPermission) {
    const token = await getPushToken();
    console.log("Push token:", token);
    // Send token to backend
    return token;
  }
}
```

3. **Backend Requirements:**

- Store push tokens for each user
- When a new document needs approval, send push notification to the approver
- Use Expo Push Notification API: `https://exp.host/--/api/v2/push/send`

---

### Option 2: Firebase Cloud Messaging (FCM) for Production

**Package:** `@react-native-firebase/messaging`

**Installation:**

```bash
npm install @react-native-firebase/app @react-native-firebase/messaging
```

**Setup Required:**

1. **Android:**
   - Add `google-services.json` to `android/app/`
   - Configure Firebase project
2. **iOS:**

   - Add `GoogleService-Info.plist` to `ios/`
   - Configure Firebase project

3. **Usage:**

```typescript
import messaging from "@react-native-firebase/messaging";

// Request permissions
async function requestUserPermission() {
  const authStatus = await messaging().requestPermission();
  return authStatus === messaging.AuthorizationStatus.AUTHORIZED;
}

// Get FCM token
async function getToken() {
  const token = await messaging().getToken();
  return token; // Send to backend
}

// Listen for messages
messaging().onMessage(async (remoteMessage) => {
  console.log("Notification received:", remoteMessage);
  // Show local notification
});
```

---

### Option 3: Background Fetch with Periodic Checks

**Package:** `expo-background-fetch`

**Installation:**

```bash
npx expo install expo-background-fetch
```

**Setup:**

```typescript
import * as BackgroundFetch from "expo-background-fetch";
import * as TaskManager from "expo-task-manager";

// Define background task
TaskManager.defineTask("check-approvals", async () => {
  try {
    const response = await fetch("https://api.printechs.com/approvals/check");
    const data = await response.json();

    if (data.pending_count > 0) {
      // Show local notification
      Notifications.scheduleNotificationAsync({
        content: {
          title: "New Approvals Pending",
          body: `You have ${data.pending_count} documents awaiting approval`,
        },
        trigger: null,
      });
    }

    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// Register background task
async function registerBackgroundFetch() {
  await BackgroundFetch.registerTaskAsync("check-approvals", {
    minimumInterval: 15 * 60, // Check every 15 minutes
    stopOnTerminate: false,
    startOnBoot: true,
  });
}
```

---

## Backend API for Push Notifications

### 1. Store Push Tokens

**Endpoint:** `POST /api/method/printechs_utility.notifications.save_token`

**Request:**

```json
{
  "token": "ExponentPushToken[xxxxxxxxxxxxxx]",
  "device_id": "unique-device-id",
  "user": "user@example.com"
}
```

### 2. Send Push Notification

**Endpoint:** `POST /api/method/printechs_utility.notifications.send_notification`

**Request:**

```json
{
  "recipients": ["user1@example.com", "user2@example.com"],
  "title": "New Approval Required",
  "body": "Sales Invoice SI-00123 needs your approval",
  "data": {
    "doc_type": "Sales Invoice",
    "doc_name": "SI-00123",
    "doctype": "Sales Invoice",
    "name": "SI-00123"
  }
}
```

**Backend Implementation (Python):**

```python
import frappe
from pyfcm import FCMNotification

@frappe.whitelist()
def send_approval_notification(doctype, name, approver_email):
    """Send push notification when document needs approval"""
    try:
        # Get approver's push tokens
        tokens = frappe.get_all(
            "Push Token",
            filters={"user": approver_email, "enabled": 1},
            fields=["token"]
        )

        if not tokens:
            return {"success": False, "message": "No push tokens found"}

        # Prepare notification data
        notification_data = {
            "title": f"New {doctype} Needs Approval",
            "body": f"{name} requires your approval",
            "data": {
                "doctype": doctype,
                "name": name,
                "type": "approval_required"
            }
        }

        # Send to all user's devices
        for token in tokens:
            send_push_notification(token.token, notification_data)

        return {"success": True}

    except Exception as e:
        frappe.log_error(f"Error sending notification: {str(e)}")
        return {"success": False, "message": str(e)}
```

---

## Recommended Implementation Steps

### Phase 1: Quick Setup (Week 1)

1. ✅ Install `expo-notifications`
2. ✅ Request user permissions
3. ✅ Get and store push tokens
4. ✅ Implement local notifications for background fetch

### Phase 2: Backend Integration (Week 2)

1. ✅ Create API to store push tokens
2. ✅ Create API to send notifications
3. ✅ Integrate with approval workflow
4. ✅ Test with real documents

### Phase 3: Polish (Week 3)

1. ✅ Add notification settings (enable/disable)
2. ✅ Add notification categories (urgent, normal)
3. ✅ Add badge count for pending approvals
4. ✅ Add deep linking to open specific documents

---

## Testing

### Test Local Notifications

```typescript
import * as Notifications from "expo-notifications";

async function testNotification() {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Test Approval",
      body: "You have 1 pending approval",
      data: { doctype: "Sales Invoice", name: "SI-001" },
    },
    trigger: { seconds: 2 },
  });
}
```

### Test Push Notifications

Use Expo's tool: https://expo.dev/notifications

---

## Summary

✅ **Expo Push Notifications** - Easiest setup for Expo apps
✅ **Background Fetch** - Periodic checks every 15 minutes
✅ **Backend API** - Send notifications when documents are created
✅ **Permission Handling** - Request user permissions
✅ **Deep Linking** - Open specific documents from notifications

**Next Steps:**

1. Install required packages
2. Request permissions in the app
3. Implement backend notification sending
4. Test with real approval documents
