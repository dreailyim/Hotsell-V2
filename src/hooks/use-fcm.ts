
'use client';

import { useEffect, useState } from 'react';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { useAuth } from './use-auth';
import { db } from '@/lib/firebase/client-app';
import { useToast } from './use-toast';
import { getApp, getApps, initializeApp } from 'firebase/app';


// This function ensures Firebase is initialized before we try to get messaging.
// It also lazily imports messaging to avoid errors in environments where it's not supported.
async function getFirebaseMessaging() {
    // Standard Firebase initialization check
    const app = !getApps().length ? initializeApp({}) : getApp();
    
    // Check if messaging is supported in the current browser environment.
    const { isSupported } = await import('firebase/messaging');
    if (typeof window !== 'undefined' && (await isSupported())) {
        return getMessaging(app);
    }
    return null;
}


export function useFcm() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [fcmToken, setFcmToken] = useState<string | null>(null);

  // Effect to request permission and get token
  useEffect(() => {
    // Guard against running on server or when no user is logged in.
    if (typeof window === 'undefined' || !user) return;

    const requestPermissionAndToken = async () => {
      const messaging = await getFirebaseMessaging();
      if (!messaging) {
        console.log("Firebase Messaging is not supported in this browser.");
        return;
      }
      
      // ❗️ IMPORTANT: Replace the placeholder value below with your own VAPID key from the Firebase console.
      // It is a public key and is safe to be hardcoded here.
      const vapidKey = "BEhu10ANaPARApTUl9QFzo1t3JxBuqC-kwI6oPDO9ON1vWlEErqsBA2-McoUDdpHeKbPvgk_rhI6TTpiPYGpkFg";

      try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          console.log('Notification permission granted.');
          const currentToken = await getToken(messaging, { vapidKey });
          
          if (currentToken) {
            console.log('FCM Token:', currentToken);
            setFcmToken(currentToken);
            // Save token to Firestore
            const userDocRef = doc(db, 'users', user.uid);
            await updateDoc(userDocRef, {
              fcmTokens: arrayUnion(currentToken),
            });
          } else {
            console.log('No registration token available. Request permission to generate one.');
          }
        } else {
          console.log('Unable to get permission to notify.');
        }
      } catch (error) {
        console.error('An error occurred while retrieving token. ', error);
        toast({
            title: "獲取推播權杖失敗",
            description: "請檢查您的 VAPID Key 是否正確，或查看控制台以獲取詳細資訊。",
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
        const messaging = await getFirebaseMessaging();
        if (messaging) {
           const unsubscribe = onMessage(messaging, (payload) => {
                console.log('Foreground message received.', payload);
                toast({
                  title: payload.notification?.title,
                  description: payload.notification?.body,
                });
            });
            return () => unsubscribe();
        }
     }
     
     setupOnMessageListener();

  }, [toast]);

  return { fcmToken };
}
