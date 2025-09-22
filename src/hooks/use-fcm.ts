
'use client';

import { useEffect, useCallback } from 'react';
import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { useAuth } from './use-auth';
import { db, app } from '@/lib/firebase/client-app';
import { useToast } from './use-toast';


export function useFcm() {
  const { user } = useAuth();
  const { toast } = useToast();

  const requestPermissionAndToken = useCallback(async () => {
    if (!user) {
      return;
    }
    
    const supported = await isSupported();
    if (!supported) {
      return;
    }
    
    const messaging = getMessaging(app);

    try {
      if ('serviceWorker' in navigator) {
        // We need to wait for the service worker to be ready
        await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      } else {
        return;
      }
      
      const permission = await Notification.requestPermission();

      if (permission !== 'granted') {
        if (permission === 'denied') {
          toast({
            title: "通知權限已被封鎖",
            description: "如要接收通知，請在瀏覽器設定中手動允許。",
            variant: "destructive"
          });
        }
        return;
      }
      
      const currentToken = await getToken(messaging);

      if (currentToken) {
          const userDocRef = doc(db, 'users', user.uid);
          await updateDoc(userDocRef, {
              fcmTokens: arrayUnion(currentToken),
          });
      } else {
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
      requestPermissionAndToken();
    }
  }, [user, requestPermissionAndToken]);

  // Effect for handling foreground messages.
  useEffect(() => {
    if (user) {
      const setupListener = async () => {
        const supported = await isSupported();
        if (supported) {
          const messagingInstance = getMessaging(app);
          const unsubscribe = onMessage(messagingInstance, (payload) => {
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
