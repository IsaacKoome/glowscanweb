"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User as FirebaseUser, onAuthStateChanged, signOut as firebaseSignOut, signInAnonymously } from 'firebase/auth';
import { getFirestore, doc, setDoc, Firestore, DocumentReference, onSnapshot } from 'firebase/firestore';
import { FirebaseApp } from 'firebase/app';
import { auth } from '../lib/firebase';
import { useRouter } from 'next/navigation';

// Firestore instance
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
  [key: string]: any; // catch-all for extra Firestore fields
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

    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();

        const updatedUserData: UserData = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          ...data, // Spread first
          subscriptionPlan: data?.subscriptionPlan || 'free',
          geminiCountToday: data?.geminiCountToday ?? 0,
          gpt4oCountToday: data?.gpt4oCountToday ?? 0,
          lastAnalysisDate: data?.lastAnalysisDate ?? new Date().toISOString().split('T')[0],
          paystackCustomerId: data?.paystackCustomerId ?? undefined,
          paystackSubscriptionStatus: data?.paystackSubscriptionStatus ?? undefined,
          paystackLastTxRef: data?.paystackLastTxRef ?? undefined,
        };

        setUser(updatedUserData);
        console.log(`AuthContext: onSnapshot updated user data: ${updatedUserData.subscriptionPlan}`);
      } else {
        console.log(`AuthContext: User document for ${firebaseUser.uid} does not exist. Creating...`);
        const newUserData: UserData = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          subscriptionPlan: 'free',
          geminiCountToday: 0,
          gpt4oCountToday: 0,
          lastAnalysisDate: new Date().toISOString().split('T')[0],
        };

        setDoc(userDocRef, newUserData, { merge: true })
          .then(() => {
            console.log(`Firestore document created for new user: ${firebaseUser.uid}`);
            setUser(newUserData);
          })
          .catch((error) => {
            console.error("Error creating user document:", error);
            setUser(newUserData);
          });
      }

      setLoading(false);
    }, (error) => {
      console.error("Error listening to user document:", error);
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
          setupUserListener(firebaseUser);
        } else {
          setUser(null);
          setLoading(false);
        }
      });
    } else {
      setUser(null);
      setLoading(false);
    }
  }, [setupUserListener, user]);

  useEffect(() => {
    console.log("AuthContext: useEffect running, setting up onAuthStateChanged listener.");
    let unsubscribeFirestore: () => void = () => {};

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      unsubscribeFirestore();

      if (firebaseUser) {
        console.log("AuthContext: onAuthStateChanged fired. User logged in:", firebaseUser.uid);
        unsubscribeFirestore = setupUserListener(firebaseUser);
      } else {
        console.log("AuthContext: No user logged in. Attempting anonymous sign-in.");
        try {
          await signInAnonymously(auth);
        } catch (error) {
          console.error("Error during anonymous sign-in:", error);
          setUser(null);
          setLoading(false);
        }
      }
    });

    return () => {
      console.log("AuthContext: Cleaning up listeners.");
      unsubscribeAuth();
      unsubscribeFirestore();
    };
  }, [setupUserListener]);

  const logout = async () => {
    try {
      await firebaseSignOut(auth);
      console.log("User signed out successfully.");
      router.push('/login');
    } catch (error) {
      console.error("Error signing out:", error);
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
