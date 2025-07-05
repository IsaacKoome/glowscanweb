// app/profile/[uid]/page.tsx
"use client"; // This is a Client Component as it uses hooks and client-side logic

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useParams } from 'next/navigation'; // To get dynamic route parameters
import Image from 'next/image'; // <--- ADD THIS IMPORT
import Link from 'next/link';   // <--- ADD THIS IMPORT
import { useAuth } from '../../../context/AuthContext'; // Adjust path if necessary

export default function UserProfilePage() {
  const { user, loading } = useAuth(); // Get user and loading state from AuthContext
  const router = useRouter();
  const params = useParams(); // Get dynamic route parameters
  const profileUid = params.uid as string; // The UID from the URL (e.g., /profile/abc123def)

  // State for additional user data (will be fetched from Firestore later)
  const [profileData, setProfileData] = useState<{ bio?: string; profilePicture?: string } | null>(null);
  const [profileLoading, setProfileLoading] = useState(true); // Loading state for profile data

  useEffect(() => {
    // --- Route Protection Logic ---
    if (loading) {
      // Still loading auth state, do nothing yet
      return;
    }

    if (!user) {
      // Not logged in, redirect to login page
      console.log("User not logged in, redirecting to /login");
      router.push('/login');
      return;
    }

    if (user.uid !== profileUid) {
      // Logged in, but trying to access another user's profile
      console.log(`Attempted to access profile ${profileUid}, but current user is ${user.uid}. Redirecting.`);
      // Redirect to their own profile or a generic access denied page
      router.push(`/profile/${user.uid}`); // Redirect to their own profile
      return;
    }

    // --- Fetch Profile Data (Placeholder for now, will use Firestore later) ---
    // In a real app, you'd fetch additional user data from Firestore here
    // For now, we'll simulate loading
    const fetchUserData = async () => {
      setProfileLoading(true);
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay

      // Placeholder data
      setProfileData({
        bio: "Hello, I'm a beauty enthusiast using WonderJoy AI to enhance my skincare and makeup routine!",
        profilePicture: "https://placehold.co/150x150/E0BBE4/FFFFFF?text=P" // Placeholder image
      });
      setProfileLoading(false);
    };

    fetchUserData();

  }, [user, loading, profileUid, router]); // Dependencies for useEffect

  // --- Render Logic based on Auth and Data Loading ---
  if (loading || profileLoading) {
    // Show a loading spinner while authentication or profile data is being fetched
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-128px)] bg-gradient-to-br from-purple-50 to-pink-50 p-6 text-center">
        <svg className="animate-spin h-10 w-10 text-purple-500 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p className="text-xl text-gray-700">Loading profile...</p>
      </div>
    );
  }

  // If we reach here, user is logged in and it's their profile
  if (!user) {
    // This case should ideally not be reached due to the redirect above,
    // but as a safeguard, return null or a message.
    return null; 
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-128px)] bg-gradient-to-br from-purple-50 to-pink-50 p-6 text-center">
      <div className="max-w-xl mx-auto py-12 px-6 bg-white rounded-3xl shadow-xl border border-gray-100">
        <h1 className="text-4xl font-extrabold text-purple-800 mb-6">
          My Profile 👤
        </h1>
        
        {profileData?.profilePicture && (
          <div className="mb-6">
            <Image 
              src={profileData.profilePicture} 
              alt="Profile Picture" 
              width={150} 
              height={150} 
              className="rounded-full mx-auto border-4 border-purple-300 shadow-md"
            />
          </div>
        )}

        <div className="text-left mb-8 space-y-3">
          <p className="text-xl text-gray-700">
            <strong>Email:</strong> <span className="font-semibold text-purple-700">{user.email}</span>
          </p>
          <p className="text-xl text-gray-700">
            <strong>User ID:</strong> <span className="font-mono text-sm bg-gray-100 p-1 rounded break-all">{user.uid}</span>
          </p>
          {profileData?.bio && (
            <p className="text-xl text-gray-700">
              <strong>Bio:</strong> <span className="text-gray-600 italic">{profileData.bio}</span>
            </p>
          )}
        </div>

        {/* Link to Edit Profile Page */}
        <div className="mt-8">
          <Link href={`/profile/${user.uid}/edit`} passHref>
            <button className="bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold py-3 px-8 rounded-full text-xl shadow-lg transition duration-300 ease-in-out transform hover:scale-105 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-blue-300">
              Edit Profile ✏️
            </button>
          </Link>
        </div>

        {/* Optional: Placeholder for saved analysis history */}
        <div className="mt-12 p-6 bg-pink-50 rounded-2xl border border-pink-100 shadow-inner">
          <h3 className="text-2xl font-bold text-pink-600 mb-4">Your Analysis History 📊</h3>
          <p className="text-gray-700">
            (Coming soon: Your past skin and makeup analysis results will appear here!)
          </p>
        </div>
      </div>
    </div>
  );
}