// app/login/page.tsx
"use client"; // This is a Client Component

import React, { useState } from 'react';
import { useRouter } from 'next/navigation'; // For navigation
import { auth } from '../../lib/firebase'; // Import auth instance
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth';

import { FirebaseError } from 'firebase/app'; // Import FirebaseError for type checking
import { useAuth } from '../../context/AuthContext'; // IMPORT useAuth

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false); // Toggle between login/register
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(''); // For success or error messages
  const router = useRouter();
  const { refreshUser } = useAuth(); // GET refreshUser from context

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      if (isRegistering) {
        // Sign Up
        await createUserWithEmailAndPassword(auth, email, password);
        setMessage('Registration successful! You can now log in.');
        setIsRegistering(false); // Switch to login view after successful registration
      } else {
        // Sign In
        await signInWithEmailAndPassword(auth, email, password);
        setMessage('Login successful!');
        // Redirect to a protected page, e.g., the profile page or home
        router.push('/'); // Or '/profile' once created

        // ADD THIS BLOCK: (Step 3 from ChatGPT)
        setTimeout(() => {
          console.log("LoginPage: Forcing user refresh manually after login...");
          refreshUser(); // This triggers AuthContext to re-evaluate the user state
        }, 500); // Give it a moment to ensure auth state is propagated
      }
    } catch (error: any) {
      if (error instanceof FirebaseError) {
        // Handle Firebase specific errors
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
      console.error("Auth error:", error);
    } finally {
      setLoading(false);
    }
  };

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
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin h-5 w-5 text-white mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {isRegistering ? 'Registering...' : 'Logging In...'}
              </span>
            ) : (
              isRegistering ? 'Register Account' : 'Log In'
            )}
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