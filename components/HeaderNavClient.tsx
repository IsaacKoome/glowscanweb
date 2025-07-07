// components/HeaderNavClient.tsx
"use client"; // This component MUST be a client component

import React from 'react';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext'; // Import useAuth hook

export default function HeaderNavClient() {
  const { user, loading, logout } = useAuth(); // Use the auth context

  // Avoid rendering anything until auth state is loaded to prevent flickering
  if (loading) {
    return null; // Or a loading spinner if you prefer
  }

  return (
    <div className="flex flex-col sm:flex-row items-center space-x-0 sm:space-x-6 w-full sm:w-auto">
      {/* Navigation Links */}
      <nav className="flex space-x-6 mb-2 sm:mb-0"> {/* Added mb-2 for spacing on mobile */}
        <Link href="/" 
        className="text-white text-lg font-semibold hover:text-pink-200 transition-colors">Home
        </Link>
        <Link href="/upload" 
        className="text-white text-lg font-semibold hover:text-pink-200 transition-colors">Upload
        </Link>
        <Link href="/tips"
          className="text-white text-lg font-semibold hover:text-pink-200 transition-colors">Tips
        </Link>

        {/* NEW: Profile Link - only show if user is logged in */}
        {user && (
          <Link href={`/profile/${user.uid}`} 
          className="text-white text-lg font-semibold hover:text-pink-200 transition-colors">Profile 👤
          </Link>
        )}
      </nav>

      {/* Auth Button - pushed to the far right within this flex container */}
      <div className="ml-0 sm:ml-auto"> {/* ml-auto on sm screens to push right, ml-0 on mobile */}
        {user ? (
          // User is logged in
          <button
            onClick={logout}
            className="bg-white text-purple-600 py-2 px-4 rounded-full text-base font-semibold hover:bg-gray-100 transition shadow-md"
          >
            Logout 👋
          </button>
        ) : (
          // User is not logged in
          <Link href="/login" passHref>
            <button className="bg-white text-purple-600 py-2 px-4 rounded-full text-base font-semibold hover:bg-gray-100 transition shadow-md">
              Login / Register 🔑
            </button>
          </Link>
        )}
      </div>
    </div>
  );
}

