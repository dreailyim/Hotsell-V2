
'use client';

import { useEffect, useCallback } from 'react';
import { getToken, onMessage } from "firebase/messaging";
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { useAuth } from './use-auth';
import { db } from '@/lib/firebase/client-app';
import { useToast } from './use-toast';
import { getMessagingInstance } from '@/lib/firebase/client-app';

const VAPID_KEY = "BEhu10ANaPARApTUl9QFzo1t3JxBuqC-kwI6oPDO9ON1vWlEErqsBA2-McoUDdpHeKbPvgk_rhI6TTpiPYGpkFg";

export function useFcm() {
  const { user } = useAuth();
  const { toast } = useToast();

  const requestPermissionAndToken = useCallback(async () => {
    if (!user) {
      console.log("FCM: User not logged in, aborting token request.");
      return;
    }
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      toast({ title: "瀏覽器不支援通知", variant: "destructive" });
      return;
    }

    try {
      // Step 1: Explicitly register the service worker and wait for it to be ready.
      // This is the most critical step to prevent the "no active Service Worker" error.
      const swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      await navigator.serviceWorker.ready; // Wait until the Service Worker is active and ready.
      
      console.log('FCM: Service Worker registered and ready:', swRegistration);

      // Step 2: Get the messaging instance.
      const messaging = await getMessagingInstance();
      if (!messaging) {
        toast({ title: "FCM 初始化失敗", description: "無法獲取 Messaging 實例。", variant: "destructive" });
        return;
      }
      
      // Step 3: Request permission from the user.
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        console.log('FCM: Notification permission granted.');
        
        // Step 4: Get the token ONLY after the SW is ready and permission is granted.
        console.log("FCM: Requesting token with VAPID key...");
        const currentToken = await getToken(messaging, {
            vapidKey: VAPID_KEY,
            serviceWorkerRegistration: swRegistration, // Pass the registration to getToken.
        });
        
        if (currentToken) {
          console.log('FCM: Token successfully retrieved:', currentToken);
          const userDocRef = doc(db, 'users', user.uid);
          await updateDoc(userDocRef, {
            fcmTokens: arrayUnion(currentToken),
          });
          console.log('FCM: Token saved to Firestore.');
        } else {
          console.error('FCM Error: No registration token available. This often means the service worker is not correctly configured.');
          toast({
              title: "無法獲取推播權杖",
              description: "未能生成註冊權杖，請檢查 Service Worker 狀態或瀏覽器設定。",
              variant: "destructive"
          });
        }
      } else {
        console.log('FCM: Unable to get permission to notify. Status:', permission);
        if (permission === 'denied') {
             toast({
              title: "通知權限已被封鎖",
              description: "如要接收通知，請在瀏覽器設定中手動允許。",
              variant: "destructive"
          });
        }
      }
    } catch (error: any) {
      console.error('FCM Error: An error occurred while retrieving token.', error);
      // Log the specific error to help diagnose the issue.
      toast({
          title: "獲取推播權杖失敗",
          description: `${error.message} (${error.code || '未知錯誤碼'})`,
          variant: "destructive"
      });
    }
  }, [user, toast]);

  // Effect to trigger the process when a user is available.
  useEffect(() => {
    if (user) {
       requestPermissionAndToken();
    }
  }, [user, requestPermissionAndToken]);

  // Effect for handling incoming messages when the app is in the foreground.
  useEffect(() => {
    const initializeMessagingListener = async () => {
        const messagingInstance = await getMessagingInstance();
        if (messagingInstance) {
            const unsubscribe = onMessage(messagingInstance, (payload) => {
                console.log('FCM: Foreground message received.', payload);
                toast({
                    title: payload.notification?.title || '新通知',
                    description: payload.notification?.body,
                });
            });
            return () => unsubscribe();
        }
    };
    if (user) {
        initializeMessagingListener();
    }
  }, [toast, user]);
}
