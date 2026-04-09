/* ===================================================
   VRS Authentication - Supabase + Google OAuth
   Real Gmail Login
   =================================================== */

// -- Supabase Configuration --
const SUPABASE_URL = 'https://pgikamweatijdrmdxkue.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnaWthbXdlYXRpamRybWR4a3VlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1NDE1MDAsImV4cCI6MjA5MTExNzUwMH0.EgQbo-TN7KZry6VuovFg4B9z0r1b-DJTeLBCd_T3ZE8';

let supabaseClient = null;

/**
 * Initialize Supabase client
 */
function initSupabase() {
  if (supabaseClient) return supabaseClient;

  if (typeof supabase !== 'undefined' && supabase.createClient) {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return supabaseClient;
}

/**
 * Sign in with Google OAuth (real Gmail login)
 */
async function handleGoogleLogin() {
  const client = initSupabase();

  // Show loading overlay
  const loading = document.getElementById('loadingOverlay');
  if (loading) loading.classList.remove('hidden');

  try {
    if (!client) {
      showToast('Failed to initialize authentication. Please refresh.', 'error');
      if (loading) loading.classList.add('hidden');
      return;
    }

    const { data, error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/dashboard.html'
      }
    });

    if (error) throw error;

    // OAuth will redirect to Google — no further action needed here
  } catch (err) {
    console.error('Login error:', err);
    showToast('Login failed: ' + (err.message || 'Please try again.'), 'error');
    if (loading) loading.classList.add('hidden');
  }
}

/**
 * Sign out
 */
async function handleSignOut() {
  const client = initSupabase();

  try {
    if (client) {
      await client.auth.signOut();
    }

    localStorage.removeItem('vrs_user');
    localStorage.removeItem('vrs_auth');
    showToast('Signed out successfully', 'info');
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 500);
  } catch (err) {
    console.error('Sign out error:', err);
    // Still clear local data and redirect
    localStorage.removeItem('vrs_user');
    localStorage.removeItem('vrs_auth');
    window.location.href = 'index.html';
  }
}

/**
 * Get current user from Supabase session (more reliable)
 */
async function getCurrentUser() {
  const client = initSupabase();
  if (!client) return null;

  try {
    // 1. Try to get the active session (checks localStorage/cookies)
    const { data: { session }, error } = await client.auth.getSession();
    
    if (error) {
      console.warn('Auth session error:', error.message);
    }

    if (session && session.user) {
      // Sync local storage flags
      localStorage.setItem('vrs_user', JSON.stringify(session.user));
      localStorage.setItem('vrs_auth', 'true');
      localStorage.setItem('user_id', session.user.id);
      return session.user;
    }

    // 2. Fallback: If no session, wait briefly (Supabase SDK sometimes needs a beat to restore storage)
    await new Promise(resolve => setTimeout(resolve, 200));
    const { data: { session: secondTry } } = await client.auth.getSession();
    
    if (secondTry && secondTry.user) {
      return secondTry.user;
    }

    return null;
  } catch (err) {
    console.error('Get user error:', err);
    return null;
  }
}

/**
 * Get the current session's access token (for API calls)
 */
async function getAccessToken() {
  const client = initSupabase();
  if (!client) return null;

  try {
    const { data: { session } } = await client.auth.getSession();
    return session?.access_token || null;
  } catch {
    return null;
  }
}

/**
 * Check if user is authenticated, redirect to login if not
 */
async function requireAuth() {
  const user = await getCurrentUser();

  if (!user) {
    window.location.href = 'index.html';
    return null;
  }

  return user;
}

/**
 * Check auth state and redirect to dashboard if logged in
 */
async function checkAuthAndRedirect() {
  const user = await getCurrentUser();
  if (user) {
    window.location.href = 'dashboard.html';
  }
}

/**
 * Listen for auth state changes (handles OAuth redirect callback)
 */
function onAuthStateChange(callback) {
  const client = initSupabase();
  if (!client) return;

  client.auth.onAuthStateChange((event, session) => {
    const user = session?.user || null;

    if (event === 'SIGNED_IN' && user) {
      localStorage.setItem('vrs_user', JSON.stringify(user));
      localStorage.setItem('vrs_auth', 'true');
      localStorage.setItem('user_id', user.id);
    } else if (event === 'SIGNED_OUT') {
      localStorage.removeItem('vrs_user');
      localStorage.removeItem('vrs_auth');
      localStorage.removeItem('user_id');
    }

    if (callback) {
      callback(event, user);
    }
  });
}
