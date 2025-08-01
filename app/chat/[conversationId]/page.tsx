// app/chat/[conversationId]/page.tsx
"use client";

import { Sidebar } from '@/components/Sidebar';
import { ChatView } from '@/components/ChatView';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function ChatPage({ params }: any) {
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
      <ChatView conversationId={params.conversationId} />
    </div>
  );
}
