// app/pricing/page.tsx
// This file is a Server Component by default.
// It now imports the client-side wrapper component.

import PricingWrapper from './PricingWrapper'; // Import the new wrapper component

export default function PricingPage() {
  return (
    // Render the client-side wrapper component
    <PricingWrapper />
  );
}
