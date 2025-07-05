// app/page.tsx
"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import AnalysisResult from '../components/AnalysisResult'; // Make sure path is correct
// No need to import auth here, it's handled by AuthContext in layout.tsx

export default function HomePage() {
  const [showCamera, setShowCamera] = useState(false);
  const [capturedImagePreviewUrl, setCapturedImagePreviewUrl] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<any | null>(null); // For snapshot analysis result
  const [liveResult, setLiveResult] = useState<any | null>(null); // For continuous live analysis result
  const [isStreamingAnalysis, setIsStreamingAnalysis] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false); // NEW: State to track video playback

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // --- Function to send a frame for live analysis ---
  const sendFrameForLiveAnalysis = useCallback(async () => {
    if (isPaused) {
      console.log("Live analysis paused. Not sending frame.");
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
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => response.text());
            console.error(`Live analysis HTTP Error! Status: ${response.status}. Details: ${JSON.stringify(errorData)}`);
            return;
          }

          const result = await response.json();
          setLiveResult(result); // Update the live result state
          console.log("Live analysis result:", result);

          setIsPaused(true); // Auto-pause after a successful analysis result is received

        } catch (err: any) {
          console.error('Live analysis fetch error:', err);
        }
      }, 'image/jpeg', 0.8); // JPEG format with 80% quality
    }
  }, [isPaused]);

  // --- useEffect for Camera Stream Setup ---
  useEffect(() => {
    let stream: MediaStream | null = null; // Local stream variable for cleanup

    const initCamera = async () => {
      if (!showCamera) {
        console.log("initCamera: showCamera is false. Not initializing camera.");
        return;
      }

      setCapturedImagePreviewUrl(null);
      setAnalysisResult(null);
      setLiveResult(null); // Clear live results on new camera open
      setError(null);
      setIsPaused(false); // Ensure not paused when camera first opens
      setIsVideoPlaying(false); // NEW: Reset video playing state

      if (!videoRef.current) {
        console.warn("initCamera called, but videoRef.current is null. This should be caught by the dependent useEffect.");
        return;
      }

      try {
        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: 'user',
            width: { ideal: 1920 }, // Request high resolution
            height: { ideal: 1080 }
          }
        };

        console.log("Attempting to get camera stream with constraints:", constraints);
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log("Camera stream obtained:", stream);

        videoRef.current.srcObject = stream;
        
        // Listen for when video starts playing
        videoRef.current.onplaying = () => {
          console.log("Video is now playing.");
          setIsVideoPlaying(true);
          setIsStreamingAnalysis(true); // Start streaming analysis when video plays
        };

        // Listen for errors during playback
        videoRef.current.onerror = (event) => {
          console.error("Video playback error:", event);
          setError("Video playback failed. Please check camera permissions or try another browser.");
          setIsVideoPlaying(false);
          setShowCamera(false);
        };

        videoRef.current.onloadedmetadata = async () => {
          console.log("Video metadata loaded.");
          try {
            await videoRef.current?.play();
            console.log("Attempted video playback.");
            // onplaying event will handle setting isVideoPlaying and isStreamingAnalysis
          } catch (playErr: any) {
            console.error("Error playing video stream:", playErr);
            setError("Failed to play camera stream. Is camera in use by another app or permissions denied?");
            setIsVideoPlaying(false);
            setShowCamera(false);
          }
        };
        videoRef.current.load(); // Ensure video element attempts to load the stream

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
        setIsVideoPlaying(false); // NEW: Ensure video playing state is false on error
        setShowCamera(false);
      }
    };

    if (showCamera) {
      initCamera();
    }

    // Cleanup for camera stream
    return () => {
      if (stream) {
        console.log("Stopping video tracks during cleanup.");
        stream.getTracks().forEach((track) => track.stop());
      }
      setIsStreamingAnalysis(false);
      setIsPaused(false);
      setIsVideoPlaying(false); // NEW: Reset video playing state on cleanup
    };
  }, [showCamera]);

  // --- useEffect for Live Analysis Interval Management ---
  useEffect(() => {
    let intervalId: NodeJS.Timeout | undefined;

    // Only start interval if video is playing and not paused
    if (isStreamingAnalysis && isVideoPlaying && !isPaused) { // NEW: Added isVideoPlaying condition
      console.log("Starting live analysis interval.");
      intervalId = setInterval(() => {
        sendFrameForLiveAnalysis();
      }, 3000);
    } else {
      console.log("Stopping live analysis interval (paused, not streaming, or video not playing).");
      if (intervalId) {
        clearInterval(intervalId);
      }
    }

    // Cleanup for interval
    return () => {
      if (intervalId) {
        console.log("Clearing interval on cleanup.");
        clearInterval(intervalId);
      }
    };
  }, [isStreamingAnalysis, isPaused, isVideoPlaying, sendFrameForLiveAnalysis]); // NEW: Added isVideoPlaying to dependencies

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
        {/* Login/Logout Button is now in RootLayout */}

        <h1 className="text-5xl font-extrabold text-purple-800 mb-6 leading-tight">
          Your Daily Beauty Mirror, Powered by AI ✨
        </h1>
        <p className="text-xl text-gray-700 mb-8 max-w-2xl mx-auto">
          Uncover the secrets to radiant skin and flawless makeup with WonderJoy AI. Your personal beauty companion, right in your pocket.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
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

        <Link href="/upload" className="inline-flex items-center justify-center bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold py-4 px-10 rounded-full text-2xl shadow-lg transition duration-300 ease-in-out transform hover:scale-105 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-purple-300">
          Upload Image from Files 📂
        </Link>
      </div>

      {/* Camera Modal */}
      {showCamera && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-0 md:p-4">
          {/* Main modal content box: Now full screen on mobile, modal on desktop */}
          <div className="bg-white rounded-none md:rounded-2xl p-4 md:p-6 shadow-xl w-full h-screen max-h-screen flex flex-col md:flex-row gap-4 md:gap-6 relative">
            
            {/* Left Column: Camera Feed & Controls */}
            <div className="flex flex-col flex-1">
              <h2 className="text-2xl font-bold mb-4 text-center text-purple-700">Live Camera Mirror 🤳</h2>
              <div className="relative w-full aspect-video bg-gray-800 rounded-xl overflow-hidden flex-grow flex items-center justify-center"> {/* Added flex, items-center, justify-center */}
                {/* Conditionally render video or loading spinner */}
                {!isVideoPlaying && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-white text-xl">
                    <svg className="animate-spin h-8 w-8 text-white mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Loading Camera...
                  </div>
                )}
                <video 
                  ref={videoRef} 
                  className={`w-full h-full object-cover ${!isVideoPlaying ? 'hidden' : ''}`} // Hide video until playing
                  autoPlay 
                  playsInline 
                  muted 
                  style={{ transform: 'scaleX(-1)' }} 
                ></video>
                <canvas ref={canvasRef} className="hidden"></canvas>

                {/* Buttons: Positioned absolutely within the video container */}
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
              </div>
            </div> {/* End Left Column */}

            {/* Right Column: Live Analysis Insights */}
            {isStreamingAnalysis && (
              <div className="flex flex-col flex-1 bg-purple-50 rounded-xl shadow-inner text-purple-800 p-4 overflow-y-auto">
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