// @ts-nocheck
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';
import { getMessaging, isSupported } from 'firebase/messaging';
import 'firebase/compat/storage'; // Import the compat library

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

// A robust way to initialize Firebase on the client, ensuring it only happens once.
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const functions = getFunctions(app, 'us-central1');


// It's crucial to check for support and only initialize messaging on the client.
// We export a function that can be called safely from a useEffect hook.
const getMessagingInstance = async () => {
  const isMessagingSupported = await isSupported();
  if (typeof window !== 'undefined' && isMessagingSupported) {
    return getMessaging(app);
  }
  return null;
};


export { app, db, auth, storage, functions, getMessagingInstance };
