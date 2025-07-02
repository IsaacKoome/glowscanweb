// app/page.tsx
"use client";

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import AnalysisResult from '../components/AnalysisResult'; // Make sure path is correct

export default function HomePage() {
  const [showCamera, setShowCamera] = useState(false);
  const [capturedImagePreviewUrl, setCapturedImagePreviewUrl] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<any | null>(null); // For snapshot analysis result
  const [liveResult, setLiveResult] = useState<any | null>(null); // NEW: For continuous live analysis result
  const [loadingAnalysis, setLoadingAnalysis] = useState<boolean>(false); // For snapshot analysis loading
  const [isStreamingAnalysis, setIsStreamingAnalysis] = useState<boolean>(false); // NEW: Indicates if live analysis is active
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null); // Corrected type for videoRef
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Main effect to manage camera stream and live analysis interval
  useEffect(() => {
    let stream: MediaStream | null = null;
    let intervalId: NodeJS.Timeout | undefined;

    const initCamera = async () => {
      if (!videoRef.current || !showCamera) {
        console.log("initCamera: videoRef.current is null or showCamera is false. Not initializing camera.");
        return;
      }

      setCapturedImagePreviewUrl(null);
      setAnalysisResult(null);
      setLiveResult(null); // Clear live results on new camera open
      setError(null);

      try {
        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: 'user',
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          }
        };

        console.log("Attempting to get camera stream with constraints:", constraints);
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log("Camera stream obtained:", stream);

        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = async () => {
          console.log("Video metadata loaded.");
          try {
            await videoRef.current?.play();
            console.log("Video playback started.");
            setIsStreamingAnalysis(true); // Start streaming analysis when video plays

            // Start sending frames every 3 seconds
            intervalId = setInterval(() => {
              sendFrameForLiveAnalysis();
            }, 3000); // Adjust interval as needed (e.g., 5000ms for 5 seconds)

          } catch (playErr: any) {
            console.error("Error playing video stream:", playErr);
            setError("Failed to play camera stream. Is camera in use by another app?");
            setShowCamera(false); // Close camera on playback error
          }
        };
        videoRef.current.load();

      } catch (err: any) {
        console.error('Error accessing camera in initCamera:', err);
        let message = 'Unable to access the camera.';
        if (err.name === 'NotAllowedError' || err.name === 'SecurityError') {
          message = 'Camera access denied. Please allow permissions in browser/device settings.';
        } else if (err.name === 'NotFoundError') {
          message = 'No camera device found. Try switching to a device with a camera.';
        } else if (window.location.protocol !== 'https:') {
          message = 'Camera access requires HTTPS. Please deploy your app over HTTPS to enable camera.';
        } else {
          message = `Camera error: ${err.message || err.name}.`;
        }
        setError(message);
        setShowCamera(false); // Hide modal if camera access fails
      }
    };

    if (showCamera && videoRef.current) {
      initCamera();
    }

    // Cleanup function: stop stream and clear interval when component unmounts or showCamera becomes false
    return () => {
      if (stream) {
        console.log("Stopping video tracks during cleanup.");
        stream.getTracks().forEach((track) => track.stop());
      }
      if (intervalId) {
        console.log("Clearing live analysis interval.");
        clearInterval(intervalId);
      }
      setIsStreamingAnalysis(false); // Ensure streaming analysis state is reset
    };
  }, [showCamera, videoRef.current]); // Dependencies: showCamera and videoRef.current


  // Close Camera function (still separate for button clicks)
  const closeCamera = () => {
    setShowCamera(false); // This will trigger the useEffect cleanup
  };


  // NEW: Function to capture a frame and send for live analysis
  const sendFrameForLiveAnalysis = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || video.readyState < 2) { // Ensure video is ready
      console.warn("Live analysis: Video or canvas not ready.");
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext('2d');
    if (context) {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Convert canvas content to Blob (more efficient for FormData than DataURL then Blob)
      canvas.toBlob(async (blob) => {
        if (!blob) {
          console.error("Failed to create blob from canvas.");
          return;
        }

        const formData = new FormData();
        formData.append('file', new File([blob], "live_frame.jpg", { type: "image/jpeg" }));

        // IMPORTANT: Use your actual backend URL (e.g., your local FastAPI or deployed Cloud Function)
        const API_ENDPOINT = 'https://glowscan-backend-241128138627.us-central1.run.app/predict'; 

        try {
          // No loading state for individual live frames, as it's continuous
          const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => response.text());
            console.error(`Live analysis HTTP Error! Status: ${response.status}. Details: ${JSON.stringify(errorData)}`);
            // Optionally set a temporary error state for live analysis
            // setError(`Live analysis failed: ${response.status}`);
            return;
          }

          const result = await response.json();
          setLiveResult(result); // Update the live result state
          console.log("Live analysis result:", result);

        } catch (err: any) {
          console.error('Live analysis fetch error:', err);
          // setError(`Live analysis network error: ${err.message}`); // Avoid constant error pop-ups for live stream
        }
      }, 'image/jpeg', 0.8); // JPEG format with 80% quality
    }
  };

  // Function to capture a single snapshot (for explicit capture button)
  const captureSnapshot = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || video.readyState < 2) {
      setError('Camera or canvas not ready for snapshot.');
      return;
    }
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext('2d');
    if (context) {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9); // Quality 0.9

      setCapturedImagePreviewUrl(imageDataUrl); // Show captured image preview
      closeCamera(); // Close the live camera view after capturing

      const blob = await (await fetch(imageDataUrl)).blob();
      const file = new File([blob], "snapshot.jpg", { type: "image/jpeg" });

      handleAnalyzeSnapshot(file); // Send this File object for analysis
    }
  };

  // Function to send the captured snapshot to the backend for analysis (snapshot-specific)
  const handleAnalyzeSnapshot = async (file: File) => {
    setLoadingAnalysis(true); // Set loading for snapshot analysis
    setError(null);
    setAnalysisResult(null); // Clear previous snapshot result

    const formData = new FormData();
    formData.append('file', file);

    const API_ENDPOINT = 'https://glowscan-backend-241128138627.us-central1.run.app/predict'; 

    try {
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => response.text());
        throw new Error(`HTTP error! Status: ${response.status}. Details: ${
          typeof errorData === 'object' ? JSON.stringify(errorData) : errorData
        }`);
      }

      const result = await response.json();
      setAnalysisResult(result); // Set snapshot analysis result

    } catch (err: any) {
      console.error('Snapshot Analysis API error:', err);
      setError(`Failed to get snapshot analysis: ${err.message}. Ensure backend is running.`);
    } finally {
      setLoadingAnalysis(false);
    }
  };


  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-128px)] bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 p-6 text-center">
      <div className="max-w-3xl mx-auto py-12 px-6 bg-white rounded-3xl shadow-xl border border-gray-100 transform transition duration-500 hover:scale-105">
        <h1 className="text-5xl font-extrabold text-purple-800 mb-6 leading-tight">
          Your Daily Beauty Mirror, Powered by AI ✨
        </h1>
        <p className="text-xl text-gray-700 mb-8 max-w-2xl mx-auto">
          Uncover the secrets to radiant skin and flawless makeup with Glowscan AI. Your personal beauty companion, right in your pocket.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          {/* Real-time Skin Analysis - Now Opens Camera */}
          <button
            onClick={() => setShowCamera(true)}
            className="p-6 bg-pink-50 rounded-2xl shadow-md border border-pink-100 hover:shadow-lg transform transition duration-300 hover:-translate-y-1 text-left cursor-pointer"
          >
            <h2 className="text-3xl font-bold text-pink-600 mb-3">
              Real-time Skin Analysis 🔬
            </h2>
            <p className="text-gray-700">
              Just open your camera and let our AI instantly analyze your skin's health, hydration, and more.
            </p>
          </button>

          {/* Makeup Perfection Guide - Now Opens Camera */}
          <button
            onClick={() => setShowCamera(true)}
            className="p-6 bg-blue-50 rounded-2xl shadow-md border border-blue-100 hover:shadow-lg transform transition duration-300 hover:-translate-y-1 text-left cursor-pointer"
          >
            <h2 className="text-3xl font-bold text-blue-600 mb-3">
              Makeup Perfection Guide 💄
            </h2>
            <p className="text-gray-700">
              Get personalized feedback on your makeup application – from foundation blend to lipstick shade!
            </p>
          </button>
        </div>

        {/* Main Call to Action Button - Still links to upload page for file selection */}
        <Link href="/upload" className="inline-flex items-center justify-center bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold py-4 px-10 rounded-full text-2xl shadow-lg transition duration-300 ease-in-out transform hover:scale-105 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-purple-300">
          Upload Image from Files 📂
        </Link>
      </div>

      {/* Camera Modal */}
      {showCamera && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex flex-col items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 shadow-xl w-full max-w-2xl">
            <h2 className="text-2xl font-bold mb-4 text-center text-purple-700">Live Camera Mirror 🤳</h2>
            <div className="relative w-full aspect-video bg-gray-800 rounded-xl overflow-hidden mb-4">
              <video 
                ref={videoRef} 
                className="w-full h-full object-cover" 
                autoPlay 
                playsInline 
                muted 
                style={{ transform: 'scaleX(-1)' }} 
              ></video>
              <canvas ref={canvasRef} className="hidden"></canvas>
            </div>
            
            {/* Live Analysis Insights Display */}
            {isStreamingAnalysis && (
              <div className="mt-4 p-4 bg-purple-50 rounded-xl shadow-inner text-purple-800 text-center">
                <h3 className="text-lg font-semibold mb-1">Live Skin Insights</h3>
                {liveResult ? (
                  // Display live result using the AnalysisResult component
                  <AnalysisResult result={liveResult} />
                ) : (
                  <p>Analyzing live... 🔄</p>
                )}
              </div>
            )}

            <div className="flex justify-center space-x-4 mt-4"> {/* Added mt-4 for spacing */}
              <button
                onClick={captureSnapshot}
                className="flex-1 bg-green-500 text-white py-3 rounded-full text-lg font-semibold hover:bg-green-600 transition shadow-md"
              >
                Capture Snapshot 📸
              </button>
              <button
                onClick={closeCamera}
                className="flex-1 bg-red-500 text-white py-3 rounded-full text-lg font-semibold hover:bg-red-600 transition shadow-md"
              >
                Close Camera ✖️
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Display captured image and analysis results if available */}
      {capturedImagePreviewUrl && !loadingAnalysis && !showCamera && (
        <div className="mt-8 w-full max-w-xl bg-white rounded-3xl shadow-xl border border-gray-100 p-8 text-center">
          <h2 className="text-2xl font-extrabold text-purple-700 mb-6">Your Snapshot & Analysis</h2>
          <div className="relative w-64 h-48 sm:w-80 sm:h-60 mx-auto bg-gray-200 rounded-xl overflow-hidden border-2 border-gray-300 shadow-sm mb-6">
            <Image
              src={capturedImagePreviewUrl}
              alt="Captured Snapshot"
              layout="fill"
              objectFit="contain"
              className="rounded-xl"
            />
          </div>
          {loadingAnalysis ? (
            <div className="flex items-center justify-center py-4">
              <svg className="animate-spin h-8 w-8 text-purple-500 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="text-lg text-gray-700">Analyzing your snapshot...</p>
            </div>
          ) : error ? (
            <div className="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg w-full text-center">
              <p className="font-bold mb-1">Error:</p>
              <p>{error}</p>
            </div>
          ) : (
            analysisResult && <AnalysisResult result={analysisResult} />
          )}
        </div>
      )}
    </div>
  );
}