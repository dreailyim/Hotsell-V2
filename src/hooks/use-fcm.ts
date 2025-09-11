
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
    if (!user) {
      console.log("FCM: Aborted. User not logged in.");
      return;
    }
    
    // Get messaging instance safely
    const messaging = await getMessagingInstance();
    if (!messaging) {
      console.log("FCM: Aborted. Messaging not supported in this browser.");
      return;
    }

    try {
      console.log('FCM: Service worker is ready. Requesting permission...');
      const permission = await Notification.requestPermission();

      if (permission !== 'granted') {
        console.log('FCM: Notification permission not granted. Status:', permission);
        // Do not toast if user just dismissed it. Only if it's denied.
        if (permission === 'denied') {
          toast({
            title: "通知權限已被封鎖",
            description: "如要接收通知，請在瀏覽器設定中手動允許。",
            variant: "destructive"
          });
        }
        return;
      }
      
      console.log('FCM: Notification permission granted. Requesting token...');
            
      // Get token
      const currentToken = await getToken(messaging, {
          vapidKey: VAPID_KEY,
          // The service worker is now loaded from /firebase-messaging-sw.js
          // so we don't need to specify scope.
      });

      if (currentToken) {
          console.log('FCM: Token successfully retrieved:', currentToken);
          const userDocRef = doc(db, 'users', user.uid);
          // This ensures we don't write the same token multiple times.
          await updateDoc(userDocRef, {
              fcmTokens: arrayUnion(currentToken),
          });
          console.log('FCM: Token saved to Firestore.');
      } else {
          console.error('FCM Error: No registration token available. This often means the VAPID key is invalid or there is a configuration issue.');
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

  // Effect to request permission and token when user is available.
  useEffect(() => {
    if (user) {
      // Give the app a moment to stabilize before requesting permission
      const timer = setTimeout(() => {
         requestPermissionAndToken();
      }, 3000); 
      return () => clearTimeout(timer);
    }
  }, [user, requestPermissionAndToken]);

  // Effect for handling foreground messages.
  useEffect(() => {
    if (user) {
      const setupListener = async () => {
        const messagingInstance = await getMessagingInstance();
        if (messagingInstance) {
          const unsubscribe = onMessage(messagingInstance, (payload) => {
            console.log('FCM: Foreground message received.', payload);
            toast({
              title: payload.notification?.title || '新通知',
              description: payload.notification?.body,
            });
          });
          return unsubscribe;
        }
      };

      const unsubscribePromise = setupListener();
      
      return () => {
        unsubscribePromise.then(unsubscribe => {
          if (unsubscribe) {
            unsubscribe();
          }
        });
      };
    }
  }, [toast, user]);
}
