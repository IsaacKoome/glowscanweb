// app/page.tsx
"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import AnalysisResult from '../components/AnalysisResult'; // Make sure path is correct
import { useAuth } from '../context/AuthContext'; // NEW: Import useAuth hook

interface AnalysisResultData {
  [key: string]: unknown;
}

export default function HomePage() {
  const { user, loading: authLoading } = useAuth(); // NEW: Get user and authLoading from AuthContext
  const [showCamera, setShowCamera] = useState(false);
  const [capturedImagePreviewUrl, setCapturedImagePreviewUrl] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResultData | null>(null); // For snapshot analysis result
  const [liveResult, setLiveResult] = useState<AnalysisResultData | null>(null); // For continuous live analysis result
  const [isStreamingAnalysis, setIsStreamingAnalysis] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraStatus, setCameraStatus] = useState<'idle' | 'loading' | 'playing' | 'error'>('idle');

  // For unauthenticated users to have a temporary ID for quota tracking
  const [tempUserId, setTempUserId] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!authLoading && !user && !tempUserId) {
      const storedTempId = localStorage.getItem('tempUserId');
      if (storedTempId) {
        setTempUserId(storedTempId);
        console.log("HomePage: Loaded existing tempUserId from localStorage:", storedTempId);
      } else {
        const newTempId = crypto.randomUUID();
        localStorage.setItem('tempUserId', newTempId);
        setTempUserId(newTempId);
        console.log("HomePage: Generated new tempUserId:", newTempId);
      }
    }
  }, [authLoading, user, tempUserId]);

  // Debugging log for auth state on homepage
  useEffect(() => {
    console.log("HomePage: authLoading state:", authLoading, "User:", user ? user.email : "null", "UID:", user ? user.uid : "null", "Temp UID:", tempUserId);
  }, [authLoading, user, tempUserId]);

  // --- Function to send a frame for live analysis ---
  const sendFrameForLiveAnalysis = useCallback(async () => {
    if (isPaused || cameraStatus !== 'playing') {
      console.log("Live analysis skipped: paused or camera not playing.");
      return;
    }

    // NEW: Use either logged-in user's UID or temporary ID
    const userIdToSend = user ? user.uid : tempUserId;

    if (!userIdToSend) {
      console.error("Cannot send live analysis: No user ID (logged in or temporary) available.");
      setError("An internal error occurred: No user identifier. Please refresh or try again.");
      setIsPaused(true);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || video.readyState < 2) {
      console.warn("Live analysis: Video or canvas not ready.");
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext('2d');
    if (context) {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Convert canvas content to Blob with higher JPEG quality (0.9 instead of 0.8)
      canvas.toBlob(async (blob) => {
        if (!blob) {
          console.error("Failed to create blob from canvas.");
          return;
        }

        const formData = new FormData();
        formData.append('file', new File([blob], "live_frame.jpg", { type: "image/jpeg" }));

        const API_ENDPOINT = 'https://glowscan-backend-241128138627.us-central1.run.app/predict'; 

        try {
          const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            body: formData,
            // NEW: Add X-User-ID header here
            headers: {
              'X-User-ID': userIdToSend // Send the user's UID or temporary ID in the header
            }
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => response.text());
            console.error(`Live analysis HTTP Error! Status: ${response.status}. Details: ${JSON.stringify(errorData)}`);
            // Display specific error message to user if it's a quota error
            if (response.status === 429) {
                setError("Daily analysis quota exceeded. Please try again tomorrow or upgrade your plan.");
            } else {
                setError(`Analysis failed: ${errorData.detail || "Server error."}`);
            }
            return;
          }

          const result = await response.json();
          setLiveResult(result);
          console.log("Live analysis result:", result);

          setIsPaused(true); // Auto-pause after a successful analysis result is received

        } catch (err: unknown) {
          console.error('Live analysis fetch error:', err);
          if (err instanceof Error) {
            setError(`Network error during analysis: ${err.message}`);
          }
        }
      }, 'image/jpeg', 0.9); // Increased quality to 0.9
    }
  }, [isPaused, cameraStatus, user, tempUserId]); // Added 'user' and 'tempUserId' to useCallback dependencies

  // --- useEffect for Camera Stream Setup ---
  useEffect(() => {
    let stream: MediaStream | null = null;

    const initCamera = async () => {
      if (!showCamera) {
        console.log("initCamera: showCamera is false. Not initializing camera.");
        setCameraStatus('idle');
        return;
      }

      setCapturedImagePreviewUrl(null);
      setAnalysisResult(null);
      setLiveResult(null);
      setError(null);
      setIsPaused(false);
      setCameraStatus('loading');

      if (!videoRef.current) {
        console.warn("initCamera called, but videoRef.current is null.");
        setCameraStatus('error');
        setError("Internal error: Video element not found.");
        return;
      }

      try {
        // More flexible constraints for desktop compatibility
        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: 'user', // Front camera for selfies
            // Use ideal for preferred resolution, but allow browser to pick lower if needed
            width: { ideal: 1280, min: 640 }, // Try 720p, accept down to 480p width
            height: { ideal: 720, min: 480 } // Try 720p, accept down to 480p height
          }
        };

        console.log("Attempting to get camera stream with constraints:", constraints);
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log("Camera stream obtained:", stream);

        // Log actual track settings
        if (stream.getVideoTracks().length > 0) {
          const track = stream.getVideoTracks()[0];
          const settings = track.getSettings();
          console.log("Camera Track Settings:", settings);
        }

        videoRef.current.srcObject = stream;
        
        // Use onloadeddata for a more reliable indication that video dimensions are available
        videoRef.current.onloadeddata = async () => {
          console.log("Video data loaded (onloadeddata event).");
          // Log actual video element dimensions after metadata is loaded
          console.log(`Video element dimensions: ${videoRef.current?.videoWidth}x${videoRef.current?.videoHeight}`);
          try {
            await videoRef.current?.play();
            console.log("Video playback initiated successfully.");
            setCameraStatus('playing');
            setIsStreamingAnalysis(true);
          } catch (playErr: unknown) {
            console.error("Error playing video stream after onloadeddata:", playErr);
            setCameraStatus('error');
            if (playErr instanceof Error) {
              setError(`Failed to play camera stream: ${playErr.message || playErr.name}. Is camera in use or permissions denied?`);
            }
            setShowCamera(false);
          }
        };

        videoRef.current.onerror = (event) => {
          console.error("Video element error event:", event);
          setCameraStatus('error');
          setError("Video playback failed. Please check camera permissions or try another browser.");
          setShowCamera(false);
        };

        videoRef.current.load();

      } catch (err: unknown) {
        console.error('Error accessing camera in initCamera:', err);
        let message = 'Unable to access the camera.';
        if (err instanceof Error) {
          if (err.name === 'NotAllowedError' || err.name === 'SecurityError') {
            message = 'Camera access denied. Please allow permissions in browser/device settings.';
          } else if (err.name === 'NotFoundError') {
            message = 'No camera device found. Try switching to a device with a camera.';
          } else if (window.location.protocol !== 'https:') {
            message = 'Camera access requires HTTPS. Please deploy your app over HTTPS to enable camera.';
          } else {
            message = `Camera error: ${err.message || err.name}.`;
          }
        }
        setError(message);
        setCameraStatus('error');
        setShowCamera(false);
      }
    };

    if (showCamera) {
      initCamera();
    }

    return () => {
      if (stream) {
        console.log("Stopping video tracks during cleanup.");
        stream.getTracks().forEach((track) => track.stop());
      }
      setIsStreamingAnalysis(false);
      setIsPaused(false);
      setCameraStatus('idle');
    };
  }, [showCamera]);

  // --- useEffect for Live Analysis Interval Management ---
  useEffect(() => {
    let intervalId: NodeJS.Timeout | undefined;

    // Only start interval if camera is playing, not paused, AND user is logged in OR has a temp ID
    if (isStreamingAnalysis && cameraStatus === 'playing' && !isPaused && (user || tempUserId)) { // NEW: Added tempUserId condition
      console.log("Starting live analysis interval.");
      intervalId = setInterval(() => {
        sendFrameForLiveAnalysis();
      }, 3000);
    } else {
      console.log("Stopping live analysis interval (paused, not playing, not streaming, or no user ID available).");
      if (intervalId) {
        clearInterval(intervalId);
      }
    }

    return () => {
      if (intervalId) {
        console.log("Clearing interval on cleanup.");
        clearInterval(intervalId);
      }
    };
  }, [isStreamingAnalysis, isPaused, cameraStatus, user, tempUserId, sendFrameForLiveAnalysis]); // Added 'tempUserId' to dependencies

  // --- Other functions ---
  const togglePauseResume = () => {
    setIsPaused(prev => !prev);
  };

  const closeCamera = () => {
    setShowCamera(false);
  };

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

      {/* Camera Modal */}
      {showCamera && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-0 md:p-4">
          <div className="bg-white rounded-none md:rounded-2xl p-4 md:p-6 shadow-xl w-full h-screen max-h-screen flex flex-col md:flex-row gap-4 md:gap-6 relative">
            
            {/* Left Column: Camera Feed & Controls */}
            <div className="flex flex-col flex-1">
              <h2 className="text-2xl font-bold mb-4 text-center text-purple-700">Live Camera Mirror 🤳</h2>
              {/* Added max-w-full and max-h-full to ensure video container respects modal size */}
              <div className="relative w-full aspect-video bg-gray-800 rounded-xl overflow-hidden flex-grow flex items-center justify-center max-w-full max-h-full">
                {/* Conditionally render loading spinner or error message */}
                {cameraStatus === 'loading' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-white text-xl flex-col">
                    <svg className="animate-spin h-8 w-8 text-white mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Loading Camera...
                    {error && <p className="text-sm text-red-300 mt-2">{error}</p>}
                  </div>
                )}
                {cameraStatus === 'error' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-red-900 text-white text-xl flex-col p-4">
                    <span className="text-4xl mb-3">⚠️</span>
                    Camera Error!
                    {error && <p className="text-sm text-red-200 mt-2 text-center">{error}</p>}
                    <button onClick={closeCamera} className="mt-4 bg-red-500 text-white py-2 px-4 rounded-full text-base font-semibold hover:bg-red-600 transition shadow-md">
                      Close
                    </button>
                  </div>
                )}
                <video 
                  ref={videoRef} 
                  className={`w-full h-full object-cover ${cameraStatus !== 'playing' ? 'hidden' : ''}`}
                  autoPlay 
                  playsInline 
                  muted 
                  style={{ transform: 'scaleX(-1)' }} 
                ></video>
                <canvas ref={canvasRef} className="hidden"></canvas>

                {/* Buttons: Positioned absolutely within the video container */}
                {cameraStatus === 'playing' && (
                  <div className="absolute bottom-4 left-0 right-0 flex justify-between px-4">
                    {isStreamingAnalysis && !isPaused ? (
                      <button
                        onClick={togglePauseResume}
                        className="bg-yellow-500 text-white py-2 px-3 rounded-full text-sm font-semibold hover:bg-yellow-600 transition shadow-md"
                      >
                        Pause ⏸️
                      </button>
                    ) : isStreamingAnalysis && isPaused ? (
                      <button
                        onClick={togglePauseResume}
                        className="bg-green-500 text-white py-2 px-3 rounded-full text-sm font-semibold hover:bg-green-600 transition shadow-md"
                      >
                        Resume ▶️
                      </button>
                    ) : null}
                    
                    <button
                      onClick={closeCamera}
                      className="bg-red-500 text-white py-2 px-3 rounded-full text-sm font-semibold hover:bg-red-600 transition shadow-md"
                    >
                      Close ✖️
                    </button>
                  </div>
                )}
              </div>
            </div> {/* End Left Column */}

            {/* Right Column: Live Analysis Insights */}
            {isStreamingAnalysis && (
              <div className="flex flex-col flex-1 bg-purple-50 rounded-xl shadow-inner text-purple-800 p-4 overflow-y-auto flex-shrink-0"> {/* Added flex-shrink-0 */}
                <h3 className="text-lg font-semibold mb-1 text-center">Live Skin Insights</h3>
                {liveResult ? (
                  <AnalysisResult result={liveResult} />
                ) : (
                  <p className="text-center">Analyzing live... 🔄</p>
                )}
              </div>
            )}

          </div> {/* End Main modal content box */}
        </div>
      )}

      {/* Display captured image and analysis results if available */}
      {capturedImagePreviewUrl && !showCamera && (
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
          {analysisResult && <AnalysisResult result={analysisResult} />}
          {error && (
            <div className="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg w-full text-center">
              <p className="font-bold mb-1">Error:</p>
              <p>{error}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
