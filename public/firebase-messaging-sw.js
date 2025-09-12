// Version: 2024-07-31-1100

// This service worker MUST be using the 'compat' library through importScripts.
// Using modern ESM 'import' statements will cause a SyntaxError in many browsers.

importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

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

// Initialize the Firebase app in the service worker
firebase.initializeApp(firebaseConfig);

// Retrieve an instance of Firebase Messaging so that it can handle background messages.
const messaging = firebase.messaging();

// By simply getting the messaging instance, Firebase SDK automatically handles
// background messages. The onBackgroundMessage handler can be used for
// custom logic, but for simple notification display, it's not strictly necessary
// as Firebase handles it. This minimal setup is the most robust.
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);

  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icon-192x192.png' // Ensure you have this icon in /public
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
