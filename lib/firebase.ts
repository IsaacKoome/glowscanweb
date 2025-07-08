// lib/firebase.ts
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Your web app's Firebase configuration
// For Next.js, it's common to use environment variables for these.
// Make sure these are set in your .env.local file (and Vercel/Cloud Run environment variables)

const firebaseConfig = {
  apiKey: "AIzaSyDoMEgC0Z2NW2De2fbJ5M4idUrhgELQYeE",
  authDomain: "deep-mile-460606-p0.firebaseapp.com",
  projectId: "deep-mile-460606-p0",
  storageBucket: "deep-mile-460606-p0.firebasestorage.app",
  messagingSenderId: "241128138627",
  appId: "1:241128138627:web:5c95c7e8fd7dac9fe1b8b6"
};

// Initialize Firebase only if it hasn't been initialized already
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Get Firebase services
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };