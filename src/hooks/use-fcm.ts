
'use client';

import { useEffect } from 'react';
import { getToken, onMessage } from "firebase/messaging";
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { useAuth } from './use-auth';
import { db, messaging } from '@/lib/firebase/client-app';
import { useToast } from './use-toast';

export function useFcm() {
  const { user } = useAuth();
  const { toast } = useToast();

  // Effect to request permission and get token
  useEffect(() => {
    if (typeof window === 'undefined' || !user) return;

    const requestPermissionAndToken = async () => {
      const messagingInstance = await messaging;
      if (!messagingInstance) {
        console.log("Firebase Messaging is not supported in this browser.");
        return;
      }
      
      // ❗️ VAPID key is hardcoded for reliability on the client-side.
      // This is a public key and is safe to be exposed.
      const vapidKey = "BEhu10ANaPARApTUl9QFzo1t3JxBuqC-kwI6oPDO9ON1vWlEErqsBA2-McoUDdpHeKbPvgk_rhI6TTpiPYGpkFg";

      try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          console.log('FCM: Notification permission granted.');
          const currentToken = await getToken(messagingInstance, { vapidKey });
          
          if (currentToken) {
            console.log('FCM: Token successfully retrieved:', currentToken);
            // Save token to Firestore
            const userDocRef = doc(db, 'users', user.uid);
            await updateDoc(userDocRef, {
              fcmTokens: arrayUnion(currentToken),
            });
            console.log('FCM: Token saved to Firestore.');
          } else {
            console.log('FCM Error: No registration token available. Request permission to generate one.');
          }
        } else {
          console.log('FCM: Unable to get permission to notify. Permission status:', permission);
        }
      } catch (error) {
        console.error('FCM Error: An error occurred while retrieving token.', error);
        toast({
            title: "獲取推播權杖失敗",
            description: "請在瀏覽器開發者工具的控制台中查看詳細錯誤。",
            variant: "destructive"
        });
      }
    };

    requestPermissionAndToken();
  }, [user, toast]);

  // Effect to handle foreground messages
  useEffect(() => {
     if (typeof window === 'undefined') return;
     
     const setupOnMessageListener = async () => {
        const messagingInstance = await messaging;
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
     
     setupOnMessageListener();

  }, [toast]);
}
