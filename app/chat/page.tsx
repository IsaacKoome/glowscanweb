// app/chat/page.tsx
'use client'; // This directive makes this a Client Component

// Import React itself, crucial for JSX and React.FC type
import React, { useState, useRef, useEffect, type Dispatch, type SetStateAction } from 'react';

import axios from 'axios'; // Standard import for axios

// Re-importing getAuth and other necessary components
import { getAuth } from 'firebase/auth'; // Assuming Firebase Auth is initialized and available globally
import Image from 'next/image'; // For optimized image display

// Import beautiful icons from Heroicons (confirm these are installed: npm install @heroicons/react)
import {
    CameraIcon,
    SparklesIcon,
    ExclamationCircleIcon,
    ArrowPathIcon,
    FaceSmileIcon,
    SunIcon,
    SwatchIcon,
    BeakerIcon,
    PaintBrushIcon
} from '@heroicons/react/24/solid';

// --- Type Definitions (Crucial for TypeScript) ---

// 1. Define the shape of the AI analysis response
interface AiAnalysisResult {
    overall_summary: string;
    hydration: string;
    acne: string;
    redness: string;
    skin_tone: string;
    makeup_coverage: string;
    makeup_blend: string;
    makeup_color_match: string;
    overall_glow_score: number;
    skincare_advice_tips: string[];
    makeup_enhancement_tips: string[];
}

// 2. Define the shape of a message in our chat state
interface UserImageMessage {
    type: 'user-image';
    content: string; // Base64 data URL of the image
    fileName: string;
}

interface AiAnalysisMessage {
    type: 'ai-analysis';
    content: AiAnalysisResult;
}

interface InfoMessage {
    type: 'info';
    content: string; // Text content for informational messages
}

// Union type for all possible message types in the state array
type ChatMessage = UserImageMessage | AiAnalysisMessage | InfoMessage;

// --- Custom Type Guard for AxiosError (Recommended by ChatGPT) ---
// Define a minimal AxiosError type that matches what we expect from the catch block
interface CustomAxiosError extends Error {
    response?: {
        data: any; // Can be more specific if you know your API error response shape
        status: number;
        headers: any;
    };
    request?: any;
    config?: any;
    code?: string;
    isAxiosError: boolean; // This property is key for the type guard
    toJSON: () => object;
}

// Custom type guard function
function isAxiosError(error: unknown): error is CustomAxiosError {
    return (
        typeof error === 'object' &&
        error !== null &&
        'isAxiosError' in error &&
        (error as any).isAxiosError === true // Use 'as any' for the runtime check if TypeScript complains
    );
}

// --- Main Chat Page Component ---

// Use React.FC for functional component typing
const ChatPage: React.FC = () => {
    // State declarations with explicit generic types for useState to prevent 'never[]' or 'null' inference issues
    const [messages, setMessages] = useState<ChatMessage[]>([]); // Initialize with empty array, but type is ChatMessage[]
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedImage, setSelectedImage] = useState<File | null>(null); // Initialize with null, but type is File | null

    // Refs for DOM manipulation
    const fileInputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Environment variable for backend URL
    const API_BASE_URL: string = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

    // Effect to scroll to the bottom of the chat messages when new messages are added
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Handler for when a user selects an image file
    const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
        const file = event.target.files?.[0]; // Get the first file selected, `?` for optional chaining
        if (file) {
            setSelectedImage(file);
            setError(null); // Clear any previous errors

            const reader = new FileReader();
            reader.onloadend = () => {
                // Read result will be string (Data URL) because we use readAsDataURL
                setMessages(prev => [...prev, { type: 'user-image', content: reader.result as string, fileName: file.name }]);
            };
            reader.readAsDataURL(file); // Read file as a data URL for preview
        }
    };

    // Handler for analyzing the selected image
    const handleAnalyzeImage = async (): Promise<void> => {
        if (!selectedImage) {
            setError("Please select a selfie to begin the analysis. ✨");
            return;
        }

        setLoading(true); // Start loading state
        setError(null); // Clear any previous errors

        // Authenticate user with Firebase
        const auth = getAuth(); // Assumes Firebase Auth is already initialized elsewhere in your app
        const user = auth.currentUser;
        if (!user) {
            setError("Oops! It seems you're not logged in. Please log in to unlock your personalized analysis. 🔐");
            setLoading(false);
            return;
        }
        const userId: string = user.uid; // Get the user's unique ID

        // Prepare form data for file upload
        const formData = new FormData();
        formData.append('file', selectedImage);

        try {
            // Add a "Thinking..." message from AI while processing
            setMessages(prev => [...prev, { type: 'info', content: "WonderJoy AI is analyzing your beautiful selfie... Please wait a moment! 🧐" }]);

            // Make the API call to your backend
            // Specify the response data type <AiAnalysisResult> for axios.post
            const response = await axios.post<AiAnalysisResult>(`${API_BASE_URL}/predict`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data', // Essential for file uploads
                    'X-User-ID': userId, // Pass user ID for backend authentication/logging
                },
            });

            // Remove the "Thinking..." message and add the AI analysis result
            // Filter out existing info messages to replace them
            setMessages(prev => prev.filter(msg => msg.type !== 'info'));
            setMessages(prev => [
                ...prev,
                { type: 'ai-analysis', content: response.data },
            ]);
            setSelectedImage(null); // Clear selected image after successful analysis

        } catch (err: unknown) { // Explicitly type err as unknown for robust error handling
            console.error("Error analyzing image:", err);
            let errorMessage: string = "An unexpected error occurred during analysis. Please try again. 😔";

            // --- Type Guarding for 'err' using our custom `isAxiosError` function ---
            if (isAxiosError(err)) { // NOW USING OUR CUSTOM TYPE GUARD!
                // TypeScript now knows `err` is a CustomAxiosError (or a type compatible with it)
                // Access properties like .response and .message safely
                errorMessage = err.response?.data?.detail || `Server Error: ${err.response?.status} - ${err.message}`;
            } else if (err instanceof Error) {
                // If it's a standard JavaScript Error object
                errorMessage = err.message;
            } else {
                // For any other unknown type of error, convert it to a string for display
                errorMessage = String(err);
            }

            setError(`Analysis failed: ${errorMessage}`);
            setMessages(prev => prev.filter(msg => msg.type !== 'info')); // Remove the thinking message on error
        } finally {
            setLoading(false); // End loading state
        }
    };

    // Helper function to render different types of chat messages dynamically
    const renderMessage = (message: ChatMessage, index: number): React.ReactElement | null => {
        // Use type guards (`if (message.type === '...')`) to narrow the type
        if (message.type === 'user-image') {
            // No need for `as UserImageMessage` because TypeScript narrows the type automatically within this block
            return (
                <div key={index} className="flex justify-end mb-4">
                    <div className="bg-gradient-to-br from-blue-400 to-indigo-500 text-white rounded-lg p-3 max-w-xs shadow-md">
                        <p className="font-semibold text-sm mb-2">You uploaded:</p>
                        <p className="text-xs italic mb-2">{message.fileName}</p> {/* `message` is now UserImageMessage */}
                        <Image
                            src={message.content} // Data URL from FileReader
                            alt="Your selfie preview"
                            width={200}
                            height={200}
                            layout="responsive" // Ensures responsiveness within its container
                            objectFit="contain"
                            className="rounded-md border border-indigo-300"
                        />
                    </div>
                </div>
            );
        } else if (message.type === 'ai-analysis') {
            const analysis = message.content; // TypeScript knows `message.content` is `AiAnalysisResult`
            return (
                <div key={index} className="flex justify-start mb-6">
                    <div className="bg-white rounded-lg p-5 max-w-xl shadow-lg border border-purple-200">
                        <h3 className="text-xl font-bold text-purple-700 mb-3 flex items-center">
                            <SparklesIcon className="h-6 w-6 text-purple-500 mr-2" />
                            WonderJoy AI Analysis:
                        </h3>
                        <p className="mb-4 text-gray-700 leading-relaxed">
                            <span className="font-semibold text-pink-600">Overall Summary:</span> {analysis.overall_summary}
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 mb-5">
                            {/* Skin Health Section */}
                            <div>
                                <h4 className="font-bold text-lg text-green-700 mb-2 flex items-center">
                                    <FaceSmileIcon className="h-5 w-5 text-green-500 mr-2" /> Skin Health Insights:
                                </h4>
                                <ul className="list-disc pl-5 text-gray-700 space-y-2">
                                    <li><span className="font-semibold">Hydration:</span> {analysis.hydration}</li>
                                    <li><span className="font-semibold">Acne:</span> {analysis.acne}</li>
                                    <li><span className="font-semibold">Redness:</span> {analysis.redness}</li>
                                    <li><span className="font-semibold">Skin Tone:</span> {analysis.skin_tone}</li>
                                </ul>
                            </div>

                            {/* Makeup Application Section */}
                            <div>
                                <h4 className="font-bold text-lg text-yellow-700 mb-2 flex items-center">
                                    <SwatchIcon className="h-5 w-5 text-yellow-500 mr-2" /> Makeup Application Insights:
                                </h4>
                                <ul className="list-disc pl-5 text-gray-700 space-y-2">
                                    <li><span className="font-semibold">Coverage:</span> {analysis.makeup_coverage}</li>
                                    <li><span className="font-semibold">Blend:</span> {analysis.makeup_blend}</li>
                                    <li><span className="font-semibold">Color Match:</span> {analysis.makeup_color_match}</li>
                                </ul>
                            </div>
                        </div>

                        <p className="text-lg font-bold text-center text-pink-600 mb-5 p-2 bg-pink-50 rounded-lg">
                            <SunIcon className="h-6 w-6 inline-block text-yellow-500 mr-2" /> Overall Glow Score: {analysis.overall_glow_score}/10
                        </p>

                        <div className="space-y-4">
                            {/* Skincare Tips */}
                            <div>
                                <h4 className="font-bold text-lg text-blue-700 mb-2 flex items-center">
                                    <BeakerIcon className="h-5 w-5 text-blue-500 mr-2" /> Skincare Advice:
                                </h4>
                                <ul className="list-disc pl-5 text-gray-700 space-y-2">
                                    {analysis.skincare_advice_tips.map((tip, i) => (
                                        <li key={`skincare-${i}`}>{tip}</li>
                                    ))}
                                </ul>
                            </div>

                            {/* Makeup Enhancement Tips */}
                            <div>
                                <h4 className="font-bold text-lg text-teal-700 mb-2 flex items-center">
                                    <PaintBrushIcon className="h-5 w-5 text-teal-500 mr-2" /> Makeup Enhancements:
                                </h4>
                                <ul className="list-disc pl-5 text-gray-700 space-y-2">
                                    {analysis.makeup_enhancement_tips.map((tip, i) => (
                                        <li key={`makeup-${i}`}>{tip}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            );
        } else if (message.type === 'info') {
            // No need for `as InfoMessage`
            return (
                <div key={index} className="flex justify-start mb-4">
                    <div className="bg-gray-100 text-gray-600 rounded-lg p-3 max-w-xs shadow-sm italic animate-pulse">
                        <ArrowPathIcon className="h-5 w-5 inline-block text-gray-500 mr-2 animate-spin" />
                        {message.content} {/* `message` is now InfoMessage */}
                    </div>
                </div>
            );
        }
        return null; // Return null for any unhandled message types
    };

    return (
        <div className="flex flex-col h-[calc(100vh-120px)] max-w-3xl mx-auto my-6 bg-white rounded-xl shadow-2xl overflow-hidden border border-purple-100">
            {/* Header Section */}
            <div className="bg-gradient-to-r from-pink-500 to-purple-600 p-5 text-center shadow-lg">
                <h1 className="text-3xl font-extrabold text-white flex items-center justify-center">
                    <SparklesIcon className="h-8 w-8 text-yellow-300 mr-3" />
                    WonderJoy AI Analyst
                </h1>
                <p className="text-white text-opacity-80 mt-1">Your personal beauty assistant ✨</p>
            </div>

            {/* Messages Display Area */}
            <div className="flex-1 p-6 overflow-y-auto custom-scrollbar bg-gray-50">
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
                        <CameraIcon className="h-16 w-16 text-purple-400 mb-4" />
                        <p className="text-lg font-semibold mb-2">Ready for your personalized analysis?</p>
                        <p className="text-md">Upload a clear selfie and let WonderJoy AI reveal your beauty secrets!</p>
                    </div>
                )}
                {messages.map((msg, index) => renderMessage(msg, index))} {/* Ensure map is correctly calling renderMessage */}
                <div ref={messagesEndRef} /> {/* For auto-scrolling */}
            </div>

            {/* Error Display Area */}
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-3 m-4 rounded-lg flex items-center justify-center shadow-md">
                    <ExclamationCircleIcon className="h-6 w-6 mr-2 text-red-500" />
                    <p className="font-medium">{error}</p>
                </div>
            )}

            {/* Input and Action Buttons Area */}
            <div className="p-4 bg-gray-100 border-t border-gray-200 flex flex-col sm:flex-row items-center gap-4">
                <input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    onChange={handleImageChange}
                    className="hidden" // Hides the native file input, we trigger it via button click
                />
                <button
                    onClick={() => fileInputRef.current?.click()} // Programmatically click the hidden input
                    disabled={loading} // Disable if analysis is in progress
                    className="flex-1 w-full sm:w-auto px-6 py-3 bg-gradient-to-br from-purple-500 to-pink-500 text-white font-semibold rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 ease-in-out flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <CameraIcon className="h-5 w-5 mr-2" />
                    {selectedImage ? `Change Selfie (${selectedImage.name})` : "Upload Selfie"}
                </button>

                <button
                    onClick={handleAnalyzeImage}
                    disabled={loading || !selectedImage} // Disable if loading or no image selected
                    className="flex-1 w-full sm:w-auto px-6 py-3 bg-gradient-to-br from-green-400 to-teal-500 text-white font-semibold rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 ease-in-out flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? (
                        <ArrowPathIcon className="h-5 w-5 mr-2 animate-spin" />
                    ) : (
                        <SparklesIcon className="h-5 w-5 mr-2" />
                    )}
                    {loading ? 'Analyzing...' : 'Analyze My Beauty!'}
                </button>
            </div>
        </div>
    );
};

export default ChatPage;