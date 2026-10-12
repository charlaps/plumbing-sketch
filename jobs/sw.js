/* Retired APS Jobs service worker.
   Unregisters itself and deletes only aps-jobs- caches (not aps-field-jobs-).
   An installed home-screen copy then loads the redirect to the Field App. */
self.addEventListener('install', function(e){ e.waitUntil(self.skipWaiting()); });
self.addEventListener('activate', function(e){
  e.waitUntil(caches.keys().then(function(ks){
    return Promise.all(ks.filter(function(k){ return k.indexOf('aps-jobs-')===0; }).map(function(k){ return caches.delete(k); }));
  }).then(function(){ return self.registration.unregister(); }).then(function(){
    return self.clients.matchAll({type:'window'}).then(function(cs){ cs.forEach(function(c){ c.navigate(c.url); }); });
  }));
});
