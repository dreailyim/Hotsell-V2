// @ts-nocheck
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';
import { getMessaging, isSupported } from 'firebase/messaging';

// 您的 Firebase 設定，storageBucket 已根據您的要求更新
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

// 初始化 Firebase App，這個模式可以防止在 Next.js 的熱重載中重複初始化
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);
// 明確連接到您部署 functions 的區域
const functions = getFunctions(app, 'asia-east2');

// 只有在瀏覽器環境且支援 FCM 時才初始化 messaging
const messaging = (async () => {
    if (typeof window !== 'undefined' && (await isSupported())) {
        console.log("Firebase Messaging is supported. Initializing...");
        return getMessaging(app);
    }
    console.log("Firebase Messaging is not supported in this browser.");
    return null;
})();


export { app, db, auth, storage, functions, messaging };
