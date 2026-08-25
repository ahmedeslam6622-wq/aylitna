const SW_VERSION = 'v2';
const PHOTO_CACHE = 'ayl-photos-v1';
const VIDEO_CACHE = 'ayl-videos-v1';

self.addEventListener('install', e => {
  self.skipWaiting(); // activate this new worker immediately, don't wait for old tabs to close
});
self.addEventListener('activate', e => {
  e.waitUntil(self.clients.claim()); // take control of open pages right away
});

self.addEventListener('fetch', e => {
  const url = e.request.url;

  // App shell files (index.html, app.js, app.css, manifest.json) — ALWAYS
  // network-first with no fallback to cache unless truly offline. This is
  // what was missing: without this explicit block, some browsers'
  // HTTP cache (separate from the Cache API) can still serve a stale
  // app.css/app.js to an installed PWA even though the SW fetch handler
  // technically re-fetches, because the underlying network request itself
  // gets satisfied from disk cache. no-store forces an actual round-trip.
  if (url.endsWith('/aylitna/') || url.endsWith('index.html') || url.endsWith('app.js') || url.endsWith('app.css') || url.endsWith('manifest.json')) {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache photos — serve from cache first, update in background
  if (url.includes('res.cloudinary.com/df618arjm')) {
    e.respondWith(
      caches.open(PHOTO_CACHE).then(async cache => {
        const hit = await cache.match(e.request);
        const fetchP = fetch(e.request).then(res => { if(res.ok) cache.put(e.request, res.clone()); return res; }).catch(()=>null);
        return hit || fetchP;
      })
    );
    return;
  }
  // Cache videos — serve from cache first (videos are large, so cache-first is critical)
  if (url.includes('res.cloudinary.com/hhjzkoeh') || url.includes('video/upload')) {
    e.respondWith(
      caches.open(VIDEO_CACHE).then(async cache => {
        const hit = await cache.match(e.request);
        if (hit) return hit;
        return fetch(e.request).then(res => {
          if(res.ok) cache.put(e.request, res.clone());
          return res;
        }).catch(() => null);
      })
    );
    return;
  }
  // Everything else — network first
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});

self.addEventListener('push', e => {
  const d = e.data?.json() || {};
  e.waitUntil((async () => {
    const cls = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (cls.some(c => c.visibilityState === 'visible')) return;
    await self.registration.showNotification(d.title || 'عيلتنا', {
      body: d.body || '', icon: '/aylitna/icon.png', badge: '/aylitna/icon.png',
      vibrate: [200, 100, 200], data: { url: d.data?.url || '/aylitna/' }
    });
  })());
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.openWindow(e.notification.data?.url || '/aylitna/'));
});
