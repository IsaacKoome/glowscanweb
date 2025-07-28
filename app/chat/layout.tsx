// app/chat/layout.tsx
// This layout will apply only to pages within the 'chat' folder.
import React, { Suspense } from 'react';
import { Loader2 } from 'lucide-react'; // For the suspense fallback

// Assuming your sidebar component is now here:
import ChatSidebar from './chat-sidebar'; // You'll create this component next

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <section className="flex flex-1 h-[calc(100vh-80px)] relative"> {/* Adjust height based on your header */}
      {/* Wrap ChatSidebar in Suspense if it uses client-side hooks like useSearchParams */}
      <Suspense fallback={
        <div className="flex-shrink-0 w-64 bg-gray-900 text-white flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
        </div>
      }>
        <ChatSidebar />
      </Suspense>
      {children} {/* This will be your app/chat/page.tsx (AiChatClient component) */}
    </section>
  );
}