// app/chat/chat-sidebar.tsx
"use client"; // This is a client component

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import {
  SparklesIcon,
  MessageSquare,
  PlusCircle,
  LogOut,
  MenuIcon,
  XIcon
} from "lucide-react";
import { Timestamp, collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from '../../context/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation'; // Only useSearchParams is needed here if activeUser is from AuthContext
import { v4 as uuidv4 } from "uuid";

interface ChatSession {
  id: string;
  title: string;
  lastActivity: Timestamp;
  firstMessageContent?: string;
  userId: string;
}

export default function ChatSidebar() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams(); // This is still okay here, handled by Suspense in layout

  const activeUser = user; // Assuming user from useAuth is the main source

  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [currentChatSessionId, setCurrentChatSessionId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const userChatSessionsCollectionPath = activeUser ? `user_chat_sessions/${activeUser.uid}/sessions` : null;

  useEffect(() => {
    if (!activeUser) return;
    const sessionIdFromUrl = searchParams.get('sessionId');
    setCurrentChatSessionId(sessionIdFromUrl); // Keep current session in sync with URL
  }, [activeUser, searchParams]);

  useEffect(() => {
    if (!activeUser || authLoading || !userChatSessionsCollectionPath) return;

    const q = query(
      collection(db, userChatSessionsCollectionPath),
      orderBy("lastActivity", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedSessions: ChatSession[] = [];
      snapshot.forEach((doc) => {
        fetchedSessions.push({ id: doc.id, ...doc.data() } as ChatSession);
      });
      setChatSessions(fetchedSessions);
    }, (error) => {
      console.error("Error fetching chat sessions:", error);
    });

    return () => unsubscribe();
  }, [activeUser, authLoading, userChatSessionsCollectionPath]);


  const startNewChatSession = useCallback(() => {
    const newId = uuidv4();
    router.push(`/chat?sessionId=${newId}`);
    // No need to set currentChatSessionId here, the useEffect based on searchParams will handle it
    if (isSidebarOpen) setIsSidebarOpen(false);
  }, [router, isSidebarOpen]);

  const loadChatSession = useCallback((sessionId: string) => {
    router.push(`/chat?sessionId=${sessionId}`);
    // No need to set currentChatSessionId here, the useEffect based on searchParams will handle it
    if (isSidebarOpen) setIsSidebarOpen(false);
  }, [router, isSidebarOpen]);

  if (!activeUser) {
    // This case should ideally be handled by the parent AiChatClient or RootLayout
    // but a fallback here ensures robustness.
    return (
      <div className="flex-shrink-0 w-64 bg-gray-900 text-white flex flex-col p-4">
        <p className="text-gray-500 italic">Please login to view sessions.</p>
      </div>
    );
  }

  return (
    <>
      <div className={`fixed inset-y-0 left-0 w-64 bg-gray-900 text-white flex flex-col transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} sm:relative sm:translate-x-0 sm:flex-shrink-0 sm:w-64 z-20`}>
        <div className="flex-1 flex flex-col p-4 overflow-y-auto custom-scrollbar">
          <Button
            onClick={startNewChatSession}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 rounded-lg flex items-center justify-center mb-4 shadow-md"
          >
            <PlusCircle className="w-5 h-5 mr-2" /> New Analysis
          </Button>

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

      <div className="sm:hidden fixed top-20 left-4 z-30">
        <Button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="bg-purple-600 hover:bg-purple-700 text-white p-3 rounded-full shadow-lg"
          aria-label="Toggle chat sessions sidebar"
        >
          {isSidebarOpen ? <XIcon className="w-6 h-6" /> : <MenuIcon className="w-6 h-6" />}
        </Button>
      </div>
       {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-10 sm:hidden"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}
    </>
  );
}