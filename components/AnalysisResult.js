// components/AnalysisResult.js
import React from 'react';

export default function AnalysisResult({ result }) {
  // If no result or essential properties are missing, don't render anything
  // Now expecting more detailed fields from Gemini
  if (!result || !result.hydration || !result.acne || !result.skin_tone) {
    return null;
  }

  // Helper to capitalize first letter
  const capitalize = (s) => {
    if (typeof s !== 'string') return '';
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  // Generate a more detailed overall message based on the analysis
  let overallMessage = "Your skin analysis is complete! Here are the insights:";
  if (result.overall_glow_score) {
    overallMessage = `Your overall glow score is ${result.overall_glow_score}/10! Here's a detailed breakdown:`;
    if (result.overall_glow_score >= 8) overallMessage = "Excellent! Your skin is glowing! ✨ Here's a detailed breakdown:";
    else if (result.overall_glow_score >= 6) overallMessage = "Great job! Your skin looks healthy. Here's a detailed breakdown:";
    else overallMessage = "Let's work on boosting that glow! Here's a detailed breakdown and some tips:";
  }

  return (
    <div className="bg-white rounded-xl p-6 shadow-lg mt-6 w-full max-w-md text-left border border-purple-100">
      <h2 className="text-2xl font-bold text-purple-700 mb-4 text-center">AI Analysis Insights 💡</h2>
      <p className="text-gray-700 text-center mb-4">{overallMessage}</p>

      {/* Skin Concerns Section */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-pink-600 mb-2">Skin Health:</h3>
        <ul className="list-disc list-inside text-gray-700 space-y-1">
          <li><strong>Hydration:</strong> {capitalize(result.hydration)}</li>
          <li><strong>Acne:</strong> {capitalize(result.acne)}</li>
          <li><strong>Skin Tone:</strong> {capitalize(result.skin_tone)}</li>
        </ul>
      </div>

      {/* Makeup Feedback Section */}
      {result.makeup_feedback && result.makeup_feedback !== "No makeup detected." && result.makeup_feedback !== "No makeup is detected." && (
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-blue-600 mb-2">Makeup Assessment:</h3>
          <p className="text-gray-700 leading-relaxed">{result.makeup_feedback}</p>
        </div>
      )}
      {/* Show a message if no makeup is detected */}
      {(result.makeup_feedback === "No makeup detected." || result.makeup_feedback === "No makeup is detected.") && (
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-blue-600 mb-2">Makeup Assessment:</h3>
          <p className="text-gray-700">No makeup detected in the image.</p>
        </div>
      )}

      {/* Overall Glow Score */}
      {result.overall_glow_score !== undefined && (
        <div className="text-center mt-4 p-3 bg-purple-50 rounded-lg">
          <h3 className="text-xl font-bold text-purple-800">Overall Glow Score: {result.overall_glow_score}/10 ✨</h3>
        </div>
      )}

      {/* Placeholder for more detailed advice based on Gemini's output
          You can add more sections here if your Gemini prompt yields
          specific 'skincare_advice' or 'makeup_tips' arrays */}
      {/* Example for if Gemini returns specific advice arrays:
      {result.skincare_advice && result.skincare_advice.length > 0 && (
        <div className="mt-4">
          <h3 className="text-lg font-semibold text-pink-600 mb-2">Skincare Advice:</h3>
          <ul className="list-disc list-inside text-gray-700 space-y-1">
            {result.skincare_advice.map((tip, i) => <li key={i}>{tip}</li>)}
          </ul>
        </div>
      )}
      {result.makeup_tips && result.makeup_tips.length > 0 && (
        <div className="mt-4">
          <h3 className="text-lg font-semibold text-blue-600 mb-2">Makeup Tips:</h3>
          <ul className="list-disc list-inside text-gray-700 space-y-1">
            {result.makeup_tips.map((tip, i) => <li key={i}>{tip}</li>)}
          </ul>
        </div>
      )}
      */}
    </div>
  );
}