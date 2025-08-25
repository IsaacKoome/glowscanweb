// app/page.tsx
"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import AnalysisResult from '../components/AnalysisResult';
import { useAuth } from '../context/AuthContext';
import { useCamera } from  '../context/CameraContext' // 👈 NEW: Import CameraContext

export default function HomePage() {
  const { user, loading: authLoading } = useAuth();
  const { showCamera, openCamera, closeCamera } = useCamera(); // 👈 NEW: use camera context
  const [capturedImagePreviewUrl, setCapturedImagePreviewUrl] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<any | null>(null);
  const [liveResult, setLiveResult] = useState<any | null>(null);
  const [isStreamingAnalysis, setIsStreamingAnalysis] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraStatus, setCameraStatus] = useState<'idle' | 'loading' | 'playing' | 'error'>('idle');

  const [tempUserId, setTempUserId] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!authLoading && !user && !tempUserId) {
      const storedTempId = localStorage.getItem('tempUserId');
      if (storedTempId) {
        setTempUserId(storedTempId);
      } else {
        const newTempId = crypto.randomUUID();
        localStorage.setItem('tempUserId', newTempId);
        setTempUserId(newTempId);
      }
    }
  }, [authLoading, user, tempUserId]);

  // --- Function to send a frame for live analysis ---
  const sendFrameForLiveAnalysis = useCallback(async () => {
    if (isPaused || cameraStatus !== 'playing') return;

    const userIdToSend = user ? user.uid : tempUserId;
    if (!userIdToSend) {
      setError("No user identifier found.");
      setIsPaused(true);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || video.readyState < 2) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext('2d');
    if (context) {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(async (blob) => {
        if (!blob) return;

        const formData = new FormData();
        formData.append('file', new File([blob], "live_frame.jpg", { type: "image/jpeg" }));

        const API_ENDPOINT = 'https://glowscan-backend-241128138627.us-central1.run.app/predict';

        try {
          const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            body: formData,
            headers: {
              'X-User-ID': userIdToSend
            }
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => response.text());
            if (response.status === 429) {
              setError("Daily analysis quota exceeded.");
            } else {
              setError(`Analysis failed: ${errorData.detail || "Server error."}`);
            }
            return;
          }

          const result = await response.json();
          setLiveResult(result);
          setIsPaused(true);

        } catch (err: any) {
          setError(`Network error: ${err.message}`);
        }
      }, 'image/jpeg', 0.9);
    }
  }, [isPaused, cameraStatus, user, tempUserId]);

  // --- Camera Setup ---
  useEffect(() => {
    let stream: MediaStream | null = null;

    const initCamera = async () => {
      if (!showCamera) {
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
        setCameraStatus('error');
        setError("Video element not found.");
        return;
      }

      try {
        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: 'user',
            width: { ideal: 1280, min: 640 },
            height: { ideal: 720, min: 480 }
          }
        };

        stream = await navigator.mediaDevices.getUserMedia(constraints);
        videoRef.current.srcObject = stream;

        videoRef.current.onloadeddata = async () => {
          try {
            await videoRef.current?.play();
            setCameraStatus('playing');
            setIsStreamingAnalysis(true);
          } catch (playErr: any) {
            setCameraStatus('error');
            setError("Failed to play camera stream.");
            closeCamera();
          }
        };

        videoRef.current.onerror = () => {
          setCameraStatus('error');
          setError("Video playback failed.");
          closeCamera();
        };

        videoRef.current.load();
      } catch (err: any) {
        setError("Unable to access camera.");
        setCameraStatus('error');
        closeCamera();
      }
    };

    if (showCamera) initCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      setIsStreamingAnalysis(false);
      setIsPaused(false);
      setCameraStatus('idle');
    };
  }, [showCamera, closeCamera]);
  // --- Live Analysis Interval ---
  useEffect(() => {
    let intervalId: NodeJS.Timeout | undefined;
    if (isStreamingAnalysis && cameraStatus === 'playing' && !isPaused && (user || tempUserId)) {
      intervalId = setInterval(() => {
        sendFrameForLiveAnalysis();
      }, 1000); // faster interval
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isStreamingAnalysis, isPaused, cameraStatus, user, tempUserId, sendFrameForLiveAnalysis]);

  const togglePauseResume = () => setIsPaused(prev => !prev);

  {/* --- Live Analysis Insights Box --- */}
  {isStreamingAnalysis && (
    <div className="flex flex-col flex-1 bg-purple-50 rounded-xl shadow-inner text-purple-800 p-4 overflow-y-auto flex-shrink-0">
      <h3 className="text-lg font-semibold mb-3 text-center">Live Skin Insights</h3>
      {liveResult ? (
        <AnalysisResult result={liveResult} />
      ) : (
        // 🔥 Skeleton Loader
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-purple-200 rounded w-3/4 mx-auto"></div>
          <div className="h-3 bg-purple-200 rounded w-1/2 mx-auto"></div>
          <div className="h-3 bg-purple-200 rounded w-5/6 mx-auto"></div>
          <div className="h-3 bg-purple-200 rounded w-2/3 mx-auto"></div>
          <div className="h-4 bg-purple-200 rounded w-1/3 mx-auto"></div>
        </div>
      )}
    </div>
  )}

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-128px)] bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 p-6 text-center">
      <div className="max-w-3xl mx-auto py-12 px-6 bg-white rounded-3xl shadow-xl border border-gray-100">
        <h1 className="text-5xl font-extrabold text-purple-800 mb-6 leading-tight">
          Your Daily Beauty Mirror, Powered by AI ✨
        </h1>
        <p className="text-xl text-gray-700 mb-8">
          Uncover the secrets to radiant skin and flawless makeup with WonderJoy AI.
        </p>

        {/* Primary CTA: Open Camera */}
        <button
          onClick={openCamera} // 👈 now uses context
          className="inline-flex items-center justify-center bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold py-5 px-12 rounded-full text-3xl shadow-xl transition transform hover:scale-105 mb-6"
        >
          Open My Beauty Mirror 📸
        </button>
      </div>

      {/* Camera Modal */}
      {showCamera && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-0 md:p-4">
          <div className="bg-white rounded-none md:rounded-2xl p-4 md:p-6 shadow-xl w-full h-screen flex flex-col md:flex-row gap-4 relative">
            <div className="flex flex-col flex-1">
              <h2 className="text-2xl font-bold mb-4 text-center text-purple-700">Live Camera Mirror 🤳</h2>
              <div className="relative w-full aspect-video bg-gray-800 rounded-xl overflow-hidden flex-grow">
                {cameraStatus === 'loading' && (
                  <div className="absolute inset-0 flex items-center justify-center text-white">Loading Camera...</div>
                )}
                {cameraStatus === 'error' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-red-900 text-white p-4">
                    <span>⚠️ {error}</span>
                    <button onClick={closeCamera} className="ml-4 bg-red-500 px-3 py-1 rounded">Close</button>
                  </div>
                )}
                <video ref={videoRef} className={`w-full h-full object-cover ${cameraStatus !== 'playing' ? 'hidden' : ''}`} autoPlay playsInline muted style={{ transform: 'scaleX(-1)' }} />
                <canvas ref={canvasRef} className="hidden"></canvas>

                {cameraStatus === 'playing' && (
                  <div className="absolute bottom-4 left-0 right-0 flex justify-between px-4">
                    {isStreamingAnalysis && !isPaused ? (
                      <button onClick={togglePauseResume} className="bg-yellow-500 text-white px-3 py-1 rounded">Pause ⏸️</button>
                    ) : (
                      <button onClick={togglePauseResume} className="bg-green-500 text-white px-3 py-1 rounded">Resume ▶️</button>
                    )}
                    <button onClick={closeCamera} className="bg-red-500 text-white px-3 py-1 rounded">Close ✖️</button>
                  </div>
                )}
              </div>
            </div>
            {isStreamingAnalysis && (
              <div className="flex flex-col flex-1 bg-purple-50 rounded-xl shadow-inner p-4 overflow-y-auto">
                <h3 className="text-lg font-semibold mb-1 text-center">Live Skin Insights</h3>
                {liveResult ? <AnalysisResult result={liveResult} /> : <p className="text-center">Analyzing live... 🔄</p>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
