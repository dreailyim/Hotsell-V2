'use client';

import { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/client-app';
import { useAuth } from './use-auth';
import type { Conversation, SystemNotification } from '@/lib/types';

export function useUnreadCount() {
  const { user, loading } = useAuth();
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);

  // Refs to store the latest counts from each listener to prevent race conditions
  const convoUnreadRef = useRef(0);
  const notifUnreadRef = useRef(0);

  useEffect(() => {
    if (loading || !user?.uid) {
      if (!loading) {
        setTotalUnreadCount(0);
        convoUnreadRef.current = 0;
        notifUnreadRef.current = 0;
      }
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
      
      convoUnreadRef.current = privateUnread;
      setTotalUnreadCount(convoUnreadRef.current + notifUnreadRef.current);
    });

    // --- Listener for System Notifications Unread Count ---
    const notificationsRef = collection(db, 'notifications');
    const notifsQuery = query(notificationsRef, where('userId', '==', user.uid), where('isRead', '==', false));

    const unsubscribeNotifs = onSnapshot(notifsQuery, (snapshot) => {
        const systemUnread = snapshot.size;
        notifUnreadRef.current = systemUnread;
        setTotalUnreadCount(convoUnreadRef.current + notifUnreadRef.current);
    });

    return () => {
      unsubscribeConvos();
      unsubscribeNotifs();
    };
  }, [user?.uid, loading]);

  return totalUnreadCount;
}
