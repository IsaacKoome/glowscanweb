// components/ImageUploader.js
import React, { useState } from 'react';
// For web, these might not be directly available like in React Native/Expo.
// For a Next.js web app, you'd typically use a simple HTML input type="file".
// However, if you intend to transition back to Expo/React Native, these imports are relevant.
// For pure web, ImagePicker and Camera are not used. I'll provide the web-compatible version.

// If you are using this in a Next.js web app, the ImagePicker/Camera APIs from Expo are not applicable.
// For web, we use a standard HTML <input type="file">.
// I'm keeping this file name for conceptual continuity, but its content is pure web.

export default function ImageUploader({ onImageSelected }) {
  const handleFileChange = (event) => {
    const file = event.target.files[0]; // Get the selected file
    if (file) {
      // Create a URL for the image to display a preview
      const fileUrl = URL.createObjectURL(file);
      // Pass both the File object and the preview URL to the parent component
      onImageSelected(file, fileUrl);
    }
  };

  return (
    <div className="flex flex-col items-center w-full max-w-sm mx-auto p-4">
      {/* Label acts as a custom styled button for file input */}
      <label
        htmlFor="image-upload"
        className="cursor-pointer bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 w-full text-center"
      >
        Upload Image
      </label>
      {/* Hidden input element that handles file selection */}
      <input
        id="image-upload"
        type="file"
        accept="image/*" // Restrict to image files
        className="hidden" // Hide the default ugly file input button
        onChange={handleFileChange} // Call handleFileChange when a file is selected
      />
      <p className="text-sm text-gray-500 mt-2">Choose an image from your device to analyze.</p>
    </div>
  );
}