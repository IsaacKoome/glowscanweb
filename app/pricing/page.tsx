"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

interface Plan {
  id: string;
  name: string;
  price: string;
  priceDetails: string;
  features: string[];
  buttonText: string;
  isPopular?: boolean;
  paystackPlanCode?: string | null;
}

const plans: Plan[] = [
  {
    id: 'free',
    name: 'Free Plan',
    price: '$0',
    priceDetails: 'per month',
    features: [
      '3 analyses per day (Fast AI Model)', // Updated
      'Basic skin & makeup insights',
      'Access to community tips',
      'No credit card required'
    ],
    buttonText: 'Choose Free',
    paystackPlanCode: null,
  },
  {
    id: 'basic',
    name: 'Basic Plan',
    price: '$5', // Updated to USD
    priceDetails: 'per month',
    features: [
      '3 analyses per day (Our Best AI Model)', // Updated
      '10 analyses per day (Fast AI Model)', // Updated
      'Advanced skin & makeup insights',
      'Priority email support',
      'Ad-free experience'
    ],
    buttonText: 'Choose Basic',
    paystackPlanCode: "PLN_pb8k1oxtu8n3bh1",
  },
  {
    id: 'standard',
    name: 'Standard Plan',
    price: '$20', // Updated to USD
    priceDetails: 'per month',
    features: [
      '10 analyses per day (Our Best AI Model)', // Updated
      'Unlimited analyses (Fast AI Model)', // Updated
      'Detailed personalized reports',
      'Dedicated chat support',
      'Early access to new features'
    ],
    buttonText: 'Choose Standard',
    isPopular: true,
    paystackPlanCode: "PLN_qc9ac75tvut6h0h",
  },
  {
    id: 'premium',
    name: 'Premium Plan',
    price: '$100', // Updated to USD
    priceDetails: 'per month',
    features: [
      'Unlimited analyses from our best model', // Updated for consistency
      'Unlimited analyses (Fast AI Model)', // Updated
      'Exclusive expert webinars',
      '24/7 priority support',
      'Personalized beauty consultations'
    ],
    buttonText: 'Choose Premium',
    paystackPlanCode: "PLN_x3g9ffyhjwjtv74",
  },
];

export default function PricingPage() {
  const { user, loading: authLoading } = useAuth();
  const [loadingPayment, setLoadingPayment] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [tempUserId, setTempUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user && !tempUserId) {
      const storedTempId = localStorage.getItem('tempUserId');
      if (storedTempId) {
        setTempUserId(storedTempId);
      } else {
        const newTempId = crypto.randomUUID();
        localStorage.setItem('tempUserId', newTempId);
        setTempUserId(newTempId);
      }
    }
  }, [authLoading, user, tempUserId]);

  const handleSubscribeClick = async (planId: string) => {
    setLoadingPayment(planId);
    setPaymentError(null);

    const selectedPlan = plans.find(p => p.id === planId);
    if (!selectedPlan || !selectedPlan.paystackPlanCode) {
      setPaymentError("Invalid plan selected or missing Paystack plan code.");
      setLoadingPayment(null);
      return;
    }

    const userIdToSend = user ? user.uid : tempUserId;
    const userEmailToSend = user ? user.email : `${userIdToSend}@wonderjoy.ai`;

    if (!userIdToSend) {
      setPaymentError("User identifier missing. Please log in or refresh the page.");
      setLoadingPayment(null);
      return;
    }

    try {
      const response = await fetch('https://glowscan-backend-241128138627.us-central1.run.app/create-paystack-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': userIdToSend,
        },
        body: JSON.stringify({
          planId: planId,
          userEmail: userEmailToSend,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to initiate payment with Paystack.');
      }

      const data = await response.json();
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        setPaymentError("No checkout URL received from Paystack.");
      }
    } catch (error: any) {
      console.error('Payment initiation error:', error);
      setPaymentError(`Failed to initiate payment: ${error.message || 'An unexpected error occurred.'}`);
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
          Choose the perfect plan to elevate your skincare and makeup journey with WonderJoy AI.
        </p>
      </div>

      {paymentError && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6 w-full max-w-xl" role="alert">
          <strong className="font-bold">Payment Error:</strong>
          <span className="block sm:inline"> {paymentError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 w-full max-w-6xl">
        {plans.map((plan) => {
          const isCurrentPlan = user?.subscriptionPlan === plan.id;

          return (
            <div
              key={plan.id}
              className={`bg-white rounded-3xl shadow-xl border-2 flex flex-col p-6 sm:p-8 transform transition duration-300 hover:scale-105 relative ${
                plan.isPopular ? 'border-purple-500 ring-4 ring-purple-200' : 'border-gray-100'
              }`}
            >
              {plan.isPopular && (
                <div className="absolute -top-3 right-4 bg-purple-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md transform rotate-3">
                  Most Popular!
                </div>
              )}

              {isCurrentPlan && (
                <div className="absolute top-3 left-3 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow">
                  Your Current Plan
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
                  ${isCurrentPlan
                    ? 'bg-gray-200 text-gray-700 cursor-not-allowed opacity-75'
                    : 'bg-gradient-to-r from-purple-600 to-pink-500 text-white focus:outline-none focus:ring-4 focus:ring-purple-300'}
                  ${loadingPayment === plan.id ? 'opacity-50 cursor-not-allowed' : ''}
                `}
                disabled={isCurrentPlan || loadingPayment === plan.id || authLoading || (!user && !tempUserId)}
              >
                {isCurrentPlan ? 'Current Plan' : loadingPayment === plan.id ? 'Processing...' : plan.buttonText}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
