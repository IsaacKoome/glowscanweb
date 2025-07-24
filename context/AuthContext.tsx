'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
  useRef,
} from 'react';

import {
  User as FirebaseUser,
  onAuthStateChanged,
  signOut as firebaseSignOut,
  signInAnonymously,
} from 'firebase/auth';

import {
  getFirestore,
  doc,
  setDoc,
  Firestore,
  DocumentReference,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';

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
  [key: string]: any;
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

  const unsubscribeFirestoreRef = useRef<Unsubscribe | null>(null);
  const isMountedRef = useRef(false);

  const setupUserListener = useCallback((firebaseUser: FirebaseUser) => {
    const userDocRef: DocumentReference = doc(db, 'users', firebaseUser.uid);

    console.log(`AuthContext: Setting up onSnapshot listener for user ${firebaseUser.uid}`);

    const unsubscribe = onSnapshot(
      userDocRef,
      (docSnap) => {
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

          if (isMountedRef.current) {
            setUser(updatedUserData);
            console.log(`AuthContext: onSnapshot updated user data for ${firebaseUser.email || firebaseUser.uid}. Subscription: ${updatedUserData.subscriptionPlan}`);
          }
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
              if (isMountedRef.current) {
                console.log(`Firestore document created for new user: ${firebaseUser.uid}`);
                setUser(newUserData);
              }
            })
            .catch((error) => {
              console.error('Error creating user document:', error);
              if (isMountedRef.current) {
                setUser(newUserData);
              }
            });
        }

        if (isMountedRef.current) {
          setLoading(false);
        }
      },
      (error) => {
        console.error('Error listening to user document:', error);
        if (isMountedRef.current) {
          setUser(null);
          setLoading(false);
        }
      }
    );

    unsubscribeFirestoreRef.current = unsubscribe;
    return unsubscribe;
  }, []);

  const refreshUser = useCallback(async () => {
    console.log('AuthContext: refreshUser called. Triggering auth state re-evaluation.');
    if (auth.currentUser) {
      setLoading(true);
      if (unsubscribeFirestoreRef.current) {
        unsubscribeFirestoreRef.current();
      }
      setupUserListener(auth.currentUser);
    } else {
      setUser(null);
      setLoading(false);
    }
  }, [setupUserListener]);

  const logout = useCallback(async () => {
    try {
      if (auth.currentUser && !auth.currentUser.isAnonymous) {
        await firebaseSignOut(auth);
        console.log('AuthContext: Authenticated user signed out successfully.');
      } else {
        console.log('AuthContext: Anonymous user, clearing state and navigating.');
        setUser(null);
        setLoading(false);
      }

      router.push('/login');
    } catch (error) {
      console.error('AuthContext: Error signing out:', error);
    }
  }, [router]);

  useEffect(() => {
    isMountedRef.current = true;
    console.log('AuthContext: Main useEffect running, setting up onAuthStateChanged listener.');

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!isMountedRef.current) return;

      if (unsubscribeFirestoreRef.current) {
        unsubscribeFirestoreRef.current();
        unsubscribeFirestoreRef.current = null;
      }

      if (firebaseUser) {
        console.log(`AuthContext: onAuthStateChanged detected user: ${firebaseUser.email || firebaseUser.uid}. Is anonymous? ${firebaseUser.isAnonymous}`);
        setLoading(true);
        setupUserListener(firebaseUser);
      } else {
        console.log('AuthContext: No authenticated user. Attempting anonymous sign-in or clearing state.');

        if (user !== null) {
          setUser(null);
          setLoading(false);
          console.log('AuthContext: User signed out, state cleared.');
        } else if (!auth.currentUser) {
          try {
            if (window.location.pathname !== '/login') {
              setLoading(true);
              const anonUserCred = await signInAnonymously(auth);
              console.log('AuthContext: Anonymous user signed in:', anonUserCred.user.uid);
              setupUserListener(anonUserCred.user);
            } else {
              setUser(null);
              setLoading(false);
            }
          } catch (error) {
            console.error('AuthContext: Error during anonymous sign-in:', error);
            setUser(null);
            setLoading(false);
          }
        } else {
          setLoading(false);
        }
      }
    });

    return () => {
      isMountedRef.current = false;
      console.log('AuthContext: Cleaning up Auth and Firestore listeners.');
      unsubscribeAuth();
      if (unsubscribeFirestoreRef.current) {
        unsubscribeFirestoreRef.current();
      }
    };
  }, [setupUserListener]); // Removed router and user from dependencies

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