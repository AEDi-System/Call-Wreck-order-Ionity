/**
 * auth.js — Authentication logic.
 *
 * Local auth (email + password):
 *  - On registration: derive a PBKDF2 key, store a salted SHA-256 hash of the
 *    password and an AES-GCM encrypted credential blob in localStorage.
 *  - On login: re-derive key, verify hash, then decrypt the blob.
 *
 * Google OAuth 2.0 (via Google Identity Services):
 *  - Renders the One Tap / Sign-In With Google button.
 *  - On success: decodes the JWT credential, stores the Google profile in
 *    localStorage (no password required for Google users).
 *
 * Storage keys (all in localStorage):
 *   cw_users   → JSON map { email: { hashB64, saltB64, encBlob, provider } }
 *   cw_session → JSON { email, displayName, provider, avatarUrl }
 */

import {
  encrypt, decrypt, hashPassword, bufToB64, b64ToBuf
} from './crypto.js';

const STORE_KEY   = 'cw_users';
const SESSION_KEY = 'cw_session';

/* ── Helpers ──────────────────────────────────────────────────────────── */

function loadUsers() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); }
  catch { return {}; }
}

function saveUsers(users) {
  localStorage.setItem(STORE_KEY, JSON.stringify(users));
}

function setSession(data) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(data));
}

export function getSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)); }
  catch { return null; }
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

/* ── Local registration ───────────────────────────────────────────────── */

/**
 * Register a new local (email + password) account.
 * Throws if email already registered.
 * @param {string} email
 * @param {string} password   plain-text password (never stored)
 * @param {string} displayName
 */
export async function registerLocal(email, password, displayName) {
  const users = loadUsers();
  const key   = email.toLowerCase().trim();

  if (users[key]) throw new Error('Email already registered.');

  const salt    = crypto.getRandomValues(new Uint8Array(16));
  const saltB64 = bufToB64(salt);
  const hashB64 = await hashPassword(password, salt);

  // Store an encrypted identity blob so we can verify decryption later
  const blob    = JSON.stringify({ email: key, displayName });
  const encBlob = await encrypt(blob, password);

  users[key] = { hashB64, saltB64, encBlob, provider: 'local' };
  saveUsers(users);

  setSession({ email: key, displayName, provider: 'local', avatarUrl: null });
}

/* ── Local login ──────────────────────────────────────────────────────── */

/**
 * Authenticate an existing local account.
 * Throws on bad credentials.
 * @param {string} email
 * @param {string} password
 */
export async function loginLocal(email, password) {
  const users = loadUsers();
  const key   = email.toLowerCase().trim();
  const user  = users[key];

  if (!user || user.provider !== 'local') {
    throw new Error('No account found for this email.');
  }

  const salt    = b64ToBuf(user.saltB64);
  const hashB64 = await hashPassword(password, salt);

  if (hashB64 !== user.hashB64) {
    throw new Error('Incorrect password.');
  }

  // Decrypt blob (double-checks password via AES-GCM auth tag)
  const blob = JSON.parse(await decrypt(user.encBlob, password));

  setSession({
    email: blob.email,
    displayName: blob.displayName,
    provider: 'local',
    avatarUrl: null,
  });
}

/* ── Lock screen (re-auth) ────────────────────────────────────────────── */

/**
 * Verify the current session user's password (for lock-screen unlock).
 * Throws on mismatch.
 * @param {string} password
 */
export async function verifyPassword(password) {
  const session = getSession();
  if (!session) throw new Error('No active session.');

  if (session.provider === 'google') {
    // Google accounts never need a password unlock; just restore session
    return;
  }

  const users = loadUsers();
  const user  = users[session.email];
  if (!user) throw new Error('Account not found.');

  const salt    = b64ToBuf(user.saltB64);
  const hashB64 = await hashPassword(password, salt);
  if (hashB64 !== user.hashB64) throw new Error('Incorrect password.');
}

/* ── Google OAuth 2.0 ─────────────────────────────────────────────────── */

/**
 * Decode a JWT without verification (the token is already validated by Google
 * servers; we only read the payload here on the client).
 * @param {string} token
 * @returns {object}
 */
function decodeJWT(token) {
  const [, payload] = token.split('.');
  const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
  return JSON.parse(json);
}

/**
 * Called by the Google Identity Services library when sign-in succeeds.
 * @param {object} response  { credential: '<JWT>' }
 */
export function handleGoogleCredential(response) {
  const payload = decodeJWT(response.credential);
  const key     = payload.email.toLowerCase();

  // Upsert user record (Google accounts have no local password)
  const users   = loadUsers();
  users[key]    = users[key] || {};
  users[key].provider    = 'google';
  users[key].displayName = payload.name;
  users[key].avatarUrl   = payload.picture;
  saveUsers(users);

  setSession({
    email:       key,
    displayName: payload.name,
    provider:    'google',
    avatarUrl:   payload.picture,
  });

  // Notify the app shell
  window.dispatchEvent(new CustomEvent('auth:login'));
}

/* ── Change password ──────────────────────────────────────────────────── */

/**
 * Re-encrypt user data with a new password.
 * @param {string} currentPassword
 * @param {string} newPassword
 */
export async function changePassword(currentPassword, newPassword) {
  const session = getSession();
  if (!session || session.provider !== 'local') throw new Error('Not a local account.');

  // Verify current password first
  await verifyPassword(currentPassword);

  const users = loadUsers();
  const key   = session.email;
  const user  = users[key];

  const newSalt    = crypto.getRandomValues(new Uint8Array(16));
  const newSaltB64 = bufToB64(newSalt);
  const newHashB64 = await hashPassword(newPassword, newSalt);
  const blob       = JSON.stringify({ email: key, displayName: user.displayName || session.displayName });
  const newEncBlob = await encrypt(blob, newPassword);

  users[key] = { ...user, hashB64: newHashB64, saltB64: newSaltB64, encBlob: newEncBlob };
  saveUsers(users);
}
