// Firebase web config for SRL PingpongArena (Realtime Database).
// These values identify the project; they are not secrets. Access is controlled by database.rules.json.
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyADK6tfFAnMApRkGVe8-_Hi3SJQsp2rYIg",
  authDomain: "srl-pingpongarena.firebaseapp.com",
  databaseURL: "https://srl-pingpongarena-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "srl-pingpongarena",
  storageBucket: "srl-pingpongarena.firebasestorage.app",
  messagingSenderId: "757924771390",
  appId: "1:757924771390:web:1c1a7bd706024d7d65836f",
};

// Admin account for unlocking edits (rename/remove players, delete older matches).
// Create it in Firebase → Authentication → Users with this email and a password of your choice.
// Must match the email in database.rules.json.
window.ARENA_ADMIN_EMAIL = "admin@srl-pingpongarena.app";
