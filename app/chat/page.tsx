// app/chat/page.tsx
"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { useAuth } from '@/context/AuthContext';
import { Loader2, SparklesIcon, SendIcon, ImageIcon, VideoIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { addDoc, collection, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db, storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { v4 as uuidv4 } from "uuid";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://glowscan-backend-241128138627.us-central1.run.app';

export default function ChatRootPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [currentMessageText, setCurrentMessageText] = useState<string>('');
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [selectedVideoFile, setSelectedVideoFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleStartChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      alert("You must be logged in to start a chat.");
      return;
    }

    if (currentMessageText.trim() === '' && !selectedImageFile && !selectedVideoFile) {
      return;
    }

    setIsProcessing(true);

    try {
      // 1. Create a new conversation
      const conversationRef = await addDoc(collection(db, `users/${user.uid}/conversations`), {
        name: currentMessageText.trim().substring(0, 30) || 'New Chat',
        createdAt: serverTimestamp(),
      });
      const conversationId = conversationRef.id;

      // 2. Upload file if it exists
      let mediaUrl: string | undefined = undefined;
      let messageType: 'text' | 'image' | 'video' = 'text';

      const uploadFileToStorage = async (file: File, folder: string): Promise<string> => {
        const fileRef = ref(storage, `${folder}/${user.uid}/${conversationId}/${uuidv4()}-${file.name}`);
        const snapshot = await uploadBytes(fileRef, file);
        return getDownloadURL(snapshot.ref);
      };

      if (selectedImageFile) {
        mediaUrl = await uploadFileToStorage(selectedImageFile, 'wonderjoy_chat_images');
        messageType = 'image';
      } else if (selectedVideoFile) {
        mediaUrl = await uploadFileToStorage(selectedVideoFile, 'wonderjoy_chat_videos');
        messageType = 'video';
      }

      // 3. Add the first message
      const messagesCollectionPath = `users/${user.uid}/conversations/${conversationId}/messages`;
      await addDoc(collection(db, messagesCollectionPath), {
        sender: 'user',
        timestamp: Timestamp.now(),
        type: messageType,
        content: currentMessageText.trim(),
        mediaUrl: mediaUrl,
        senderPhotoURL: user.photoURL || undefined,
      });

      // 4. (Optional) Immediately trigger AI response from the client, or let ChatView handle it
      const formData = new FormData();
      if (selectedImageFile) formData.append('file', selectedImageFile);
      else if (selectedVideoFile) formData.append('file', selectedVideoFile);
      if (currentMessageText.trim()) formData.append('user_message', currentMessageText.trim());

      fetch(`${BACKEND_URL}/chat-predict`, {
        method: 'POST',
        headers: { 'X-User-ID': user.uid },
        body: formData
      }).then(async (response) => {
        if (response.ok) {
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
          });
        }
      });

      // 5. Redirect to the new chat
      router.push(`/chat/${conversationId}`);

    } catch (error) {
      console.error("Error starting new chat:", error);
      alert("Failed to start a new chat. Please try again.");
      setIsProcessing(false);
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

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-purple-700" />
      </div>
    );
  }

  if (!user) {
    router.push('/login');
    return null;
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      <main className="flex-1 flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center text-center bg-gray-50 p-4">
          {/* This area remains empty, acting as the top part of the chat view */}
        </div>
        <div className="p-4 bg-white border-t border-gray-200">
          <div className="max-w-2xl mx-auto">
            <form onSubmit={handleStartChat} className="flex flex-col gap-2">
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
                  disabled={isProcessing}
                />
                <label htmlFor="chatImageUpload" className="cursor-pointer p-2 rounded-full hover:bg-gray-200"><ImageIcon className="w-5 h-5 text-gray-600" /></label>
                <input id="chatImageUpload" type="file" accept="image/*" className="hidden" onChange={handleImageChange} disabled={isProcessing} />
                <label htmlFor="chatVideoUpload" className="cursor-pointer p-2 rounded-full hover:bg-gray-200"><VideoIcon className="w-5 h-5 text-gray-600" /></label>
                <input id="chatVideoUpload" type="file" accept="video/*" className="hidden" onChange={handleVideoChange} disabled={isProcessing} />
                <Button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white rounded-full p-3" disabled={isProcessing || (!currentMessageText.trim() && !selectedImageFile && !selectedVideoFile)}>
                  {isProcessing ? <Loader2 className="h-5 w-5 animate-spin" /> : <SendIcon className="w-5 h-5" />}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
