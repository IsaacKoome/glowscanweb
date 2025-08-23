"use client";

import React, { createContext, useContext, useState } from "react";

type CameraContextType = {
  showCamera: boolean;
  openCamera: () => void;
  closeCamera: () => void;
};

const CameraContext = createContext<CameraContextType | undefined>(undefined);

export function CameraProvider({ children }: { children: React.ReactNode }) {
  const [showCamera, setShowCamera] = useState(false);

  const openCamera = () => setShowCamera(true);
  const closeCamera = () => setShowCamera(false);

  return (
    <CameraContext.Provider value={{ showCamera, openCamera, closeCamera }}>
      {children}
    </CameraContext.Provider>
  );
}

export function useCamera() {
  const context = useContext(CameraContext);
  if (!context) {
    throw new Error("useCamera must be used inside CameraProvider");
  }
  return context;
}
