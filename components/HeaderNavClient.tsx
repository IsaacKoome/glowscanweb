"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';
import {
  SparklesIcon,
  ArrowRightEndOnRectangleIcon,
  KeyIcon
} from '@heroicons/react/24/solid';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';

export default function HeaderNavClient() {
  const { user, loading, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  if (loading) return null;

  return (
    <div className="flex flex-col sm:flex-row items-center space-x-0 sm:space-x-6 w-full sm:w-auto">
      {/* Mobile Toggle */}
      <div className="sm:hidden flex justify-end w-full mb-2">
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="text-white focus:outline-none"
          aria-label="Toggle navigation menu"
        >
          {isMobileMenuOpen ? (
            <XMarkIcon className="h-8 w-8" />
          ) : (
            <Bars3Icon className="h-8 w-8" />
          )}
        </button>
      </div>

      {/* Navigation Items */}
      <nav className={`
        ${isMobileMenuOpen ? 'flex flex-col' : 'hidden'}
        sm:flex sm:flex-row
        items-center
        space-y-4 sm:space-y-0
        space-x-0 sm:space-x-6
        w-full sm:w-auto
        ${isMobileMenuOpen ? 'absolute top-full left-0 bg-purple-700 shadow-lg py-4 transition-all duration-300 ease-in-out animate-fade-in-down' : ''}
        sm:static sm:bg-transparent sm:shadow-none sm:py-0
      `}>
        {/* ✅ New Analysis */}
        <Link
          href="/chat"
          className="flex items-center px-5 py-2 rounded-full bg-white text-purple-700 font-semibold text-lg hover:bg-purple-100 transition-colors shadow-md transform hover:scale-105"
          onClick={() => setIsMobileMenuOpen(false)}
        >
          <SparklesIcon className="h-6 w-6 mr-2" />
          New Analysis
        </Link>

        {/* ✅ Tips */}
        <Link
          href="/tips"
          className="text-white text-lg font-semibold hover:text-pink-200 transition-colors"
          onClick={() => setIsMobileMenuOpen(false)}
        >
          Tips
        </Link>

        {/* ✅ Billing */}
        <Link
          href="/billing"
          className="text-white text-lg font-semibold hover:text-pink-200 transition-colors"
          onClick={() => setIsMobileMenuOpen(false)}
        >
          Billing
        </Link>

        {/* 🔐 Auth Buttons */}
        {user ? (
          <button
            onClick={() => {
              logout();
              setIsMobileMenuOpen(false);
            }}
            className="flex items-center bg-white text-purple-600 py-2 px-4 rounded-full text-base font-semibold hover:bg-gray-100 transition shadow-md mt-4 sm:mt-0"
          >
            <ArrowRightEndOnRectangleIcon className="h-6 w-6 mr-1" />
            Logout
          </button>
        ) : (
          <Link href="/login" passHref>
            <button
              className="flex items-center bg-white text-purple-600 py-2 px-4 rounded-full text-base font-semibold hover:bg-gray-100 transition shadow-md mt-4 sm:mt-0"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <KeyIcon className="h-6 w-6 mr-1" />
              Login / Register
            </button>
          </Link>
        )}
      </nav>
    </div>
  );
}
