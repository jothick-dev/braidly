// lib/auth.js — Supabase authentication middleware for Express
// Verifies JWT tokens from Authorization header or session cookie

const { verifyToken } = require('./supabase');

// Extract token from Authorization header: "Bearer <token>"
function extractToken(req) {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    return auth.slice(7);
  }
  // Also check cookies (for SSR/embedded scenarios)
  const cookies = req.headers.cookie;
  if (cookies) {
    const match = cookies.match(/sb-[^=]+-auth-token=([^;]+)/);
    if (match) {
      try {
        return JSON.parse(decodeURIComponent(match[1])).access_token;
      } catch {
        return decodeURIComponent(match[1]);
      }
    }
  }
  return null;
}

// Middleware: require authentication
// Sets req.user = { id, email, user_metadata, app_metadata }
function requireAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  verifyToken(token).then(user => {
    if (!user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    req.supabaseToken = token;
    next();
  }).catch(err => {
    console.error('[auth] Token verification failed:', err.message);
    res.status(401).json({ error: 'Authentication failed' });
  });
}

// Middleware: optional authentication (attaches user if present, doesn't reject)
function optionalAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) return next();
  verifyToken(token).then(user => {
    if (user) {
      req.user = user;
      req.supabaseToken = token;
    }
    next();
  }).catch(() => next());
}

module.exports = { requireAuth, optionalAuth, extractToken };
