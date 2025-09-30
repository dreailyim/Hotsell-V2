'use client';

import { useEffect, useCallback } from 'react';
import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { useAuth } from './use-auth'; // 假設您有一個身份驗證的 custom hook
import { db, app } from '@/lib/firebase/client-app';
import { useToast } from './use-toast'; // 假設您使用 shadcn/ui 的 toast

export function useFcm() {
  const { user } = useAuth();
  const { toast } = useToast();

  /**
   * 請求權限、取得 Token 並儲存到 Firestore
   */
  const requestPermissionAndToken = useCallback(async (retryCount = 0) => {
    if (!user) {
      console.log('FCM: User not logged in. Aborting.');
      return;
    }
    
    const supported = await isSupported();
    if (!supported) {
      console.log('FCM is not supported in this browser.');
      return;
    }
    
    const messaging = getMessaging(app);

    try {
      const serviceWorkerRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      console.log('FCM: Service worker registered successfully.');

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        if (permission === 'denied') {
          console.warn('FCM: Notification permission denied by user.');
          toast({
            title: "通知權限已被封鎖",
            description: "如要接收新訊息通知，請在瀏覽器設定中手動允許。",
            variant: "destructive"
          });
        }
        return;
      }
      
      console.log('FCM: Notification permission granted.');

      // --- **正確的設定** ---
      // 取得此裝置的 FCM Token，並提供 VAPID key
      const currentToken = await getToken(messaging, { 
          vapidKey:'BBfufXrZC9QhcAwNKSGHsVMeuqQhnz76kJYVqrYczMV_1Engp54lGvnyAtX0zHTdoU9TuEITBI7ckloGlb5iTfA',
          serviceWorkerRegistration 
      });

      if (currentToken) {
          console.log('FCM: Token received:', currentToken);
          const userDocRef = doc(db, 'users', user.uid);
          await updateDoc(userDocRef, {
              fcmTokens: arrayUnion(currentToken),
          });
          console.log('FCM: Token saved to Firestore.');
      } else {
           console.warn('FCM: No registration token available. Request permission to generate one.');
      }
    } catch (error: any) {
      console.error('FCM Error: An error occurred while retrieving token.', error);
      
      // Handle the specific IndexedDB error with a retry
      if (error.code === 'messaging/failed-to-get-token' && error.message.includes('database connection is closing') && retryCount < 1) {
          console.log('FCM: Database connection closing. Retrying in 1 second...');
          setTimeout(() => requestPermissionAndToken(retryCount + 1), 1000);
          return; // Exit without showing toast on first failed attempt
      }
      
      toast({
        title: "獲取推播權杖失敗",
        description: `${error.message} (${error.code || '未知錯誤碼'})`,
        variant: "destructive"
      });
    }
  }, [user, toast]);

  // 當使用者登入後，執行一次權限請求
  useEffect(() => {
    if (user) {
      requestPermissionAndToken();
    }
  }, [user, requestPermissionAndToken]);

  // 設定前景訊息監聽器
  useEffect(() => {
    if (typeof window === 'undefined' || !user) {
        return;
    }

    const setupListener = async () => {
        const supported = await isSupported();
        if (supported) {
            const messagingInstance = getMessaging(app);
            const unsubscribe = onMessage(messagingInstance, (payload) => {
                console.log('Foreground message received.', payload);
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
    
    // Cleanup function
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
