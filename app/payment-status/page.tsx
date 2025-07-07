// app/payment-status/page.tsx
"use client";

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function PaymentStatusPage() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'success' | 'cancelled' | 'error' | 'verifying'>('verifying');
  const [message, setMessage] = useState('Verifying your payment status...');
  const [txRef, setTxRef] = useState<string | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const paymentStatus = searchParams.get('status');
    const transactionRef = searchParams.get('tx_ref');
    const receivedPlanId = searchParams.get('planId');
    const receivedUserId = searchParams.get('userId');

    setTxRef(transactionRef);
    setPlanId(receivedPlanId);
    setUserId(receivedUserId);

    if (paymentStatus === 'success') {
      setStatus('success');
      setMessage('Payment successful! Your plan has been updated.');
      // Optionally, you might want to call a backend endpoint here to verify the transaction
      // using the tx_ref, especially for one-time payments.
      // For subscriptions, the webhook should handle the update.
    } else if (paymentStatus === 'cancelled') {
      setStatus('cancelled');
      setMessage('Payment cancelled. You can try again or choose another plan.');
    } else if (paymentStatus === 'callback') {
      // This status is from Paystack's callback URL.
      // We should verify the transaction with Paystack directly from the backend.
      // However, for simplicity, we're mostly relying on the webhook.
      // This page can confirm the user was redirected and inform them.
      setStatus('verifying');
      setMessage('Payment initiated. Please wait while we confirm your subscription. This may take a few moments.');
      // You could trigger a backend verification call here if needed,
      // but the webhook is the primary source of truth for subscription status.
    } else {
      setStatus('error');
      setMessage('An error occurred during payment processing. Please try again.');
    }
  }, [searchParams]);

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
