// context/AuthContext.tsx
"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User as FirebaseUser, onAuthStateChanged, signOut as firebaseSignOut, signInAnonymously } from 'firebase/auth';
// Import specific types from firestore, and onSnapshot
import { getFirestore, doc, setDoc, Firestore, DocumentReference, onSnapshot } from 'firebase/firestore'; 
import { FirebaseApp } from 'firebase/app'; // Explicitly import FirebaseApp type
import { auth } from '../lib/firebase'; // Assuming auth is initialized and exported from here
import { useRouter } from 'next/navigation';

// Initialize Firestore (assuming Firebase app is already initialized by auth from ../lib/firebase)
const db: Firestore = getFirestore(auth.app as FirebaseApp);

// Define the structure for user data including Firestore fields
interface UserData {
  uid: string;
  email: string | null;
  subscriptionPlan: string;
  geminiCountToday: number;
  gpt4oCountToday: number;
  lastAnalysisDate: string; // ISO date string 'YYYY-MM-DD'
  paystackCustomerId?: string;
  paystackSubscriptionStatus?: string;
  paystackLastTxRef?: string;
  // Add any other fields you store in the 'users' Firestore collection
}

// Define the shape of your AuthContext
interface AuthContextType {
  user: UserData | null;
  loading: boolean;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>; // Added refreshUser to the context type
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true); // Initial loading state is true
  const router = useRouter();

  // This function will set up a real-time listener for user data
  const setupUserListener = useCallback((firebaseUser: FirebaseUser) => {
    if (!firebaseUser) {
      console.warn("setupUserListener called with null firebaseUser.");
      return () => {}; // Return a no-op unsubscribe function
    }

    const userDocRef: DocumentReference = doc(db, 'users', firebaseUser.uid);
    console.log(`AuthContext: Setting up onSnapshot listener for user ${firebaseUser.uid}`);

    // onSnapshot returns an unsubscribe function
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const updatedUserData: UserData = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          subscriptionPlan: data?.subscriptionPlan || 'free',
          geminiCountToday: data?.geminiCountToday || 0,
          gpt4oCountToday: data?.gpt4oCountToday || 0,
          lastAnalysisDate: data?.lastAnalysisDate || new Date().toISOString().split('T')[0],
          paystackCustomerId: data?.paystackCustomerId || undefined,
          paystackSubscriptionStatus: data?.paystackSubscriptionStatus || undefined,
          paystackLastTxRef: data?.paystackLastTxRef || undefined,
          ...data, // Include any other fields from Firestore
        } as UserData;
        setUser(updatedUserData);
        console.log(`AuthContext: onSnapshot updated user data: ${updatedUserData.subscriptionPlan}`);
      } else {
        // If user document doesn't exist, create it with a default free plan
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
            setUser(newUserData); // Set user after creation
          })
          .catch((error) => {
            console.error("Error creating user document in Firestore:", error);
            setUser(newUserData); // Still set user locally even if Firestore write fails
          });
      }
      setLoading(false); // Data is loaded after first snapshot
    }, (error) => {
      console.error("Error listening to user document:", error);
      setLoading(false); // Stop loading on error
      // Optionally, handle error by setting user to null or a default state
    });

    return unsubscribe; // Return the unsubscribe function
  }, []);

  // refreshUser will now just ensure the listener is active
  const refreshUser = useCallback(async () => {
    console.log("AuthContext: refreshUser called. Re-evaluating listener.");
    if (auth.currentUser) {
      // The onAuthStateChanged listener below will handle setting up the snapshot
      // and updating the user state. This function primarily ensures that
      // the listener is active if it somehow wasn't, or forces an initial data load.
      // We don't need to manually fetch here because onSnapshot is reactive.
      if (user === null) { // Only force loading if user is not yet set
        setLoading(true);
      }
      // Trigger onAuthStateChanged to re-evaluate and potentially set up a new listener
      // if the current one is somehow stale or missing.
      // This is a bit of a hack, but ensures the listener is always active.
      onAuthStateChanged(auth, (firebaseUser) => {
        if (firebaseUser) {
          setupUserListener(firebaseUser); // Re-establish listener
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
  }, [setupUserListener, user]); // Dependency on setupUserListener and user

  useEffect(() => {
    console.log("AuthContext: useEffect running, setting up onAuthStateChanged listener.");
    let unsubscribeFirestore: () => void = () => {};

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      // First, unsubscribe from any previous Firestore listener
      unsubscribeFirestore(); 

      if (firebaseUser) {
        console.log("AuthContext: onAuthStateChanged fired. User logged in:", firebaseUser.uid);
        // Set up the real-time listener for this user's data
        unsubscribeFirestore = setupUserListener(firebaseUser);
      } else {
        console.log("AuthContext: No user logged in. Attempting anonymous sign-in.");
        try {
          // Attempt anonymous sign-in if no user is authenticated
          await signInAnonymously(auth);
          // onAuthStateChanged will be triggered again with the anonymous user
        } catch (error) {
          console.error("Error during anonymous sign-in:", error);
          setUser(null); // No user if anonymous sign-in fails
          setLoading(false); // Stop loading if anonymous sign-in fails
        }
      }
      // setLoading(false) is now handled by setupUserListener's first snapshot
    });

    return () => {
      console.log("AuthContext: useEffect cleanup, unsubscribing from Auth and Firestore.");
      unsubscribeAuth(); // Cleanup Auth subscription
      unsubscribeFirestore(); // Cleanup Firestore subscription
    };
  }, [setupUserListener]); // Dependency on setupUserListener

  const logout = async () => {
    try {
      await firebaseSignOut(auth);
      console.log("User signed out successfully.");
      router.push('/login'); // Redirect to login page after logout
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
