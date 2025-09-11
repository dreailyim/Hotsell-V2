// DO NOT USE import, this file is not a module.

// This file MUST be in the public folder.

// Give the service worker access to the Firebase App and Messaging products.
// Use the compat libraries for the widest browser support.
try {
    importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
    importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

    // Your web app's Firebase configuration
    // This is the same config object used in your client-side code.
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
    // by passing in the messagingSenderId.
    firebase.initializeApp(firebaseConfig);

    // Retrieve an instance of Firebase Messaging so that it can handle background
    // messages.
    const messaging = firebase.messaging();
    
    // Optional: Set a handler for when a notification is received while the app is in the background.
    messaging.onBackgroundMessage((payload) => {
        console.log('[firebase-messaging-sw.js] Received background message ', payload);
        
        const notificationTitle = payload.notification.title;
        const notificationOptions = {
            body: payload.notification.body,
            icon: '/firebase-logo.png' // Optional: a small icon for the notification
        };

        self.registration.showNotification(notificationTitle, notificationOptions);
    });

} catch (e) {
    console.error('firebase-messaging-sw.js: Failed to initialize Firebase', e);
}
