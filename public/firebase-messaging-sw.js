
// This file MUST be in the public folder.

// Import the Firebase app and messaging packages.
// This uses the "compat" version of the SDK, which is recommended for service workers.
importScripts('https://www.gstatic.com/firebasejs/9.15.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.15.0/firebase-messaging-compat.js');

// IMPORTANT: Do not copy your config object here.
// The service worker will be initialized automatically from the client-side app.
// If you put your config here, you may accidentally initialize the app twice.

// Set Firebase messaging background handler
// This is triggered when the app is in the background or closed.
self.addEventListener('push', (event) => {
  // Background message handling logic can be added here if needed,
  // but for simple notifications, Firebase handles it automatically.
});

// Optional: If you want to customize the notification click action
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const notificationPayload = event.notification.data;
  if (notificationPayload && notificationPayload.FCM_MSG) {
      const clickAction = notificationPayload.FCM_MSG.data.click_action;
      if (clickAction) {
          event.waitUntil(clients.openWindow(clickAction));
      }
  }
});
