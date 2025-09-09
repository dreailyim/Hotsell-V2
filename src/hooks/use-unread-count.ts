
'use client';

import { useState, useEffect } from 'react';
import { doc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/client-app';
import { useAuth } from './use-auth';

export function useUnreadCount() {
  const { user, loading } = useAuth();
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);

  useEffect(() => {
    if (loading || !user?.uid) {
      if (!loading) setTotalUnreadCount(0);
      return;
    }
    
    // This is more robust. It listens directly to the user document,
    // which is updated by cloud functions and is the single source of truth.
    const userDocRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const count = docSnap.data()?.totalUnreadCount || 0;
        setTotalUnreadCount(count);
      }
    });

    return () => unsubscribe();
  }, [user?.uid, loading]);

  return totalUnreadCount;
}
