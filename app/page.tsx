// app/page.tsx
"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import AnalysisResult from '../components/AnalysisResult'; // Make sure path is correct
import { useAuth } from '../context/AuthContext'; // NEW: Import useAuth hook

export default function HomePage() {
  const { user, loading: authLoading } = useAuth(); // NEW: Get user and authLoading from AuthContext
  const [showCamera, setShowCamera] = useState(false);
  const [capturedImagePreviewUrl, setCapturedImagePreviewUrl] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<any | null>(null); // For snapshot analysis result
  const [liveResult, setLiveResult] = useState<any | null>(null); // For continuous live analysis result
  const [isStreamingAnalysis, setIsStreamingAnalysis] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraStatus, setCameraStatus] = useState<'idle' | 'loading' | 'playing' | 'error'>('idle');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // --- Function to send a frame for live analysis ---
  const sendFrameForLiveAnalysis = useCallback(async () => {
    if (isPaused || cameraStatus !== 'playing') {
      console.log("Live analysis skipped: paused or camera not playing.");
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
          setLiveResult(result);
          console.log("Live analysis result:", result);

          setIsPaused(true); // Auto-pause after a successful analysis result is received

        } catch (err: any) {
          console.error('Live analysis fetch error:', err);
        }
      }, 'image/jpeg', 0.8);
    }
  }, [isPaused, cameraStatus]);

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
        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        };

        console.log("Attempting to get camera stream with constraints:", constraints);
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log("Camera stream obtained:", stream);

        videoRef.current.srcObject = stream;
        
        videoRef.current.oncanplay = async () => {
          console.log("Video is ready to play (oncanplay event).");
          try {
            await videoRef.current?.play();
            console.log("Video playback initiated successfully.");
            setCameraStatus('playing');
            setIsStreamingAnalysis(true);
          } catch (playErr: any) {
            console.error("Error playing video stream after oncanplay:", playErr);
            setCameraStatus('error');
            setError(`Failed to play camera stream: ${playErr.message || playErr.name}. Is camera in use or permissions denied?`);
            setShowCamera(false);
          }
        };

        videoRef.current.onerror = (event) => {
          console.error("Video element error event:", event);
          setCameraStatus('error');
          setError("Video playback failed. Please check camera permissions or try another browser.");
          setShowCamera(false);
        };

        videoRef.current.onloadedmetadata = () => {
          console.log("Video metadata loaded (onloadedmetadata event).");
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

    if (isStreamingAnalysis && cameraStatus === 'playing' && !isPaused) {
      console.log("Starting live analysis interval.");
      intervalId = setInterval(() => {
        sendFrameForLiveAnalysis();
      }, 3000);
    } else {
      console.log("Stopping live analysis interval (paused, not playing, or not streaming).");
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
  }, [isStreamingAnalysis, isPaused, cameraStatus, sendFrameForLiveAnalysis]);

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

        {/* NEW: Link to User Profile if logged in */}
        {!authLoading && user && (
          <div className="mt-8">
            <Link href={`/profile/${user.uid}`} passHref>
              <button className="inline-flex items-center justify-center bg-gradient-to-r from-blue-500 to-green-500 text-white font-bold py-4 px-10 rounded-full text-2xl shadow-lg transition duration-300 ease-in-out transform hover:scale-105 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-blue-300">
                View My Profile 👤
              </button>
            </Link>
          </div>
        )}
      </div>

      {/* Camera Modal */}
      {showCamera && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-0 md:p-4">
          <div className="bg-white rounded-none md:rounded-2xl p-4 md:p-6 shadow-xl w-full h-screen max-h-screen flex flex-col md:flex-row gap-4 md:gap-6 relative">
            
            {/* Left Column: Camera Feed & Controls */}
            <div className="flex flex-col flex-1">
              <h2 className="text-2xl font-bold mb-4 text-center text-purple-700">Live Camera Mirror 🤳</h2>
              <div className="relative w-full aspect-video bg-gray-800 rounded-xl overflow-hidden flex-grow flex items-center justify-center">
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