// app/payment-status/page.tsx
"use client";

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext'; // Import useAuth hook

function PaymentStatusContent() {
  const searchParams = useSearchParams();
  const { user, loading: authLoading, refreshUser } = useAuth(); // Get refreshUser from context
  const [status, setStatus] = useState<'success' | 'cancelled' | 'error' | 'verifying'>('verifying');
  const [message, setMessage] = useState('Verifying your payment status...');
  const [txRef, setTxRef] = useState<string | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const [userIdFromUrl, setUserIdFromUrl] = useState<string | null>(null); // Renamed to avoid conflict with user.uid

  // Effect to parse URL params and set initial state
  useEffect(() => {
    const paymentStatus = searchParams.get('status');
    const transactionRef = searchParams.get('tx_ref');
    const receivedPlanId = searchParams.get('planId');
    const receivedUserId = searchParams.get('userId');

    setTxRef(transactionRef);
    setPlanId(receivedPlanId);
    setUserIdFromUrl(receivedUserId);

    if (paymentStatus === 'success') {
      // If Paystack immediately says success, we still verify via webhook
      setStatus('verifying');
      setMessage('Payment successful! Confirming your plan update...');
    } else if (paymentStatus === 'cancelled') {
      setStatus('cancelled');
      setMessage('Payment cancelled. You can try again or choose another plan.');
    } else if (paymentStatus === 'callback') {
      setStatus('verifying');
      setMessage('Payment initiated. Please wait while we confirm your subscription. This may take a few moments.');
    } else {
      setStatus('error');
      setMessage('An error occurred during payment processing. Please try again.');
    }

    // Trigger a user data refresh shortly after the page loads if it's a callback/success state
    // This helps ensure the AuthContext user object is up-to-date with Firestore
    if (paymentStatus === 'success' || paymentStatus === 'callback') {
      // Use a timeout to ensure AuthContext has had a chance to initialize
      const initialRefreshTimeout = setTimeout(() => {
        if (!authLoading && user) { // Only refresh if auth is ready and a user exists
          console.log("PaymentStatusContent: Initial refreshUser triggered.");
          refreshUser();
        } else if (!authLoading && !user && receivedUserId) { // If no user but we have a temp ID, also refresh
          console.log("PaymentStatusContent: Initial refreshUser triggered for unauthenticated user.");
          refreshUser(); // This will trigger anonymous sign-in and then fetch data
        }
      }, 2000); // Give it 2 seconds

      return () => clearTimeout(initialRefreshTimeout);
    }

  }, [searchParams, authLoading, user, refreshUser]); // Dependencies for this useEffect

  // Effect to watch for user.subscriptionPlan changes from AuthContext
  useEffect(() => {
    // Only proceed if we are in 'verifying' state and AuthContext is loaded
    if (status === 'verifying' && !authLoading && user && planId) {
      console.log(`PaymentStatusContent: Watching user.subscriptionPlan. Current: ${user.subscriptionPlan}, Expected: ${planId}`);
      if (user.subscriptionPlan === planId) {
        console.log("PaymentStatusContent: User plan matches expected planId. Setting status to success.");
        setStatus('success');
        setMessage('Payment confirmed and plan updated!');
      } else {
        // If user exists but plan doesn't match yet, and we're still verifying,
        // it means the webhook might have hit, but the AuthContext hasn't fully propagated.
        // Or, if the user was anonymous, the UID might have changed after anonymous login.
        // We can trigger another refresh as a fallback.
        console.log("PaymentStatusContent: User plan does not match expected. Triggering refreshUser.");
        refreshUser();
      }
    }
  }, [user, authLoading, planId, status, refreshUser]); // Dependencies for this useEffect

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-128px)] bg-gradient-to-br from-blue-50 to-green-50 p-6 text-center">
      <div className="max-w-xl mx-auto py-12 px-6 bg-white rounded-3xl shadow-xl border border-gray-100 transform transition duration-500 hover:scale-105 relative">
        {status === 'success' && (
          <>
            <h1 className="text-5xl font-extrabold text-green-700 mb-4 leading-tight">
              Payment Successful! 🎉
            </h1>
            <p className="text-xl text-gray-700 mb-8">{message}</p>
            {planId && <p className="text-lg text-gray-600 mb-2">Your new plan: <span className="font-bold text-green-600">{planId.charAt(0).toUpperCase() + planId.slice(1)}</span></p>}
            {txRef && <p className="text-sm text-gray-500">Transaction Reference: <span className="font-mono">{txRef}</span></p>}
            {userIdFromUrl && <p className="text-sm text-gray-500">User ID: <span className="font-mono">{userIdFromUrl}</span></p>}
            {user && user.subscriptionPlan && user.subscriptionPlan !== planId && (
              <p className="text-sm text-orange-500 mt-2">
                Your current plan in app: <span className="font-bold">{user.subscriptionPlan.charAt(0).toUpperCase() + user.subscriptionPlan.slice(1)}</span> (may take a moment to fully update)
              </p>
            )}
            <Link href="/" className="inline-flex items-center justify-center bg-gradient-to-r from-green-500 to-blue-500 text-white font-bold py-3 px-8 rounded-full text-lg shadow-lg transition duration-300 ease-in-out transform hover:scale-105 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-green-300 mt-8">
              Go to Home
            </Link>
          </>
        )}

        {status === 'cancelled' && (
          <>
            <h1 className="text-5xl font-extrabold text-yellow-700 mb-4 leading-tight">
              Payment Cancelled 😔
            </h1>
            <p className="text-xl text-gray-700 mb-8">{message}</p>
            <Link href="/pricing" className="inline-flex items-center justify-center bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-bold py-3 px-8 rounded-full text-lg shadow-lg transition duration-300 ease-in-out transform hover:scale-105 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-yellow-300 mt-8">
              Try Again
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <h1 className="text-5xl font-extrabold text-red-700 mb-4 leading-tight">
              Payment Error ⚠️
            </h1>
            <p className="text-xl text-gray-700 mb-8">{message}</p>
            <Link href="/pricing" className="inline-flex items-center justify-center bg-gradient-to-r from-red-500 to-purple-500 text-white font-bold py-3 px-8 rounded-full text-lg shadow-lg transition duration-300 ease-in-out transform hover:scale-105 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-red-300 mt-8">
              Try Again
            </Link>
          </>
        )}

        {status === 'verifying' && (
          <>
            <h1 className="text-5xl font-extrabold text-blue-700 mb-4 leading-tight">
              Verifying Payment... 🔄
            </h1>
            <p className="text-xl text-gray-700 mb-8">{message}</p>
            <div className="flex justify-center items-center">
              <svg className="animate-spin h-10 w-10 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <Link href="/" className="inline-flex items-center justify-center bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold py-3 px-8 rounded-full text-lg shadow-lg transition duration-300 ease-in-out transform hover:scale-105 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-blue-300 mt-8">
              Go to Home
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

// Default export wrapped with Suspense
export default function PaymentStatusPage() {
  return (
    <Suspense fallback={<div>Loading payment status...</div>}>
      <PaymentStatusContent />
    </Suspense>
  );
}
