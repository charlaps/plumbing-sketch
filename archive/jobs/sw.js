/* APS Jobs service worker – cache app shell so it opens with no signal */
const CACHE = 'aps-jobs-v2';
const FILES = ['./', 'index.html', 'styles.css', 'app.js', 'site.webmanifest',
  'fonts/montserrat-var.woff2', 'img/logo-white.png', 'icon-192.png', 'icon-512.png',
  'apple-touch-icon.png', 'favicon-32.png', 'favicon.ico'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  // network first (so updates land), fall back to cache when offline
  e.respondWith(
    fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request, {ignoreSearch: true}).then(r => r || caches.match('index.html')))
  );
});
