// app/login/page.tsx
"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '../../lib/firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth';

import { FirebaseError } from 'firebase/app';
// --- START FIX 1: Import useAuth to get the new Google sign-in function ---
import { useAuth } from '../../context/AuthContext';
// --- END FIX 1 ---

// A simple Google Icon component to use in our button
const GoogleIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 48 48" {...props}>
    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"></path>
    <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"></path>
    <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A8 8 0 0 1 24 36c-5.222 0-9.618-3.66-11.083-8.584l-6.522 5.025C9.505 39.556 16.227 44 24 44z"></path>
    <path fill="#1976D2" d="M43.611 20.083H24v8h11.303a12.04 12.04 0 0 1-4.087 7.739l6.19 5.238C42.018 36.458 44 30.638 44 24c0-1.341-.138-2.65-.389-3.917z"></path>
  </svg>
);

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const router = useRouter();
  // --- START FIX 2: Get signInWithGoogle from the useAuth hook ---
  const { refreshUser, signInWithGoogle } = useAuth();
  // --- END FIX 2 ---

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, email, password);
        setMessage('Registration successful! You can now log in.');
        setIsRegistering(false);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        setMessage('Login successful!');
        router.push('/');
        setTimeout(() => {
          refreshUser();
        }, 500);
      }
    } catch (error: any) {
      // ... (error handling remains the same)
      if (error instanceof FirebaseError) {
        switch (error.code) {
          case 'auth/email-already-in-use':
            setMessage('Error: This email is already registered. Try logging in.');
            break;
          case 'auth/invalid-email':
            setMessage('Error: Invalid email address format.');
            break;
          case 'auth/weak-password':
            setMessage('Error: Password should be at least 6 characters.');
            break;
          case 'auth/user-not-found':
          case 'auth/wrong-password':
            setMessage('Error: Invalid email or password.');
            break;
          case 'auth/too-many-requests':
            setMessage('Error: Too many login attempts. Please try again later.');
            break;
          default:
            setMessage(`Authentication Error: ${error.message}`);
        }
      } else {
        setMessage(`An unexpected error occurred: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // --- START FIX 3: Create a handler for the Google Sign-In button ---
  const handleGoogleSignIn = async () => {
    setLoading(true);
    setMessage('');
    try {
      await signInWithGoogle();
      // No need to do anything else, the AuthContext and router push will handle it
    } catch (error) {
      setMessage('Failed to sign in with Google. Please try again.');
      setLoading(false);
    }
    // setLoading(false) will be handled by the redirect or if an error occurs
  };
  // --- END FIX 3 ---

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-4">
      <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-md text-center border border-gray-100">
        <h1 className="text-4xl font-extrabold text-purple-800 mb-6">
          {isRegistering ? 'Join WonderJoy AI ✨' : 'Welcome Back! 👋'}
        </h1>
        <p className="text-gray-700 mb-8">
          {isRegistering ?
            "Create your account to unlock personalized beauty insights." :
            "Log in to continue your journey to radiant skin and flawless makeup."
          }
        </p>

        {/* --- START FIX 4: Add the Google Sign-In button and divider --- */}
        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 py-3 mb-6 rounded-xl text-gray-700 font-semibold text-lg transition duration-300 bg-white border border-gray-300 hover:bg-gray-50 shadow-sm"
        >
          <GoogleIcon className="w-6 h-6" />
          Sign in with Google
        </button>

        <div className="flex items-center my-6">
          <div className="flex-grow border-t border-gray-300"></div>
          <span className="flex-shrink mx-4 text-gray-500">OR</span>
          <div className="flex-grow border-t border-gray-300"></div>
        </div>
        {/* --- END FIX 4 --- */}

        <form onSubmit={handleAuth} className="space-y-6">
          <div>
            <label htmlFor="email" className="sr-only">Email</label>
            <input
              type="email"
              id="email"
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-5 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-lg"
            />
          </div>
          <div>
            <label htmlFor="password" className="sr-only">Password</label>
            <input
              type="password"
              id="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-5 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-lg"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 rounded-xl text-white font-bold text-xl transition duration-300 ${
              loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg transform hover:scale-105'
            }`}
          >
            {/* ... (loading spinner logic remains the same) ... */}
            {loading ? 'Processing...' : (isRegistering ? 'Register Account' : 'Log In')}
          </button>
        </form>

        {message && (
          <p className={`mt-6 text-lg font-medium ${message.includes('Error') ? 'text-red-600' : 'text-green-600'}`}>
            {message}
          </p>
        )}

        <button
          onClick={() => setIsRegistering(prev => !prev)}
          className="mt-6 text-purple-600 hover:underline text-lg transition duration-200"
        >
          {isRegistering ? 'Already have an account? Log In' : "Don't have an account? Register Now"}
        </button>
      </div>
    </div>
  );
}
