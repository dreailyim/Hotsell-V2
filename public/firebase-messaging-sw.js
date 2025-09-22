// 使用 'compat' 版本的 importScripts 來引入 Firebase SDK，這是 Service Worker 支援的方式
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// 你的 Firebase 設定，保持不變
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

// 使用 compat library 的方式初始化 Firebase
firebase.initializeApp(firebaseConfig);

// 取得 Firebase Messaging 的實例，以便處理背景訊息
const messaging = firebase.messaging();

/**
 * 處理應用程式在背景或關閉時收到的訊息
 */
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] 收到背景訊息：', payload);

  // 從收到的 payload 自訂通知的標題和內容
  const notificationTitle = payload.notification?.title || '新訊息';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: payload.notification?.imageUrl || '/favicon.ico', // 可選：使用圖示
    data: payload.data, // 將 click_action 等資料傳遞下去
  };

  // 使用 service worker 的 registration 來顯示通知
  self.registration.showNotification(notificationTitle, notificationOptions);
});

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
            }
        })
    );
});


