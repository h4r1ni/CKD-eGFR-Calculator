import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Firebase configuration (DO NOT SHARE PUBLICLY)
const firebaseConfig = {
  apiKey: "AIzaSyCaoCuTwlKX4pN3IS4D7jZbsVyM6UOvk3o",
  authDomain: "clinician-da122.firebaseapp.com",
  projectId: "clinician-da122",
  storageBucket: "clinician-da122.appspot.com",
  messagingSenderId: "1081273905927",
  appId: "1:1081273905927:web:d686cc0b6b54c547430ba2",
  measurementId: "G-6PCDJE04XM"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app); // Authentication
const db = getFirestore(app); // Firestore Database

export { app, auth, db };
