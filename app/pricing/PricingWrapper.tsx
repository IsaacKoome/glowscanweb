// app/pricing/PricingWrapper.tsx
"use client"; // This component is explicitly a client component

import dynamic from 'next/dynamic';
import React from 'react'; // Import React for JSX

// Dynamically import the actual client-side PricingPageClient component.
// { ssr: false } is now allowed here because this file itself is a client component.
const DynamicPricingPageClient = dynamic(() => import('./PricingPageClient'), { ssr: false });

export default function PricingWrapper() {
  return (
    // You can add a loading fallback here if the component takes time to load
    <React.Suspense fallback={
      <div className="min-h-[calc(100vh-128px)] flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50">
        <p className="text-xl text-gray-700">Loading pricing plans...</p>
      </div>
    }>
      <DynamicPricingPageClient />
    </React.Suspense>
  );
}
