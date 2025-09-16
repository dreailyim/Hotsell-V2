
'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/client-app';
import { useAuth } from './use-auth';
import type { Conversation } from '@/lib/types';

/**
 * A dedicated hook to calculate the total number of unread items
 * for the current user, including private messages and system notifications.
 * It establishes its own real-time listeners.
 */
export function useUnreadCount() {
  const { user } = useAuth();
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setTotalUnreadCount(0);
      return;
    }

    // --- Listener for Unread Private Messages ---
    const conversationsRef = collection(db, 'conversations');
    const convosQuery = query(conversationsRef, where('participantIds', 'array-contains', user.uid));
    
    const convosUnsubscribe = onSnapshot(convosQuery, (snapshot) => {
        const privateUnread = snapshot.docs.reduce((acc, doc) => {
            const convo = doc.data() as Conversation;
            // Important: Only count unread messages in conversations that are not hidden by the user.
            if (!convo.hiddenFor || !convo.hiddenFor.includes(user.uid)) {
                return acc + (convo.unreadCounts?.[user.uid] || 0);
            }
            return acc;
        }, 0);

        // Update total count by combining with the latest notifications count
        setTotalUnreadCount(currentTotal => {
            const currentNotifsCount = currentTotal - (currentTotal - (snapshot.metadata.fromCache ? 0 : privateUnread));
            return privateUnread + currentNotifsCount;
        });

    }, (error) => {
        console.error("Error listening to conversations for unread count:", error);
    });

    // --- Listener for Unread System Notifications ---
    const notificationsRef = collection(db, 'notifications');
    const notifsQuery = query(notificationsRef, where('userId', '==', user.uid), where('isRead', '==', false));

    const notifsUnsubscribe = onSnapshot(notifsQuery, (snapshot) => {
        const systemUnread = snapshot.size;

        // Update total count by combining with the latest conversations count
        setTotalUnreadCount(currentTotal => {
            const currentConvosCount = currentTotal - (currentTotal - (snapshot.metadata.fromCache ? 0 : systemUnread));
            return systemUnread + currentConvosCount;
        });
        
    }, (error) => {
        console.error("Error listening to notifications for unread count:", error);
    });


    // Cleanup both listeners on component unmount or when user changes
    return () => {
      convosUnsubscribe();
      notifsUnsubscribe();
    };
  }, [user]);

  return totalUnreadCount;
}
