
'use client';

import { useEffect, useCallback } from 'react';
import { getToken, onMessage } from "firebase/messaging";
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { useAuth } from './use-auth';
import { db, getMessagingInstance } from '@/lib/firebase/client-app';
import { useToast } from './use-toast';

export function useFcm() {
  const { user } = useAuth();
  const { toast } = useToast();

  const requestPermissionAndToken = useCallback(async () => {
    // Ensure user is logged in before proceeding
    if (!user) {
      console.log("FCM: User not logged in. Aborting.");
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        console.log('FCM: Notification permission granted.');
        
        const messaging = await getMessagingInstance();
        if (!messaging) {
          console.log("FCM: Firebase Messaging is not supported in this browser.");
          return;
        }
        
        const vapidKey = "BEhu10ANaPARApTUl9QFzo1t3JxBuqC-kwI6oPDO9ON1vWlEErqsBA2-McoUDdpHeKbPvgk_rhI6TTpiPYGpkFg";
        const currentToken = await getToken(messaging, { vapidKey: vapidKey });
        
        if (currentToken) {
          console.log('FCM: Token successfully retrieved:', currentToken);
          const userDocRef = doc(db, 'users', user.uid);
          await updateDoc(userDocRef, {
            fcmTokens: arrayUnion(currentToken),
          });
          console.log('FCM: Token saved to Firestore.');
        } else {
          console.log('FCM Error: No registration token available. Request permission to generate one.');
          toast({
              title: "無法獲取推播權杖",
              description: "請確認瀏覽器設定並重試。",
              variant: "destructive"
          });
        }
      } else {
        console.log('FCM: Unable to get permission to notify. Permission status:', permission);
        // Optionally inform user if permission was denied.
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
          description: "請在瀏覽器開發者工具的控制台中查看詳細錯誤。",
          variant: "destructive"
      });
    }
  }, [user, toast]);


  useEffect(() => {
    if (typeof window !== 'undefined' && user) {
       // Request permission when user is available
       requestPermissionAndToken();
    }
  }, [user, requestPermissionAndToken]);

  useEffect(() => {
     if (typeof window === 'undefined') return;
     
     const setupOnMessageListener = async () => {
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
     }
     
     // Set up the listener only when a user is logged in.
     if (user) {
        setupOnMessageListener();
     }

  }, [toast, user]);
}
