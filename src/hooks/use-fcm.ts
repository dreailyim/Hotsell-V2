'use client';

import { useEffect, useCallback } from 'react';
import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { useAuth } from './use-auth'; // Assuming you have a custom hook for auth
import { db, app } from '@/lib/firebase/client-app';
import { useToast } from './use-toast'; // Assuming you use shadcn/ui toast

export function useFcm() {
  const { user } = useAuth();
  const { toast } = useToast();

  /**
   * 請求權限、取得 Token 並儲存到 Firestore
   */
  const requestPermissionAndToken = useCallback(async () => {
    // 必須在使用者登入後才能執行
    if (!user) {
      console.log('FCM: User not logged in. Aborting.');
      return;
    }
    
    // 檢查瀏覽器是否支援 FCM
    const supported = await isSupported();
    if (!supported) {
      console.log('FCM is not supported in this browser.');
      return;
    }
    
    const messaging = getMessaging(app);

    try {
      // 註冊 Service Worker，這是背景通知的關鍵
      // Service Worker 檔案必須放在 public 資料夾的根目錄
      const serviceWorkerRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      
      console.log('FCM: Service worker registered successfully.');

      // 向使用者請求顯示通知的權限
      const permission = await Notification.requestPermission();

      if (permission !== 'granted') {
        if (permission === 'denied') {
          console.warn('FCM: Notification permission denied by user.');
          toast({
            title: "通知權限已被封鎖",
            description: "如要接收新訊息通知，請在瀏覽器設定中手動允許。",
            variant: "destructive"
          });
        } else {
          console.log('FCM: Notification permission not granted.');
        }
        return;
      }
      
      console.log('FCM: Notification permission granted.');

      // 取得此裝置的 FCM Token
      const currentToken = await getToken(messaging, { 
          vapidKey: BEhu10ANaPARApTUl9QFzo1t3JxBuqC-kwI6oPDO9ON1vWlEErqsBA2-McoUDdpHeKbPvgk_rhI6TTpiPYGpkFg, // **重要**: 請到 Firebase Console > Project Settings > Cloud Messaging > Web configuration 找到並貼上您的 VAPID key
          serviceWorkerRegistration 
      });

      if (currentToken) {
          console.log('FCM: Token received:', currentToken);
          // 將 Token 存到 Firestore 的使用者文件底下
          const userDocRef = doc(db, 'users', user.uid);
          // 使用 arrayUnion 避免重複寫入同一個 Token
          await updateDoc(userDocRef, {
              fcmTokens: arrayUnion(currentToken),
          });
          console.log('FCM: Token saved to Firestore.');
      } else {
           console.warn('FCM: No registration token available. Request permission to generate one.');
           toast({
            title: "獲取推播權杖失敗",
            description: "無法獲取權杖，請確認您的瀏覽器設定或稍後再試。",
            variant: "destructive"
          });
      }
    } catch (error: any) {
      console.error('FCM Error: An error occurred while retrieving token.', error);
      toast({
        title: "獲取推播權杖失敗",
        description: `${error.message} (${error.code || '未知錯誤碼'})`,
        variant: "destructive"
      });
    }
  }, [user, toast]);

  // Effect: 當使用者登入狀態確立後，執行一次權限請求與 Token 獲取
  useEffect(() => {
    if (user) {
      requestPermissionAndToken();
    }
  }, [user, requestPermissionAndToken]);

  // Effect: 設定前景訊息監聽器
  useEffect(() => {
    // 確保只在瀏覽器環境且使用者已登入時執行
    if (typeof window === 'undefined' || !user) {
        return;
    }

    const setupListener = async () => {
        const supported = await isSupported();
        if (supported) {
            const messagingInstance = getMessaging(app);
            // onMessage 用於接收 App 在前景時的推播
            const unsubscribe = onMessage(messagingInstance, (payload) => {
                console.log('Foreground message received.', payload);
                // 使用 Toast 或其他 UI 元件來顯示前景通知
                toast({
                  title: payload.notification?.title || '新通知',
                  description: payload.notification?.body,
                });
            });
            return unsubscribe;
        }
        return null;
    };

    const unsubscribePromise = setupListener();
    
    // Cleanup function: 在元件卸載時取消監聽
    return () => {
        unsubscribePromise.then(unsubscribe => {
            if (unsubscribe) {
                console.log('FCM: Unsubscribing from foreground messages.');
                unsubscribe();
            }
        });
    };
  }, [toast, user]);
}


