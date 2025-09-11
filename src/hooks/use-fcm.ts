
'use client';

import { useEffect, useCallback } from 'react';
import { getToken, onMessage } from "firebase/messaging";
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { useAuth } from './use-auth';
import { db } from '@/lib/firebase/client-app';
import { useToast } from './use-toast';
import { getMessagingInstance } from '@/lib/firebase/client-app';

// THE ONLY CORRECT VAPID KEY PROVIDED BY THE USER.
const VAPID_KEY = "BEhu10ANaPARApTUl9QFzo1t3JxBuqC-kwI6oPDO9ON1vWlEErqsBA2-McoUDdpHeKbPvgk_rhI6TTpiPYGpkFg";

export function useFcm() {
  const { user } = useAuth();
  const { toast } = useToast();

  const requestPermissionAndToken = useCallback(async () => {
    if (!user || typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      console.log("FCM: Pre-conditions not met (no user, no window, or no serviceWorker). Aborting.");
      return;
    }

    try {
      const messaging = await getMessagingInstance();
      if (!messaging) {
        console.log("FCM: Messaging is not supported in this browser.");
        return;
      }
      
      console.log('FCM: Waiting for Service Worker to be ready...');
      const swRegistration = await navigator.serviceWorker.ready;
      console.log('FCM: Service Worker is ready.');

      // 1. Request permission.
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.log('FCM: Notification permission not granted. Status:', permission);
        if (permission === 'denied') {
            toast({
                title: "通知權限已被封鎖",
                description: "如要接收通知，請在瀏覽器設定中手動允許。",
                variant: "destructive"
            });
        }
        return;
      }
      
      console.log('FCM: Notification permission granted.');
      console.log('FCM: Requesting token with VAPID key...');
            
      // 2. Get the token with the correct VAPID key.
      const currentToken = await getToken(messaging, {
          vapidKey: VAPID_KEY,
          serviceWorkerRegistration: swRegistration,
      });

      if (currentToken) {
          console.log('FCM: Token successfully retrieved:', currentToken);
          const userDocRef = doc(db, 'users', user.uid);
          await updateDoc(userDocRef, {
              fcmTokens: arrayUnion(currentToken),
          });
          console.log('FCM: Token saved to Firestore.');
      } else {
          console.error('FCM Error: No registration token available. This often means the VAPID key is invalid, the service worker is not registered correctly, or there is a configuration issue.');
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

  // Effect to request permission and token when user is available.
  useEffect(() => {
    if (user) {
      requestPermissionAndToken();
    }
  }, [user, requestPermissionAndToken]);

  // Effect for handling foreground messages.
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
