
// context/CameraContext.tsx
"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface CameraContextType {
  showCamera: boolean;
  setShowCamera: (show: boolean) => void;
}

const CameraContext = createContext<CameraContextType | undefined>(undefined);

export const CameraProvider = ({ children }: { children: ReactNode }) => {
  const [showCamera, setShowCamera] = useState(false);

  return (
    <CameraContext.Provider value={{ showCamera, setShowCamera }}>
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
