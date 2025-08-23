// components/HeaderNavClient.tsx
"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';
import { useCamera } from '../context/CameraContext'; // 👈 NEW: use CameraContext
import {
  SparklesIcon,
  ClockIcon,
  UserIcon,
  ArrowRightEndOnRectangleIcon,
  KeyIcon
} from '@heroicons/react/24/solid';
import {
  Bars3Icon,
  XMarkIcon
} from '@heroicons/react/24/outline';

export default function HeaderNavClient() {
  const { user, loading, logout } = useAuth();
  const { openCamera } = useCamera(); // 👈 NEW
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  if (loading) return null;

  return (
    <div className="flex flex-col sm:flex-row items-center w-full sm:w-auto">
      <div className="sm:hidden flex justify-end w-full mb-2">
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-white">
          {isMobileMenuOpen ? <XMarkIcon className="h-8 w-8" /> : <Bars3Icon className="h-8 w-8" />}
        </button>
      </div>

      <nav className={`${isMobileMenuOpen ? 'flex flex-col' : 'hidden'} sm:flex sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-6 w-full sm:w-auto`}>
        
        {/* New Analysis: Primary Feature */}
        <button
          onClick={() => {
            openCamera();
            setIsMobileMenuOpen(false);
          }}
          className="flex items-center px-5 py-2 rounded-full bg-white text-purple-700 font-semibold text-lg hover:bg-purple-100 transition-colors shadow-md transform hover:scale-105"
        >
          <SparklesIcon className="h-6 w-6 mr-2" />
          New Analysis
        </button>

        {/* Secondary: Chat with AI */}
        <Link
          href="/chat"
          className="text-white text-lg font-semibold hover:text-pink-200 transition-colors"
          onClick={() => setIsMobileMenuOpen(false)}
        >
          Chat with AI
        </Link>

        <Link href="/tips" className="text-white text-lg font-semibold hover:text-pink-200 transition-colors" onClick={() => setIsMobileMenuOpen(false)}>
          Tips
        </Link>

        <Link href="/billing" className="text-white text-lg font-semibold hover:text-pink-200 transition-colors" onClick={() => setIsMobileMenuOpen(false)}>
          Billing
        </Link>

        {user ? (
          <button onClick={() => { logout(); setIsMobileMenuOpen(false); }} className="flex items-center bg-white text-purple-600 py-2 px-4 rounded-full text-base font-semibold hover:bg-gray-100 shadow-md mt-4 sm:mt-0">
            <ArrowRightEndOnRectangleIcon className="h-6 w-6 mr-1" />
            Logout
          </button>
        ) : (
          <Link href="/login">
            <button onClick={() => setIsMobileMenuOpen(false)} className="flex items-center bg-white text-purple-600 py-2 px-4 rounded-full text-base font-semibold hover:bg-gray-100 shadow-md mt-4 sm:mt-0">
              <KeyIcon className="h-6 w-6 mr-1" />
              Login / Register
            </button>
          </Link>
        )}
      </nav>
    </div>
  );
}
