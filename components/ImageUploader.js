// components/ImageUploader.js (or .tsx if it's a TypeScript file)
// This component now solely handles the file input and passes the selected file and its URL to the parent.
// The parent component (e.g., app/upload/page.tsx) will handle displaying the image preview and loading states.

// import Image from 'next/image'; // REMOVED: Image is no longer used directly in this component

export default function ImageUploader({ onImageSelected, isLoading }) {
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
    </div>
  );
}
