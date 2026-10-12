/* Retired APS Field Manual service worker.
   Unregisters itself and deletes only aps-manual- caches so an installed
   home-screen copy loads the redirect to the Field App. */
self.addEventListener('install', function(e){ e.waitUntil(self.skipWaiting()); });
self.addEventListener('activate', function(e){
  e.waitUntil(caches.keys().then(function(ks){
    return Promise.all(ks.filter(function(k){ return k.indexOf('aps-manual-')===0; }).map(function(k){ return caches.delete(k); }));
  }).then(function(){ return self.registration.unregister(); }).then(function(){
    return self.clients.matchAll({type:'window'}).then(function(cs){ cs.forEach(function(c){ c.navigate(c.url); }); });
  }));
});
