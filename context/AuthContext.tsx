// context/AuthContext.tsx
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth'; // Renamed signOut to avoid conflict
import { auth } from '../lib/firebase'; // Import your auth instance
import { useRouter } from 'next/navigation';

// Define the shape of our AuthContext
interface AuthContextType {
  user: User | null;
  loading: boolean; // To indicate if auth state is still being loaded
  logout: () => Promise<void>;
}

// Create the context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Create the AuthProvider component
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true); // Start as loading
  const router = useRouter();

  useEffect(() => {
    // Listen for authentication state changes
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false); // Auth state has been determined
    });

    // Cleanup subscription on component unmount
    return () => unsubscribe();
  }, []); // Empty dependency array means this runs once on mount

  // Logout function
  const logout = async () => {
    try {
      await firebaseSignOut(auth);
      // Firebase's onAuthStateChanged listener will automatically update the user state to null
      console.log("User signed out successfully.");
      router.push('/login'); // Redirect to login page after logout
    } catch (error) {
      console.error("Error signing out:", error);
      // You could set an error state here if needed
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook to use the AuthContext
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};