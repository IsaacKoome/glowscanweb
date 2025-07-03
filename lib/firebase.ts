// lib/firebase.ts
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Your web app's Firebase configuration
// For Next.js, it's common to use environment variables for these.
// Make sure these are set in your .env.local file (and Vercel/Cloud Run environment variables)

const firebaseConfig = {
  apiKey: "AIzaSyAxuE5lYXmd8PUewdlYc9yeWssBEzA17ck",
  authDomain: "wonderjoyai.firebaseapp.com",
  projectId: "wonderjoyai",
  storageBucket: "wonderjoyai.firebasestorage.app",
  messagingSenderId: "182014677364",
  appId: "1:182014677364:web:6e17dfa541e2b6e88e5c21"
};

// Initialize Firebase only if it hasn't been initialized already
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Get Firebase services
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };