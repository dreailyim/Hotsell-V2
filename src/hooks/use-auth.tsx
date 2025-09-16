
'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
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
import { doc, setDoc, getDoc, Timestamp, serverTimestamp, onSnapshot } from 'firebase/firestore';
import type { FullUser } from '@/lib/types';


interface AuthContextType {
  user: FullUser | null;
  loading: boolean;
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
  
  useEffect(() => {
    const unsubscribeFromAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        // When auth state changes, set up a real-time listener for the user's document.
        // This ensures the UI always has the latest user profile data.
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const unsubscribeFromFirestore = onSnapshot(userDocRef, (docSnap) => {
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
            // This case handles a new user (e.g., first-time Google sign-in)
            // where the Firestore doc might not exist yet. We create it.
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
            setDoc(userDocRef, {
                ...newUser,
                createdAt: serverTimestamp(),
            }).catch(e => console.error("Error creating user doc:", e));
          }
          setLoading(false);
        }, (error) => {
          console.error("Error with Firestore snapshot:", error);
          setLoading(false);
        });
        
        // Return a cleanup function to unsubscribe from the Firestore listener
        // when the auth state changes (e.g., user signs out).
        return () => unsubscribeFromFirestore();

      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => unsubscribeFromAuth();
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
    // onAuthStateChanged will handle setting the user state.
  };

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
    // onAuthStateChanged will handle the user state update.
  };
  
  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
    // onAuthStateChanged will handle creating/updating the user state and firestore doc.
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

  return (
    <AuthContext.Provider value={{ user, loading, signUp, signIn, signOut, signInWithGoogle, updateAuthProfile, sendPasswordReset }}>
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
