
// context/CameraContext.tsx
"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface CameraContextType {
  showCamera: boolean;
  setShowCamera: (show: boolean, conversationId?: string | null) => void;
  conversationId: string | null;
}

const CameraContext = createContext<CameraContextType | undefined>(undefined);

export const CameraProvider = ({ children }: { children: ReactNode }) => {
  const [showCamera, _setShowCamera] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const setShowCamera = (show: boolean, convId: string | null = null) => {
    _setShowCamera(show);
    setConversationId(convId);
  };

  return (
    <CameraContext.Provider value={{ showCamera, setShowCamera, conversationId }}>
      {children}
    </CameraContext.Provider>
  );
};

export const useCamera = () => {
  const context = useContext(CameraContext);
  if (context === undefined) {
    throw new Error('useCamera must be used within a CameraProvider');
  }
  return context;
};
