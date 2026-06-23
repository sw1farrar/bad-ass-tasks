// Badazz Tasks — Basic PWA Service Worker (foundation for offline shell)
// Caches app shell + key assets for installable offline experience.
// In production, consider Workbox for advanced precaching, background sync with hybridStore, etc.
// This provides a solid "offline shell" so the PWA feels native even without network.

const CACHE_NAME = 'badazz-tasks-shell-v2';
const SHELL_ASSETS = [
  '/',
  '/manifest.json',
  '/brand/donkey-logo.jpg',
  '/favicon.svg',
  // Agent 27 offline polish: more shell for premium offline lists/views (Next chunks dynamic but critical html/css/js covered by runtime)
  '/?source=pwa',
  '/?view=today&source=pwa',
  '/?view=tasks&source=pwa',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(SHELL_ASSETS).catch((err) => {
        console.warn('[SW] Shell cache partial failure (ok for dev):', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // === DEV + EXTENSION SAFETY (critical for Next.js Turbopack + HMR) ===
  // Never intercept localhost, HMR, or chrome-extension requests.
  // This prevents "chrome-extension scheme unsupported" and chunk loading failures in dev.
  if (
    url.hostname === 'localhost' ||
    url.hostname === '127.0.0.1' ||
    url.protocol === 'chrome-extension:' ||
    url.pathname.startsWith('/_next/webpack-hmr') ||
    url.pathname.includes('__nextjs') ||
    url.pathname.includes('/_next/static/chunks')
  ) {
    return; // Let the browser/dev server handle it completely
  }

  // === Production PWA logic only (safe http/https origins) ===

  // Network first for API-like + Supabase (never cache auth/data calls)
  if (url.pathname.includes('/api/') || url.hostname.includes('supabase')) {
    event.respondWith(
      fetch(req).catch(() => caches.match(req))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          // Runtime cache only for successful same-origin responses
          if (res && res.status === 200 && url.origin === self.location.origin) {
            const resClone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, resClone));
          }
          return res;
        })
        .catch(() => {
          // Offline fallback to shell
          return caches.match('/');
        });
    })
  );
});

// Optional: message for skip waiting from client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

console.log('[SW] Badazz Tasks service worker ready (offline shell)');