// Import the Firebase app and messaging services
import { initializeApp } from "firebase/app";
import { getMessaging, onBackgroundMessage } from "firebase/messaging/sw";

// IMPORTANT: This configuration needs to be accessible to the service worker.
// It's the same configuration from your `client-app.ts`.
const firebaseConfig = {
    "projectId": "hotsell-dolw2",
    "appId": "1:25821240563:web:0c84f1a6f053f3e9e12b86",
    "storageBucket": "hotsell-dolw2.appspot.com",
    "apiKey": "AIzaSyAZChqV6v73lcJBCMVXIdd4VlREq7tdDVo",
    "authDomain": "hotsell-dolw2.firebaseapp.com",
    "messagingSenderId": "25821240563",
    "measurementId": "G-5G6503TB6P",
    "databaseURL": "https://hotsell-dolw2.firebaseio.com"
};

// Initialize the Firebase app in the service worker
const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

/**
 * Handles incoming messages when the app is in the background or terminated.
 * This is the core logic for showing system-level notifications.
 */
onBackgroundMessage(messaging, (payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);

  // Customize the notification title and body from the incoming payload
  const notificationTitle = payload.notification?.title || '新訊息';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: payload.notification?.imageUrl || '/favicon.ico', // Optional: use an icon
    data: payload.data, // Pass along data like URLs
  };

  // The service worker's registration is used to show the notification
  self.registration.showNotification(notificationTitle, notificationOptions);
});

/**
 * Handles clicks on the background notification.
 * This function is triggered when a user clicks the notification shown by the service worker.
 */
self.addEventListener('notificationclick', (event) => {
    console.log('[firebase-messaging-sw.js] Notification click Received.', event.notification.data);

    // Close the notification
    event.notification.close();

    // This is the URL that will be opened when the notification is clicked
    const targetUrl = event.notification.data?.click_action || '/';

    // This looks for an existing window and focuses it, or opens a new one
    event.waitUntil(
        clients.matchAll({ type: "window" }).then((clientList) => {
            for (const client of clientList) {
                if (client.url === targetUrl && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});


