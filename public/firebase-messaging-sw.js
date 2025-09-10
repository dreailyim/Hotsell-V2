
// @ts-nocheck
// This file needs to be in the public directory.
// It's the service worker that will handle background push notifications.

import { initializeApp } from 'firebase/app';
import { getMessaging } from 'firebase/messaging/sw';

// IMPORTANT: This config has to be sync and cannot be behind a dynamic import.
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

// Background message handler (optional)
// self.addEventListener('push', (event) => {
//   console.log('[SW] Push Received.', event.data.json());
// });
