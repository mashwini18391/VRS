/* ═══════════════════════════════════════════════════
   VRS Middleware — Supabase JWT Auth Verification
   Real Authentication (no demo mode)
   ═══════════════════════════════════════════════════ */

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase server client for JWT verification
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

let supabaseAdmin = null;

function getSupabase() {
  if (!supabaseAdmin && SUPABASE_URL && SUPABASE_ANON_KEY) {
    supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return supabaseAdmin;
}

/**
 * Verify Supabase JWT token from Authorization header
 * Extracts real user ID from the authenticated session
 */
async function verifyAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const sb = getSupabase();

    if (sb) {
      // Verify the JWT by getting the user from the token
      const { data: { user }, error } = await sb.auth.getUser(token);

      if (error || !user) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }

      // Attach real user data to request
      req.userId = user.id;
      req.userEmail = user.email;
      req.userMeta = user.user_metadata;
      next();
    } else {
      // Supabase not configured — reject
      return res.status(500).json({ error: 'Authentication service not configured' });
    }
  } catch (err) {
    console.error('Auth verification error:', err.message);
    res.status(401).json({ error: 'Authentication failed' });
  }
}

/**
 * Optional auth — doesn't block if no token, but attaches user if present
 */
async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];

    try {
      const sb = getSupabase();
      if (sb) {
        const { data: { user }, error } = await sb.auth.getUser(token);
        if (!error && user) {
          req.userId = user.id;
          req.userEmail = user.email;
          req.userMeta = user.user_metadata;
        }
      }
    } catch {
      // Silently continue — optional auth
    }
  }

  next();
}

module.exports = { verifyAuth, optionalAuth };
