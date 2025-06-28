// app/tips/page.tsx

import React from 'react';

const skincareTips = [
  {
    title: 'Stay Hydrated',
    description: 'Drink at least 8 glasses of water daily to keep your skin glowing and healthy.',
  },
  {
    title: 'Use Sunscreen',
    description: 'Always apply sunscreen with SPF 30 or higher, even on cloudy days.',
  },
  {
    title: 'Cleanse Regularly',
    description: 'Wash your face twice a day to remove dirt, oil, and makeup.',
  },
  {
    title: 'Moisturize',
    description: 'Apply moisturizer after cleansing to keep your skin hydrated and soft.',
  },
  {
    title: 'Healthy Diet',
    description: 'Eat fruits, vegetables, and foods rich in antioxidants to support skin health.',
  },
];

export default function TipsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-center text-pink-700">Skin Care Tips</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {skincareTips.map((tip, index) => (
            <div
              key={index}
              className="bg-white shadow-md rounded-2xl p-6 border border-pink-100 hover:shadow-lg transition"
            >
              <h2 className="text-xl font-semibold text-pink-600">{tip.title}</h2>
              <p className="text-gray-600 mt-2">{tip.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
