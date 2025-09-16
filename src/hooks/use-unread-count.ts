
'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/client-app';
import { useAuth } from './use-auth';
import type { Conversation, SystemNotification } from '@/lib/types';

export function useUnreadCount() {
  const { user, loading } = useAuth();
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);

  useEffect(() => {
    if (loading || !user?.uid) {
      if (!loading) setTotalUnreadCount(0);
      return;
    }

    // --- Listener for Private Messages Unread Count ---
    const conversationsRef = collection(db, 'conversations');
    const convosQuery = query(conversationsRef, where('participantIds', 'array-contains', user.uid));
    
    const unsubscribeConvos = onSnapshot(convosQuery, (snapshot) => {
      let privateUnread = 0;
      snapshot.forEach(doc => {
        const convo = doc.data() as Conversation;
        // Check if the conversation is not hidden by the user
        if (!convo.hiddenFor || !convo.hiddenFor.includes(user.uid!)) {
            privateUnread += convo.unreadCounts?.[user.uid!] || 0;
        }
      });
      
      // Update total count using a function to get the latest state from other listeners
      setTotalUnreadCount(prev => {
          const currentSystemUnread = prev - (convoUnreadRef.current);
          convoUnreadRef.current = privateUnread;
          return privateUnread + currentSystemUnread;
      });
    });

    // --- Listener for System Notifications Unread Count ---
    const notificationsRef = collection(db, 'notifications');
    const notifsQuery = query(notificationsRef, where('userId', '==', user.uid), where('isRead', '==', false));

    const unsubscribeNotifs = onSnapshot(notifsQuery, (snapshot) => {
        const systemUnread = snapshot.size;

        setTotalUnreadCount(prev => {
            const currentPrivateUnread = prev - (notifUnreadRef.current);
            notifUnreadRef.current = systemUnread;
            return systemUnread + currentPrivateUnread;
        });
    });

    // Refs to store the latest counts from each listener to prevent race conditions
    const convoUnreadRef = { current: 0 };
    const notifUnreadRef = { current: 0 };

    return () => {
      unsubscribeConvos();
      unsubscribeNotifs();
    };
  }, [user?.uid, loading]);

  return totalUnreadCount;
}
