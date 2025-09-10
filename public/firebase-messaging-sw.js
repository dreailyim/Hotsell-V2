
// Import the Firebase v10+ app and messaging modules directly from the CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getMessaging, onBackgroundMessage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-sw.js";

// IMPORTANT: This configuration MUST be consistent with the one in your main app.
const firebaseConfig = {
    "projectId": "hotsell-dolw2",
    "appId": "1:25821240563:web:0c84f1a6f053f3e9e12b86",
    "storageBucket": "hotsell-dolw2.firebasestorage.app",
    "apiKey": "AIzaSyAZChqV6v73lcJBCMVXIdd4VlREq7tdDVo",
    "authDomain": "hotsell-dolw2.firebaseapp.com",
    "messagingSenderId": "25821240563",
    "measurementId": "G-5G6503TB6P",
    "databaseURL": "https://hotsell-dolw2.firebaseio.com"
};


// Initialize the Firebase app in the service worker
const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

// Optional: Set up a background message handler
// This is triggered when the app is in the background or closed.
onBackgroundMessage(messaging, (payload) => {
  console.log("[firebase-messaging-sw.js] Received background message: ", payload);

  // Customize the notification that will be shown to the user
  const notificationTitle = payload.notification?.title || "New Message";
  const notificationOptions = {
    body: payload.notification?.body || "You have a new message.",
    icon: payload.notification?.image || "/icons/icon-192x192.png", // Fallback icon
    data: {
        url: payload.fcmOptions?.link || '/' // Use the link from the payload or fallback to home
    }
  };

  // The service worker's registration object is available as `self.registration`
  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Optional: Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    event.notification.close(); // Close the notification

    const urlToOpen = event.notification.data?.url || '/';

    // This looks for an existing window/tab with the same URL and focuses it.
    // If not found, it opens a new one.
    event.waitUntil(
        clients.matchAll({
            type: "window",
            includeUncontrolled: true,
        }).then((clientList) => {
            for (const client of clientList) {
                // You can add more complex logic here to check if the URL matches
                if (client.url === urlToOpen && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});
