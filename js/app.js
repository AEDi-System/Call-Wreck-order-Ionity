/**
 * app.js — Main application shell.
 *
 * Handles:
 *  - Screen routing (auth ↔ app ↔ lock)
 *  - Auth form wiring (register / login / lock screen)
 *  - Google Identity Services initialisation
 *  - Basic call-recorder UI stub
 *  - Service worker registration
 */

import {
  registerLocal,
  loginLocal,
  verifyPassword,
  handleGoogleCredential,
  getSession,
  clearSession,
} from './auth.js';
import { measureStrength } from './crypto.js';

/* ── Google Client ID ─────────────────────────────────────────────────── *
 * Replace with your actual OAuth 2.0 client ID from Google Cloud Console.
 * See: https://console.cloud.google.com/apis/credentials
 * ────────────────────────────────────────────────────────────────────── */
const GOOGLE_CLIENT_ID = window.__GOOGLE_CLIENT_ID__ || 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';

/* ── DOM refs ─────────────────────────────────────────────────────────── */
const authScreen  = document.getElementById('auth-screen');
const appScreen   = document.getElementById('app-screen');
const lockScreen  = document.getElementById('lock-screen');

// Auth tabs
const tabLogin    = document.getElementById('tab-login');
const tabRegister = document.getElementById('tab-register');
const loginForm   = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');

// Login form
const loginEmail  = document.getElementById('login-email');
const loginPw     = document.getElementById('login-pw');
const loginBtn    = document.getElementById('login-btn');
const loginBanner = document.getElementById('login-banner');

// Register form
const regName     = document.getElementById('reg-name');
const regEmail    = document.getElementById('reg-email');
const regPw       = document.getElementById('reg-pw');
const regPw2      = document.getElementById('reg-pw2');
const regBtn      = document.getElementById('reg-btn');
const regBanner   = document.getElementById('reg-banner');
const strengthBar = document.getElementById('strength-bar');
const strengthLbl = document.getElementById('strength-label');

// App header
const userBadge   = document.getElementById('user-badge');
const signOutBtn  = document.getElementById('sign-out-btn');

// Lock screen
const lockPw      = document.getElementById('lock-pw');
const lockBtn     = document.getElementById('lock-btn');
const lockBanner  = document.getElementById('lock-banner');
const lockUser    = document.getElementById('lock-user');

// Recorder
const recBtn      = document.getElementById('rec-btn');
const recStatus   = document.getElementById('rec-status');

/* ── Screen helpers ───────────────────────────────────────────────────── */

function showAuth() {
  authScreen.classList.remove('hidden');
  appScreen.classList.add('hidden');
  lockScreen.classList.add('hidden');
}

function showApp() {
  authScreen.classList.add('hidden');
  appScreen.classList.remove('hidden');
  lockScreen.classList.add('hidden');
  const s = getSession();
  if (s) userBadge.textContent = s.email;
}

function showLock() {
  lockScreen.classList.remove('hidden');
  const s = getSession();
  if (s) {
    lockUser.textContent = s.email;
    // Google users don't need a password — unlock immediately via re-auth skip
    if (s.provider === 'google') {
      lockPw.closest('.field').classList.add('hidden');
      lockBtn.textContent = 'Continue';
    } else {
      lockPw.closest('.field').classList.remove('hidden');
      lockBtn.textContent = 'Unlock';
    }
  }
}

/* ── Auth tab switching ───────────────────────────────────────────────── */

function setTab(tab) {
  const isLogin = tab === 'login';
  tabLogin.classList.toggle('active', isLogin);
  tabRegister.classList.toggle('active', !isLogin);
  loginForm.classList.toggle('hidden', !isLogin);
  registerForm.classList.toggle('hidden', isLogin);
  loginBanner.className = 'banner';
  regBanner.className   = 'banner';
}

tabLogin.addEventListener('click', () => setTab('login'));
tabRegister.addEventListener('click', () => setTab('register'));

/* ── Password toggle ──────────────────────────────────────────────────── */

document.querySelectorAll('.toggle-pw').forEach((btn) => {
  btn.addEventListener('click', () => {
    const input = btn.previousElementSibling;
    input.type  = input.type === 'password' ? 'text' : 'password';
    btn.querySelector('.eye-icon').textContent = input.type === 'password' ? '👁' : '🙈';
  });
});

/* ── Password strength ────────────────────────────────────────────────── */

regPw.addEventListener('input', () => {
  const s = measureStrength(regPw.value);
  strengthBar.style.width      = s.pct + '%';
  strengthBar.style.background = s.color;
  strengthLbl.textContent      = regPw.value ? s.label : '';
});

/* ── Register ─────────────────────────────────────────────────────────── */

registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  regBanner.className = 'banner';
  regBtn.disabled     = true;

  const name  = regName.value.trim();
  const email = regEmail.value.trim();
  const pw    = regPw.value;
  const pw2   = regPw2.value;

  if (!name || !email || !pw) {
    showBanner(regBanner, 'All fields are required.', 'error');
    regBtn.disabled = false;
    return;
  }

  if (pw !== pw2) {
    showBanner(regBanner, 'Passwords do not match.', 'error');
    regBtn.disabled = false;
    return;
  }

  const strength = measureStrength(pw);
  if (strength.score < 2) {
    showBanner(regBanner, 'Please choose a stronger password.', 'error');
    regBtn.disabled = false;
    return;
  }

  try {
    await registerLocal(email, pw, name);
    showApp();
  } catch (err) {
    showBanner(regBanner, err.message, 'error');
  } finally {
    regBtn.disabled = false;
  }
});

/* ── Login ────────────────────────────────────────────────────────────── */

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginBanner.className = 'banner';
  loginBtn.disabled     = true;

  try {
    await loginLocal(loginEmail.value, loginPw.value);
    showApp();
  } catch (err) {
    showBanner(loginBanner, err.message, 'error');
  } finally {
    loginBtn.disabled = false;
  }
});

/* ── Lock screen unlock ───────────────────────────────────────────────── */

lockBtn.addEventListener('click', async () => {
  lockBanner.className = 'banner';
  lockBtn.disabled     = true;

  try {
    await verifyPassword(lockPw.value);
    showApp();
    lockPw.value = '';
  } catch (err) {
    showBanner(lockBanner, err.message, 'error');
  } finally {
    lockBtn.disabled = false;
  }
});

lockPw.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') lockBtn.click();
});

/* ── Sign out ─────────────────────────────────────────────────────────── */

signOutBtn.addEventListener('click', () => {
  clearSession();
  showAuth();
  setTab('login');
});

/* ── Auto-lock on visibility change ──────────────────────────────────── */

let lockTimer = null;
const LOCK_AFTER_MS = 5 * 60 * 1000; // 5 minutes

function resetLockTimer() {
  clearTimeout(lockTimer);
  lockTimer = setTimeout(() => {
    if (getSession()) showLock();
  }, LOCK_AFTER_MS);
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    clearTimeout(lockTimer);
    lockTimer = setTimeout(() => {
      if (getSession()) showLock();
    }, 30_000); // lock after 30 s hidden
  } else {
    clearTimeout(lockTimer);
  }
});

['click', 'keydown', 'touchstart'].forEach((ev) =>
  document.addEventListener(ev, resetLockTimer, { passive: true })
);

/* ── Google Identity Services ─────────────────────────────────────────── */

// Expose callback for GIS library
window.handleGoogleCredential = handleGoogleCredential;

window.addEventListener('auth:login', () => showApp());

function initGoogle() {
  if (!window.google?.accounts?.id) return;
  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback:  handleGoogleCredential,
    auto_select: false,
    cancel_on_tap_outside: true,
  });

  // Render button in both login and register forms
  ['google-btn-login', 'google-btn-register'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      google.accounts.id.renderButton(el, {
        type:  'standard',
        shape: 'rectangular',
        theme: 'outline',
        size:  'large',
        text:  'signin_with',
        width: el.offsetWidth || 320,
      });
    }
  });

  // Show One Tap prompt on the auth screen
  if (!getSession()) google.accounts.id.prompt();
}

// GIS loads asynchronously — wait for it
if (window.google?.accounts?.id) {
  initGoogle();
} else {
  window.addEventListener('load', () => {
    const wait = setInterval(() => {
      if (window.google?.accounts?.id) {
        clearInterval(wait);
        initGoogle();
      }
    }, 200);
  });
}

/* ── Recorder stub ────────────────────────────────────────────────────── */

let mediaRecorder  = null;
let recordedChunks = [];
let isRecording    = false;

recBtn.addEventListener('click', async () => {
  if (!isRecording) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordedChunks = [];
      mediaRecorder  = new MediaRecorder(stream);
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunks.push(e.data);
      };
      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: 'audio/webm' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `call-${Date.now()}.webm`;
        a.click();
        URL.revokeObjectURL(url);
        stream.getTracks().forEach((t) => t.stop());
      };
      mediaRecorder.start();
      isRecording = true;
      recBtn.classList.add('recording');
      recStatus.textContent = '● Recording…';
      recStatus.classList.add('active');
    } catch {
      recStatus.textContent = 'Microphone access denied.';
    }
  } else {
    mediaRecorder?.stop();
    isRecording = false;
    recBtn.classList.remove('recording');
    recStatus.textContent = 'Tap to start recording';
    recStatus.classList.remove('active');
  }
});

/* ── Banner helper ────────────────────────────────────────────────────── */

function showBanner(el, msg, type) {
  el.textContent = msg;
  el.className   = `banner ${type}`;
}

/* ── Boot ─────────────────────────────────────────────────────────────── */

(function boot() {
  const session = getSession();
  if (session) {
    showApp();
    resetLockTimer();
  } else {
    showAuth();
  }
})();

/* ── Service worker ───────────────────────────────────────────────────── */

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(console.error);
}
