// This script exists only to import the actual service worker logic.
// The actual logic is in `src/lib/firebase/messaging-sw.ts` and is compiled by Webpack.
self.importScripts('/firebase-messaging-sw-logic.js');
