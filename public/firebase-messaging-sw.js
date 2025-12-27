// Service worker for Firebase Cloud Messaging
// This file should be in the public directory
// Environment variables are injected at build time by Vite

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Initialize Firebase with values from .env.local (injected at build time)
firebase.initializeApp({
  apiKey: "AIzaSyCNniSjUjrJYmcrjbBqIaBMqiNRfUQfIT0",
  authDomain: "poligame-fcm.firebaseapp.com",
  projectId: "poligame-fcm",
  storageBucket: "poligame-fcm.firebasestorage.app",
  messagingSenderId: "325211744398",
  appId: "1:325211744398:web:3afb198d8d6515096601df"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('Background message:', payload);
  const notificationTitle = payload.notification?.title || 'PoliGame';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: payload.data?.gameIcon || '/icon.png',
    badge: '/icon.png',
    tag: payload.data?.type || 'notification',
    data: payload.data,
  };
  
  self.registration.showNotification(notificationTitle, notificationOptions);
});

