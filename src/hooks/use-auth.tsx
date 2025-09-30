
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
  sendEmailVerification,
  reauthenticateWithCredential,
  EmailAuthProvider,
  deleteUser,
} from 'firebase/auth';
import { auth, db } from '@/lib/firebase/client-app';
import { doc, setDoc, getDoc, Timestamp, serverTimestamp, onSnapshot } from 'firebase/firestore';
import type { FullUser } from '@/lib/types';
import { useFcm } from './use-fcm';


interface AuthContextType {
  user: FullUser | null;
  loading: boolean;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  updateAuthProfile: (profile: { displayName?: string; photoURL?: string | null; phoneNumber?: string | null }) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<FullUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        // Set up a real-time listener for the user document
        const firestoreUnsubscribe = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            const firestoreData = docSnap.data();
            
            let createdAt = '';
            if (firestoreData.createdAt instanceof Timestamp) {
                createdAt = firestoreData.createdAt.toDate().toISOString();
            } else if (typeof firestoreData.createdAt === 'string') {
                createdAt = firestoreData.createdAt;
            }

            // Combine auth data with Firestore data
            const fullUser: FullUser = {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: firestoreData.displayName || firebaseUser.displayName,
              photoURL: firestoreData.photoURL || firebaseUser.photoURL,
              phoneNumber: firestoreData.phoneNumber || firebaseUser.phoneNumber,
              aboutMe: firestoreData.aboutMe || '',
              city: firestoreData.city || '',
              createdAt: createdAt,
              averageRating: firestoreData.averageRating || 0,
              reviewCount: firestoreData.reviewCount || 0,
            };
            setUser(fullUser);
          } else {
            // If user doc doesn't exist, create it
            const newUser: FullUser = {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName,
              photoURL: firebaseUser.photoURL,
              phoneNumber: firebaseUser.phoneNumber,
              aboutMe: '',
              city: '',
              createdAt: new Date().toISOString(), // Use current date as a fallback for initial state
              averageRating: 0,
              reviewCount: 0,
            };
            setUser(newUser);
            // Create the document in Firestore
            setDoc(userDocRef, {
                displayName: newUser.displayName,
                email: newUser.email,
                photoURL: newUser.photoURL,
                phoneNumber: newUser.phoneNumber,
                uid: newUser.uid,
                createdAt: serverTimestamp(), // Use server timestamp for accuracy
                aboutMe: '',
                city: '',
                averageRating: 0,
                reviewCount: 0,
            }).catch(e => console.error("Error creating user doc:", e));
          }
          setLoading(false);
        }, (error) => {
            console.error("Error with Firestore snapshot:", error);
            setUser(null);
            setLoading(false);
        });

        return () => firestoreUnsubscribe(); // Cleanup Firestore listener
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => unsubscribe(); // Cleanup auth state listener
  }, []);
  
  const signUp = async (email: string, password: string, displayName: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;
    
    // Send email verification
    await sendEmailVerification(firebaseUser);

    // Update the user's profile in Firebase Auth
    await updateProfile(firebaseUser, { displayName: displayName || '新用戶' });
    
    // Create a corresponding document in the 'users' collection
    const userDocRef = doc(db, 'users', firebaseUser.uid);
    await setDoc(userDocRef, {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName, // Use the updated display name
        photoURL: firebaseUser.photoURL,
        createdAt: serverTimestamp(),
        aboutMe: '',
        city: '',
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
    // The onAuthStateChanged listener will handle user creation/update in Firestore.
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };
  
  const updateAuthProfile = async (profile: { displayName?: string; photoURL?: string | null; phoneNumber?: string | null }) => {
    if (!auth.currentUser) {
      throw new Error('您必須登入才能更新個人資料。');
    }
    // This updates the profile in Firebase Authentication service
    await updateProfile(auth.currentUser, profile);
    // The onSnapshot listener in this hook will automatically pick up changes if they affect the user object
  };
  
  const sendPasswordReset = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const deleteAccount = async (password: string) => {
    if (!auth.currentUser || !auth.currentUser.email) {
      throw new Error('找不到有效的用戶或電郵地址。');
    }

    // 1. Re-authenticate the user
    const credential = EmailAuthProvider.credential(auth.currentUser.email, password);
    await reauthenticateWithCredential(auth.currentUser, credential);
    
    // 2. Delete the user from Firebase Authentication
    // This will trigger the `onUserDelete` Cloud Function to clean up Firestore data.
    await deleteUser(auth.currentUser);
  };

  const value = {
      user,
      loading,
      signUp,
      signIn,
      signOut,
      signInWithGoogle,
      updateAuthProfile,
      sendPasswordReset,
      deleteAccount,
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

    

    