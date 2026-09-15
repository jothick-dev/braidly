// lib/supabase.js — Supabase client for Braidly
// Server-side client uses service role key (full access)
// Client-side anon key is safe for browser

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('[supabase] SUPABASE_URL or SUPABASE_ANON_KEY not set — storage will fall back to JSON files');
}

// Server-side client with service role (full access, bypasses RLS)
let serverClient = null;
if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
  serverClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  console.log('[supabase] Server client initialized (service role)');
} else if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  // Fallback: use anon key on server (RLS will apply based on user JWT)
  serverClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  console.log('[supabase] Server client initialized (anon key fallback — less secure)');
}

// Verify a JWT token and return the user
async function verifyToken(token) {
  if (!serverClient) return null;
  try {
    const { data, error } = await serverClient.auth.getUser(token);
    if (error || !data.user) return null;
    return data.user;
  } catch {
    return null;
  }
}

// Create a Supabase client scoped to a specific user's JWT (respects RLS)
function clientForToken(token) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: { Authorization: `Bearer ${token}` },
    },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Get the anon key for embedding in the frontend
function getAnonKey() {
  return SUPABASE_ANON_KEY || null;
}

function getSupabaseUrl() {
  return SUPABASE_URL || null;
}

function isConfigured() {
  return !!(SUPABASE_URL && SUPABASE_ANON_KEY);
}

module.exports = {
  serverClient,
  verifyToken,
  clientForToken,
  getAnonKey,
  getSupabaseUrl,
  isConfigured,
};
