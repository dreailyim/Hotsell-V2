// This service worker can be customized!
// See https://firebase.google.com/docs/messaging/js/receive

// Import and configure the Firebase SDK
// These scripts are made available when the app is served or deployed
import { initializeApp } from 'firebase/app';
import { getMessaging } from 'firebase/messaging/sw';

// This configuration is safe to be exposed on the client-side.
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

// If you would like to customize notifications that are received in the
// background (Web app is closed or not in browser focus) then you should
// implement this optional method.
//
// self.addEventListener('push', function(event) {
//   console.log('[firebase-messaging-sw.js] Received push event.', event);
//   // Customize notification here
//   const notificationTitle = 'New Message';
//   const notificationOptions = {
//     body: 'You have a new message.',
//     icon: '/firebase-logo.png'
//   };
//   event.waitUntil(self.registration.showNotification(notificationTitle, notificationOptions));
// });
