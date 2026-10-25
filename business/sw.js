/* Corner & Co — network first for the page, script, and style. */
var CACHE = 'corner-co-v4';
var PREFIX = 'corner-co-';
var V = '4';
var FILES = [
  './',
  './?v=' + V,
  './index.html',
  './index.html?v=' + V,
  './game.js?v=' + V,
  './app.css?v=' + V,
  './manifest.webmanifest?v=' + V,
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(FILES.map(function (f) {
      return c.add(new Request(f, { cache: 'reload' })).catch(function () {});
    }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) {
      return k.indexOf(PREFIX) === 0 && k !== CACHE;
    }).map(function (k) { return caches.delete(k); }));
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

self.addEventListener('fetch', function (e) {
  var r = e.request;
  if (r.method !== 'GET') return;
  var url = new URL(r.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.slice(-6) === '/sw.js') return;
  if (isCode(url)) {
    e.respondWith(fetch(r, { cache: 'no-cache' }).then(function (res) {
      if (res && res.ok) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(r, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(r).then(function (hit) {
        if (hit) return hit;
        return caches.match('./index.html');
      });
    }));
    return;
  }
  e.respondWith(caches.match(r).then(function (hit) {
    if (hit) return hit;
    return fetch(r).then(function (res) {
      if (res && res.ok) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(r, copy); });
      }
      return res;
    });
  }));
});
