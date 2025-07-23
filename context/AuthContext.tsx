// context/AuthContext.tsx
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
  paystackSubscriptionCode?: string;
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
  const [loading, setLoading] = useState(true); // Start as true
  const router = useRouter();

  const setupUserListener = useCallback((firebaseUser: FirebaseUser) => {
    if (!firebaseUser) return () => {};

    const userDocRef: DocumentReference = doc(db, 'users', firebaseUser.uid);
    console.log(`AuthContext: Setting up onSnapshot listener for user ${firebaseUser.uid}`);

    // Added safety delay for onSnapshot (Step 4 from ChatGPT)
    let unsubscribe: () => void;
    const timeoutId = setTimeout(() => {
      unsubscribe = onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();

          const updatedUserData: UserData = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            ...data,
            subscriptionPlan: data?.subscriptionPlan || 'free',
            geminiCountToday: data?.geminiCountToday ?? 0,
            gpt4oCountToday: data?.gpt4oCountToday ?? 0,
            lastAnalysisDate: data?.lastAnalysisDate ?? new Date().toISOString().split('T')[0],
            paystackCustomerId: data?.paystackCustomerId ?? undefined,
            paystackSubscriptionStatus: data?.paystackSubscriptionStatus ?? undefined,
            paystackLastTxRef: data?.paystackLastTxRef ?? undefined,
            paystackSubscriptionCode: data?.paystackSubscriptionCode ?? undefined,
          };

          setUser(updatedUserData);
          console.log(`AuthContext: onSnapshot updated user data for ${firebaseUser.email || firebaseUser.uid}. Subscription: ${updatedUserData.subscriptionPlan}`);
          console.log(`AuthContext: paystackSubscriptionCode read from Firestore: ${updatedUserData.paystackSubscriptionCode}`);
        } else {
          console.log(`AuthContext: User document for ${firebaseUser.uid} does not exist. Creating default.`);
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
              setUser(newUserData); // Still set user locally even if doc creation fails for some reason
            });
        }
        setLoading(false); // Only set loading to false AFTER user data is determined/fetched
      }, (error) => {
        console.error("Error listening to user document:", error);
        setUser(null); // Clear user if listener fails critically
        setLoading(false);
      });
    }, 500); // 500ms delay

    // Ensure the cleanup also clears the timeout if it hasn't fired yet
    return () => {
      clearTimeout(timeoutId);
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  const refreshUser = useCallback(async () => {
    console.log("AuthContext: refreshUser called. Triggering auth state re-evaluation.");
    if (auth.currentUser) {
        setLoading(true);
        setupUserListener(auth.currentUser);
    } else {
        setUser(null);
        setLoading(false);
    }
  }, [setupUserListener]);

  useEffect(() => {
    console.log("AuthContext: Main useEffect running, setting up onAuthStateChanged listener.");
    let unsubscribeFirestore: (() => void) | null = null; // Initialize as null

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      // Always unsubscribe previous Firestore listener first
      if (unsubscribeFirestore) {
        unsubscribeFirestore();
        unsubscribeFirestore = null;
      }

      if (firebaseUser) {
        console.log(`AuthContext: onAuthStateChanged detected user: ${firebaseUser.email || firebaseUser.uid}. Is anonymous? ${firebaseUser.isAnonymous}`);
        // Add logging from ChatGPT (Step 1)
        console.log("AuthContext: About to set up Firestore snapshot for UID:", firebaseUser.uid);
        setLoading(true);
        unsubscribeFirestore = setupUserListener(firebaseUser);
      } else {
        console.log("AuthContext: No authenticated user. Attempting anonymous sign-in or clearing state.");
        // Check if there was previously a user and they signed out
        if (user !== null) {
             setUser(null);
             setLoading(false);
             console.log("AuthContext: User signed out, state cleared.");
        } else if (!auth.currentUser) { // Only sign in anonymously if no user exists at all
            try {
                // Only attempt anonymous sign-in if not on the login page
                if (window.location.pathname !== '/login') {
                  setLoading(true);
                  const anonUserCred = await signInAnonymously(auth);
                  console.log("AuthContext: Anonymous user signed in:", anonUserCred.user.uid);
                  unsubscribeFirestore = setupUserListener(anonUserCred.user);
                } else {
                    setUser(null);
                    setLoading(false);
                }
            } catch (error) {
                console.error("AuthContext: Error during anonymous sign-in:", error);
                setUser(null);
                setLoading(false);
            }
        } else {
             setLoading(false);
        }
      }
    });

    return () => {
      console.log("AuthContext: Cleaning up Auth and Firestore listeners.");
      unsubscribeAuth();
      if (unsubscribeFirestore) {
        unsubscribeFirestore();
      }
    };
  }, [setupUserListener, user, router]);

  const logout = async () => {
    try {
      if (auth.currentUser && !auth.currentUser.isAnonymous) {
        await firebaseSignOut(auth);
        console.log("AuthContext: Authenticated user signed out successfully.");
      } else {
        console.log("AuthContext: Anonymous user, clearing state and navigating.");
        setUser(null);
        setLoading(false);
      }
      router.push('/login');
    } catch (error) {
      console.error("AuthContext: Error signing out:", error);
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