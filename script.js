import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
} from "firebase/firestore";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Firebase config
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// DOM Elements
const signinPanel = document.getElementById("signinPanel");
const panelSignInBtn = document.getElementById("panelSignInBtn");
const formContainer = document.getElementById("formContainer");
const signOutBtn = document.getElementById("signOutBtn");
const signOutSection = document.getElementById("signOutSection");
const userDetails = document.getElementById("userDetails");

let currentUser = null;
// Auth
panelSignInBtn.onclick = () => {
  signInWithPopup(auth, provider);
};
signOutBtn.onclick = () => {
  signOut(auth);
};

// Auth state
auth.onAuthStateChanged(async (user) => {
  currentUser = user;
  console.log(user);
  if (user) {
    signinPanel.classList.add("hidden");
    formContainer.classList.remove("hidden");
    userDetails.textContent = `Welcome, ${user.email}`;
    signOutSection.classList.remove("hidden");
    await disableUsedFlats();
  } else {
    signinPanel.classList.remove("hidden");
    formContainer.classList.add("hidden");
    signOutSection.classList.add("hidden");
  }
});
