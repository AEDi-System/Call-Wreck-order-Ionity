# Call Wreck — Ionity

> **Cross-device, cross-service call recorder PWA** with encrypted local accounts and Google OAuth 2.0 sign-in.

---

## Features

| Feature | Detail |
|---|---|
| **Local auth** | Email + password; password never stored — only a PBKDF2-derived SHA-256 hash |
| **Encryption** | AES-GCM 256-bit (Web Crypto API) — all credential blobs encrypted on-device |
| **Google Sign-In** | OAuth 2.0 via Google Identity Services (One Tap + button) |
| **Auto-lock** | App locks after 5 min of inactivity or 30 s hidden; re-auth required |
| **PWA** | Installable, offline-capable (service worker + cache) |
| **Call recording** | `MediaRecorder` API — records microphone audio and saves as `.webm` |

---

## Quick Start

### 1 — Serve the app

The PWA uses ES modules, so it **must** be served over HTTP/S (not `file://`).

```bash
# Python (no install needed)
python3 -m http.server 8080

# Node (npx, no install needed)
npx serve .

# Any static host: Netlify, Vercel, GitHub Pages, Cloudflare Pages …
```

Open `http://localhost:8080` in a modern browser (Chrome 97+, Firefox 102+, Safari 15.4+).

---

### 2 — Configure Google OAuth 2.0

> Skip this step if you only want local email/password auth.

1. Go to [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials).
2. Click **Create Credentials → OAuth 2.0 Client ID**.
3. Choose **Web application**.
4. Add your origin to **Authorised JavaScript origins**:
   - `http://localhost:8080` (development)
   - `https://yourdomain.com` (production)
5. Copy the **Client ID** (looks like `1234567890-abc….apps.googleusercontent.com`).
6. Open `js/app.js` and replace the placeholder:

```js
// js/app.js  — line 26
const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';
```

Or, set it dynamically before the script loads in `index.html`:

```html
<script>window.__GOOGLE_CLIENT_ID__ = '1234567890-abc….apps.googleusercontent.com';</script>
```

---

## Security Model

### Local accounts
- The raw password is **never stored** anywhere.
- A random 16-byte **salt** is generated per user on registration.
- PBKDF2 (SHA-256, **310 000 iterations**) is used to derive a 256-bit AES-GCM key.
- A salted SHA-256 **hash** of the password is stored for fast verification.
- An **AES-GCM encrypted blob** (salt + IV + ciphertext) holds the identity record; decryption failure (wrong password) is cryptographically detected.
- All operations run inside the browser's [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) — no JavaScript crypto libraries.

### Google accounts
- The Google JWT credential is verified by Google's servers before it reaches the app.
- The app only reads the JWT payload (email, name, picture) to create a local session.
- No password is stored for Google accounts.

### Session & lock
- Session data is stored in `localStorage` (not cookies).
- After **5 minutes of inactivity** or **30 seconds hidden**, the app shows the lock screen.
- Re-entering the password re-derives the PBKDF2 hash and compares it; the raw password is discarded immediately.

---

## Project Structure

```
.
├── index.html          Main shell (auth + app + lock screens)
├── manifest.json       PWA manifest
├── sw.js               Service worker (pre-cache + offline fallback)
├── css/
│   └── app.css         All styles (dark theme, responsive)
├── js/
│   ├── crypto.js       AES-GCM helpers, PBKDF2 key derivation, strength meter
│   ├── auth.js         Registration, login, lock-screen verify, Google callback
│   └── app.js          UI wiring, recorder, GIS initialisation, service worker reg
└── icons/
    ├── icon-192.png    PWA icon (192 × 192)
    └── icon-512.png    PWA icon (512 × 512)
```

---

## Roadmap

- [ ] Server-side call storage (WebRTC / SIP integration)
- [ ] End-to-end encrypted cloud sync
- [ ] Push notifications for incoming calls
- [ ] Recording list with playback UI
- [ ] Change-password dialog
- [ ] Biometric unlock (WebAuthn)
