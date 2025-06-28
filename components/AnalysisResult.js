// components/AnalysisResult.js
import React from 'react';

export default function AnalysisResult({ result }) {
  // If no result or essential properties are missing, don't render anything
  if (!result || !result.prediction || !result.confidence) {
    return null;
  }

  // Determine the advice message based on the predicted class
  let message = '';
  switch (result.prediction) { // Using 'prediction' to match your FastAPI output key
    case 'acne':
      message = "Looks like there might be some acne. Remember to cleanse gently, avoid picking, and consider oil-free products.";
      break;
    case 'bags':
      message = "You might have some under-eye bags. Try to get more rest, stay hydrated, and use a cool compress.";
      break;
    case 'redness':
      message = "There's some redness detected. Opt for soothing, fragrance-free skincare to calm and protect your skin barrier.";
      break;
    default:
      // Fallback message for unexpected or general predictions
      message = "Skin analysis complete! Keep up the good work on your skincare routine.";
  }

  return (
    <div className="bg-white rounded-xl p-6 shadow-lg mt-6 w-full max-w-md text-center">
      <h2 className="text-2xl font-semibold text-purple-700 mb-4">Analysis Result</h2>
      {/* Display predicted condition */}
      <div className="flex justify-between items-center text-lg py-2 border-b border-gray-200">
        <span className="font-medium text-gray-700">Predicted Condition:</span>
        <span className="font-bold text-purple-600">{result.prediction.toUpperCase()}</span>
      </div>
      {/* Display confidence level */}
      <div className="flex justify-between items-center text-lg py-2">
        <span className="font-medium text-gray-700">Confidence:</span>
        <span className="font-bold text-purple-600">{result.confidence.toFixed(2)}%</span>
      </div>
      {/* Display personalized advice message */}
      <p className="text-gray-700 mt-4 text-center leading-relaxed">{message}</p>
    </div>
  );
}