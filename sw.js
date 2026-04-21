/**
 * sw.js  —  Service Worker for CWO Ionity PWA
 *
 * Caches all static shell assets so the app works offline.
 */

const CACHE_NAME = 'cwo-ionity-v1';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/style.css',
  '/js/storage.js',
  '/js/recorder.js',
  '/js/app.js',
];

/* ── Install: pre-cache shell assets ──────────────────────── */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)),
  );
  self.skipWaiting();
});

/* ── Activate: purge old caches ───────────────────────────── */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
      ),
    ),
  );
  self.clients.claim();
});

/* ── Fetch: cache-first for shell assets ──────────────────── */
self.addEventListener('fetch', (event) => {
  // Only handle GET requests for same-origin shell assets.
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then(
      (cached) => cached || fetch(event.request),
    ),
  );
});
