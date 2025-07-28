// app/chat/page.tsx
"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  SparklesIcon,
  SendIcon,
  Loader2,
  ImageIcon,
  VideoIcon,
  PlusCircle, // For new chat button
  MessageSquare, // For chat session icon
  UserCircle, // For profile icon in sidebar (though we use image/initials)
  LogOut, // For logout in sidebar
  MenuIcon, // For mobile sidebar toggle
  XIcon // For mobile sidebar close
} from "lucide-react";

// Firebase imports
import {
  Timestamp,
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  doc, // Need doc for updating session titles
  updateDoc, // Need updateDoc for updating session titles
  where, // For querying messages by session ID
  getDoc, // To check if a session exists before creating/merging
  setDoc, // To create/update a session document
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { getAuth, signInAnonymously, User as FirebaseAuthUser } from "firebase/auth";
import { v4 as uuidv4 } from "uuid";

// Assuming you still have your AuthContext
import { useAuth } from '../../context/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation'; // Import useRouter and useSearchParams

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://glowscan-backend-241128138627.us-central1.run.app';

// Define interfaces for your AI chat messages
interface AIMessage {
  id: string;
  sender: 'user' | 'ai';
  timestamp: Timestamp;
  type: 'text' | 'image' | 'video' | 'analysis_result';
  content?: string;
  mediaUrl?: string;
  analysisData?: any;
  imageUrlForAnalysis?: string;
  senderPhotoURL?: string;
  chatSessionId: string; // NEW: Each message must belong to a session
}

// NEW: Interface for a chat session summary (for the sidebar)
interface ChatSession {
  id: string; // The chatSessionId
  title: string; // A brief title for the session (e.g., "Skin Analysis: June 25th" or "Acne Concerns")
  lastActivity: Timestamp; // To order sessions in the sidebar
  firstMessageContent?: string; // Storing the first message for quick title generation
  userId: string;
}


export default function AiChatPage() {
  const { user, loading: authLoading, logout } = useAuth(); // Get user info from context and logout function
  const [anonymousUser, setAnonymousUser] = useState<FirebaseAuthUser | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Determine the active user (authenticated or anonymous)
  const activeUser = user || anonymousUser; // useAuth handles the primary user, fallback to local anonymous.

  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [currentMessageText, setCurrentMessageText] = useState<string>('');
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [selectedVideoFile, setSelectedVideoFile] = useState<File | null>(null);
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // NEW STATES FOR CHAT HISTORY/SIDEBAR
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [currentChatSessionId, setCurrentChatSessionId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // For mobile responsiveness

  // Derived state for Firestore paths
  const userChatCollectionPath = activeUser ? `chats/${activeUser.uid}/messages` : null;
  const userChatSessionsCollectionPath = activeUser ? `user_chat_sessions/${activeUser.uid}/sessions` : null; // New collection for session summaries

  // --- Anonymous Sign-in Effect ---
  // This useEffect ensures an anonymous user is established if no authenticated user is present.
  // It complements the AuthContext but ensures a local `anonymousUser` state if AuthContext doesn't provide one directly.
  useEffect(() => {
    const auth = getAuth();
    if (!user && !authLoading && !anonymousUser) { // Only try if no authenticated user, not loading, AND no anonymous user yet
      signInAnonymously(auth)
        .then((userCredential) => {
          setAnonymousUser(userCredential.user);
          console.log("Signed in anonymously:", userCredential.user.uid);
        })
        .catch((error) => {
          console.error("Error signing in anonymously:", error);
          // Handle error, e.g., show a message to the user
        });
    }
  }, [user, authLoading, anonymousUser]); // Depend on `user`, `authLoading`, and `anonymousUser` state

  // --- Effect to manage current chat session from URL or initialize new ---
  useEffect(() => {
    if (!activeUser) return; // Wait for activeUser to be set

    const sessionIdFromUrl = searchParams.get('sessionId');

    if (sessionIdFromUrl) {
      setCurrentChatSessionId(sessionIdFromUrl);
    } else if (!currentChatSessionId) {
      // If no session in URL and no current session set in state,
      // either load the latest existing session or start a new one.
      // This is a common pattern for initial load.
      if (chatSessions.length > 0) {
        setCurrentChatSessionId(chatSessions[0].id); // Load the latest session
           // --- FIX 1 ---
        router.replace(`/chat?sessionId=${chatSessions[0].id}`);
      } else {
        // If no sessions exist, start a new one
        const newId = uuidv4();
        setCurrentChatSessionId(newId);
        // --- FIX 2 ---
        router.replace(`/chat?sessionId=${newId}`);
      }
    }
  }, [activeUser, searchParams, currentChatSessionId, router, chatSessions]); // Add chatSessions to dependencies


  // --- Real-time listener for chat SESSIONS ---
  useEffect(() => {
    if (!activeUser || authLoading || !userChatSessionsCollectionPath) return;

    const q = query(
      collection(db, userChatSessionsCollectionPath),
      orderBy("lastActivity", "desc") // Order by most recent activity
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedSessions: ChatSession[] = [];
      snapshot.forEach((doc) => {
        fetchedSessions.push({ id: doc.id, ...doc.data() } as ChatSession);
      });
      setChatSessions(fetchedSessions);
      // This logic is mostly handled by the `currentChatSessionId` effect above,
      // but this ensures `chatSessions` state is updated, which that effect uses.
    }, (error) => {
      console.error("Error fetching chat sessions:", error);
    });

    return () => unsubscribe();
  }, [activeUser, authLoading, userChatSessionsCollectionPath]);


  // --- Real-time listener for chat MESSAGES of the current session ---
  useEffect(() => {
    if (!activeUser || authLoading || !userChatCollectionPath || !currentChatSessionId) {
      setMessages([]); // Clear messages if no active session or user is loading
      return;
    }

    const q = query(
      collection(db, userChatCollectionPath),
      where("chatSessionId", "==", currentChatSessionId), // Filter by current session ID
      orderBy("timestamp", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedMessages: AIMessage[] = [];
      snapshot.forEach((doc) => {
        fetchedMessages.push({ id: doc.id, ...doc.data() } as AIMessage);
      });
      setMessages(fetchedMessages);
    }, (error) => {
      console.error("Error fetching chat messages for session:", error);
    });

    return () => unsubscribe();
  }, [activeUser, authLoading, userChatCollectionPath, currentChatSessionId]); // Re-run if session ID changes


  // --- Scroll to bottom on new messages ---
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);


  // --- Helper to upload files to Firebase Storage ---
  const uploadFileToStorage = async (file: File, folder: string): Promise<string> => {
    if (!activeUser) throw new Error("User not authenticated for upload.");
    const fileRef = ref(storage, `${folder}/${activeUser.uid}/${uuidv4()}-${file.name}`);
    const snapshot = await uploadBytes(fileRef, file);
    return getDownloadURL(snapshot.ref);
  };

  // --- Handle user sending a message (text or media) ---
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeUser || authLoading || !userChatCollectionPath || !userChatSessionsCollectionPath) {
      alert("Authentication is not ready. Please wait or refresh.");
      return;
    }

    // Ensure a chat session is active, if not, create one.
    let sessionToUse = currentChatSessionId;
    if (!sessionToUse) {
      sessionToUse = uuidv4();
      setCurrentChatSessionId(sessionToUse);
       // --- FIX 3 ---
      router.replace(`/chat?sessionId=${sessionToUse}`);
    }

    if (currentMessageText.trim() === '' && !selectedImageFile && !selectedVideoFile) {
      alert("Please enter a message or select a file to send.");
      return;
    }

    setIsProcessingAI(true);

    try {
      const messageTimestamp = Timestamp.now();

      // 1. Prepare user's message
      const userMessagePayload: Omit<AIMessage, 'id'> = {
        sender: 'user',
        timestamp: messageTimestamp,
        type: 'text',
        content: currentMessageText.trim(),
        senderPhotoURL: activeUser.photoURL || 'images/default-avatar.png',
        chatSessionId: sessionToUse, // Assign to current session
      };

      if (selectedImageFile) {
        userMessagePayload.type = 'image';
        const imageUrl = await uploadFileToStorage(selectedImageFile, 'wonderjoy_chat_images');
        userMessagePayload.mediaUrl = imageUrl;
        userMessagePayload.imageUrlForAnalysis = imageUrl;
        userMessagePayload.content = currentMessageText.trim() || 'Image for analysis';
      } else if (selectedVideoFile) {
        userMessagePayload.type = 'video';
        const videoUrl = await uploadFileToStorage(selectedVideoFile, 'wonderjoy_chat_videos');
        userMessagePayload.mediaUrl = videoUrl;
        userMessagePayload.imageUrlForAnalysis = videoUrl;
        userMessagePayload.content = currentMessageText.trim() || 'Video for analysis';
      }

      // Add user's message to Firestore
      await addDoc(collection(db, userChatCollectionPath), userMessagePayload);

      // 2. Update/Create Chat Session Summary (for sidebar)
      const sessionDocRef = doc(db, userChatSessionsCollectionPath, sessionToUse);
      const sessionDocSnapshot = await getDoc(sessionDocRef); // Get doc to check existence and current title

      let sessionTitle = sessionDocSnapshot.exists() ? sessionDocSnapshot.data().title : "New Chat";
      // If it's a new session, or the first message of an existing session (which implies no title yet)
      // and a content message is provided, use that for the title.
      if (!sessionDocSnapshot.exists() || messages.length === 0) { // Check local messages state for current session
        if (userMessagePayload.content) {
          sessionTitle = userMessagePayload.content.substring(0, 50) + (userMessagePayload.content.length > 50 ? '...' : '');
        } else if (userMessagePayload.type === 'image') {
          sessionTitle = "Image Analysis";
        } else if (userMessagePayload.type === 'video') {
          sessionTitle = "Video Analysis";
        }
      }

      await setDoc(sessionDocRef, {
        title: sessionTitle,
        lastActivity: messageTimestamp,
        userId: activeUser.uid,
        // Only set firstMessageContent if it's truly the first message of this session being created
        ...(messages.length === 0 && !sessionDocSnapshot.exists() && { firstMessageContent: userMessagePayload.content }),
      }, { merge: true });


      // 3. Make the API call to your backend
      const formData = new FormData();
      if (selectedImageFile) {
        formData.append('file', selectedImageFile);
      } else if (selectedVideoFile) {
        formData.append('file', selectedVideoFile);
      }
      if (currentMessageText.trim()) {
        formData.append('user_message', currentMessageText.trim());
      }
      formData.append('chat_session_id', sessionToUse); // Pass session ID to backend

      const response = await fetch(`${BACKEND_URL}/chat-predict`, {
        method: 'POST',
        headers: {
          'X-User-ID': activeUser.uid,
        },
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        try {
          const errorJson = JSON.parse(errorText);
          throw new Error(`API Error: ${response.status} - ${errorJson.detail || errorText}`);
        } catch (e) {
          throw new Error(`API Error: ${response.status} - ${errorText}`);
        }
      }

      const aiResponseData = await response.json();

      const aiContent = aiResponseData.type === 'analysis_result' ?
        aiResponseData.overall_summary || "Here's your analysis." :
        aiResponseData.message || "An AI response was received.";

      // Add AI response to Firestore
      await addDoc(collection(db, userChatCollectionPath), {
        sender: 'ai',
        type: aiResponseData.type || 'text',
        content: aiContent,
        analysisData: aiResponseData.analysisData || null,
        timestamp: Timestamp.now(),
        chatSessionId: sessionToUse, // Assign AI response to current session
      } as Omit<AIMessage, 'id'>);

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
      setIsProcessingAI(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedImageFile(e.target.files[0]);
      setSelectedVideoFile(null);
      (document.getElementById('chatVideoUpload') as HTMLInputElement).value = ''; // Clear other file input
    } else {
      setSelectedImageFile(null);
    }
  };

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedVideoFile(e.target.files[0]);
      setSelectedImageFile(null);
      (document.getElementById('chatImageUpload') as HTMLInputElement).value = ''; // Clear other file input
    } else {
      setSelectedVideoFile(null);
    }
  };

  const startNewChatSession = useCallback(() => {
    const newId = uuidv4();
    setCurrentChatSessionId(newId);
    setMessages([]); // Clear messages for the new session
    router.push(`/chat?sessionId=${newId}`); // Navigate to new session
    setCurrentMessageText(''); // Clear input
    setSelectedImageFile(null);
    setSelectedVideoFile(null);
    // Clear file input elements
    if (document.getElementById('chatImageUpload')) (document.getElementById('chatImageUpload') as HTMLInputElement).value = '';
    if (document.getElementById('chatVideoUpload')) (document.getElementById('chatVideoUpload') as HTMLInputElement).value = '';
    if (isSidebarOpen) setIsSidebarOpen(false); // Close sidebar on mobile
  }, [router, isSidebarOpen]);

  const loadChatSession = useCallback((sessionId: string) => {
    setCurrentChatSessionId(sessionId);
    // setMessages([]); // No need to clear, the useEffect for messages will fetch new ones
    router.push(`/chat?sessionId=${sessionId}`); // Update URL
    setCurrentMessageText(''); // Clear input
    setSelectedImageFile(null);
    setSelectedVideoFile(null);
    // Clear file input elements
    if (document.getElementById('chatImageUpload')) (document.getElementById('chatImageUpload') as HTMLInputElement).value = '';
    if (document.getElementById('chatVideoUpload')) (document.getElementById('chatVideoUpload') as HTMLInputElement).value = '';
    if (isSidebarOpen) setIsSidebarOpen(false); // Close sidebar on mobile
  }, [router, isSidebarOpen]);

  // Handle authentication loading/no user
  // This initial loading state should ideally come from AuthContext for the main 'user'
  // and then the anonymous sign-in resolves if 'user' is null.
  if (authLoading || (!user && !anonymousUser)) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-80px)] text-purple-700">
        <Loader2 className="h-10 w-10 animate-spin mr-3" />
        <p className="text-xl">Initializing WonderJoy AI Chat...</p>
      </div>
    );
  }

  // If after loading, there's still no activeUser (meaning both authenticated and anonymous failed)
  if (!activeUser) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-80px)] px-4">
        <div className="max-w-4xl mx-auto p-8 bg-white rounded-2xl shadow-xl border border-gray-100 text-center">
          <SparklesIcon className="w-16 h-16 mx-auto text-purple-600 mb-4" />
          <h2 className="text-3xl font-bold text-purple-700 mb-4">Welcome to WonderJoy AI Analyst!</h2>
          <p className="text-lg text-gray-700 mb-6">
            There was an issue starting your session. Please sign in or try refreshing the page.
          </p>
          <Link href="/login">
            <Button className="bg-purple-600 hover:bg-purple-700 text-white text-lg px-8 py-3 rounded-full shadow-md">
              Login / Register
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <section className="flex flex-1 h-[calc(100vh-80px)] relative"> {/* Adjusted height to fill screen below header */}
      {/* Sidebar for Chat History and Profile */}
      <div className={`fixed inset-y-0 left-0 w-64 bg-gray-900 text-white flex flex-col transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} sm:relative sm:translate-x-0 sm:flex-shrink-0 sm:w-64 z-20`}>
        <div className="flex-1 flex flex-col p-4 overflow-y-auto custom-scrollbar">
          {/* New Chat Button */}
          <Button
            onClick={startNewChatSession}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 rounded-lg flex items-center justify-center mb-4 shadow-md"
          >
            <PlusCircle className="w-5 h-5 mr-2" /> New Analysis
          </Button>

          {/* Chat Sessions List */}
          <h3 className="text-gray-400 text-sm font-semibold uppercase mb-2">Your Sessions</h3>
          <ul className="flex-1 space-y-2">
            {chatSessions.length === 0 ? (
              <li className="text-gray-500 italic text-sm px-2">No past sessions. Start a new analysis!</li>
            ) : (
              chatSessions.map((session) => (
                <li key={session.id}>
                  <Button
                    onClick={() => loadChatSession(session.id)}
                    variant="ghost"
                    className={`w-full justify-start text-left px-3 py-2 rounded-md transition-colors duration-200 ${
                      currentChatSessionId === session.id
                        ? 'bg-purple-700 text-white shadow-inner'
                        : 'text-gray-200 hover:bg-gray-700'
                    }`}
                  >
                    <MessageSquare className="w-4 h-4 mr-2 text-purple-300 flex-shrink-0" />
                    <span className="truncate flex-1">{session.title}</span>
                  </Button>
                </li>
              ))
            )}
          </ul>
        </div>

        {/* User Profile/Avatar and Logout at bottom of sidebar */}
        <div className="p-4 border-t border-gray-700 flex items-center justify-between">
          <Link href="/profile" passHref className="flex items-center group">
            {activeUser.photoURL ? (
              <Image
                src={activeUser.photoURL}
                alt={activeUser.displayName || activeUser.email || 'User'}
                width={36}
                height={36}
                className="rounded-full object-cover border-2 border-purple-400 group-hover:scale-105 transition-transform"
              />
            ) : (
              <div className="h-9 w-9 rounded-full bg-purple-700 flex items-center justify-center text-white font-bold text-base border-2 border-purple-400 group-hover:scale-105 transition-transform">
                {activeUser.displayName ? activeUser.displayName.charAt(0).toUpperCase() : (activeUser.email ? activeUser.email.charAt(0).toUpperCase() : 'U')}
              </div>
            )}
            <div className="ml-3">
              <span className="block font-semibold text-white group-hover:text-purple-300 transition-colors">
                {activeUser.displayName || (activeUser.isAnonymous ? "Guest User" : activeUser.email || "User")}
              </span>
              <span className="block text-xs text-gray-400">
                 {activeUser.isAnonymous ? "Anonymous Session" : "View Profile"}
              </span>
            </div>
          </Link>
          <Button onClick={logout} variant="ghost" className="text-gray-400 hover:text-red-400 p-2">
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Mobile Sidebar Toggle Button */}
      <div className="sm:hidden fixed top-20 left-4 z-30">
        <Button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="bg-purple-600 hover:bg-purple-700 text-white p-3 rounded-full shadow-lg"
          aria-label="Toggle chat sessions sidebar"
        >
          {isSidebarOpen ? <XIcon className="w-6 h-6" /> : <MenuIcon className="w-6 h-6" />}
        </Button>
      </div>
       {/* Overlay for mobile sidebar when open */}
       {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-10 sm:hidden"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}

      {/* Main Chat Area */}
      {/* Added sm:ml-64 to push main content for desktop, and ensures it takes remaining width */}
      <div className="flex-1 flex flex-col bg-white rounded-l-2xl shadow-xl border-l border-gray-100 relative overflow-hidden sm:ml-64">
        <h2 className="text-3xl font-bold text-center text-purple-700 py-4 border-b border-gray-100 flex items-center justify-center gap-3">
          <SparklesIcon className="w-8 h-8 text-yellow-400" /> WonderJoy AI Analyst
        </h2>

        {/* Chat Messages Display Area */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-gray-50 flex flex-col">
          {messages.length === 0 && !isProcessingAI ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 italic">
              <SparklesIcon className="w-16 h-16 text-purple-400 mb-4" />
              <p className="text-lg">
                Start a new conversation or select an existing one from the sidebar.
              </p>
              <p className="text-md mt-2">
                Send a selfie or a message to begin your beauty analysis!
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex items-start gap-3 mb-4 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender === 'ai' && (
                  <div className="flex-shrink-0">
                    <Image
                      src="/images/wonderjoy-ai-avatar.png"
                      alt="WonderJoy AI"
                      width={32}
                      height={32}
                      className="rounded-full object-cover border-2 border-purple-400"
                    />
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
                  {msg.type === 'video' && msg.mediaUrl && (
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
                    </div>
                  )}
                  <span className={`text-xs mt-1 ${msg.sender === 'user' ? 'text-purple-200' : 'text-gray-500'} text-right`}>
                    {msg.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {msg.sender === 'user' && (
                  <div className="flex-shrink-0">
                    <Image
                      src={activeUser?.photoURL || 'images/default-avatar.png'}
                      alt={activeUser?.displayName || "You"}
                      width={32}
                      height={32}
                      className="rounded-full object-cover border-2 border-purple-400"
                    />
                  </div>
                )}
              </div>
            ))
          )}
          {isProcessingAI && (
            <div className="flex justify-start items-center gap-3 mb-4">
              <Image
                src="/images/wonderjoy-ai-avatar.png"
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
        <form onSubmit={handleSendMessage} className="flex flex-col gap-2 p-4 bg-gray-100 rounded-b-lg border-t border-gray-200">
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
                // When typing, clear file selections
                setSelectedImageFile(null);
                setSelectedVideoFile(null);
                const chatImageUploadInput = document.getElementById('chatImageUpload') as HTMLInputElement;
                if (chatImageUploadInput) chatImageUploadInput.value = '';
                const chatVideoUploadInput = document.getElementById('chatVideoUpload') as HTMLInputElement;
                if (chatVideoUploadInput) chatVideoUploadInput.value = '';
              }}
              placeholder={selectedImageFile || selectedVideoFile ? "Add a caption (optional)" : "Ask WonderJoy AI anything or upload a selfie..."}
              className="flex-grow border-gray-300 focus:border-purple-500 focus:ring-purple-500 rounded-full py-2 px-4"
              disabled={isProcessingAI}
            />
            <label htmlFor="chatImageUpload" className="cursor-pointer bg-purple-100 text-purple-700 hover:bg-purple-200 p-2 rounded-full shadow-sm transition-colors flex items-center justify-center w-10 h-10 flex-shrink-0">
              <ImageIcon className="w-5 h-5" />
              <input
                id="chatImageUpload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageChange}
                // Disable if AI is processing, or a video is selected, or if text is typed and no image is selected
                disabled={isProcessingAI || !!selectedVideoFile || (currentMessageText.trim() !== '' && !selectedImageFile && !selectedVideoFile)}
              />
            </label>
            <label htmlFor="chatVideoUpload" className="cursor-pointer bg-purple-100 text-purple-700 hover:bg-purple-200 p-2 rounded-full shadow-sm transition-colors flex items-center justify-center w-10 h-10 flex-shrink-0">
              <VideoIcon className="w-5 h-5" />
              <input
                id="chatVideoUpload"
                type="file"
                accept="video/*"
                className="hidden"
                onChange={handleVideoChange}
                // Disable if AI is processing, or an image is selected, or if text is typed and no video is selected
                disabled={isProcessingAI || !!selectedImageFile || (currentMessageText.trim() !== '' && !selectedImageFile && !selectedVideoFile)}
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
      </div>
    </section>
  );
}