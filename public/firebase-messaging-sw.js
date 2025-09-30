
// Scripts for firebase and firebase messaging
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyAZChqV6v73lcJBCMVXIdd4VlREq7tdDVo",
  authDomain: "hotsell-dolw2.firebaseapp.com",
  projectId: "hotsell-dolw2",
  storageBucket: "hotsell-dolw2.appspot.com",
  messagingSenderId: "25821240563",
  appId: "1:25821240563:web:0c84f1a6f053f3e9e12b86",
  measurementId: "G-5G6503TB6P",
  databaseURL: "https://hotsell-dolw2.firebaseio.com"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log(
    '[firebase-messaging-sw.js] Received background message ',
    payload
  );
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: payload.notification.image,
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
