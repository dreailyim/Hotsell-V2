// This file must be in the public folder.
// It is intentionally left almost empty.
// Firebase will automatically handle the rest.
// For more information, see: https://firebase.google.com/docs/cloud-messaging/js/client#retrieve-the-current-registration-token

// We are intentionally not initializing the app here.
// The service worker will be initialized by the main app.
// We just need to import and use getMessaging somewhere.
import { getMessaging, onBackgroundMessage } from "firebase/messaging/sw";

const messaging = getMessaging();

onBackgroundMessage(messaging, (payload) => {
  console.log(
    "[firebase-messaging-sw.js] Received background message ",
    payload
  );
  // Customize notification here
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: "/firebase-logo.png",
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
