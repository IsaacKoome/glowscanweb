"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User as FirebaseUser, onAuthStateChanged, signOut as firebaseSignOut, signInAnonymously } from 'firebase/auth';
import { getFirestore, doc, setDoc, Firestore, DocumentReference, onSnapshot } from 'firebase/firestore';
import { FirebaseApp } from 'firebase/app';
import { auth } from '../lib/firebase';
import { useRouter } from 'next/navigation';

const db: Firestore = getFirestore(auth.app as FirebaseApp);

interface UserData {
  uid: string;
  email: string | null;
  subscriptionPlan: string;
  geminiCountToday: number;
  gpt4oCountToday: number;
  lastAnalysisDate: string;
  paystackCustomerId?: string;
  paystackSubscriptionStatus?: string;
  paystackLastTxRef?: string;
  paystackSubscriptionCode?: string;
}

interface AuthContextType {
  user: UserData | null;
  loading: boolean;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const setupUserListener = useCallback((firebaseUser: FirebaseUser) => {
    if (!firebaseUser) return () => {};

    const userDocRef: DocumentReference = doc(db, 'users', firebaseUser.uid);
    console.log(`AuthContext: Setting up onSnapshot listener for user ${firebaseUser.uid}`);

    const unsubscribe = onSnapshot(userDocRef, async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const updatedUser: UserData = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          subscriptionPlan: data.subscriptionPlan || 'free',
          geminiCountToday: data.geminiCountToday || 0,
          gpt4oCountToday: data.gpt4oCountToday || 0,
          lastAnalysisDate: data.lastAnalysisDate || new Date().toISOString().split('T')[0],
          paystackCustomerId: data.paystackCustomerId || undefined,
          paystackSubscriptionStatus: data.paystackSubscriptionStatus || undefined,
          paystackLastTxRef: data.paystackLastTxRef || undefined,
          paystackSubscriptionCode: data.paystackSubscriptionCode || undefined,
          ...data,
        };
        setUser(updatedUser);
        console.log(`AuthContext: onSnapshot updated user data: ${updatedUser.subscriptionPlan}`);
      } else {
        console.log(`AuthContext: User document missing. Creating default for ${firebaseUser.uid}`);
        const newUserData: UserData = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          subscriptionPlan: 'free',
          geminiCountToday: 0,
          gpt4oCountToday: 0,
          lastAnalysisDate: new Date().toISOString().split('T')[0],
        };
        await setDoc(userDocRef, newUserData, { merge: true });
        setUser(newUserData);
      }
      setLoading(false);
    }, (err) => {
      console.error("AuthContext: onSnapshot error:", err);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const refreshUser = useCallback(async () => {
    console.log("AuthContext: refreshUser called. Re-evaluating listener.");
    if (auth.currentUser) {
      if (user === null) setLoading(true);
      onAuthStateChanged(auth, (firebaseUser) => {
        if (firebaseUser) {
          setupUserListener(firebaseUser); // reconnect listener
        } else {
          setUser(null);
          setLoading(false);
        }
      });
    } else {
      console.log("AuthContext: No current user to refresh.");
      setUser(null);
      setLoading(false);
    }
  }, [setupUserListener, user]);

  useEffect(() => {
    console.log("AuthContext: useEffect running, setting up onAuthStateChanged listener.");
    let unsubscribeFirestore: () => void = () => {};

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      unsubscribeFirestore(); // cleanup previous listener

      if (firebaseUser) {
        console.log("AuthContext: onAuthStateChanged fired. User logged in:", firebaseUser.uid);
        unsubscribeFirestore = setupUserListener(firebaseUser);
      } else {
        console.log("AuthContext: No user logged in. Attempting anonymous sign-in.");
        try {
          await signInAnonymously(auth);
        } catch (err) {
          console.error("Error during anonymous sign-in:", err);
          setUser(null);
          setLoading(false);
        }
      }
    });

    return () => {
      console.log("AuthContext: Cleanup");
      unsubscribeAuth();
      unsubscribeFirestore();
    };
  }, [setupUserListener]);

  const logout = async () => {
    try {
      await firebaseSignOut(auth);
      console.log("User signed out.");
      router.push('/login');
    } catch (err) {
      console.error("Error during logout:", err);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
