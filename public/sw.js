// Bad Ass Tasks — Basic PWA Service Worker (foundation for offline shell)
// Caches app shell + key assets for installable offline experience.
// In production, consider Workbox for advanced precaching, background sync with hybridStore, etc.
// This provides a solid "offline shell" so the PWA feels native even without network.

const CACHE_NAME = 'bad-ass-tasks-shell-v1';
const SHELL_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.svg',
  '/icon-192.jpg',
  '/icon-512.jpg',
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

  // Network first for API-like, cache first for shell/static
  if (req.url.includes('/api/') || req.url.includes('supabase')) {
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
          // Optionally cache new successful responses (runtime)
          if (res && res.status === 200) {
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

console.log('[SW] Bad Ass Tasks service worker ready (offline shell)');