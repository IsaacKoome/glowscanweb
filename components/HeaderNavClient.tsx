// components/HeaderNavClient.tsx
"use client"; // This component MUST be a client component

import React, { useState } from 'react'; // Import useState for mobile menu
import Link from 'next/link';
import { useAuth } from '../context/AuthContext'; // Import useAuth hook
import {
  SparklesIcon,      // For New Analysis
  UserIcon,         // For Profile
  ArrowRightEndOnRectangleIcon, // For Logout
  KeyIcon           // For Login/Register
} from '@heroicons/react/24/solid'; // Using solid icons for main navigation items
import {
  Bars3Icon,        // Hamburger icon for mobile menu open
  XMarkIcon         // Close icon for mobile menu close
} from '@heroicons/react/24/outline'; // Outline icons for menu toggles


export default function HeaderNavClient() {
  const { user, loading, logout } = useAuth(); // Use the auth context
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); // State for mobile menu


  // Avoid rendering anything until auth state is loaded to prevent flickering
  if (loading) {
    return null; // Or a loading spinner if you prefer
  }

  return (
    <div className="flex flex-col sm:flex-row items-center space-x-0 sm:space-x-6 w-full sm:w-auto">

      {/* Mobile Menu Button - visible only on small screens */}
      <div className="sm:hidden flex justify-end w-full mb-2"> {/* Pushed to the right on mobile */}
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

      {/* Desktop Navigation & Mobile Menu Overlay */}
      <nav className={`
        ${isMobileMenuOpen ? 'flex flex-col' : 'hidden'}
        sm:flex sm:flex-row
        items-center
        space-y-4 sm:space-y-0
        space-x-0 sm:space-x-6
        w-full sm:w-auto
        ${isMobileMenuOpen ? 'absolute top-full left-0 bg-purple-700 shadow-lg py-4 transition-all duration-300 ease-in-out transform origin-top animate-fade-in-down' : ''}
        sm:static sm:bg-transparent sm:shadow-none sm:py-0
      `}>
        {/* NEW: Live Analysis Button (Primary Action) */}
        <Link
          href="/"
          className="flex items-center px-5 py-2 rounded-full bg-white text-purple-700 font-semibold text-lg hover:bg-purple-100 transition-colors shadow-md transform hover:scale-105"
          onClick={() => setIsMobileMenuOpen(false)} // Close menu on click
        >
          <SparklesIcon className="h-6 w-6 mr-2" />
          Live Analysis
        </Link>

        {/* Existing Chat Link */}
        <Link
          href="/chat"
          className="text-white text-lg font-semibold hover:text-pink-200 transition-colors"
          onClick={() => setIsMobileMenuOpen(false)}
        >
          Chat
        </Link>

       

        {/* Existing Tips Link */}
        <Link
          href="/tips"
          className="text-white text-lg font-semibold hover:text-pink-200 transition-colors"
          onClick={() => setIsMobileMenuOpen(false)}
        >
          Tips
        </Link>

        {/* Existing Billing Link */}
        <Link
          href="/billing"
          className="text-white text-lg font-semibold hover:text-pink-200 transition-colors"
          onClick={() => setIsMobileMenuOpen(false)}
        >
          Billing
        </Link>

        {/* Profile Link - only show if user is logged in */}
        {user && (
          <Link
            href={`/profile/${user.uid}`}
            className="flex items-center text-white text-lg font-semibold hover:text-pink-200 transition-colors"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <UserIcon className="h-6 w-6 mr-1" />
            Profile
          </Link>
        )}

        {/* Auth Button - always at the end */}
        {user ? (
          // User is logged in
          <button
            onClick={() => {
              logout();
              setIsMobileMenuOpen(false); // Close menu on logout
            }}
            className="flex items-center bg-white text-purple-600 py-2 px-4 rounded-full text-base font-semibold hover:bg-gray-100 transition shadow-md mt-4 sm:mt-0" // mt-4 for mobile spacing
          >
            <ArrowRightEndOnRectangleIcon className="h-6 w-6 mr-1" />
            Logout
          </button>
        ) : (
          // User is not logged in
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