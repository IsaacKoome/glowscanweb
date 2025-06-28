import React, { useState } from 'react';

export default function ImageUploader({ onImageSelected }) {
  const [previewUrl, setPreviewUrl] = useState(null); // ✅ useState used

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      const fileUrl = URL.createObjectURL(file);
      setPreviewUrl(fileUrl); // ✅ update preview
      onImageSelected(file, fileUrl);
    }
  };

  return (
    <div className="flex flex-col items-center w-full max-w-sm mx-auto p-4">
      <label
        htmlFor="image-upload"
        className="cursor-pointer bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 w-full text-center"
      >
        Upload Image
      </label>
      <input
        id="image-upload"
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
      <p className="text-sm text-gray-500 mt-2">
        Choose an image from your device to analyze.
      </p>

      {/* ✅ Preview the selected image */}
      {previewUrl && (
        <div className="mt-4">
          <img
            src={previewUrl}
            alt="Preview"
            className="rounded-xl shadow-md max-h-64"
          />
        </div>
      )}
    </div>
  );
}
