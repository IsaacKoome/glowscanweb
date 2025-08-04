// components/Sidebar.tsx
"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { Button } from "@/components/ui/button";
import {
  PlusCircleIcon,
  MessageSquare,
  Loader2,
  LogOutIcon
} from "lucide-react";
import { useAuth } from '../context/AuthContext';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Image from 'next/image';

import { getInitials } from '@/lib/utils';

interface Conversation {
  id: string;
  name: string;
  createdAt: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

export function Sidebar() {
  const { user, loading, logout } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const router = useRouter();
  const params = useParams();
  const conversationId = params.conversationId;

  useEffect(() => {
    if (user) {
      setIsLoadingConversations(true);
      const q = query(
        collection(db, `users/${user.uid}/conversations`),
        orderBy('createdAt', 'desc')
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const convos: Conversation[] = [];
        snapshot.forEach(doc => {
          convos.push({ id: doc.id, ...doc.data() } as Conversation);
        });
        setConversations(convos);
        setIsLoadingConversations(false);
      }, (error) => {
        console.error("Error fetching conversations:", error);
        setIsLoadingConversations(false);
      });

      return () => unsubscribe();
    }
  }, [user]);

  const handleNewChat = async () => {
    if (!user || isCreatingChat) return;
    setIsCreatingChat(true);
    try {
      const docRef = await addDoc(collection(db, `users/${user.uid}/conversations`), {
        name: 'New Chat',
        createdAt: serverTimestamp(),
      });
      router.push(`/chat/${docRef.id}`);
    } catch (error) {
      console.error("Error creating new chat:", error);
    } finally {
      setIsCreatingChat(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (error) {
      console.error("Failed to log out:", error);
    }
  };

  if (loading) {
    return (
      <aside className="w-full md:w-64 flex flex-col p-4 bg-gray-800 text-white">
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-full md:w-64 flex-col p-4 bg-gray-800 text-white hidden md:flex">
      <div className="flex items-center justify-between mb-6">
        <Link href="/chat" className="text-2xl font-bold flex items-center gap-2">
          <Image src="/images/wonderjoy-ai-avatar.png" alt="Logo" width={32} height={32} />
          WonderJoy
        </Link>
      </div>
      <Button onClick={handleNewChat} disabled={isCreatingChat} className="w-full bg-purple-600 hover:bg-purple-700 mb-6">
        {isCreatingChat ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <PlusCircleIcon className="mr-2 h-4 w-4" />
        )}
        New Chat
      </Button>
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <h2 className="text-sm font-semibold text-gray-400 mb-2">Recent Chats</h2>
        {isLoadingConversations ? (
          <div className="flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <nav className="space-y-1">
            {conversations.map(convo => (
              <Link
                key={convo.id}
                href={`/chat/${convo.id}`}
                className={`flex items-center p-2 text-sm rounded-md ${conversationId === convo.id ? 'bg-gray-700' : 'hover:bg-gray-700'}`}
              >
                <MessageSquare className="mr-3 h-4 w-4" />
                <span className="truncate">{convo.name}</span>
              </Link>
            ))}
          </nav>
        )}
      </div>
      <div className="mt-auto">
        <div className="border-t border-gray-700 pt-4">
          {user ? (
            <div className="flex items-center gap-3">
              {user.photoURL ? (
                <Image
                  src={user.photoURL}
                  alt={user.displayName || 'User'}
                  width={36}
                  height={36}
                  className="rounded-full"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold">
                  {getInitials(user.displayName)}
                </div>
              )}
              <div className="flex-1 truncate">
                <p className="text-sm font-semibold">{user.displayName || 'Anonymous User'}</p>
                <Link href={`/profile/${user.uid}`} className="text-xs text-gray-400 hover:underline">
                  View Profile
                </Link>
              </div>
              <button onClick={handleLogout} className="p-2 rounded-md hover:bg-gray-700" title="Logout">
                <LogOutIcon className="h-5 w-5" />
              </button>
            </div>
          ) : (
             <Link href="/login">
                <Button className="w-full bg-purple-600 hover:bg-purple-700">
                    Login
                </Button>
             </Link>
          )}
        </div>
      </div>
    </aside>
  );
}
