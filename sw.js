// Pereselah service worker — app-shell caching with safe, always-live auth/data calls.
// Bump CACHE_VERSION on every deploy that changes cached files, so old caches are dropped
// and everyone gets the new version automatically (no manual cache-clearing needed).
const CACHE_VERSION = 'pereselah-v1';

const APP_SHELL = [
  './',
  'Falc.html',
  'manifest.json',
  'icon-192.png',
  'icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Lets the page force this worker to activate right away when a new version is installed
// (see the registration code in Falc.html), instead of waiting for every tab to close.
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never cache Supabase or the verse API — sign-in, journal data and verses must always be live.
  if (url.hostname.includes('supabase.co') || url.hostname.includes('bible-api.com')) {
    return;
  }

  if (event.request.mode === 'navigate') {
    // Network-first for the page itself, so a fresh deploy shows up immediately when online,
    // falling back to the cached copy only when offline.
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first for static assets (icons, fonts, manifest).
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy));
        return res;
      });
    })
  );
});
