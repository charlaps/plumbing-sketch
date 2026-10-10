/* APS Quote Finale — cache-first app shell. Scoped to this folder so /plumbing-sketch/quote-app/ stays offline. */
var CACHE = 'aps-quote-finale-v2';
var SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(SHELL);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (key) {
        return key.indexOf('aps-quote-finale-') === 0 && key !== CACHE;
      }).map(function (key) {
        return caches.delete(key);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== location.origin) return;
  event.respondWith(
    caches.match(request, {ignoreSearch: true}).then(function (cached) {
      if (cached) return cached;
      return fetch(request).catch(function () {
        if (request.mode === 'navigate') return caches.match('./index.html');
      });
    })
  );
});
