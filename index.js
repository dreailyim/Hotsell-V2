
const functions = require("firebase-functions");
const next = require("next");

const dev = process.env.NODE_ENV !== "production";
const nextApp = next({ dev, conf: { distDir: ".next" } });
const handle = nextApp.getRequestHandler();

// Main web API that serves the Next.js app
exports.webApi = functions.https.onRequest((req, res) => {
  return nextApp.prepare().then(() => handle(req, res));
});
