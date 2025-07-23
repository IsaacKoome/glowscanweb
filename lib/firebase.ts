// lib/firebase.ts
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAnalytics, isSupported, Analytics } from "firebase/analytics"; // Import Analytics type and isSupported

// Your web app's Firebase configuration
// For Next.js, it's common to use environment variables for these.
// Make sure these are set in your .env.local file (and Vercel/Cloud Run environment variables)

export const firebaseConfig = {
    apiKey: "AIzaSyDoMEgC0Z2NW2De2fbJ5M4idUrhgELQYeE",
    authDomain: "deep-mile-460606-p0.firebaseapp.com",
    projectId: "deep-mile-460606-p0",
    storageBucket: "deep-mile-460606-p0.firebasestorage.app",
    messagingSenderId: "241128138627",
    appId: "1:241128138627:web:5c95c7e8fd7dac9fe1b8b6",
    measurementId: "G-CJQ39X0H3R"
};

// Initialize Firebase only if it hasn't been initialized already
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Get Firebase services
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Initialize analytics conditionally and asynchronously
let analytics: Analytics | null = null; // Declare with type and initialize to null

if (typeof window !== 'undefined') {
  // Use an Immediately Invoked Async Function Expression (IIAFE)
  // to await isSupported() without making the whole module async.
  (async () => {
    try {
      const supported = await isSupported(); // Await the Promise
      if (supported) {
        analytics = getAnalytics(app);
        console.log("Firebase Analytics initialized successfully.");
      } else {
        console.warn("Firebase Analytics is not supported in this environment (e.g., cookies disabled).");
      }
    } catch (error) {
      console.error("Error checking Firebase Analytics support or initializing:", error);
    }
  })();
}

// Export all necessary services
export { app, auth,storage, db, analytics }; // Export analytics (will be null on server, then populated on client)
