// This file must be in the /public folder.

self.importScripts("https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js");
self.importScripts("https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js");

// NOTE: The firebaseConfig object is now passed from the main app's service worker registration.
// We do not need to initialize the app here.

// The service worker will be initialized and configured by the client-side code.
// This file just needs to exist and load the scripts.

// Optional: To handle background messages.
// It's important to check if messaging is available before using it.
if (typeof firebase.messaging === 'function') {
    const messaging = firebase.messaging();
    messaging.onBackgroundMessage((payload) => {
      console.log(
        '[firebase-messaging-sw.js] Received background message ',
        payload
      );
      // Customize notification here
      const notificationTitle = payload.notification.title;
      const notificationOptions = {
        body: payload.notification.body,
        icon: '/icon-192x192.png'
      };

      self.registration.showNotification(notificationTitle, notificationOptions);
    });
}
