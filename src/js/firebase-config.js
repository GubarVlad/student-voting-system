// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyDrql-9L3pOk5aHiIu0gBPeXxKazNfzsuA",
  authDomain: "student-voting-system-3bf9a.firebaseapp.com",
  projectId: "student-voting-system-3bf9a",
  storageBucket: "student-voting-system-3bf9a.firebasestorage.app",
  messagingSenderId: "898829893941",
  appId: "1:898829893941:web:fbf21bc1eee1edc7824c7c"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Export Firebase services
window.auth = firebase.auth();
window.db = firebase.firestore();

console.log('✅ Firebase initialized successfully');
