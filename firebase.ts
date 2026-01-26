
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyAHttj5cj_yd4vQMQHy7pH-S8APG2RUhIc",
    authDomain: "sm-sports-1d8ee.firebaseapp.com",
    projectId: "sm-sports-1d8ee",
    storageBucket: "sm-sports-1d8ee.firebasestorage.app",
    messagingSenderId: "701916968860",
    appId: "1:701916968860:web:8df9de53e28c7b4c8a3a59",
    measurementId: "G-CFW20VFVJ7"
};

// Initialize Firebase using Compat singleton pattern
let app;
if (!firebase.apps.length) {
    app = firebase.initializeApp(firebaseConfig);
} else {
    app = firebase.app();
}

const db = app.firestore();
const auth = app.auth();

// Configure Firestore settings for better performance/reliability
db.settings({
    cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED
});

// Enable offline persistence with better error handling
// Wrapping in an async-ready block to ensure it doesn't block main script if it fails
const initPersistence = async () => {
    try {
        await db.enablePersistence({ synchronizeTabs: true });
    } catch (err: any) {
        if (err.code === 'failed-precondition') {
            // Multiple tabs open, persistence can only be enabled in one tab at a time.
            console.warn("Firebase Persistence: Multiple tabs open, persistence disabled in this tab.");
        } else if (err.code === 'unimplemented') {
            // The current browser does not support all of the features required to enable persistence
            console.warn("Firebase Persistence: Browser not supported.");
        } else {
            console.error("Firebase Persistence Error:", err.message);
        }
    }
};

initPersistence();

export { db, auth };
