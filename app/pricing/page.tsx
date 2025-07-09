// app/pricing/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext'; // Import useAuth hook
// Removed PaystackProps import, will infer type directly from usePaystackPayment
import { usePaystackPayment } from 'react-paystack'; 

// Define the structure for a plan
interface Plan {
  id: string;
  name: string;
  price: string; // e.g., 'KES 700'
  priceDetails: string;
  features: string[];
  buttonText: string;
  isPopular?: boolean;
  paystackPlanCode?: string | null; // Allow null for free plan
}

// Define your subscription plans
const plans: Plan[] = [
  {
    id: 'free',
    name: 'Free Plan',
    price: '$0',
    priceDetails: 'per month',
    features: [
      '3 analyses per day (Gemini Flash)',
      'Basic skin & makeup insights',
      'Access to community tips',
      'No credit card required'
    ],
    buttonText: 'Current Plan',
    paystackPlanCode: null,
  },
  {
    id: 'basic',
    name: 'Basic Plan',
    price: 'KES 700',
    priceDetails: 'per month',
    features: [
      '3 analyses/day (GPT-4o)',
      '10 analyses/day (Gemini Flash)',
      'Advanced skin & makeup insights',
      'Priority email support',
      'Ad-free experience'
    ],
    buttonText: 'Choose Basic',
    paystackPlanCode: "PLN_lrkikt1qz6r5mig", // YOUR ACTUAL BASIC PLAN CODE
  },
  {
    id: 'standard',
    name: 'Standard Plan',
    price: 'KES 2,800',
    priceDetails: 'per month',
    features: [
      '10 analyses/day (GPT-4o)',
      'Unlimited analyses (Gemini Flash)',
      'Detailed personalized reports',
      'Dedicated chat support',
      'Early access to new features'
    ],
    buttonText: 'Choose Standard',
    isPopular: true,
    paystackPlanCode: "PLN_9v76fs96u1us4o0", // YOUR ACTUAL STANDARD PLAN CODE
  },
  {
    id: 'premium',
    name: 'Premium Plan',
    price: 'KES 14,000',
    priceDetails: 'per month',
    features: [
      'Unlimited analyses (GPT-4o)',
      'Unlimited analyses (Gemini Flash)',
      'Exclusive expert webinars',
      '24/7 priority support',
      'Personalized beauty consultations'
    ],
    buttonText: 'Choose Premium',
    paystackPlanCode: "PLN_smf4ocf5w0my58c", // YOUR ACTUAL PREMIUM PLAN CODE - Make sure this is correct for Premium
  },
];

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://glowscan-backend-241128138627.us-central1.run.app'; // Use env var or fallback

export default function PricingPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [loadingPayment, setLoadingPayment] = useState<string | null>(null); // To show loading state for specific plan button
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Paystack configuration hook
  // Provide a default publicKey to satisfy the hook's argument requirement
  const initializePayment = usePaystackPayment({ 
    publicKey: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || '',
    // You can add other default config here if needed, e.g., currency
  });

  // Function to extract numerical amount from price string and convert to kobo
  const getAmountInKobo = useCallback((priceString: string): number | null => {
    const numericPart = priceString.replace(/[^0-9.]/g, ''); // Remove non-numeric characters except dot
    const amountKES = parseFloat(numericPart);
    if (isNaN(amountKES)) {
      return null;
    }
    return Math.round(amountKES * 100); // Convert to kobo and round to nearest integer
  }, []);

  const handleSubscribeClick = async (planId: string) => {
    // Prevent multiple clicks or clicks while auth is loading
    if (loadingPayment || authLoading) {
      console.log("Payment already loading or authentication in progress.");
      return;
    }

    setLoadingPayment(planId);
    setPaymentError(null);

    const selectedPlan = plans.find(p => p.id === planId);
    if (!selectedPlan || !selectedPlan.paystackPlanCode) {
      setPaymentError("Invalid plan selected or missing Paystack plan code.");
      setLoadingPayment(null);
      return;
    }

    // CRUCIAL: Ensure user is available and has a UID before proceeding
    if (!user || !user.uid) {
      console.error("User not authenticated or UID not available. Cannot initiate payment.");
      setPaymentError("Authentication required. Please wait for the page to load fully or refresh.");
      setLoadingPayment(null);
      return;
    }

    const amountInKobo = getAmountInKobo(selectedPlan.price);
    if (amountInKobo === null) {
      setPaymentError("Could not determine plan price. Please try again.");
      setLoadingPayment(null);
      return;
    }

    try {
      // Step 1: Call your backend to initialize the Paystack transaction
      const response = await fetch(`${BACKEND_URL}/create-paystack-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': user.uid, // Send the Firebase UID to the backend
        },
        body: JSON.stringify({
          planId: planId,
          userEmail: user.email || `${user.uid}@wonderjoy.ai`, // Use user's email or a fallback based on UID
          amount: amountInKobo, // Amount in kobo
          userId: user.uid, // Also send in body for consistency, backend should prefer X-User-ID header
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to initialize payment with backend.');
      }

      const data = await response.json();
      if (data.authorization_url) { // Assuming backend returns authorization_url for redirect
        // Step 2: Redirect to Paystack payment page
        window.location.href = data.authorization_url;
      } else {
        setPaymentError("No authorization URL received from Paystack.");
      }

    } catch (error: any) {
      console.error('Payment initiation error:', error);
      setPaymentError(error.message || 'An unexpected error occurred during payment initiation.');
    } finally {
      setLoadingPayment(null);
    }
  };

  return (
    <div className="min-h-[calc(100vh-128px)] bg-gradient-to-br from-purple-50 to-pink-50 py-16 px-4 sm:px-6 lg:px-8 flex flex-col items-center">
      <div className="max-w-4xl mx-auto text-center mb-12">
        <h1 className="text-5xl font-extrabold text-purple-800 mb-4 leading-tight">
          Unlock Your Full Glow Potential ✨
        </h1>
        <p className="text-xl text-gray-700">
          Choose the perfect plan to elevate your skincare and makeup journey with the best model ever - WonderJoy AI.
        </p>
      </div>

      {paymentError && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6 w-full max-w-xl" role="alert">
          <strong className="font-bold">Payment Error:</strong>
          <span className="block sm:inline"> {paymentError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 w-full max-w-6xl">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`
              bg-white rounded-3xl shadow-xl border-2
              flex flex-col p-6 sm:p-8 transform transition duration-300 hover:scale-105
              relative
              ${plan.isPopular ? 'border-purple-500 ring-4 ring-purple-200' : 'border-gray-100'}
              ${user?.subscriptionPlan === plan.id ? 'bg-indigo-50' : ''} {/* Highlight current plan */}
            `}
          >
            {plan.isPopular && (
              <div className="absolute -top-3 right-4 bg-purple-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md transform rotate-3">
                Most Popular!
              </div>
            )}
            <h2 className="text-3xl font-bold text-purple-700 mb-4">{plan.name}</h2>
            <div className="flex items-baseline mb-6">
              <span className="text-5xl font-extrabold text-gray-900">{plan.price}</span>
              <span className="text-xl font-medium text-gray-600 ml-2">{plan.priceDetails}</span>
            </div>
            <ul className="flex-grow space-y-3 text-gray-700 text-left mb-8">
              {plan.features.map((feature, index) => (
                <li key={index} className="flex items-center">
                  <svg className="h-6 w-6 text-green-500 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={() => handleSubscribeClick(plan.id)}
              className={`
                mt-auto w-full py-3 px-6 rounded-full text-lg font-semibold shadow-lg
                transition duration-300 ease-in-out transform hover:scale-105 hover:shadow-xl
                ${(plan.id === 'free' || user?.subscriptionPlan === plan.id)
                  ? 'bg-gray-200 text-gray-700 cursor-not-allowed opacity-75'
                  : 'bg-gradient-to-r from-purple-600 to-pink-500 text-white focus:outline-none focus:ring-4 focus:ring-purple-300'
                }
                ${loadingPayment === plan.id ? 'opacity-50 cursor-not-allowed' : ''}
              `}
              disabled={
                plan.id === 'free' || // Free plan is not clickable for subscription
                user?.subscriptionPlan === plan.id || // User already has this plan
                loadingPayment === plan.id || // This specific plan's payment is loading
                authLoading || // Auth state is still loading (Firebase not ready)
                !user // User object is not yet available (initial load before anonymous sign-in)
              }
            >
              {authLoading ? 'Loading...' : loadingPayment === plan.id ? 'Processing...' : (user?.subscriptionPlan === plan.id ? 'Current Plan' : plan.buttonText)}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
