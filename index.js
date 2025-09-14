
const { https, region } = require('firebase-functions');
const next = require('next');
const customFunctions = require('./dist/lib/firebase/functions');

const dev = process.env.NODE_ENV !== 'production';
const nextApp = next({ dev, conf: { distDir: '.next' } });
const handle = nextApp.getRequestHandler();

// Main web API that serves the Next.js app
exports.webApi = https.onRequest((req, res) => {
  return nextApp.prepare().then(() => handle(req, res));
});

// Export all other custom cloud functions
Object.keys(customFunctions).forEach(key => {
    if (key !== 'webApi') { // Avoid re-exporting the main webApi
        exports[key] = region('us-central1').https.onCall(customFunctions[key]);
    }
});
