// lib/security.js — Braidly security hardening (GOVERNANCE.md A-rules)
// Headers/CSP (A8, A9), input validation (A4), rate limiting (A10), no error leakage (A6).

const COLORS = ['#7aa2f7', '#9ece6a', '#e0af68', '#bb9af7', '#f7768e', '#73daca', '#ff9e64', '#2ac3de'];

const MAX_TEXT = 4000;
const MAX_NAME = 24;
const MAX_CLIENT_ID = 64;

// A8/A9 — security headers on every response
function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; " +
      "connect-src 'self' ws: wss: https:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
  );
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store');
  }
  next();
}

// A6 — never leak internals to the client; details go to the server log only
function errorHandler(err, req, res, next) {
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON' });
  }
  if (err && err.status === 413) {
    return res.status(413).json({ error: 'Payload too large' });
  }
  console.error('[error]', err && err.message ? err.message : err);
  res.status(500).json({ error: 'Internal server error' });
}

// A4 — validate a chat message from a client
function validateChatMessage(payload) {
  if (!payload || typeof payload !== 'object') return { ok: false, error: 'invalid payload' };
  const { sender, text, clientId } = payload;
  if (typeof sender !== 'string' || sender.length === 0 || sender.length > MAX_NAME) {
    return { ok: false, error: 'invalid sender' };
  }
  if (typeof text !== 'string' || text.trim().length === 0) {
    return { ok: false, error: 'empty message' };
  }
  if (text.length > MAX_TEXT) return { ok: false, error: 'message too long' };
  if (clientId !== undefined && (typeof clientId !== 'string' || clientId.length > MAX_CLIENT_ID)) {
    return { ok: false, error: 'invalid clientId' };
  }
  return { ok: true, sender: sender.trim(), text: text.trim(), clientId };
}

// Sanitize a display name: strip control chars, trim, cap length
function sanitizeName(name) {
  if (typeof name !== 'string') return null;
  const clean = name.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, MAX_NAME);
  return clean.length > 0 ? clean : null;
}

// A10 — simple in-memory sliding-window rate limiter for REST
function rateLimiter({ windowMs = 60000, max = 300, label = 'api' } = {}) {
  const hits = new Map();
  return function limit(req, res, next) {
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (arr.length >= max) {
      return res.status(429).json({ error: 'Too many requests' });
    }
    arr.push(now);
    hits.set(key, arr);
    next();
  };
}

function pickColor() {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

module.exports = {
  securityHeaders,
  errorHandler,
  validateChatMessage,
  sanitizeName,
  rateLimiter,
  pickColor,
  MAX_TEXT,
  MAX_NAME,
};
