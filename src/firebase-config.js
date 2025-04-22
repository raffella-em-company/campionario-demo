// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBA5jE1rkALdeMRQZQcwQa0pTKJY9qk5iI",
  authDomain: "campionario-app-48f2d.firebaseapp.com",
  projectId: "campionario-app-48f2d",
  storageBucket: "campionario-app-48f2d.firebasestorage.app",
  messagingSenderId: "458993948554",
  appId: "1:458993948554:web:a35dd7794d6248b7761a73"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);