// public/landing.js — Braidly Landing Page with Supabase Auth
(function () {
  'use strict';

  // ---- Supabase client (initialized async) ----
  let supabase = null;
  let currentUser = null;

  // ---- DOM refs ----
  const $ = (s) => document.querySelector(s);
  const authSection = $('#auth-section');
  const dashboardSection = $('#dashboard-section');
  const sessionsSection = $('#sessions-section');
  const authForms = $('#auth-forms');
  const loginFormContainer = $('#login-form-container');
  const signupFormContainer = $('#signup-form-container');

  const loginForm = $('#login-form');
  const loginEmail = $('#login-email');
  const loginPassword = $('#login-password');
  const loginError = $('#login-error');

  const signupForm = $('#signup-form');
  const signupName = $('#signup-name');
  const signupEmail = $('#signup-email');
  const signupPassword = $('#signup-password');
  const signupError = $('#signup-error');

  const userNameEl = $('#user-name');
  const userEmailEl = $('#user-email');
  const userAvatarEl = $('#user-avatar');

  const landingForm = $('#landing-form');
  const sessionTitleInput = $('#session-title');
  const sessionsList = $('#sessions-list');

  // ---- Init ----
  async function init() {
    try {
      const res = await fetch('/api/config');
      const cfg = await res.json();
      if (cfg.supabase && cfg.supabase.url && cfg.supabase.anonKey) {
        supabase = window.supabase.createClient(cfg.supabase.url, cfg.supabase.anonKey);
        // Check existing session
        const { data: { session } } = await supabase.auth.getSession();
        if (session && session.user) {
          currentUser = session.user;
          showDashboard();
        } else {
          showAuth();
        }
        // Listen for auth changes
        supabase.auth.onAuthStateChange((event, session) => {
          if (event === 'SIGNED_IN' && session) {
            currentUser = session.user;
            showDashboard();
          } else if (event === 'SIGNED_OUT') {
            currentUser = null;
            showAuth();
          }
        });
      } else {
        // No Supabase — go to dashboard directly with localStorage name
        showDashboard();
      }
    } catch {
      showDashboard();
    }
  }

  // ---- Auth flow ----
  function showAuth() {
    authSection.classList.remove('hidden');
    dashboardSection.classList.add('hidden');
    sessionsSection.classList.add('hidden');
    loginEmail.focus();
  }

  function showDashboard() {
    authSection.classList.add('hidden');
    dashboardSection.classList.remove('hidden');
    sessionsSection.classList.remove('hidden');
    if (currentUser) {
      const name = currentUser.user_metadata?.display_name || currentUser.email?.split('@')[0] || 'User';
      userNameEl.textContent = name;
      userEmailEl.textContent = currentUser.email || '';
      userAvatarEl.textContent = name.charAt(0).toUpperCase();
      // Save name for debate room
      localStorage.setItem('braidly.name', name);
    }
    loadSessions();
  }

  function showError(el, msg) {
    el.textContent = msg;
    el.classList.remove('hidden');
  }

  // Toggle login/signup
  $('#show-signup').addEventListener('click', (e) => {
    e.preventDefault();
    loginFormContainer.classList.add('hidden');
    signupFormContainer.classList.remove('hidden');
    signupName.focus();
  });
  $('#show-login').addEventListener('click', (e) => {
    e.preventDefault();
    signupFormContainer.classList.add('hidden');
    loginFormContainer.classList.remove('hidden');
    loginEmail.focus();
  });

  // Login
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.classList.add('hidden');
    if (!supabase) {
      showError(loginError, 'Supabase not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY to your .env file.');
      return;
    }
    const btn = $('#login-btn');
    btn.disabled = true;
    btn.textContent = 'Signing in...';
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail.value.trim(),
        password: loginPassword.value,
      });
      if (error) throw error;
      // onAuthStateChange will handle the rest
    } catch (err) {
      showError(loginError, err.message || 'Login failed');
      btn.disabled = false;
      btn.textContent = 'Sign In';
    }
  });

  // Signup
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    signupError.classList.add('hidden');
    if (!supabase) {
      showError(signupError, 'Supabase not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY to your .env file.');
      return;
    }
    const btn = $('#signup-btn');
    btn.disabled = true;
    btn.textContent = 'Creating account...';
    try {
      const { error } = await supabase.auth.signUp({
        email: signupEmail.value.trim(),
        password: signupPassword.value,
        options: {
          data: { display_name: signupName.value.trim() },
        },
      });
      if (error) throw error;
      showError(signupError, 'Check your email for a confirmation link!');
      btn.disabled = false;
      btn.textContent = 'Create Account';
    } catch (err) {
      showError(signupError, err.message || 'Signup failed');
      btn.disabled = false;
      btn.textContent = 'Create Account';
    }
  });

  // Sign out
  $('#signout-btn').addEventListener('click', async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    localStorage.removeItem('braidly.currentSession');
    currentUser = null;
    showAuth();
  });

  // ---- Sessions ----
  async function loadSessions() {
    try {
      const headers = {};
      if (supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          headers['Authorization'] = 'Bearer ' + session.access_token;
        }
      }
      const res = await fetch('/api/sessions', { headers });
      const data = await res.json();
      const sessions = data.sessions || [];

      if (sessions.length === 0) {
        sessionsList.innerHTML = '<p class="sessions-empty">No sessions yet. Start a new chat above!</p>';
        return;
      }

      sessionsList.innerHTML = '';
      sessions.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      for (const s of sessions) {
        const card = document.createElement('div');
        card.className = 'session-card';

        const title = document.createElement('h3');
        title.textContent = s.title || 'Untitled Session';
        card.appendChild(title);

        const meta = document.createElement('div');
        meta.className = 'session-meta';

        const dateSpan = document.createElement('span');
        dateSpan.textContent = formatDate(s.createdAt);
        meta.appendChild(dateSpan);

        if (s.members && s.members.length > 0) {
          const membersSpan = document.createElement('span');
          membersSpan.textContent = s.members.join(', ');
          meta.appendChild(membersSpan);
        }

        if (s.messageCount) {
          const msgSpan = document.createElement('span');
          msgSpan.textContent = s.messageCount + ' messages';
          meta.appendChild(msgSpan);
        }

        card.appendChild(meta);
        card.addEventListener('click', () => {
          localStorage.setItem('braidly.currentSession', s.id);
          window.location.href = '/app?session=' + encodeURIComponent(s.id);
        });
        sessionsList.appendChild(card);
      }
    } catch {
      sessionsList.innerHTML = '<p class="sessions-empty">Could not load sessions.</p>';
    }
  }

  // New session
  landingForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = sessionTitleInput.value.trim() || 'New Session';

    try {
      // Create session via server API
      const headers = { 'Content-Type': 'application/json' };
      if (supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          headers['Authorization'] = 'Bearer ' + session.access_token;
        }
      }
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers,
        body: JSON.stringify({ title }),
      });
      const data = await res.json();
      if (data.session) {
        localStorage.setItem('braidly.currentSession', data.session.id);
      }
    } catch {
      // Fallback: generate session ID locally
      const sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
      localStorage.setItem('braidly.currentSession', sessionId);
    }

    // Ensure we have a display name
    if (!localStorage.getItem('braidly.name')) {
      localStorage.setItem('braidly.name', 'Guest');
    }

    window.location.href = '/app';
  });

  function formatDate(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now - d;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return diffMin + 'm ago';
    if (diffHr < 24) return diffHr + 'h ago';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  init();
})();
