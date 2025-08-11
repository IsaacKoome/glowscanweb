// components/ChatView.tsx
"use client";

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  SparklesIcon,
  SendIcon,
  Loader2,
  ImageIcon,
  VideoIcon,
  CameraIcon
} from "lucide-react";
import {
  Timestamp,
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { v4 as uuidv4 } from "uuid";
import { useAuth } from '../context/AuthContext';
import { useCamera } from '../context/CameraContext';

import { getInitials } from '@/lib/utils';
import AnalysisResult from './AnalysisResult';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://glowscan-backend-241128138627.us-central1.run.app';

interface AIMessage {
  id: string;
  sender: 'user' | 'ai';
  timestamp: Timestamp;
  type: 'text' | 'image' | 'video' | 'analysis_result';
  content?: string;
  mediaUrl?: string;
  analysisData?: Record<string, unknown>;
  imageUrlForAnalysis?: string;
  senderPhotoURL?: string;
}

interface ChatViewProps {
  conversationId: string;
}

export function ChatView({ conversationId }: ChatViewProps) {
  const { user } = useAuth();
  const { setShowCamera } = useCamera();
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [currentMessageText, setCurrentMessageText] = useState<string>('');
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [selectedVideoFile, setSelectedVideoFile] = useState<File | null>(null);
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const messagesCollectionPath = `users/${user?.uid}/conversations/${conversationId}/messages`;

  useEffect(() => {
    if (!user || !conversationId) return;

    setIsLoadingMessages(true);
    const q = query(
      collection(db, messagesCollectionPath),
      orderBy("timestamp", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedMessages: AIMessage[] = [];
      snapshot.forEach((doc) => {
        fetchedMessages.push({ id: doc.id, ...doc.data() } as AIMessage);
      });
      setMessages(fetchedMessages);
      setIsLoadingMessages(false);
    }, (error) => {
      console.error("Error fetching chat messages:", error);
      setIsLoadingMessages(false);
    });

    return () => unsubscribe();
  }, [user, conversationId, messagesCollectionPath]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const uploadFileToStorage = async (file: File, folder: string): Promise<string> => {
    if (!user) throw new Error("User not authenticated for upload.");
    const fileRef = ref(storage, `${folder}/${user.uid}/${conversationId}/${uuidv4()}-${file.name}`);
    const snapshot = await uploadBytes(fileRef, file);
    return getDownloadURL(snapshot.ref);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      alert("Authentication error. Please sign in again.");
      return;
    }

    if (currentMessageText.trim() === '' && !selectedImageFile && !selectedVideoFile) {
      return;
    }

    setIsProcessingAI(true);

    try {
      const userMessagePayload: Omit<AIMessage, 'id'> = {
        sender: 'user',
        timestamp: Timestamp.now(),
        type: 'text',
        content: currentMessageText.trim(),
        senderPhotoURL: user.photoURL || undefined,
      };

      const firstMessage = messages.length === 0;

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

      await addDoc(collection(db, messagesCollectionPath), userMessagePayload);

      if (firstMessage && userMessagePayload.content) {
        const conversationRef = doc(db, `users/${user.uid}/conversations`, conversationId);
        await updateDoc(conversationRef, {
          name: userMessagePayload.content.substring(0, 30)
        });
      }

      const formData = new FormData();
      if (selectedImageFile) formData.append('file', selectedImageFile);
      else if (selectedVideoFile) formData.append('file', selectedVideoFile);
      if (currentMessageText.trim()) formData.append('user_message', currentMessageText.trim());

      const response = await fetch(`${BACKEND_URL}/chat-predict`, {
        method: 'POST',
        headers: { 'X-User-ID': user.uid },
        body: formData
      });

      if (!response.ok) throw new Error(`API Error: ${response.status} - ${await response.text()}`);

      const aiResponseData = await response.json();
      const aiContent = aiResponseData.type === 'analysis_result' ?
        aiResponseData.overall_summary || "Here's your analysis." :
        aiResponseData.message || "An AI response was received.";

      await addDoc(collection(db, messagesCollectionPath), {
        sender: 'ai',
        type: aiResponseData.type || 'text',
        content: aiContent,
        analysisData: aiResponseData.analysisData || null,
        timestamp: Timestamp.now()
      } as Omit<AIMessage, 'id'>);

      setCurrentMessageText('');
      setSelectedImageFile(null);
      setSelectedVideoFile(null);
      // Reset file inputs
      (document.getElementById('chatImageUpload') as HTMLInputElement).value = '';
      (document.getElementById('chatVideoUpload') as HTMLInputElement).value = '';

    } catch (error) {
      console.error("Error sending message:", error);
      alert(`Failed to send message: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsProcessingAI(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedImageFile(e.target.files[0]);
      setSelectedVideoFile(null);
    }
  };

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedVideoFile(e.target.files[0]);
      setSelectedImageFile(null);
    }
  };

  return (
    <main className="flex-1 flex flex-col bg-gray-100">
      <header className="bg-white border-b border-gray-200 p-4 flex items-center justify-between z-10">
        <h2 className="text-xl font-bold text-purple-700 flex items-center gap-2">
          <SparklesIcon className="w-6 h-6 text-yellow-400" /> WonderJoy AI Analyst
        </h2>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
        {isLoadingMessages ? (
          <div className="flex justify-center items-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-purple-700" />
          </div>
        ) : (
          <div className="space-y-6">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex items-start gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.sender === 'ai' && (
                  <Image src="/images/wonderjoy-ai-avatar.png" alt="AI" width={32} height={32} className="rounded-full border-2 border-purple-400" />
                )}
                <div className={`flex flex-col max-w-[80%] p-3 rounded-xl shadow-sm ${msg.sender === 'user' ? 'bg-purple-600 text-white rounded-br-none' : 'bg-gray-200 text-gray-800 rounded-bl-none'}`}>
                  {/* Message content rendering logic here, adapted from original page */}
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
                    <h4 className="font-bold mb-1">Live Analysis Result:</h4>
                    <AnalysisResult result={msg.analysisData} />
                  </div>
                )}
                  <span className={`text-xs mt-1 ${msg.sender === 'user' ? 'text-purple-200' : 'text-gray-500'} text-right`}>
                    {msg.timestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                {msg.sender === 'user' && (
                  <div className="flex-shrink-0">
                    {user?.photoURL ? (
                      <Image src={user.photoURL} alt="User" width={32} height={32} className="rounded-full" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold text-sm">
                        {getInitials(user?.displayName)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            {isProcessingAI && (
              <div className="flex justify-start items-center gap-3">
                <Image src="/images/wonderjoy-ai-avatar.png" alt="AI" width={32} height={32} className="rounded-full border-2 border-purple-400" />
                <div className="bg-white text-gray-800 rounded-xl rounded-bl-none p-3 shadow-sm flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">WonderJoy AI is thinking...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
        {messages.length === 0 && !isLoadingMessages && (
          <div className="text-center text-gray-500 py-16">
            <SparklesIcon className="w-12 h-12 mx-auto text-purple-400 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Start a new conversation</h3>
            <p>Ask anything or upload a selfie for analysis.</p>
          </div>
        )}
      </div>

      <div className="p-4 bg-white border-t border-gray-200 z-10">
        <form onSubmit={handleSendMessage} className="flex flex-col gap-2">
          {(selectedImageFile || selectedVideoFile) && (
            <div className="flex items-center gap-2 text-sm text-gray-700 px-2">
              {selectedImageFile && <span className="flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-1 rounded-full"><ImageIcon className="w-4 h-4" /> {selectedImageFile.name}</span>}
              {selectedVideoFile && <span className="flex items-center gap-1 bg-green-100 text-green-800 px-2 py-1 rounded-full"><VideoIcon className="w-4 h-4" /> {selectedVideoFile.name}</span>}
            </div>
          )}
          <div className="flex gap-2 items-center">
            <Input
              type="text"
              value={currentMessageText}
              onChange={(e) => setCurrentMessageText(e.target.value)}
              placeholder="Ask WonderJoy AI anything..."
              className="flex-grow"
              disabled={isProcessingAI}
            />
            <label htmlFor="chatImageUpload" className="cursor-pointer p-2 rounded-full hover:bg-gray-200"><ImageIcon className="w-5 h-5 text-gray-600" /></label>
            <input id="chatImageUpload" type="file" accept="image/*" className="hidden" onChange={handleImageChange} disabled={isProcessingAI} />
            <label htmlFor="chatVideoUpload" className="cursor-pointer p-2 rounded-full hover:bg-gray-200"><VideoIcon className="w-5 h-5 text-gray-600" /></label>
            <input id="chatVideoUpload" type="file" accept="video/*" className="hidden" onChange={handleVideoChange} disabled={isProcessingAI} />
            <button type="button" onClick={() => setShowCamera(true, conversationId)} className="cursor-pointer p-2 rounded-full hover:bg-gray-200"><CameraIcon className="w-5 h-5 text-gray-600" /></button>
            <Button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white rounded-full p-3" disabled={isProcessingAI || (!currentMessageText.trim() && !selectedImageFile && !selectedVideoFile)}>
              {isProcessingAI ? <Loader2 className="h-5 w-5 animate-spin" /> : <SendIcon className="w-5 h-5" />}
            </Button>
          </div>
        </form>
      </div>
    </main>
  );
}

