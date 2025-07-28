// app/chat/page.tsx
// No "use client" here, this will be a Server Component to wrap the client component
import React, { Suspense } from 'react';
import AiChatClient from './chat-client'; // Import the new client component
import { Loader2 } from "lucide-react"; // Import Loader2 for the fallback

export default function AiChatPage() {
  return (
    // Wrap the client component in Suspense
    <Suspense fallback={
      <div className="flex justify-center items-center min-h-[calc(100vh-80px)] text-purple-700">
        <Loader2 className="h-10 w-10 animate-spin mr-3" />
        <p className="text-xl">Loading Chat...</p>
      </div>
    }>
      <AiChatClient />
    </Suspense>
  );
}