
const { https } = require('firebase-functions');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const nextApp = next({ dev, conf: { distDir: '.next' } });
const handle = nextApp.getRequestHandler();

exports.webApi = https.onRequest((req, res) => {
  return nextApp.prepare().then(() => handle(req, res));
});
