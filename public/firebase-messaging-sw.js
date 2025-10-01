
// Scripts for firebase and firebase messaging
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyAZChqV6v73lcJBCMVXIdd4VlREq7tdDVo",
  authDomain: "hotsell-dolw2.firebaseapp.com",
  projectId: "hotsell-dolw2",
  storageBucket: "hotsell-dolw2.firebasestorage.app",
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
}

/**
 * 處理背景通知的點擊事件
 */
self.addEventListener('notificationclick', (event) => {
    console.log('[firebase-messaging-sw.js] 用戶點擊了通知：', event.notification.data);

    // 關閉通知
    event.notification.close();

    // 這是點擊通知後要開啟的 URL，來自 Cloud Function 的 data payload
    const targetUrl = event.notification.data?.click_action || '/';

    // 這段程式碼會尋找一個已開啟的視窗並對焦，如果沒有就會開一個新的
    event.waitUntil(
        clients.matchAll({ type: "window" }).then((clientList) => {
            for (const client of clientList) {
                // 如果找到符合的 URL，就直接 focus 該視窗
                if (client.url.endsWith(targetUrl) && 'focus' in client) {
                    return client.focus();
                }
            }
            // 如果沒有符合的視窗，就開新視窗
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            });
