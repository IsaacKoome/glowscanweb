// app/page.tsx
"use client";

import React from 'react';
import Link from 'next/link';
import { useCamera } from '../context/CameraContext'; // NEW: Import useCamera hook

export default function HomePage() {
  const { setShowCamera } = useCamera(); // NEW: Get setShowCamera from CameraContext

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-128px)] bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 p-6 text-center">
      <div className="max-w-3xl mx-auto py-12 px-6 bg-white rounded-3xl shadow-xl border border-gray-100 transform transition duration-500 hover:scale-105 relative">
        <h1 className="text-5xl font-extrabold text-purple-800 mb-6 leading-tight">
          Your Daily Beauty Mirror, Powered by AI ✨
        </h1>
        <p className="text-xl text-gray-700 mb-8 max-w-2xl mx-auto">
          Uncover the secrets to radiant skin and flawless makeup with WonderJoy AI. Get instant, personalized analysis directly from your camera.
        </p>

        {/* Primary CTA: Open Camera */}
        <button
          onClick={() => setShowCamera(true)}
          className="inline-flex items-center justify-center bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold py-5 px-12 rounded-full text-3xl shadow-xl transition duration-300 ease-in-out transform hover:scale-105 hover:shadow-2xl focus:outline-none focus:ring-4 focus:ring-purple-400 mb-6"
        >
          Open My Beauty Mirror 📸
        </button>
        <p className="text-lg text-gray-600 mb-8">
          Start your real-time skin and makeup analysis instantly.
        </p>

        {/* Secondary CTAs */}
        <div className="flex flex-col sm:flex-row justify-center gap-4 mt-8">
         

          {/* Button to Pricing Page */}
          <Link href="/pricing" className="inline-flex items-center justify-center bg-green-100 text-green-700 font-bold py-3 px-8 rounded-full text-xl shadow-md transition duration-300 ease-in-out hover:bg-green-200">
            View Plans & Pricing 💰
          </Link>
          
        </div>
      </div>

      {/* NEW: Early Stage Development Message */}
      <div className="mt-16 max-w-3xl mx-auto bg-yellow-50 border border-yellow-200 rounded-2xl shadow-lg p-6 text-center text-yellow-800">
        <h2 className="text-2xl font-bold mb-3">We&apos;re Just Getting Started! 🌱</h2>
        <p className="text-lg mb-4">
          WonderJoy AI is in its early development phase. We&apos;re constantly working to refine our analysis, add exciting new features, and squash any bugs you might encounter. Your experience helps us grow!
        </p>
        <p className="text-lg mb-6">
          If you love what we&apos;re building and want to help shape the future of beauty tech, consider becoming an early adopter or sharing your valuable feedback.
        </p>
        <Link href="mailto:koomeisaac16@gmail.com" className="inline-flex items-center justify-center bg-yellow-500 text-white font-bold py-3 px-8 rounded-full text-lg shadow-md transition duration-300 ease-in-out hover:bg-yellow-600 focus:outline-none focus:ring-4 focus:ring-yellow-300">
          Reach Us ❤️
        </Link>
      </div>
    </div>
  );
}
