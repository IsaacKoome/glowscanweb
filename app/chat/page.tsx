// app/chat/page.tsx
"use client";

import { Sidebar } from '@/components/Sidebar';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Loader2, SparklesIcon } from 'lucide-react';

export default function ChatRootPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

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
      <main className="flex-1 flex flex-col items-center justify-center text-center bg-gray-50">
        <div className="bg-white p-12 rounded-2xl shadow-lg border border-gray-200">
            <SparklesIcon className="w-16 h-16 mx-auto text-purple-500 mb-6" />
            <h2 className="text-3xl font-bold text-gray-800 mb-2">Welcome to WonderJoy AI</h2>
            <p className="text-gray-600">
                Select a conversation or start a new one to begin.
            </p>
        </div>
      </main>
    </div>
  );
}
