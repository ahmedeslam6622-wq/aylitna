const PHOTO_CACHE = 'ayl-photos-v1';

self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => { self.clients.claim(); });

self.addEventListener('fetch', e => {
  const url = e.request.url;
  if (url.includes('cloudinary.com')) {
    e.respondWith(caches.open(PHOTO_CACHE).then(async cache => {
      const hit = await cache.match(e.request);
      const fetchP = fetch(e.request).then(res => { if(res.ok) cache.put(e.request, res.clone()); return res; }).catch(()=>null);
      return hit || fetchP;
    }));
    return;
  }
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
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
