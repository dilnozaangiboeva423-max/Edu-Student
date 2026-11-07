// Oflayn rejim: ilova qobig'i keshlanadi, jadval/kutubxona ma'lumotlari oxirgi holatda saqlanadi.
const SHELL = 'edubot-shell-v1', API = 'edubot-api-v1';
const FILES = ['/', '/index.html', '/css/app.css', '/js/app.js', '/manifest.webmanifest', '/icon.svg'];
const CACHEABLE = /^\/api\/(schedule|today|books|reservations|attendance|notifications|me|chat)$/;

self.addEventListener('install', e => { e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => ![SHELL, API].includes(k)).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;

  if (url.pathname.startsWith('/api/')) {
    if (!CACHEABLE.test(url.pathname)) return;
    e.respondWith((async () => {
      const cache = await caches.open(API);
      try {
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      } catch {
        const hit = await cache.match(req);
        if (!hit) return new Response(JSON.stringify({ error: 'Internet yo‘q' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
        const h = new Headers(hit.headers); h.set('x-cache', '1');
        return new Response(await hit.blob(), { status: 200, headers: h });
      }
    })());
    return;
  }
  // Statik fayllar: tarmoq birinchi, bo'lmasa kesh
  e.respondWith(fetch(req).then(res => { if (res.ok) caches.open(SHELL).then(c => c.put(req, res.clone())); return res; }).catch(() => caches.match(req).then(r => r || caches.match('/index.html'))));
});
