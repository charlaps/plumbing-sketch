/* APS Slips — network first for the page, cache fallback when offline. */
var CACHE = 'aps-slips-v3';
var PREFIX = 'aps-slips-';
var V = '3';
var PDF_JS = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
var FILES = [
  './',
  './?v=' + V,
  './index.html',
  './index.html?v=' + V,
  './app.js?v=' + V,
  './manifest.webmanifest?v=' + V,
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(caches.open(CACHE).then(function (cache) {
    return Promise.all(FILES.map(function (file) {
      return cache.add(new Request(file, { cache: 'reload' })).catch(function () {});
    })).then(function () {
      return fetch(new Request(PDF_JS, { mode: 'cors', credentials: 'omit', cache: 'reload' })).then(function (res) {
        if (res && res.ok) return cache.put(PDF_JS, res);
      }).catch(function () {});
    });
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (event) {
  event.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (key) {
      return key.indexOf(PREFIX) === 0 && key !== CACHE;
    }).map(function (key) { return caches.delete(key); }));
  }).then(function () {
    return self.clients.claim();
  }).then(function () {
    return self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  }).then(function (list) {
    return Promise.all(list.map(function (client) {
      return client.navigate(client.url).catch(function () {});
    }));
  }));
});

function isCode(url) {
  var path = url.pathname;
  if (path.slice(-6) === '/sw.js') return false;
  if (path.slice(-1) === '/') return true;
  return /\.(html|js|css|webmanifest)$/.test(path);
}

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') return;
  var url = new URL(request.url);
  if (url.href === PDF_JS) {
    event.respondWith(caches.open(CACHE).then(function (cache) {
      return fetch(request).then(function (res) {
        if (res && res.ok) cache.put(PDF_JS, res.clone());
        return res;
      }).catch(function () { return cache.match(PDF_JS); });
    }));
    return;
  }
  if (url.origin !== location.origin) return;
  if (url.pathname.slice(-6) === '/sw.js') return;
  if (isCode(url)) {
    event.respondWith(fetch(request, { cache: 'no-cache' }).then(function (res) {
      if (res && res.ok) {
        var copy = res.clone();
        caches.open(CACHE).then(function (cache) { cache.put(request, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(request).then(function (hit) {
        if (hit) return hit;
        if (request.mode === 'navigate') return caches.match('./index.html');
      });
    }));
    return;
  }
  event.respondWith(caches.match(request).then(function (hit) {
    if (hit) return hit;
    return fetch(request).then(function (res) {
      if (res && res.ok) {
        var copy = res.clone();
        caches.open(CACHE).then(function (cache) { cache.put(request, copy); });
      }
      return res;
    });
  }));
});
