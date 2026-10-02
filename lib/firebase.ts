// lib/firebase.ts
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBP-vO7SaIJHJBj-1NYwjGUd162v5imPNM",
  authDomain: "matrix-830ab.firebaseapp.com",
  projectId: "matrix-830ab",
  storageBucket: "matrix-830ab.firebasestorage.app",
  messagingSenderId: "460835735377",
  appId: "1:460835735377:web:285365ae2cca00086db570"
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

export { app, auth, db, googleProvider };