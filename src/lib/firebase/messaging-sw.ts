// This file is the actual Service Worker logic.
// It's written in TypeScript using modern ES modules and will be compiled by Webpack.

import { initializeApp } from 'firebase/app';
import { getMessaging } from 'firebase/messaging/sw';

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

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

// Background message handler can be added here if needed in the future.
// For example:
// onBackgroundMessage(messaging, (payload) => {
//   console.log(
//     '[firebase-messaging-sw.js] Received background message ',
//     payload
//   );
//   // ...
// });
