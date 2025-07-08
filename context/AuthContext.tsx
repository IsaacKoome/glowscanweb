// context/AuthContext.tsx
"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User as FirebaseUser, onAuthStateChanged, signOut as firebaseSignOut, signInAnonymously } from 'firebase/auth';
// Import specific types from firestore
import { getFirestore, doc, getDocFromServer, setDoc, Firestore, DocumentReference } from 'firebase/firestore'; // Added Firestore, DocumentReference
import { FirebaseApp } from 'firebase/app'; // Explicitly import FirebaseApp type
import { auth } from '../lib/firebase'; // Assuming auth is initialized and exported from here
import { useRouter } from 'next/navigation';

// Initialize Firestore (assuming Firebase app is already initialized by auth from ../lib/firebase)
// If db is already exported from ../lib/firebase, you can remove this and import it.
const db: Firestore = getFirestore(auth.app as FirebaseApp); // Explicitly type db

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

  // Function to fetch or create user data in Firestore
  const fetchUserData = useCallback(async (firebaseUser: FirebaseUser) => {
    if (!firebaseUser) {
      console.warn("fetchUserData called with null firebaseUser.");
      return null;
    }

    const userDocRef: DocumentReference = doc(db, 'users', firebaseUser.uid); // Explicitly type userDocRef
    try {
      // *** IMPORTANT CHANGE HERE: Force fetch from server ***
      // The options object { source: 'server' } is still passed as the second argument
      const userDocSnap = await getDocFromServer(userDocRef); // Pass options object directly
      
      if (userDocSnap.exists()) {
        const data = userDocSnap.data();
        console.log(`Firestore user data fetched for ${firebaseUser.uid} (from server):`, data);
        return {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          subscriptionPlan: data?.subscriptionPlan || 'free', // Default to 'free' if not set
          geminiCountToday: data?.geminiCountToday || 0,
          gpt4oCountToday: data?.gpt4oCountToday || 0,
          lastAnalysisDate: data?.lastAnalysisDate || new Date().toISOString().split('T')[0],
          paystackCustomerId: data?.paystackCustomerId || undefined,
          paystackSubscriptionStatus: data?.paystackSubscriptionStatus || undefined,
          paystackLastTxRef: data?.paystackLastTxRef || undefined,
          ...data, // Include any other fields from Firestore
        } as UserData; // Cast to UserData
      } else {
        // If user document doesn't exist, create it with a default free plan
        const newUserData: UserData = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          subscriptionPlan: 'free',
          geminiCountToday: 0,
          gpt4oCountToday: 0,
          lastAnalysisDate: new Date().toISOString().split('T')[0],
        };
        await setDoc(userDocRef, newUserData, { merge: true }); // Use merge: true to avoid overwriting
        console.log(`Firestore document created for new user: ${firebaseUser.uid}`);
        return newUserData;
      }
    } catch (error) {
      console.error("Error fetching or creating user data in Firestore:", error);
      // Fallback to basic user info if Firestore fetch/create fails
      return {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        subscriptionPlan: 'free', // Assume free if data can't be fetched/created
        geminiCountToday: 0,
        gpt4oCountToday: 0,
        lastAnalysisDate: new Date().toISOString().split('T')[0],
      };
    }
  }, []);

  // Function to refresh user data, callable from outside
  const refreshUser = useCallback(async () => {
    console.log("AuthContext: refreshUser called.");
    if (auth.currentUser) {
      setLoading(true); // Set loading while refreshing
      const updatedUser = await fetchUserData(auth.currentUser);
      setUser(updatedUser);
      setLoading(false); // End loading
      console.log("AuthContext: User data refreshed:", updatedUser?.subscriptionPlan);
    } else {
      console.log("AuthContext: No current user to refresh.");
      setUser(null);
      setLoading(false);
    }
  }, [fetchUserData]); // Dependency on fetchUserData

  useEffect(() => {
    console.log("AuthContext: useEffect running, setting up onAuthStateChanged listener.");
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        console.log("AuthContext: onAuthStateChanged fired. User logged in:", firebaseUser.uid);
        const userData = await fetchUserData(firebaseUser); // This will now force server fetch
        setUser(userData);
      } else {
        console.log("AuthContext: No user logged in. Attempting anonymous sign-in.");
        try {
          // Attempt anonymous sign-in if no user is authenticated
          await signInAnonymously(auth);
          // onAuthStateChanged will be triggered again with the anonymous user
        } catch (error) {
          console.error("Error during anonymous sign-in:", error);
          setUser(null); // No user if anonymous sign-in fails
        }
      }
      setLoading(false); // Set loading to false once auth state is determined
      console.log("AuthContext: loading set to false after auth state determination.");
    });

    return () => {
      console.log("AuthContext: useEffect cleanup, unsubscribing from onAuthStateChanged.");
      unsubscribe(); // Cleanup subscription
    };
  }, [fetchUserData]); // Dependency on fetchUserData

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
