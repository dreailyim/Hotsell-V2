// IMPORTANT: This file must be in the public directory.

import { initializeApp } from 'firebase/app';
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw';

// This configuration is safe to be exposed on the client-side.
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


const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

// This listener handles notifications when the app is in the background or closed.
onBackgroundMessage(messaging, (payload) => {
  console.log(
    '[firebase-messaging-sw.js] Received background message ',
    payload
  );

  const notificationTitle = payload.notification?.title || 'HotSell';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new message.',
    icon: '/favicon.ico', // Optional: Use a default icon
    data: {
        url: payload.fcmOptions?.link || '/'
    }
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Optional: Listener for notification click
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const notification = event.notification;
    const urlToOpen = notification.data?.url || '/';

    event.waitUntil(
        clients.matchAll({
            type: 'window',
            includeUncontrolled: true,
        }).then((clientList) => {
            // If a window for this origin is already open, focus it.
            for (const client of clientList) {
                if (new URL(client.url).origin === new URL(urlToOpen).origin) {
                    return client.focus();
                }
            }
            // Otherwise, open a new window.
            return clients.openWindow(urlToOpen);
        })
    );
});
