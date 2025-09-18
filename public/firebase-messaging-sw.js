// This file must be in the public directory.
// It allows the app to receive push notifications when in the background.

// IMPORTANT: Do not use any functions or variables from the main app code here.
// This script is run in a separate environment from the rest of the app.

import { initializeApp } from 'firebase/app';
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw';

// This configuration is duplicated from the main app's Firebase client setup.
// It's safe to be exposed here.
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


const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

// This handler is called when a push notification is received and the app is in the background.
onBackgroundMessage(messaging, (payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const notificationTitle = payload.notification?.title || 'New Message';
  const notificationOptions = {
    body: payload.notification?.body,
    icon: payload.notification?.image || '/icon-192x192.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
