'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from 'react';
import {
  onAuthStateChanged,
  User,
  signOut as firebaseSignOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { auth, db } from '@/lib/firebase/client-app';
import { doc, setDoc, getDoc, Timestamp, serverTimestamp, onSnapshot, collection, query, where } from 'firebase/firestore';
import type { FullUser, Conversation } from '@/lib/types';


interface AuthContextType {
  user: FullUser | null;
  loading: boolean;
  totalUnreadCount: number; // Add this to the context
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  updateAuthProfile: (profile: { displayName?: string; photoURL?: string | null }) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<FullUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);

  // Unread count logic moved here
  const convoUnreadRef = useRef(0);
  const notifUnreadRef = useRef(0);

  useEffect(() => {
    const authUnsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const firestoreUnsubscribe = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            const firestoreData = docSnap.data();
            const fullUser: FullUser = {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: firestoreData.displayName || firebaseUser.displayName,
              photoURL: firestoreData.photoURL || firebaseUser.photoURL,
              aboutMe: firestoreData.aboutMe || '',
              createdAt: (firestoreData.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
              averageRating: firestoreData.averageRating || 0,
              reviewCount: firestoreData.reviewCount || 0,
            };
            setUser(fullUser);
          } else {
            const newUser: FullUser = {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName,
              photoURL: firebaseUser.photoURL,
              aboutMe: '',
              createdAt: new Date().toISOString(),
              averageRating: 0,
              reviewCount: 0,
            };
            setUser(newUser);
            setDoc(userDocRef, { ...newUser, createdAt: serverTimestamp() })
              .catch(e => console.error("Error creating user doc:", e));
          }
          setLoading(false);
        }, (error) => {
          console.error("Error with Firestore snapshot:", error);
          setLoading(false);
        });

        // --- Start unread count listeners ---
        const conversationsRef = collection(db, 'conversations');
        const convosQuery = query(conversationsRef, where('participantIds', 'array-contains', firebaseUser.uid));
        const convosUnsubscribe = onSnapshot(convosQuery, (snapshot) => {
          let privateUnread = 0;
          snapshot.forEach(doc => {
            const convo = doc.data() as Conversation;
            if (!convo.hiddenFor || !convo.hiddenFor.includes(firebaseUser.uid)) {
              privateUnread += convo.unreadCounts?.[firebaseUser.uid] || 0;
            }
          });
          convoUnreadRef.current = privateUnread;
          setTotalUnreadCount(convoUnreadRef.current + notifUnreadRef.current);
        });

        const notificationsRef = collection(db, 'notifications');
        const notifsQuery = query(notificationsRef, where('userId', '==', firebaseUser.uid), where('isRead', '==', false));
        const notifsUnsubscribe = onSnapshot(notifsQuery, (snapshot) => {
          notifUnreadRef.current = snapshot.size;
          setTotalUnreadCount(convoUnreadRef.current + notifUnreadRef.current);
        });
        // --- End unread count listeners ---

        return () => {
          firestoreUnsubscribe();
          convosUnsubscribe();
          notifsUnsubscribe();
        };

      } else {
        setUser(null);
        setLoading(false);
        setTotalUnreadCount(0); // Reset on logout
        convoUnreadRef.current = 0;
        notifUnreadRef.current = 0;
      }
    });

    return () => authUnsubscribe();
  }, []);
  
  const signUp = async (email: string, password: string, displayName: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;
    await updateProfile(firebaseUser, { displayName: displayName || '新用戶' });
    
    const userDocRef = doc(db, 'users', firebaseUser.uid);
    await setDoc(userDocRef, {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName,
        photoURL: firebaseUser.photoURL,
        createdAt: serverTimestamp(),
        aboutMe: '',
        averageRating: 0,
        reviewCount: 0,
    });
  };

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };
  
  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };
  
  const updateAuthProfile = async (profile: { displayName?: string; photoURL?: string | null; }) => {
    if (!auth.currentUser) {
      throw new Error('您必須登入才能更新個人資料。');
    }
    await updateProfile(auth.currentUser, profile);
  };
  
  const sendPasswordReset = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  }

  const value = {
      user,
      loading,
      totalUnreadCount,
      signUp,
      signIn,
      signOut,
      signInWithGoogle,
      updateAuthProfile,
      sendPasswordReset,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
