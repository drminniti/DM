// Firebase Cloud Messaging Service Worker
// Note: service workers can't use process.env, so we hardcode the public config here.
// These values are all NEXT_PUBLIC_ (safe to expose).
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyCKqsej5rOf32qFngVt-kqU7ELMA5bi1pg',
  authDomain: 'desafioapp-259f1.firebaseapp.com',
  projectId: 'desafioapp-259f1',
  storageBucket: 'desafioapp-259f1.firebasestorage.app',
  messagingSenderId: '1068925513675',
  appId: '1:1068925513675:web:ffbbbcdfe89035cb82104e',
});

const messaging = firebase.messaging();

// Handle background push notifications for DATA payloads
// Since we send NOTIFICATION payloads from the backend, Firebase handles them automatically.
messaging.onBackgroundMessage(function (payload) {
  // If we had data-only payloads, we would manually call self.registration.showNotification here
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
});
