
'use client';

import { useEffect } from 'react';
import { getToken, onMessage } from "firebase/messaging";
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { useAuth } from './use-auth';
import { db, getMessagingInstance } from '@/lib/firebase/client-app';
import { useToast } from './use-toast';

export function useFcm() {
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window === 'undefined' || !user) return;

    const requestPermissionAndToken = async () => {
      const messaging = await getMessagingInstance();
      if (!messaging) {
        console.log("FCM: Firebase Messaging is not supported in this browser.");
        return;
      }
      
      const vapidKey = "BEhu10ANaPARApTUl9QFzo1t3JxBuqC-kwI6oPDO9ON1vWlEErqsBA2-McoUDdpHeKbPvgk_rhI6TTpiPYGpkFg";

      try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          console.log('FCM: Notification permission granted.');
          const currentToken = await getToken(messaging, { vapidKey });
          
          if (currentToken) {
            console.log('FCM: Token successfully retrieved:', currentToken);
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

    // Delay the call slightly to ensure all browser services are ready
    const timer = setTimeout(() => {
        requestPermissionAndToken();
    }, 1500);

    return () => clearTimeout(timer);

  }, [user, toast]);

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
     
     setupOnMessageListener();

  }, [toast]);
}
