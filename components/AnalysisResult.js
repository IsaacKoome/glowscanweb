// components/AnalysisResult.js
import React from 'react';

export default function AnalysisResult({ result }) {
  // Ensure all expected top-level properties are present for a full display
  if (!result || !result.hydration || !result.acne || !result.redness || !result.skin_tone || 
      !result.makeup_coverage || !result.makeup_blend || !result.makeup_color_match || 
      result.overall_glow_score === undefined || 
      !result.skincare_advice_tips || !result.makeup_enhancement_tips || !result.overall_summary) {
    // Fallback for incomplete data, useful during prompt refinement
    console.warn("Incomplete analysis result received:", result);
    return (
      <div className="bg-white rounded-xl p-6 shadow-lg mt-6 w-full max-w-md text-left border border-purple-100">
        <h2 className="text-2xl font-bold text-purple-700 mb-4 text-center">AI Analysis Insights 💡</h2>
        <p className="text-gray-700 text-center">Still analyzing or received incomplete data. Please try again or refine the prompt.</p>
        <pre className="text-sm overflow-auto max-h-40 mt-4">{JSON.stringify(result, null, 2)}</pre>
      </div>
    );
  }

  // Helper to capitalize first letter
  const capitalize = (s) => {
    if (typeof s !== 'string') return '';
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  // Determine overall message based on glow score
  let overallMessage = result.overall_summary || "Here's a detailed breakdown of your beauty analysis:";
  if (result.overall_glow_score >= 8) {
    overallMessage = `Excellent! Your overall glow score is ${result.overall_glow_score}/10! ✨ ${overallMessage}`;
  } else if (result.overall_glow_score >= 6) {
    overallMessage = `Great job! Your overall glow score is ${result.overall_glow_score}/10. 👍 ${overallMessage}`;
  } else {
    overallMessage = `Let's boost that glow! Your overall glow score is ${result.overall_glow_score}/10. 💪 ${overallMessage}`;
  }

  // Function to render tips with icons
  const renderTips = (tips, icon) => {
    if (!Array.isArray(tips) || tips.length === 0) {
      return <p className="text-gray-600 italic">No specific tips provided.</p>;
    }
    return (
      <ul className="list-none space-y-2"> {/* Removed list-disc for custom icons */}
        {tips.map((tip, i) => (
          <li key={i} className="flex items-start">
            <span className="mr-2 text-xl flex-shrink-0">{icon}</span>
            <span className="text-gray-700">{tip}</span>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="bg-white rounded-xl p-4 shadow-lg w-full text-left border border-purple-100"> {/* Removed mt-6 as parent handles spacing */}
      <h2 className="text-2xl font-bold text-purple-700 mb-3 text-center">AI Analysis Insights 💡</h2>
      <p className="text-gray-700 text-center mb-4 leading-relaxed">{overallMessage}</p>

      {/* Skin Health Section */}
      <div className="mb-4 p-3 bg-pink-50 rounded-lg border border-pink-100">
        <h3 className="text-lg font-semibold text-pink-600 mb-2 flex items-center">
          Skin Health Report 🌿
        </h3>
        <ul className="list-none space-y-1">
          <li className="flex items-center"><span className="mr-2 text-lg">💧</span><strong>Hydration:</strong> {capitalize(result.hydration)}</li>
          <li className="flex items-center"><span className="mr-2 text-lg">✨</span><strong>Acne:</strong> {capitalize(result.acne)}</li>
          <li className="flex items-center"><span className="mr-2 text-lg">🔴</span><strong>Redness:</strong> {capitalize(result.redness)}</li>
          <li className="flex items-center"><span className="mr-2 text-lg">🎨</span><strong>Skin Tone:</strong> {capitalize(result.skin_tone)}</li>
        </ul>
      </div>

      {/* Makeup Assessment Section */}
      <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
        <h3 className="text-lg font-semibold text-blue-600 mb-2 flex items-center">
          Makeup Assessment 💄
        </h3>
        <ul className="list-none space-y-1">
          <li className="flex items-center"><span className="mr-2 text-lg">🖌️</span><strong>Coverage:</strong> {capitalize(result.makeup_coverage)}</li>
          <li className="flex items-center"><span className="mr-2 text-lg">✨</span><strong>Blend:</strong> {capitalize(result.makeup_blend)}</li>
          <li className="flex items-center"><span className="mr-2 text-lg">🌈</span><strong>Color Match:</strong> {capitalize(result.makeup_color_match)}</li>
        </ul>
      </div>

      {/* Skincare Advice Tips */}
      {result.skincare_advice_tips && result.skincare_advice_tips.length > 0 && (
        <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-100">
          <h3 className="text-lg font-semibold text-green-700 mb-2 flex items-center">
            Skincare Tips for You 🌱
          </h3>
          {renderTips(result.skincare_advice_tips, '✅')}
        </div>
      )}

      {/* Makeup Enhancement Tips */}
      {result.makeup_enhancement_tips && result.makeup_enhancement_tips.length > 0 && (
        <div className="mt-4 p-3 bg-purple-100 rounded-lg border border-purple-200">
          <h3 className="text-lg font-semibold text-purple-700 mb-2 flex items-center">
            Makeup Enhancement Suggestions 💡
          </h3>
          {renderTips(result.makeup_enhancement_tips, '➡️')} {/* Using arrow emoji for directional advice */}
        </div>
      )}

      {/* Overall Glow Score (already present, but ensures it's always at the bottom if needed) */}
      {result.overall_glow_score !== undefined && (
        <div className="text-center mt-4 p-3 bg-purple-50 rounded-lg border border-purple-100">
          <h3 className="text-xl font-bold text-purple-800">Overall Glow Score: {result.overall_glow_score}/10 ✨</h3>
        </div>
      )}
    </div>
  );
}