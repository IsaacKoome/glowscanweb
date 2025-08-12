// app/chat/page.tsx
"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { useAuth } from '@/context/AuthContext';
import { Loader2, SendIcon, ImageIcon, VideoIcon, SparklesIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function ChatRootPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [currentMessageText, setCurrentMessageText] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleStartChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || currentMessageText.trim() === '') {
      return;
    }

    setIsProcessing(true);

    try {
      // Create a new conversation
      const conversationRef = await addDoc(collection(db, `users/${user.uid}/conversations`), {
        name: currentMessageText.trim().substring(0, 30),
        createdAt: serverTimestamp(),
      });
      const conversationId = conversationRef.id;

      // Add the first message
      await addDoc(collection(db, `users/${user.uid}/conversations/${conversationId}/messages`), {
        sender: 'user',
        timestamp: serverTimestamp(),
        type: 'text',
        content: currentMessageText.trim(),
      });
      
      // Redirect to the new chat
      router.push(`/chat/${conversationId}`);

    } catch (error) {
      console.error("Error starting new chat:", error);
      alert("Failed to start a new chat. Please try again.");
      setIsProcessing(false);
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
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col">
        {/* Empty, scrollable message area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="flex justify-center items-center h-full">
            <div className="text-center text-gray-500">
              <SparklesIcon className="w-12 h-12 mx-auto text-purple-400 mb-4" />
              <h3 className="text-xl font-semibold mb-2">Start a new conversation</h3>
              <p>Ask anything or upload a selfie for analysis.</p>
            </div>
          </div>
        </div>
        
        {/* Input form pinned to the bottom */}
        <div className="p-4 bg-white border-t border-gray-200">
          <div className="max-w-3xl mx-auto">
            <form onSubmit={handleStartChat} className="flex gap-2 items-center">
              <Input
                type="text"
                value={currentMessageText}
                onChange={(e) => setCurrentMessageText(e.target.value)}
                placeholder="Ask WonderJoy AI anything to start a new chat..."
                className="flex-grow"
                disabled={isProcessing}
              />
              <Button 
                type="submit" 
                className="bg-purple-600 hover:bg-purple-700 text-white rounded-full p-3" 
                disabled={isProcessing || !currentMessageText.trim()}
              >
                {isProcessing ? <Loader2 className="h-5 w-5 animate-spin" /> : <SendIcon className="w-5 h-5" />}
              </Button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
