/**
 * Firebase Configuration and Initialization
 * First Look Fashion Designer Boutique
 * Uses Firestore database only (Auth is handled locally)
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  deleteDoc, 
  doc, 
  query, 
  orderBy, 
  limit,
  setDoc, 
  getDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBWhIS0KTaEystxXBn3JfWUSCGjjX2tTT0",
  authDomain: "firstlook-fashiondesigne-e620f.firebaseapp.com",
  projectId: "firstlook-fashiondesigne-e620f",
  storageBucket: "firstlook-fashiondesigne-e620f.appspot.com",
  messagingSenderId: "321890719883",
  appId: "1:321890719883:web:42938096e03ec713041c8e",
  measurementId: "G-NXVJB65SSG"
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export {
  db,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  orderBy,
  limit,
  setDoc,
  getDoc
};
