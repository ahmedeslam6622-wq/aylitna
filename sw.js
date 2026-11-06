/* عيلتنا service worker
   · App shell is pre-cached → opens instantly, works offline.
   · Shell files use stale-while-revalidate: you get the cached copy now,
     the fresh copy is fetched in the background for next launch.
   · Cloudinary images: cache-first (capped). Videos/API/realtime are never touched.
   Bump VERSION whenever you deploy changed files. */
const VERSION = 'v4';
const SHELL = `ayl-shell-${VERSION}`, IMGS = 'ayl-photos-v2', MAX_IMGS = 160;
const FILES = ['./', 'index.html', 'app.css', 'config.js', 'app.js', 'calls.js', 'manifest.json', 'icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== SHELL && k !== IMGS) await caches.delete(k);
    await self.clients.claim();
  })());
});

async function trim(cache) {
  const keys = await cache.keys();
  if (keys.length > MAX_IMGS) await Promise.all(keys.slice(0, keys.length - MAX_IMGS).map(k => cache.delete(k)));
}

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || req.headers.has('range')) return;

  if (url.origin === location.origin) {                           // shell: stale-while-revalidate
    e.respondWith((async () => {
      const cache = await caches.open(SHELL);
      const hit = await cache.match(req, { ignoreSearch: true });
      const net = fetch(req).then(r => { if (r.ok) cache.put(req, r.clone()); return r; }).catch(() => null);
      if (hit) { e.waitUntil(net); return hit; }
      return (await net) || (req.mode === 'navigate' ? cache.match('index.html') : Response.error());
    })());
    return;
  }
  if (url.hostname === 'res.cloudinary.com' && !url.pathname.includes('/video/')) {   // photos: cache-first
    e.respondWith((async () => {
      const cache = await caches.open(IMGS), hit = await cache.match(req);
      if (hit) return hit;
      try {
        const r = await fetch(req);
        if (r.ok || r.type === 'opaque') { cache.put(req, r.clone()).then(() => trim(cache)); }
        return r;
      } catch { return Response.error(); }
    })());
  }
});

self.addEventListener('push', e => {
  const d = e.data?.json() || {};
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (wins.some(c => c.visibilityState === 'visible')) return;           // already looking at the app
    await self.registration.showNotification(d.title || 'عيلتنا', {
      body: d.body || '', icon: 'icon.png', badge: 'icon.png', vibrate: [200, 100, 200], tag: d.tag || 'ayl', data: { url: d.data?.url || './' },
    });
  })());
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (wins[0]) return wins[0].focus();
    return self.clients.openWindow(e.notification.data?.url || './');
  })());
});
