"use client";

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link'; // Make sure Link is imported for the login button
import { Button } from "@/components/ui/button"; // Assuming you have this Button component
import { Input } from "@/components/ui/input";   // Assuming you have this Input component
import {
  SparklesIcon, // For AI specific messages/actions
  SendIcon,
  Loader2,
  ImageIcon,
  VideoIcon // If you decide to support video analysis/upload
} from "lucide-react"; // Or from @heroicons/react if you prefer consistency

// Firebase imports
import {
  Timestamp,
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  // doc, // REMOVED: No longer needed based on the previous error
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase"; // Your Firebase config
import { v4 as uuidv4 } from "uuid"; // For generating unique IDs for uploads

// Define interfaces for your AI chat messages
interface AIMessage {
  id: string;
  sender: 'user' | 'ai'; // 'user' for user messages, 'ai' for AI responses
  timestamp: Timestamp; // Using Firestore Timestamp
  type: 'text' | 'image' | 'video' | 'analysis_result'; // 'analysis_result' is a new type for structured AI output
  content?: string;     // For text messages or AI summaries
  mediaUrl?: string;    // For user-uploaded images/videos, or AI-generated images
  analysisData?: any;   // For structured AI analysis results (e.g., skin health score, recommendations)
  imageUrlForAnalysis?: string; // The URL of the image the AI is analyzing (sent by user)
  senderPhotoURL?: string; // For user's avatar
}

// Assuming you still have your AuthContext
import { useAuth } from '../../context/AuthContext';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://glowscan-backend-241128138627.us-central1.run.app';


export default function AiChatPage( ) {
  const { user, loading: authLoading } = useAuth(); // Get user info from context

  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [currentMessageText, setCurrentMessageText] = useState<string>('');
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [selectedVideoFile, setSelectedVideoFile] = useState<File | null>(null);
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Firestore path for user's chat messages
  const userChatCollectionPath = user ? `chats/${user.uid}/messages` : null;

  // --- Real-time listener for chat messages ---
  useEffect(() => {
    if (!user || authLoading) return; // Don't listen if user not logged in or still loading

    const q = query(
      collection(db, `chats/${user.uid}/messages`),
      orderBy("timestamp", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedMessages: AIMessage[] = [];
      snapshot.forEach((doc) => {
        fetchedMessages.push({ id: doc.id, ...doc.data() } as AIMessage);
      });
      setMessages(fetchedMessages);
    }, (error) => {
      console.error("Error fetching chat messages:", error);
      // Optionally show an error to the user
    });

    // Clean up listener on component unmount
    return () => unsubscribe();
  }, [user, authLoading, userChatCollectionPath]); // Re-run if user or authLoading changes

  // --- Scroll to bottom on new messages ---
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);


  // --- Helper to upload files to Firebase Storage ---
  const uploadFileToStorage = async (file: File, folder: string): Promise<string> => {
    if (!user) throw new Error("User not authenticated for upload.");
    const fileRef = ref(storage, `${folder}/${user.uid}/${uuidv4()}-${file.name}`);
    const snapshot = await uploadBytes(fileRef, file);
    return getDownloadURL(snapshot.ref);
  };

  // --- Handle user sending a message (text or media) ---
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || authLoading || !userChatCollectionPath) {
      alert("Please sign in to chat with WonderJoy AI.");
      return;
    }

    if (currentMessageText.trim() === '' && !selectedImageFile && !selectedVideoFile) {
      alert("Please enter a message or select a file to send.");
      return;
    }

    setIsProcessingAI(true); // Start AI processing indicator

    try {
      // 1. Prepare and add user's message to firestore for immediate display
      const userMessagePayload: Omit<AIMessage, 'id'> = { // CHANGED: 'let' to 'const'
        sender: 'user',
        timestamp: Timestamp.now(),
        type: 'text',
        content: currentMessageText.trim(),
        senderPhotoURL: user.photoURL || 'images/default-avatar.png', //fallback to a default avatar
      };

      if (selectedImageFile) {
        userMessagePayload.type = 'image';
        // Upload image to Firebase Storage
        const imageUrl = await uploadFileToStorage(selectedImageFile, 'wonderjoy_chat_images');
        userMessagePayload.mediaUrl = imageUrl;
        userMessagePayload.imageUrlForAnalysis = imageUrl; // This is the image URL the AI will analyze
        userMessagePayload.content = currentMessageText.trim() || 'Image for analysis'; // Allow caption
      } else if (selectedVideoFile) {
        userMessagePayload.type = 'video';
        // Upload video to Firebase Storage
        const videoUrl = await uploadFileToStorage(selectedVideoFile, 'wonderjoy_chat_videos');
        userMessagePayload.mediaUrl = videoUrl;
        userMessagePayload.imageUrlForAnalysis = videoUrl; // If AI analyzes video frames, use this
        userMessagePayload.content = currentMessageText.trim() || 'Video for analysis'; // Allow caption
      }

      // Add user's message to Firestore
      // CHANGED: Removed 'const userMessageRef =' as it's not used
      await addDoc(collection(db, userChatCollectionPath!), userMessagePayload);
     
      //2. Start Real AI integration

      const formData = new FormData();
      //Append the actual file if selected
      if(selectedImageFile) {
        formData.append('file', selectedImageFile);
      }
      else if(selectedVideoFile){
        //assuming your api/predict endpoint can handle video file
        formData.append('file', selectedVideoFile);
      }

      //Append the user's current text message if present
      if(currentMessageText.trim()) {
        formData.append('user_message', currentMessageText.trim());
      }

      //Make the Api call to you backend
      const response = await fetch(`${BACKEND_URL}/chat-predict`, {
        method: 'POST',
        headers: {
          //'content-type': 'multipart/formData' is not set for formData
          'X-User-ID': user.uid, //User ID is available here due to initial check
        },
        body: formData
      });

      // To this (using proper template literals):
if(!response.ok) {
  const errorText = await response.text();
  try {
    const errorJson = JSON.parse(errorText);
    throw new Error(`API Error: ${response.status} - ${errorJson.detail || errorText}`);
  } catch (e) {
    throw new Error(`API Error: ${response.status} - ${errorText}`);
  }
}

      const aiResponseData = await response.json();  //Get AI response data

      // Determine the content based on whether it's analysis or text
      const aiContent = aiResponseData.type === 'analysis_result' ?
                    aiResponseData.overall_summary || "Here's your analysis." :
                    aiResponseData.message || "An AI response was received.";

              await addDoc(collection(db, userChatCollectionPath!), {
              sender: 'ai',
              type: aiResponseData.type || 'text', // Use type from AI, default to 'text'
              content: aiContent,
              analysisData: aiResponseData.analysisData || null, // Store full analysisData if available
              timestamp: Timestamp.now()
              } as Omit<AIMessage, 'id'>);

    // --- END: REAL AI INTEGRATION ---

      // Clear input and selections
      setCurrentMessageText('');
      setSelectedImageFile(null);
      setSelectedVideoFile(null);
      const chatImageUploadInput = document.getElementById('chatImageUpload') as HTMLInputElement;
      if (chatImageUploadInput) chatImageUploadInput.value = '';
      const chatVideoUploadInput = document.getElementById('chatVideoUpload') as HTMLInputElement;
      if (chatVideoUploadInput) chatVideoUploadInput.value = '';

    } catch (error) {
      console.error("Error sending message or getting AI response:", error);
      alert(`Failed to send message or get AI response: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsProcessingAI(false); // End AI processing indicator
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedImageFile(e.target.files[0]);
      setSelectedVideoFile(null); // Clear video if image is selected
      // setCurrentMessageText(''); // Keep text if user wants to add caption
      (document.getElementById('chatVideoUpload') as HTMLInputElement).value = '';
    } else {
      setSelectedImageFile(null);
    }
  };

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedVideoFile(e.target.files[0]);
      setSelectedImageFile(null); // Clear image if video is selected
      // setCurrentMessageText(''); // Keep text if user wants to add caption
      (document.getElementById('chatImageUpload') as HTMLInputElement).value = '';
    } else {
      setSelectedVideoFile(null);
    }
  };

  if (authLoading) {
    return (
      <div className="flex justify-center items-center min-h-[80vh] text-purple-700">
        <Loader2 className="h-10 w-10 animate-spin mr-3" />
        <p className="text-xl">Loading chat...</p>
      </div>
    );
  }

  // If user is not logged in after authLoading, prompt them to sign in
  if (!user) {
    return (
      <div className="max-w-4xl mx-auto p-8 bg-white rounded-2xl shadow-xl border border-gray-100 mt-8 mb-8 text-center">
        <SparklesIcon className="w-16 h-16 mx-auto text-purple-600 mb-4" />
        <h2 className="text-3xl font-bold text-purple-700 mb-4">Welcome to WonderJoy AI Analyst!</h2>
        <p className="text-lg text-gray-700 mb-6">
          Please sign in to start your personalized beauty analysis and chat with our AI.
        </p>
        <Link href="/login">
          <Button className="bg-purple-600 hover:bg-purple-700 text-white text-lg px-8 py-3 rounded-full shadow-md">
            Login / Register
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <section className="max-w-4xl mx-auto p-4 bg-white rounded-2xl shadow-xl border border-gray-100 mt-8 mb-8">
      <h2 className="text-3xl font-bold text-center text-purple-700 mb-6 flex items-center justify-center gap-3">
        <SparklesIcon className="w-8 h-8 text-yellow-400" /> WonderJoy AI Analyst
      </h2>

      {/* Chat Messages Display Area */}
      <div className="h-[70vh] max-h-[600px] overflow-y-auto border border-gray-200 rounded-lg p-4 mb-4 bg-gray-50 custom-scrollbar flex flex-col">
        {messages.length === 0 ? (
          <p className="text-gray-500 italic text-center py-8">
            Hello! Send a selfie or a message to start your beauty analysis.
              

            (Or ask me anything about beauty!)
          </p>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-start gap-3 mb-4 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.sender === 'ai' && (
                <div className="flex-shrink-0">
                  {/* AI Avatar */}
                  <Image
                    src="images/wonderjoy-ai-avatar.png" // Path to your AI avatar image in /public
                    alt="WonderJoy AI"
                    width={32}
                    height={32}
                    className="rounded-full object-cover border-2 border-purple-400"
                  />
                </div>
              )}
            {msg.sender === 'user' && (
              <div className="flex-shrink-0">
                {/* --- START FIX 2: Render the avatar using the URL from the message itself --- */}
                <Image
                  // Use the 'senderPhotoURL' from the specific message object 'msg'.
                  // This ensures that even if the user changes their avatar later, old messages still show the old avatar.
                  src={msg.senderPhotoURL || '/images/default-avatar.png'}
                  alt={user?.displayName || "You"}
                  width={32}
                  height={32}
                  className="rounded-full object-cover border-2 border-purple-400"
                />
                {/* --- END FIX 2 --- */}
              </div>
            )}
              <div className={`flex flex-col max-w-[75%] p-3 rounded-xl shadow-sm relative group ${
                msg.sender === 'user'
                  ? 'bg-purple-600 text-white rounded-br-none'
                  : 'bg-gray-200 text-gray-800 rounded-bl-none'
              }`}>
                <span className={`text-xs font-bold mb-1 ${msg.sender === 'user' ? 'text-purple-100' : 'text-gray-600'}`}>
                  {msg.sender === 'user' ? (user?.displayName || "You") : "WonderJoy AI"}
                </span>

                {/* Render content based on message type */}
                {msg.type === 'text' && msg.content && (
                  <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                )}
                {msg.type === 'image' && msg.mediaUrl && (
                  <div className="relative w-48 h-32 md:w-64 md:h-48 rounded-lg overflow-hidden border border-gray-300 mb-1">
                    <Image
                      src={msg.mediaUrl}
                      alt="User uploaded image"
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 50vw"
                    />
                  </div>
                )}
                {msg.type === 'video' && msg.mediaUrl && ( // Render video if you support it
                  <div className="relative w-48 h-32 md:w-64 md:h-48 rounded-lg overflow-hidden border border-gray-300 mb-1 bg-black flex items-center justify-center">
                    <video
                      src={msg.mediaUrl}
                      controls
                      className="w-full h-full object-contain"
                      aria-label="Shared video"
                      preload="metadata"
                    />
                  </div>
                )}
                {msg.type === 'analysis_result' && msg.analysisData && (
                  <div className="bg-purple-100 p-3 rounded-lg mt-2 text-purple-800 border border-purple-200">
                    <h4 className="font-bold mb-1">Beauty Analysis Summary:</h4>
                    {msg.analysisData.analyzedImage && (
                        <div className="relative w-full h-32 rounded-lg overflow-hidden border border-purple-300 mb-2">
                            <Image
                                src={msg.analysisData.analyzedImage}
                                alt="Analyzed Selfie"
                                fill
                                className="object-cover"
                                sizes="100vw"
                            />
                            <span className="absolute top-1 left-1 bg-purple-600 text-white text-xs px-2 py-1 rounded-full">Analyzed</span>
                        </div>
                    )}
                    <p className="text-sm">
                      <span className="font-semibold">Skin Health Score:</span> {msg.analysisData.skinHealthScore}/100
                    </p>
                    <p className="text-sm">
                      <span className="font-semibold">Acne Severity:</span> {msg.analysisData.acneSeverity}
                    </p>
                    <p className="text-sm">
                      <span className="font-semibold">Redness Level:</span> {msg.analysisData.rednessLevel}
                    </p>
                    {msg.analysisData.recommendations && msg.analysisData.recommendations.length > 0 && (
                      <div className="mt-2">
                        <p className="font-semibold text-sm">Recommendations:</p>
                        <ul className="list-disc list-inside text-sm">
                          {msg.analysisData.recommendations.map((rec: string, index: number) => (
                            <li key={index}>{rec}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {/* Add more analysis data points as needed */}
                  </div>
                )}
                <span className={`text-xs mt-1 ${msg.sender === 'user' ? 'text-purple-200' : 'text-gray-500'} text-right`}>
                  {msg.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              {msg.sender === 'user' && (
                <div className="flex-shrink-0">
                  {/* User Avatar */}
                  <Image
                    src={user?.photoURL || 'images/default-avatar.png'} // Use user's actual photoURL from AuthContext
                    alt={user?.displayName || "You"}
                    width={32}
                    height={32}
                    className="rounded-full object-cover border-2 border-purple-400"
                  />
                </div>
              )}
            </div>
          ))
        )}
        {/* Loading indicator for AI response */}
        {isProcessingAI && (
          <div className="flex justify-start items-center gap-3 mb-4">
            <Image
              src="images/wonderjoy-ai-avatar.png" // Your AI avatar
              alt="WonderJoy AI"
              width={32}
              height={32}
              className="rounded-full object-cover border-2 border-purple-400"
            />
            <div className="bg-gray-200 text-gray-800 rounded-xl rounded-bl-none p-3 shadow-sm flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">WonderJoy AI is thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input Area */}
      {/* The `user` check is now handled by the outer conditional render */}
        <form onSubmit={handleSendMessage} className="flex flex-col gap-2 p-2 bg-gray-100 rounded-lg border border-gray-200">
          {/* Display selected file names */}
          {(selectedImageFile || selectedVideoFile) && (
            <div className="flex items-center gap-2 text-sm text-gray-700 px-2">
              {selectedImageFile && (
                <span className="flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                  <ImageIcon className="w-4 h-4" /> {selectedImageFile.name}
                  <button type="button" onClick={() => setSelectedImageFile(null)} className="ml-1 text-blue-600 hover:text-blue-900 font-bold">x</button>
                </span>
              )}
              {selectedVideoFile && (
                <span className="flex items-center gap-1 bg-green-100 text-green-800 px-2 py-1 rounded-full">
                  <VideoIcon className="w-4 h-4" /> {selectedVideoFile.name}
                  <button type="button" onClick={() => setSelectedVideoFile(null)} className="ml-1 text-green-600 hover:text-green-900 font-bold">x</button>
                </span>
              )}
            </div>
          )}

          <div className="flex gap-2 items-center">
            <Input
              type="text"
              value={currentMessageText}
              onChange={(e) => {
                setCurrentMessageText(e.target.value);
                // Clear media selection when typing text, but not the file input itself
                setSelectedImageFile(null);
                setSelectedVideoFile(null);
                // Optionally reset the file input visually
                const chatImageUploadInput = document.getElementById('chatImageUpload') as HTMLInputElement;
                if (chatImageUploadInput) chatImageUploadInput.value = '';
                const chatVideoUploadInput = document.getElementById('chatVideoUpload') as HTMLInputElement;
                if (chatVideoUploadInput) chatVideoUploadInput.value = '';
              }}
              placeholder={selectedImageFile || selectedVideoFile ? "Add a caption (optional)" : "Ask WonderJoy AI anything or upload a selfie..."}
              className="flex-grow border-gray-300 focus:border-purple-500 focus:ring-purple-500 rounded-full py-2 px-4"
              disabled={isProcessingAI}
            />
            {/* Image Upload Button */}
            <label htmlFor="chatImageUpload" className="cursor-pointer bg-purple-100 text-purple-700 hover:bg-purple-200 p-2 rounded-full shadow-sm transition-colors flex items-center justify-center w-10 h-10 flex-shrink-0">
              <ImageIcon className="w-5 h-5" />
              <input
                id="chatImageUpload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageChange}
                disabled={isProcessingAI || !!selectedVideoFile || (currentMessageText.trim() !== '' && !selectedImageFile)} // Disable if video selected or text entered and no image is already selected
              />
            </label>
            {/* Video Upload Button (if supported for analysis) */}
            <label htmlFor="chatVideoUpload" className="cursor-pointer bg-purple-100 text-purple-700 hover:bg-purple-200 p-2 rounded-full shadow-sm transition-colors flex items-center justify-center w-10 h-10 flex-shrink-0">
              <VideoIcon className="w-5 h-5" />
              <input
                id="chatVideoUpload"
                type="file"
                accept="video/*"
                className="hidden"
                onChange={handleVideoChange}
                disabled={isProcessingAI || !!selectedImageFile || (currentMessageText.trim() !== '' && !selectedVideoFile)} // Disable if image selected or text entered and no video is already selected
              />
            </label>
            <Button
              type="submit"
              className="bg-purple-600 hover:bg-purple-700 text-white rounded-full p-3 shadow-md transition-colors flex-shrink-0"
              disabled={isProcessingAI || (currentMessageText.trim() === '' && !selectedImageFile && !selectedVideoFile)}
            >
              {isProcessingAI ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <SendIcon className="w-5 h-5" />
              )}
            </Button>
          </div>
        </form>
    </section>
  );
}
