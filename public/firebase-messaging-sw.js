// This file is intentionally simple.
// It just needs to initialize Firebase so the SDK can handle background notifications automatically.

import { initializeApp } from "firebase/app";
import { getMessaging } from "firebase/messaging/sw";

const firebaseConfig = {
  apiKey: "AIzaSyAZChqV6v73lcJBCMVXIdd4VlREq7tdDVo",
  authDomain: "hotsell-dolw2.firebaseapp.com",
  projectId: "hotsell-dolw2",
  storageBucket: "hotsell-dolw2.appspot.com",
  messagingSenderId: "25821240563",
  appId: "1:25821240563:web:0c84f1a6f053f3e9e12b86",
  measurementId: "G-5G6503TB6P",
};

const app = initializeApp(firebaseConfig);

// This is the only line needed in the service worker.
// The Firebase SDK will handle everything else.
getMessaging(app);
