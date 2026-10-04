/* APS Field App service worker.
   Scope = the folder this file sits in (.../plumbing-sketch/field/).
   - Shell, data and index: network-first (3 s timeout) so updates show up, cache fallback when offline.
   - Photo packs (pack-NN.bin): cache-first, filled on first use / background download.
   - Only deletes caches that start with "aps-field-" – never other apps' caches on this origin. */
var CACHE='aps-field-v1';
var SHELL=['./','index.html','app.css','app.js','handbook-data.js','handbook.js','sans.js','manifest.webmanifest','icon.svg','icon-192.png','icon-512.png','icon-maskable-512.png','logo.png','logo-white.png','items.json','photos.idx'];
self.addEventListener('install',function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){
    return Promise.all(SHELL.map(function(f){return c.add(new Request(f,{cache:'reload'})).catch(function(){})}));
  }).then(function(){return self.skipWaiting()}));
});
self.addEventListener('activate',function(e){
  e.waitUntil(caches.keys().then(function(ks){
    return Promise.all(ks.filter(function(k){return k.indexOf('aps-field-')===0&&k!==CACHE}).map(function(k){return caches.delete(k)}));
  }).then(function(){return self.clients.claim()}));
});
function isPack(u){return /\/pack-\d+\.bin$/.test(u.pathname)}
function netFirst(r){
  return caches.open(CACHE).then(function(c){
    return new Promise(function(resolve){
      var done=false;
      function fromCache(){return c.match(r,{ignoreSearch:true}).then(function(hit){return hit||(r.mode==='navigate'?c.match('index.html'):null)})}
      var t=setTimeout(function(){fromCache().then(function(hit){if(hit&&!done){done=true;resolve(hit)}})},3000);
      fetch(r).then(function(res){
        clearTimeout(t);
        if(res&&res.ok){c.put(r,res.clone())}
        if(!done){done=true;resolve(res)}
      }).catch(function(){
        clearTimeout(t);
        fromCache().then(function(hit){if(!done){done=true;resolve(hit||new Response('Offline',{status:503,statusText:'Offline'}))}})
      });
    });
  });
}
function cacheFirst(r){
  return caches.open(CACHE).then(function(c){
    return c.match(r).then(function(hit){
      if(hit)return hit;
      return fetch(r).then(function(res){if(res&&res.ok)c.put(r,res.clone());return res});
    });
  });
}
self.addEventListener('fetch',function(e){
  var r=e.request;
  if(r.method!=='GET')return;
  var u=new URL(r.url);
  if(u.origin!==location.origin||u.href.indexOf(self.registration.scope)!==0)return;
  e.respondWith(isPack(u)?cacheFirst(r):netFirst(r));
});
