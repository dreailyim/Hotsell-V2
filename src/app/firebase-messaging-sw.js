
// This file must be in the /src/app directory when using next-pwa with a custom worker directory.

self.importScripts("https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js");
self.importScripts("https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js");

// NOTE: This config is public and safe to expose.
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


firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

// Optional: To handle background messages.
messaging.onBackgroundMessage((payload) => {
  console.log(
    '[firebase-messaging-sw.js] Received background message ',
    payload
  );
  // Customize notification here
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icon-192x192.png' // Make sure you have this icon in your /public folder
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
