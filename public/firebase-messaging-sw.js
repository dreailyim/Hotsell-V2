// DO NOT EDIT
// This file is required for Firebase Cloud Messaging to work.

import { initializeApp } from 'firebase/app';
import { getMessaging } from 'firebase/messaging/sw';

// This configuration is safe to be exposed on the client-side.
// It is the same config from `src/lib/firebase/client-app.ts`.
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

// This service worker can be customized with onBackgroundMessage handler.
// See: https://firebase.google.com/docs/cloud-messaging/js/receive
