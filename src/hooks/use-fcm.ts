
'use client';

import { useEffect, useCallback } from 'react';
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { useAuth } from './use-auth';
import { db, app } from '@/lib/firebase/client-app';
import { useToast } from './use-toast';

export function useFcm() {
  const { user } = useAuth();
  const { toast } = useToast();

  const requestPermissionAndToken = useCallback(async () => {
    if (!user) {
      console.log("FCM: User not logged in. Aborting.");
      return;
    }

    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
        console.log("FCM: Service Worker not supported. Aborting.");
        return;
    }

    try {
      const messaging = getMessaging(app);
      
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        console.log('FCM: Notification permission granted.');
        
        const vapidKey = "BEhu10ANaPARApTUl9QFzo1t3JxBuqC-kwI6oPDO9ON1vWlEErqsBA2-McoUDdpHeKbPvgk_rhI6TTpiPYGpkFg";
        const currentToken = await getToken(messaging, { 
            vapidKey: vapidKey,
            serviceWorkerRegistration: await navigator.serviceWorker.ready, // Use the active service worker
        });
        
        if (currentToken) {
          console.log('FCM: Token successfully retrieved:', currentToken);
          const userDocRef = doc(db, 'users', user.uid);
          await updateDoc(userDocRef, {
            fcmTokens: arrayUnion(currentToken),
          });
          console.log('FCM: Token saved to Firestore.');
        } else {
          console.error('FCM Error: No registration token available. Request permission to generate one.');
          toast({
              title: "無法獲取推播權杖",
              description: "未能生成註冊權杖，請檢查 Service Worker 狀態。",
              variant: "destructive"
          });
        }
      } else {
        console.log('FCM: Unable to get permission to notify. Permission status:', permission);
        if (permission === 'denied') {
             toast({
              title: "通知權限已被封鎖",
              description: "如要接收通知，請在瀏覽器設定中手動允許。",
              variant: "destructive"
          });
        }
      }
    } catch (error) {
      console.error('FCM Error: An error occurred while retrieving token.', error);
      toast({
          title: "獲取推播權杖失敗",
          description: `請在瀏覽器開發者工具的控制台中查看詳細錯誤: ${error}`,
          variant: "destructive"
      });
    }
  }, [user, toast]);


  useEffect(() => {
    if (user) {
       requestPermissionAndToken();
    }
  }, [user, requestPermissionAndToken]);

  useEffect(() => {
     if (typeof window === 'undefined') return;
     
     const messagingInstance = getMessaging(app);
     const unsubscribe = onMessage(messagingInstance, (payload) => {
          console.log('FCM: Foreground message received.', payload);
          toast({
            title: payload.notification?.title || '新通知',
            description: payload.notification?.body,
          });
      });
      return () => unsubscribe();

  }, [toast]);
}
