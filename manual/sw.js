/* APS Field Service Manual service worker – offline cache (cache-first, refreshed in background).
   Scope is the folder this file sits in, so it can be served from .../plumbing-sketch/manual/ */
var CACHE='aps-manual-v1.1';
var FILES=['./','index.html','manifest.webmanifest','icon.svg','icon-192.png','icon-512.png','icon-maskable-512.png'];
self.addEventListener('install',function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){
    return c.addAll(FILES.map(function(f){return new Request(f,{cache:'reload'})}));
  }).then(function(){return self.skipWaiting()}));
});
self.addEventListener('activate',function(e){
  /* only remove OLD caches of THIS app – never touch other apps' caches on the same origin */
  e.waitUntil(caches.keys().then(function(ks){
    return Promise.all(ks.filter(function(k){return k.indexOf('aps-manual-')===0&&k!==CACHE}).map(function(k){return caches.delete(k)}));
  }).then(function(){return self.clients.claim()}));
});
self.addEventListener('fetch',function(e){
  var r=e.request;
  if(r.method!=='GET')return;
  var u=new URL(r.url);
  if(u.origin!==location.origin||u.href.indexOf(self.registration.scope)!==0)return;
  e.respondWith(caches.open(CACHE).then(function(c){
    return c.match(r,{ignoreSearch:true}).then(function(hit){
      var net=fetch(r).then(function(res){if(res&&res.ok)c.put(r,res.clone());return res}).catch(function(){return null});
      if(hit){net.catch(function(){});return hit}
      return net.then(function(res){return res||c.match('index.html')});
    });
  }));
});
