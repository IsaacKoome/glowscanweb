// components/ImageUploader.js (or .tsx if it's a TypeScript file)
// This component now solely handles the file input and passes the selected file and its URL to the parent.
// The parent component (e.g., app/upload/page.tsx) will handle displaying the image preview and loading states.

import Image from 'next/image'; // Still imported, but its usage will be commented out or removed if not needed internally.

export default function ImageUploader({ onImageSelected, isLoading }) { // Changed onImageUpload to onImageSelected, removed imageUrl
  // onImageSelected: Function to call when a new file is selected, passes (file: File, url: string)
  // isLoading: Boolean to indicate if the parent is processing (can be used to disable input)

  const handleFileChange = (event) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      const fileUrl = URL.createObjectURL(file); // Create a URL for the selected file
      onImageSelected(file, fileUrl); // Pass both the File object and its URL to the parent
    }
  };

  return (
    <div className="flex flex-col items-center p-4 bg-white rounded-xl shadow-md">
      <h3 className="text-xl font-semibold mb-4">Upload Your Selfie</h3>
      
      <input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="mb-4 p-2 border rounded-lg"
        disabled={isLoading} // Disable input if parent is loading
      />

      {/* The loading spinner and image preview logic are now expected to be handled by the parent component (app/upload/page.tsx).
          This component's responsibility is just to provide the file input.
      */}
      {/*
      {isLoading && (
        <div className="flex items-center justify-center p-4">
          <svg className="animate-spin h-8 w-8 text-purple-500 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p>Uploading and processing...</p>
        </div>
      )}

      {imageUrl && !isLoading && (
        <div className="relative w-64 h-64 border-2 border-gray-300 rounded-lg overflow-hidden mt-4">
          <Image
            src={imageUrl}
            alt="Uploaded Selfie"
            layout="fill"
            objectFit="contain"
            className="rounded-lg"
          />
        </div>
      )}

      {!imageUrl && !isLoading && (
        <p className="text-gray-500 mt-4">No image uploaded yet.</p>
      )}
      */}
    </div>
  );
}
