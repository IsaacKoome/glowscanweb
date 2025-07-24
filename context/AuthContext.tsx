'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  User as FirebaseUser,
  getAuth,
} from 'firebase/auth';
import {
  doc,
  onSnapshot,
  getDoc,
  setDoc,
} from 'firebase/firestore';
import { auth, firestore } from '@/lib/firebase';

type UserData = {
  uid: string;
  email: string | null;
  subscriptionPlan: 'free' | 'premium';
  createdAt: number;
  name?: string;
};

type AuthContextType = {
  user: UserData | null;
  firebaseUser: FirebaseUser | null;
  authLoading: boolean;
  refreshUser: () => void;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  firebaseUser: null,
  authLoading: true,
  refreshUser: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<UserData | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Track Firestore unsubscribe function
  let unsubscribeFirestore: (() => void) | null = null;

  const setupUserListener = (firebaseUser: FirebaseUser) => {
    const userDocRef = doc(firestore, 'users', firebaseUser.uid);

    // Cancel previous snapshot if any
    if (unsubscribeFirestore) {
      unsubscribeFirestore();
    }

    // Delay to give Firestore time to create the document (in case of race conditions)
    const delay = 500; // 0.5 seconds
    console.log('AuthContext: Waiting', delay, 'ms before setting up snapshot for UID:', firebaseUser.uid);

    setTimeout(() => {
      console.log('AuthContext: Setting up Firestore onSnapshot listener for UID:', firebaseUser.uid);

      unsubscribeFirestore = onSnapshot(userDocRef, async (docSnap) => {
        if (docSnap.exists()) {
          const userData = docSnap.data() as UserData;
          setUser(userData);
          console.log('AuthContext: 🔄 onSnapshot updated user data:', userData);
        } else {
          console.log(`AuthContext: ❗ User document for ${firebaseUser.uid} does not exist. Creating default...`);
          const newUserData: UserData = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            subscriptionPlan: 'free',
            createdAt: Date.now(),
          };
          await setDoc(userDocRef, newUserData, { merge: true });
          console.log('AuthContext: ✅ Default user document created.');
        }
        setAuthLoading(false);
      });
    }, delay);
  };

  // This method can be used manually after login to force-refresh user data
  const refreshUser = () => {
    const authInstance = getAuth();
    const currentUser = authInstance.currentUser;
    console.log('AuthContext: 🔄 refreshUser() called. Current Firebase user:', currentUser?.email);
    if (currentUser) {
      setupUserListener(currentUser);
    }
  };

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        console.log('AuthContext: ✅ onAuthStateChanged detected user:', firebaseUser.email);
        setFirebaseUser(firebaseUser);
        setupUserListener(firebaseUser);
      } else {
        console.log('AuthContext: 🚫 No user is signed in');
        setUser(null);
        setFirebaseUser(null);
        setAuthLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeFirestore) unsubscribeFirestore();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, firebaseUser, authLoading, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};
