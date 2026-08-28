const SW_VERSION = 'v3'; // bump this on every future deploy that changes sw.js itself
const PHOTO_CACHE = 'ayl-photos-v1';
const VIDEO_CACHE = 'ayl-videos-v1';

self.addEventListener('install', e => {
  self.skipWaiting(); // activate this new worker immediately, don't wait for old tabs to close
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    await self.clients.claim(); // take control of open pages right away
    // Drop any old named caches from previous versions so nothing stale lingers
    const keys = await caches.keys();
    await Promise.all(
      keys.filter(k => k !== PHOTO_CACHE && k !== VIDEO_CACHE).map(k => caches.delete(k))
    );
  })());
});

self.addEventListener('fetch', e => {
  const url = e.request.url;
  // App shell files — ALWAYS network-first with no-store, no cache fallback
  // unless truly offline. no-store forces an actual network round-trip,
  // bypassing the browser's own HTTP disk cache (separate from the Cache
  // Storage API), which can otherwise serve a stale app.css/app.js even
  // when this fetch handler itself re-fetches correctly.
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
