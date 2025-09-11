// Use the old `importScripts` syntax for maximum compatibility in Service Workers.
importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js");

// This configuration is safe to be exposed in the service worker.
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

// Initialize the Firebase app in the service worker with the configuration
firebase.initializeApp(firebaseConfig);

// Retrieve an instance of Firebase Messaging so that it can handle background
// messages.
const messaging = firebase.messaging();

// If you want to handle background messages, you can add a listener here.
// For now, Firebase will automatically handle displaying the notification.
messaging.onBackgroundMessage((payload) => {
  console.log(
    "[firebase-messaging-sw.js] Received background message ",
    payload
  );

  // Customize notification here
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: "/favicon.ico", // You can add a default icon here
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
