/* KEC master-plan service worker — runtime caching for offline use.
   After the first load, same-origin GET responses are cached; the app (and the
   958-plot dataset) then work offline. Cache is bumped by changing CACHE. */
const CACHE = 'kec-cache-v2';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // let cross-origin (tiles/fonts CDN) pass through

  // Navigations: network-first, fall back to the cached app shell when offline.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then((r) => { const c = r.clone(); caches.open(CACHE).then((cache) => cache.put(req, c)); return r; })
        .catch(() => caches.match(req).then((m) => m || caches.match(self.registration.scope))),
    );
    return;
  }

  // Everything else: stale-while-revalidate.
  e.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req).then((r) => { if (r && r.ok) { const c = r.clone(); caches.open(CACHE).then((cache) => cache.put(req, c)); } return r; }).catch(() => cached);
      return cached || network;
    }),
  );
});
