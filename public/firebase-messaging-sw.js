// This file must be in the public directory.

import { initializeApp } from 'firebase/app';
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw';

// This configuration is safe to be exposed on the client-side.
// It's the same config used in your main app.
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

// onBackgroundMessage is used to handle messages received while the app is in the background.
onBackgroundMessage(messaging, (payload) => {
  console.log(
    '[firebase-messaging-sw.js] Received background message ',
    payload
  );
  
  // Customize notification here
  const notificationTitle = payload.notification?.title || 'HotSell';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new message.',
    icon: '/icon-192x192.png' // Ensure this icon exists in the public folder
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
