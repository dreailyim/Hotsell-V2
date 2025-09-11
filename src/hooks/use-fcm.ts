
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

    const messaging = await getMessagingInstance();
    if (!messaging) {
      console.error("FCM Error: Messaging is not supported in this browser.");
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        console.log('FCM: Notification permission granted.');
        
        // The service worker is expected to be at the root, served from /public
        const swRegistration = await navigator.serviceWorker.ready;
        console.log('FCM: Service worker is ready.');

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
          console.error('FCM Error: No registration token available. This often means the service worker is not correctly configured or the VAPID key is invalid.');
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
      toast({
        title: "獲取推播權杖失敗",
        description: `${error.message} (${error.code || '未知錯誤碼'})`,
        variant: "destructive"
      });
    }
  }, [user, toast]);

  useEffect(() => {
    if (user) {
      // Small delay to ensure the service worker has a chance to register
      setTimeout(() => {
        requestPermissionAndToken();
      }, 1000);
    }
  }, [user, requestPermissionAndToken]);

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
