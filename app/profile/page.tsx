// app/profile/page.tsx
"use client"; // This is necessary for client-side functionality like useState, useEffect, localStorage

import React, { useState, useEffect } from 'react';

export default function ProfilePage() {
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [skinType, setSkinType] = useState('');
  const [message, setMessage] = useState(''); // For displaying success/error messages

  useEffect(() => {
    // Load profile data from localStorage when the component mounts (client-side only)
    if (typeof window !== 'undefined' && window.localStorage) {
      setName(localStorage.getItem('profileName') || '');
      setAge(localStorage.getItem('profileAge') || '');
      setSkinType(localStorage.getItem('profileSkinType') || '');
    }
  }, []); // Empty dependency array ensures this runs once on mount

  // Handles saving profile data to localStorage
  const saveProfile = () => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem('profileName', name);
        localStorage.setItem('profileAge', age);
        localStorage.setItem('profileSkinType', skinType);
        setMessage('Profile saved successfully! 🎉');
        // Clear message after a few seconds
        setTimeout(() => setMessage(''), 3000);
      } catch (e) {
        console.error('Error saving profile to localStorage:', e);
        setMessage('Error saving profile. Please try again.');
      }
    }
  };

  return (
    <div className="flex flex-col items-center min-h-[calc(100vh-128px)] bg-gradient-to-br from-purple-50 to-pink-50 p-6"> {/* Gradient background */}
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-gray-100 p-8 mt-8 text-center">
        <h1 className="text-3xl font-extrabold text-purple-700 mb-8">Your Profile 👤</h1>

        <div className="mb-6">
          <label htmlFor="name" className="block text-gray-700 text-left text-sm font-semibold mb-2">Name:</label>
          <input
            type="text"
            id="name"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 transition duration-200"
            placeholder="Enter your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="mb-6">
          <label htmlFor="age" className="block text-gray-700 text-left text-sm font-semibold mb-2">Age:</label>
          <input
            type="number"
            id="age"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 transition duration-200"
            placeholder="Enter your age"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            inputMode="numeric"
          />
        </div>

        <div className="mb-8">
          <label htmlFor="skinType" className="block text-gray-700 text-left text-sm font-semibold mb-2">Skin Type:</label>
          <input
            type="text"
            id="skinType"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 transition duration-200"
            placeholder="e.g., Oily, Dry, Combination, Normal"
            value={skinType}
            onChange={(e) => setSkinType(e.target.value)}
          />
        </div>

        <button
          onClick={saveProfile}
          className="bg-gradient-to-r from-pink-500 to-purple-500 text-white font-bold py-3 px-8 rounded-full text-lg shadow-lg transition duration-300 ease-in-out transform hover:scale-105 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-purple-300"
        >
          Save Profile
        </button>

        {/* Display success/error message */}
        {message && (
          <p className={`mt-6 text-lg font-semibold ${message.includes('Error') ? 'text-red-600' : 'text-green-600'}`}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
}