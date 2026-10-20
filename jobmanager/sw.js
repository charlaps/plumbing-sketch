/* APS Job Manager — cache the app shell so a job card still opens with no signal. */
const CACHE = 'aps-jm-v2';
const FILES = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './db.js',
  './sync.js',
  './rates.js',
  './config.js',
  './pdf.js',
  './demo.js',
  './office.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(caches.open(CACHE).then(function (cache) {
    return cache.addAll(FILES);
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (event) {
  event.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (key) {
      return key.indexOf('aps-jm-') === 0 && key !== CACHE;
    }).map(function (key) { return caches.delete(key); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;
  var url = new URL(event.request.url);
  if (url.origin !== location.origin) return;
  event.respondWith(fetch(event.request).then(function (res) {
    if (res && res.ok) {
      var copy = res.clone();
      caches.open(CACHE).then(function (cache) { return cache.put(event.request, copy); });
    }
    return res;
  }).catch(function () {
    return caches.match(event.request, { ignoreSearch: true }).then(function (cached) {
      if (cached) return cached;
      if (event.request.mode === 'navigate') return caches.match('./index.html');
      return new Response('', { status: 504, statusText: 'offline' });
    });
  }));
});
