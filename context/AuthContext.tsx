//context/AuthContext
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
    if (!firebaseUser) return () => {}; // Should not happen if called correctly

    const userDocRef: DocumentReference = doc(db, 'users', firebaseUser.uid);
    console.log(`AuthContext: Setting up onSnapshot listener for user ${firebaseUser.uid}`);

    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
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

    return unsubscribe;
  }, []);

  const refreshUser = useCallback(async () => {
    console.log("AuthContext: refreshUser called. Triggering auth state re-evaluation.");
    // This function can be used to manually trigger a refresh if needed
    // However, the main useEffect below is handling the primary auth state changes.
    // Force a re-evaluation of the auth state
    if (auth.currentUser) {
        setLoading(true); // Indicate loading while re-evaluating
        // No need to call onAuthStateChanged directly here,
        // as the main useEffect is already listening.
        // If you truly need to force it, you might need a dummy re-auth or similar
        // but for now, let the primary useEffect handle it.
        setupUserListener(auth.currentUser); // Directly try to setup listener if user already exists
    } else {
        setUser(null);
        setLoading(false);
    }
  }, [setupUserListener]); // Include setupUserListener in deps

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
        // If it's an anonymous user AND they just logged in with email/password,
        // Firebase will automatically link the accounts.
        // We set loading true *before* setting up the listener to avoid flicker.
        setLoading(true);
        unsubscribeFirestore = setupUserListener(firebaseUser);
      } else {
        console.log("AuthContext: No authenticated user. Attempting anonymous sign-in or clearing state.");
        // Check if there was previously a user and they signed out
        if (user !== null) { // This check prevents redundant anonymous sign-ins
             setUser(null);
             setLoading(false);
             console.log("AuthContext: User signed out, state cleared.");
        } else if (!auth.currentUser) { // Only sign in anonymously if no user exists at all
            try {
                // Only attempt anonymous sign-in if no user is present (initial load)
                if (window.location.pathname !== '/login') { // Prevent anonymous sign-in loop on login page
                  setLoading(true); // Set loading while waiting for anonymous sign-in
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
             // This case handles situations where auth.currentUser exists but it's not detected by the listener yet
             // (e.g., initial state is null, but auth has a user from a previous session).
             // This branch should ideally be rare with onAuthStateChanged.
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
  }, [setupUserListener, user, router]); // Added 'user' and 'router' to dependencies

  const logout = async () => {
    try {
      if (auth.currentUser && !auth.currentUser.isAnonymous) {
        await firebaseSignOut(auth);
        console.log("AuthContext: Authenticated user signed out successfully.");
      } else {
        // If it's an anonymous user, just clear local state and navigate
        console.log("AuthContext: Anonymous user, clearing state and navigating.");
        setUser(null);
        setLoading(false);
        // Firebase Auth's onAuthStateChanged will likely re-sign in anonymously again
        // due to the useEffect logic, but that's fine for anonymity.
      }
      router.push('/login'); // Always redirect to login after logout
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