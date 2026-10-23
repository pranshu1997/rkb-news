// publish_pages.sh stamps CACHE with a hash of the shell files, so any app change reaches the phones.
// The source value matches APP_VERSION (js/app.js); tests/logic.test.mjs checks.
const CACHE = 'rkb-a0e31998';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'css/app.css', 'js/app.js', 'js/logic.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  // News: network first, last batch when offline. The query string only defeats HTTP caches.
  if (url.pathname.endsWith('/data/news.json')) {
    const key = new Request(new URL('data/news.json', self.registration.scope));
    e.respondWith(fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(key, copy)); }
      return res;
    }).catch(() => caches.match(key).then(hit => hit || Response.error())));
    return;
  }
  // App shell: cache first (opens with no network, like Pulse).
  const key = req.mode === 'navigate' ? 'index.html' : req;
  e.respondWith(caches.match(key, { ignoreSearch: true }).then(hit => hit || fetch(req)));
});
