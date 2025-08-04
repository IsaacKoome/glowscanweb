// app/billing/page.tsx
"use client";

import { useState } from "react"; // Removed useEffect import as it was unused
import { useAuth } from "../../context/AuthContext";

export default function BillingDashboard() {
  const { user, loading: authLoading } = useAuth(); // Renamed 'loading' to 'authLoading' for clarity

  const [status, setStatus] = useState<"idle" | "loading" | "cancelled" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const currentPlan = user?.subscriptionPlan || "free";
  const isSubscribed = currentPlan !== "free";

  const handleCancelSubscription = async () => {
    if (!user) return; // Should ideally not happen if button is disabled for unauthenticated users
    setStatus("loading");
    setErrorMessage(null);

    try {
      const res = await fetch("https://glowscan-backend-241128138627.us-central1.run.app/cancel-subscription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-ID": user.uid,
        },
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to cancel subscription.");
      }

      setStatus("cancelled");
      // Optionally, you might want to call refreshUser() from AuthContext here
      // to immediately update the user's plan in the frontend after cancellation.
      // E.g., const { refreshUser } = useAuth(); and then refreshUser();
    } catch (err: unknown) {
      setStatus("error");
      if (err instanceof Error) {
        setErrorMessage(err.message || "Something went wrong.");
      }
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 py-12 px-6 sm:px-12 lg:px-24 flex items-center justify-center">
        <p className="text-xl text-gray-700">Loading billing information...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 py-12 px-6 sm:px-12 lg:px-24">
      <div className="max-w-3xl mx-auto bg-white rounded-3xl shadow-xl p-8 sm:p-12">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-purple-700 mb-6 text-center">
          Billing & Subscription
        </h1>

        <div className="text-center mb-8">
          <p className="text-lg text-gray-800">
            <span className="font-semibold">Current Plan:</span>{" "}
            <span className="inline-block px-3 py-1 bg-purple-100 text-purple-800 font-medium rounded-full">
              {currentPlan.toUpperCase()}
            </span>
          </p>

          {status === "cancelled" && (
            <p className="mt-4 text-green-600 font-medium">✅ Subscription successfully cancelled. You’re now on the Free Plan.</p>
          )}

          {status === "error" && (
            <p className="mt-4 text-red-600 font-medium">❌ {errorMessage}</p>
          )}
        </div>

        {isSubscribed && (
          <div className="text-center">
            <button
              onClick={handleCancelSubscription}
              disabled={status === "loading"}
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-full font-semibold shadow-md transition duration-300"
            >
              {status === "loading" ? "Cancelling..." : "Cancel Subscription"}
            </button>
            <p className="text-sm mt-2 text-gray-600">
              You’ll lose premium access immediately and revert to the Free Plan.
            </p>
          </div>
        )}

        {!isSubscribed && (
          <div className="text-center mt-8">
            <p className="text-gray-700 mb-4">Want more features?</p>
            <a
              href="/pricing"
              className="inline-block bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-full font-semibold shadow-md transition duration-300"
            >
              Upgrade Plan
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
