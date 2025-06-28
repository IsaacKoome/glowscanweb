// app/upload/page.tsx
"use client"; // This is necessary for client-side functionality like useState, useEffect, fetch, etc.

import React, { useState } from 'react';
import Image from 'next/image'; // For optimized image handling in Next.js
import ImageUploader from '../../components/ImageUploader'; // Adjust path based on your actual structure
import AnalysisResult from '../../components/AnalysisResult'; // Adjust path based on your actual structure

export default function UploadPage() {
  // Explicitly type useState hooks for better type safety
  const [selectedFile, setSelectedFile] = useState<File | null>(null); // Stores the actual File object
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null); // Stores URL for displaying preview
  const [analysisResult, setAnalysisResult] = useState<any | null>(null); // Use 'any' or define a more specific interface for your result
  const [loading, setLoading] = useState<boolean>(false); // Controls loading state for UI
  const [error, setError] = useState<string | null>(null); // Stores any error messages

  // This function is passed to ImageUploader and is called when a file is selected
  // Explicitly type 'file' as File and 'url' as string
  const handleImageSelected = (file: File, url: string) => {
    setSelectedFile(file);
    setImagePreviewUrl(url);
    setAnalysisResult(null); // Clear previous analysis results
    setError(null); // Clear any previous errors
  };

  // This function handles sending the selected image to the FastAPI backend for analysis
  const handleAnalyze = async () => {
    if (!selectedFile) {
      alert('Please select an image first before analyzing.'); // Simple alert for no image
      return;
    }

    setLoading(true); // Start loading state
    setError(null); // Clear previous errors
    setAnalysisResult(null); // Clear previous results

    // Create a FormData object to send the file
    const formData = new FormData();
    formData.append('file', selectedFile); // Append the actual File object

    // IMPORTANT: Replace with your actual computer's local IP address and port
    // Ensure your FastAPI server is running on this specific address and port
    const API_ENDPOINT = 'http://172.17.117.236:8000/predict'; 

    try {
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        // When using FormData, the 'Content-Type' header for 'multipart/form-data'
        // is automatically set by the browser/fetch API, including the necessary boundary.
        // DO NOT manually set 'Content-Type': 'multipart/form-data' here.
        body: formData,
      });

      if (!response.ok) {
        // If the server response is not OK (e.g., 4xx or 5xx error)
        const errorData = await response.json().catch(() => response.text()); // Try to parse as JSON, fall back to text
        // Improved error message to be more specific
        throw new Error(`HTTP error! Status: ${response.status}. Details: ${
          typeof errorData === 'object' ? JSON.stringify(errorData) : errorData
        }`);
      }

      const result = await response.json(); // Parse the JSON response from FastAPI
      setAnalysisResult(result); // Set the received analysis result
      
    } catch (err: any) { // Type 'err' as 'any' or 'Error' for safety
      // Catch network errors or errors thrown from the response handling
      console.error('Analysis error:', err);
      setError(`Failed to analyze image: ${err.message}. Please check server connection and console for details.`);
    } finally {
      setLoading(false); // End loading state
    }
  };

  return (
    <div className="flex flex-col items-center min-h-[calc(100vh-128px)] bg-gray-100 p-6">
      <div className="w-full max-w-xl bg-white rounded-3xl shadow-xl border border-gray-100 p-8 mt-8 text-center">
        <h1 className="text-3xl font-extrabold text-purple-700 mb-6">Analyze Your Skin 📸</h1>

        {/* Image Uploader Component */}
        <ImageUploader onImageSelected={handleImageSelected} />

        {/* Display selected image preview and Analyze button */}
        {imagePreviewUrl && ( // Check if imagePreviewUrl is not null
          <div className="mt-8 flex flex-col items-center">
            <h2 className="text-xl font-semibold text-gray-700 mb-4">Selected Image:</h2>
            <div className="relative w-72 h-56 sm:w-80 sm:h-64 bg-gray-200 rounded-xl overflow-hidden border-2 border-gray-300 shadow-md">
              <Image
                src={imagePreviewUrl}
                alt="Selected Image Preview"
                layout="fill"
                objectFit="contain" // Ensures the entire image is visible within the container
                className="rounded-xl"
              />
            </div>
            {/* Analyze button, disabled when loading */}
            <button
              onClick={handleAnalyze}
              disabled={loading}
              className={`mt-8 py-3 px-8 rounded-full text-xl font-bold transition duration-300 ease-in-out transform hover:scale-105 shadow-lg ${
                loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-purple-300'
              }`}
            >
              {loading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Analyzing...
                </span>
              ) : (
                'Analyze Image'
              )}
            </button>
          </div>
        )}

        {/* Error message display */}
        {error && (
          <div className="mt-8 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg w-full text-center">
            <p className="font-bold mb-1">Analysis Error:</p>
            <p>{error}</p>
          </div>
        )}

        {/* Analysis Result Component */}
        {analysisResult && <AnalysisResult result={analysisResult} />}
      </div>
    </div>
  );
}