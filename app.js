/* ─── Call Wreck Order – Ionity  ────────────────────────────── */

/* Register service worker */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.warn('SW registration failed:', err);
    });
  });
}

/* Dismiss splash once page resources are ready */
function hideSplash() {
  const splash = document.getElementById('splash');
  const app    = document.getElementById('app');
  if (!splash || !app) return;

  // Minimum display time keeps the logo visible long enough to read
  const MIN_MS = 1800;
  const elapsed = performance.now();
  const delay = Math.max(0, MIN_MS - elapsed);

  setTimeout(() => {
    splash.classList.add('hidden');
    app.classList.add('visible');
  }, delay);
}

if (document.readyState === 'complete') {
  hideSplash();
} else {
  window.addEventListener('load', hideSplash);
}
