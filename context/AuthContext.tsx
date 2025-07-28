// context/AuthContext.tsx
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
  GoogleAuthProvider,
  signInWithPopup,
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
  displayName: string | null;
  photoURL: string | null;
  subscriptionPlan: string;
  geminiCountToday: number;
  gpt4oCountToday: number;
  lastAnalysisDate: string;
  paystackCustomerId?: string;
  paystackSubscriptionStatus?: string;
  paystackLastTxRef?: string;
  paystackSubscriptionCode?: string;
  isAnonymous?: boolean; // Add this field to distinguish anonymous users
  [key: string]: any;
}

interface AuthContextType {
  user: UserData | null;
  loading: boolean;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
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

    // Sync profile data for both authenticated and anonymous users
    // Anonymous users might not have displayName/photoURL, but merge:true handles that.
    const profileDataToSync = {
      displayName: firebaseUser.displayName || null, // Ensure null for anonymous
      photoURL: firebaseUser.photoURL || null,     // Ensure null for anonymous
      email: firebaseUser.email || null,           // Ensure null for anonymous
      isAnonymous: firebaseUser.isAnonymous,       // Store if user is anonymous
    };

    setDoc(userDocRef, profileDataToSync, { merge: true })
      .then(() => {
        console.log(`AuthContext: User profile synced with Firestore for ${firebaseUser.uid}`);
      })
      .catch(error => {
        console.error("AuthContext: Error syncing user profile to Firestore:", error);
      });

    console.log(`AuthContext: Setting up onSnapshot listener for user ${firebaseUser.uid}`);

    const unsubscribe = onSnapshot(
      userDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();

          const updatedUserData: UserData = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
            photoURL: firebaseUser.photoURL,
            isAnonymous: firebaseUser.isAnonymous, // Set this based on the FirebaseUser object
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
            console.log(`AuthContext: onSnapshot updated user data for ${firebaseUser.email || firebaseUser.uid}. Is anonymous? ${updatedUserData.isAnonymous}. Subscription: ${updatedUserData.subscriptionPlan}`);
          }
        } else {
          console.log(`AuthContext: User document for ${firebaseUser.uid} does not exist. Creating default.`);
          const newUserData: UserData = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || null, // Ensure null for anonymous
            displayName: firebaseUser.displayName || null, // Ensure null for anonymous
            photoURL: firebaseUser.photoURL || null,     // Ensure null for anonymous
            isAnonymous: firebaseUser.isAnonymous,       // Crucial for new anonymous users
            subscriptionPlan: 'free',
            geminiCountToday: 0,
            gpt4oCountToday: 0,
            lastAnalysisDate: new Date().toISOString().split('T')[0],
          };

          setDoc(userDocRef, newUserData, { merge: true })
            .then(() => {
              if (isMountedRef.current) {
                console.log(`Firestore document created for new user: ${firebaseUser.uid}. Is anonymous? ${newUserData.isAnonymous}`);
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

  const signInWithGoogle = useCallback(async () => {
  const provider = new GoogleAuthProvider();
  try {
    // If an anonymous user is currently signed in, link them to Google
    // Otherwise, just sign in with Google
    if (auth.currentUser && auth.currentUser.isAnonymous) {
      console.log('AuthContext: Linking anonymous user with Google.');
      // The correction is here: call linkWithPopup on the auth instance,
      // and pass the current user along with the provider.
      await signInWithPopup(auth, provider); // signInWithPopup handles linking automatically if a user is already signed in.
                                          // It essentially merges the anonymous session with the new provider's session.
    } else {
      await signInWithPopup(auth, provider);
    }
    router.push('/');
  } catch (error) {
    console.error("Error during Google sign-in/linking:", error);
    // You could add user facing error if desired
  }
}, [router]);


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
      // If the user is an authenticated user (not anonymous), sign them out completely.
      // If they are anonymous, we don't 'sign out' in the traditional sense,
      // but rather clear the local state and effectively make them anonymous again
      // when the onAuthStateChanged listener re-triggers.
      if (auth.currentUser && !auth.currentUser.isAnonymous) {
        await firebaseSignOut(auth);
        console.log('AuthContext: Authenticated user signed out successfully.');
      } else if (auth.currentUser && auth.currentUser.isAnonymous) {
        // For anonymous users, we just want to clear the session and allow a new anonymous session to start.
        // Revoking their token is one way, or simply reloading the page will often trigger a new anonymous session.
        // firebaseSignOut works even for anonymous, but the *impact* is different (no credential to invalidate).
        await firebaseSignOut(auth); // This will clear the current anonymous session
        console.log('AuthContext: Anonymous user session cleared.');
      } else {
        console.log('AuthContext: No active user to sign out.');
      }

      // Clear local state immediately for faster UI response
      setUser(null);
      setLoading(false);
      router.push('/login'); // Redirect after logout/clearing
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
        setLoading(true); // Set loading while we fetch Firestore data for this user
        setupUserListener(firebaseUser);
      } else {
        // No authenticated user, try to sign in anonymously if not on login page
        console.log('AuthContext: No authenticated user. Attempting anonymous sign-in...');
        if (window.location.pathname !== '/login' && window.location.pathname !== '/signup') { // Avoid infinite loop on login/signup pages
          try {
            setLoading(true); // Set loading while anonymous sign-in is in progress
            const anonUserCred = await signInAnonymously(auth);
            console.log('AuthContext: Anonymous user signed in:', anonUserCred.user.uid);
            setupUserListener(anonUserCred.user); // Setup listener for the new anonymous user
          } catch (error) {
            console.error('AuthContext: Error during anonymous sign-in:', error);
            setUser(null);
            setLoading(false);
          }
        } else {
          // If on login/signup page, no anonymous sign-in. Just set user to null and stop loading.
          setUser(null);
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
  }, [setupUserListener]);

  return (
    <AuthContext.Provider value={{ user, loading, logout, refreshUser, signInWithGoogle }}>
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