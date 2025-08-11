
// components/CameraModal.tsx
"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AnalysisResult from './AnalysisResult';
import { useAuth } from '../context/AuthContext';
import { useCamera } from '../context/CameraContext';
import { createConversation, addMessage } from '../lib/chat';

interface AnalysisResultData {
  [key: string]: unknown;
}

export default function CameraModal() {
  const { showCamera, setShowCamera, conversationId } = useCamera();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  // const [capturedImagePreviewUrl, setCapturedImagePreviewUrl] = useState<string | null>(null);
  // const [analysisResult, setAnalysisResult] = useState<AnalysisResultData | null>(null);
  const [liveResult, setLiveResult] = useState<AnalysisResultData | null>(null);
  const [isStreamingAnalysis, setIsStreamingAnalysis] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraStatus, setCameraStatus] = useState<'idle' | 'loading' | 'playing' | 'error'>('idle');
  const [tempUserId, setTempUserId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

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

  const sendFrameForLiveAnalysis = useCallback(async () => {
    if (isPaused || cameraStatus !== 'playing' || isSaving) {
      return;
    }

    const userIdToSend = user ? user.uid : tempUserId;

    if (!userIdToSend) {
      setError("An internal error occurred: No user identifier. Please refresh or try again.");
      setIsPaused(true);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || video.readyState < 2) {
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext('2d');
    if (context) {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(async (blob) => {
        if (!blob) {
          return;
        }

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
                setError("Daily analysis quota exceeded. Please try again tomorrow or upgrade your plan.");
            } else {
                setError(`Analysis failed: ${errorData.detail || "Server error."}`);
            }
            return;
          }

          const result = await response.json();
          setLiveResult(result);
          setIsPaused(true);

          if (user && !isSaving) {
            setIsSaving(true);
            const analysisText = "Here is your live analysis result.";

            if (conversationId) {
              // Add to existing conversation
              await addMessage(conversationId, user.uid, analysisText, 'ai', result);
              setShowCamera(false);
            } else {
              // Create new conversation
              const newConversationId = await createConversation(user.uid);
              await addMessage(newConversationId, user.uid, analysisText, 'ai', result);
              setShowCamera(false);
              router.push(`/chat/${newConversationId}`);
            }
          }

        } catch (err: unknown) {
          if (err instanceof Error) {
            setError(`Network error during analysis: ${err.message}`);
          }
        }
      }, 'image/jpeg', 0.9);
    }
  }, [isPaused, cameraStatus, user, tempUserId, router, setShowCamera, isSaving, conversationId]);

  useEffect(() => {
    let stream: MediaStream | null = null;

    const initCamera = async () => {
      if (!showCamera) {
        setCameraStatus('idle');
        return;
      }

      setLiveResult(null);
      setError(null);
      setIsPaused(false);
      setCameraStatus('loading');

      if (!videoRef.current) {
        setCameraStatus('error');
        setError("Internal error: Video element not found.");
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

        if (stream.getVideoTracks().length > 0) {
          const track = stream.getVideoTracks()[0];
          track.getSettings();
        }

        videoRef.current.srcObject = stream;
        
        videoRef.current.onloadeddata = async () => {
          try {
            await videoRef.current?.play();
            setCameraStatus('playing');
            setIsStreamingAnalysis(true);
          } catch (playErr: unknown) {
            setCameraStatus('error');
            if (playErr instanceof Error) {
              setError(`Failed to play camera stream: ${playErr.message || playErr.name}. Is camera in use or permissions denied?`);
            }
            setShowCamera(false);
          }
        };

        videoRef.current.onerror = () => {
          setCameraStatus('error');
          setError("Video playback failed. Please check camera permissions or try another browser.");
          setShowCamera(false);
        };

        videoRef.current.load();

      } catch (err: unknown) {
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
        stream.getTracks().forEach((track) => track.stop());
      }
      setIsStreamingAnalysis(false);
      setIsPaused(false);
      setCameraStatus('idle');
    };
  }, [showCamera, setShowCamera]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | undefined;

    if (isStreamingAnalysis && cameraStatus === 'playing' && !isPaused && (user || tempUserId)) {
      intervalId = setInterval(() => {
        sendFrameForLiveAnalysis();
      }, 3000);
    } else {
      if (intervalId) {
        clearInterval(intervalId);
      }
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isStreamingAnalysis, isPaused, cameraStatus, user, tempUserId, sendFrameForLiveAnalysis]);

  const togglePauseResume = () => {
    setIsPaused(prev => !prev);
  };

  const closeCamera = () => {
    setShowCamera(false, null);
  };

  if (!showCamera) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-0 md:p-4">
      <div className="bg-white rounded-none md:rounded-2xl p-4 md:p-6 shadow-xl w-full h-screen max-h-screen flex flex-col md:flex-row gap-4 md:gap-6 relative">
        
        <div className="flex flex-col flex-1">
          <h2 className="text-2xl font-bold mb-4 text-center text-purple-700">Live Camera Mirror 🤳</h2>
          <div className="relative w-full aspect-video bg-gray-800 rounded-xl overflow-hidden flex-grow flex items-center justify-center max-w-full max-h-full">
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
        </div>

        {isStreamingAnalysis && (
          <div className="flex flex-col flex-1 bg-purple-50 rounded-xl shadow-inner text-purple-800 p-4 overflow-y-auto flex-shrink-0">
            <h3 className="text-lg font-semibold mb-1 text-center">Live Skin Insights</h3>
            {liveResult ? (
              <AnalysisResult result={liveResult} />
            ) : (
              <p className="text-center">Analyzing live... 🔄</p>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
