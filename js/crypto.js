/**
 * crypto.js — AES-GCM encryption helpers using the browser Web Crypto API.
 *
 * The encryption scheme:
 *  1. Derive a 256-bit AES-GCM key from the user's password + a stored salt
 *     using PBKDF2 (310 000 iterations, SHA-256).
 *  2. Encrypt an arbitrary plaintext with a random 12-byte IV.
 *  3. Store salt + IV + ciphertext (all base64-encoded) in localStorage.
 *
 * Nothing leaves the device; the raw password is never stored.
 */

const PBKDF2_ITERATIONS = 310_000;
const SALT_BYTES        = 16;
const IV_BYTES          = 12;

/** Encode ArrayBuffer → base64 string */
function bufToB64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

/** Decode base64 string → Uint8Array */
function b64ToBuf(b64) {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

/**
 * Derive an AES-GCM CryptoKey from a password and salt.
 * @param {string} password
 * @param {Uint8Array} salt
 * @returns {Promise<CryptoKey>}
 */
async function deriveKey(password, salt) {
  const enc     = new TextEncoder();
  const keyMat  = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMat,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Hash a password for verification storage (separate from the encryption key).
 * Returns a base64-encoded SHA-256 digest of salt+password.
 * @param {string} password
 * @param {Uint8Array} salt
 * @returns {Promise<string>}
 */
async function hashPassword(password, salt) {
  const enc   = new TextEncoder();
  const data  = new Uint8Array([...salt, ...enc.encode(password)]);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return bufToB64(digest);
}

/**
 * Encrypt plaintext string with the user's password.
 * Returns an opaque string: "<saltB64>.<ivB64>.<cipherB64>"
 * @param {string} plaintext
 * @param {string} password
 * @returns {Promise<string>}
 */
async function encrypt(plaintext, password) {
  const salt  = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv    = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key   = await deriveKey(password, salt);
  const enc   = new TextEncoder();
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plaintext)
  );
  return `${bufToB64(salt)}.${bufToB64(iv)}.${bufToB64(cipher)}`;
}

/**
 * Decrypt a token produced by {@link encrypt}.
 * Throws DOMException if the password is wrong (authentication tag mismatch).
 * @param {string} token   "<saltB64>.<ivB64>.<cipherB64>"
 * @param {string} password
 * @returns {Promise<string>} plaintext
 */
async function decrypt(token, password) {
  const [saltB64, ivB64, cipherB64] = token.split('.');
  if (!saltB64 || !ivB64 || !cipherB64) throw new Error('Invalid token format');
  const salt   = b64ToBuf(saltB64);
  const iv     = b64ToBuf(ivB64);
  const cipher = b64ToBuf(cipherB64);
  const key    = await deriveKey(password, salt);
  const plain  = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
  return new TextDecoder().decode(plain);
}

/**
 * Measure password strength.
 * Returns { score: 0-4, label: string, color: string, pct: number }
 * @param {string} pw
 */
function measureStrength(pw) {
  let score = 0;
  if (pw.length >= 8)  score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw))   score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  const levels = [
    { label: 'Very weak', color: '#ef4444', pct: 15 },
    { label: 'Weak',      color: '#f97316', pct: 35 },
    { label: 'Fair',      color: '#eab308', pct: 55 },
    { label: 'Strong',    color: '#22c55e', pct: 80 },
    { label: 'Very strong', color: '#10b981', pct: 100 },
  ];
  return { score, ...levels[Math.min(score, 4)] };
}

export { encrypt, decrypt, hashPassword, bufToB64, b64ToBuf, measureStrength };
