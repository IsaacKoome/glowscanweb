// app/payment-status/page.tsx
"use client";

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext'; // Import useAuth hook

function PaymentStatusContent() {
  const searchParams = useSearchParams();
  const { user, loading: authLoading, refreshUser } = useAuth();
  const [displayStatus, setDisplayStatus] = useState<'success' | 'cancelled' | 'error' | 'verifying'>('verifying');
  const [message, setMessage] = useState('Verifying your payment status...');
  const [txRef, setTxRef] = useState<string | null>(null);
  const [planIdFromUrl, setPlanIdFromUrl] = useState<string | null>(null);
  const [userIdFromUrl, setUserIdFromUrl] = useState<string | null>(null);
  const [retryAttempts, setRetryAttempts] = useState(0); // For retry logic

  // Max retries for the frontend to wait for Firestore propagation
  const MAX_RETRY_ATTEMPTS = 5;
  const RETRY_DELAY_MS = 3000; // 3 seconds

  // Effect to parse URL params and set initial state
  useEffect(() => {
    const paymentStatusParam = searchParams.get('status');
    const transactionRef = searchParams.get('tx_ref');
    const receivedPlanId = searchParams.get('planId');
    const receivedUserId = searchParams.get('userId');

    setTxRef(transactionRef);
    setPlanIdFromUrl(receivedPlanId);
    setUserIdFromUrl(receivedUserId);

    if (paymentStatusParam === 'cancelled') {
      setDisplayStatus('cancelled');
      setMessage('Payment cancelled. You can try again or choose another plan.');
    } else if (paymentStatusParam === 'callback' || paymentStatusParam === 'success') {
      setDisplayStatus('verifying'); // Start in verifying state
      setMessage('Payment initiated. Please wait while we confirm your subscription. This may take a few moments.');
      // No immediate refreshUser here, as onSnapshot in AuthContext should handle initial load
      // The retry logic below will trigger refreshes if needed.
    } else {
      setDisplayStatus('error');
      setMessage('An unexpected error occurred during payment processing. Please try again.');
    }
  }, [searchParams]);

  // Effect to watch for user.subscriptionPlan changes from AuthContext and retry if needed
  useEffect(() => {
    let retryTimeout: NodeJS.Timeout;

    // Only proceed if we are currently verifying, AuthContext is loaded, and we have an expected planId
    if (displayStatus === 'verifying' && !authLoading && user && planIdFromUrl) {
      console.log(`PaymentStatusContent: Watching user.subscriptionPlan. Current: ${user.subscriptionPlan}, Expected: ${planIdFromUrl}`);
      
      if (user.subscriptionPlan === planIdFromUrl) {
        console.log("PaymentStatusContent: User plan matches expected planId. Setting status to success.");
        setDisplayStatus('success');
        setMessage('Payment confirmed and plan updated!');
        setRetryAttempts(0); // Reset attempts on success
      } else if (retryAttempts < MAX_RETRY_ATTEMPTS) {
        console.log(`PaymentStatusContent: User plan does not match expected. Retrying in ${RETRY_DELAY_MS / 1000}s (Attempt ${retryAttempts + 1}/${MAX_RETRY_ATTEMPTS}).`);
        retryTimeout = setTimeout(() => {
          refreshUser(); // Trigger a refresh in AuthContext
          setRetryAttempts(prev => prev + 1);
        }, RETRY_DELAY_MS);
      } else {
        console.warn("PaymentStatusContent: Max retry attempts reached. Plan still does not match.");
        setDisplayStatus('error');
        setMessage('Could not confirm payment status. Please check your account or contact support.');
      }
    }

    return () => clearTimeout(retryTimeout); // Cleanup timeout on unmount or re-run
  }, [user, authLoading, planIdFromUrl, displayStatus, refreshUser, retryAttempts]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-128px)] bg-gradient-to-br from-blue-50 to-green-50 p-6 text-center">
      <div className="max-w-xl mx-auto py-12 px-6 bg-white rounded-3xl shadow-xl border border-gray-100 transform transition duration-500 hover:scale-105 relative">
        {displayStatus === 'success' && (
          <>
            <h1 className="text-5xl font-extrabold text-green-700 mb-4 leading-tight">
              Payment Successful! 🎉
            </h1>
            <p className="text-xl text-gray-700 mb-8">{message}</p>
            {planIdFromUrl && <p className="text-lg text-gray-600 mb-2">Your new plan: <span className="font-bold text-green-600">{planIdFromUrl.charAt(0).toUpperCase() + planIdFromUrl.slice(1)}</span></p>}
            {txRef && <p className="text-sm text-gray-500">Transaction Reference: <span className="font-mono">{txRef}</span></p>}
            {userIdFromUrl && <p className="text-sm text-gray-500">User ID: <span className="font-mono">{userIdFromUrl}</span></p>}
            {user && user.subscriptionPlan && user.subscriptionPlan !== planIdFromUrl && (
              <p className="text-sm text-orange-500 mt-2">
                Your current plan in app: <span className="font-bold">{user.subscriptionPlan.charAt(0).toUpperCase() + user.subscriptionPlan.slice(1)}</span> (may take a moment to fully update)
              </p>
            )}
            <Link href="/" className="inline-flex items-center justify-center bg-gradient-to-r from-green-500 to-blue-500 text-white font-bold py-3 px-8 rounded-full text-lg shadow-lg transition duration-300 ease-in-out transform hover:scale-105 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-green-300 mt-8">
              Go to Home
            </Link>
          </>
        )}

        {displayStatus === 'cancelled' && (
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

        {displayStatus === 'error' && (
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

        {displayStatus === 'verifying' && (
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
