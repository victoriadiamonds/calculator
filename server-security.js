const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

function installSecurity(app, root) {
  app.disable('x-powered-by');
  // Render terminates TLS at its reverse proxy. Trust only the nearest hop.
  if (process.env.RENDER === 'true') app.set('trust proxy', 1);
  app.set('query parser', 'simple');
  app.use((req, res, next) => {
    res.locals.scriptNonce = crypto.randomBytes(18).toString('base64');
    next();
  });
  app.use(helmet({
    contentSecurityPolicy: { directives: {
      scriptSrc: ["'self'", (req, res) => `'nonce-${res.locals.scriptNonce}'`],
      scriptSrcAttr: ["'none'"],
      frameAncestors: ["'self'", 'https://victoria-diamonds.com', 'https://www.victoria-diamonds.com', 'https://victoriadiamonds.github.io'],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
    } },
    // CSP allows embedding by the main storefront; SAMEORIGIN would block it.
    xFrameOptions: false
  }));
  const limit = (max, windowMs) => rateLimit({ windowMs, limit: max, standardHeaders: 'draft-8', legacyHeaders: false });
  const publicLimit = limit(300, 60 * 1000);
  const paymentLimit = limit(10, 15 * 60 * 1000);
  app.use((req, res, next) => {
    if (req.path === '/airwallex/webhook' || req.path === '/health') return next();
    return publicLimit(req, res, next);
  });
  app.use((req, res, next) => {
    if (req.method === 'POST' && /(?:payment-link|payment-intent)$/.test(req.path)) return paymentLimit(req, res, next);
    next();
  });
  app.use((req, res, next) => {
    if (/^\/(?:order|payment)-receipt\//.test(req.path) || req.method !== 'GET') {
      res.set('Cache-Control', 'no-store');
    }
    next();
  });
  // Serve only browser assets, never server code, archives, tests, or lockfiles.
  const assets = new Set(['/style.css', '/natural-selector.js', '/natural-diamonds-data.js']);
  const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  app.get(['/', '/index.html'], (req, res) => {
    res.set('Cache-Control', 'no-store').type('html').send(index.replace(/<script>/g, `<script nonce="${res.locals.scriptNonce}">`));
  });
  app.get([...assets], (req, res) => res.sendFile(path.join(root, req.path.slice(1))));
}

module.exports = { installSecurity, escapeHtml };
