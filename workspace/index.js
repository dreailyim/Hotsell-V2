
const functions = require("firebase-functions");
const next = require("next");

const dev = process.env.NODE_ENV !== "production";
// The `distDir` is relative to the `index.js` file.
// Since `index.js` is in the `workspace` directory, we need to go up one level
// to find the `.next` directory, which is in the root.
const nextApp = next({ dev, conf: { distDir: "../.next" } });
const handle = nextApp.getRequestHandler();

// Main web API that serves the Next.js app
exports.webApi = functions.region("us-central1").https.onRequest((req, res) => {
  return nextApp.prepare().then(() => handle(req, res));
});
