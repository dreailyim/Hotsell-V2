// This file must be in the public folder.

// Import the Firebase SDKs using the compatibility library for broad browser support in Service Workers.
importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js");

// This service worker can be intentionally left empty.
// The main app logic in `use-fcm.ts` handles the registration and token management.
// Firebase Messaging will automatically use this file as long as it's served from the root.
// No initialization is needed here as it inherits from the main app's initialization context.

console.log("Service Worker loaded. It is intentionally left minimal.");
