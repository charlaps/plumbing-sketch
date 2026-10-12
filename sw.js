/* Retired Plumbing Sketch service worker.
   Installed home-screen copies update to this file, then it unregisters itself
   and deletes only plumbing-sketch- caches. It does not cache pages, and it
   does not redirect site/, quote-app/, field/, jobs/, manual/ or multiquoters/.
   Sketch navigations are sent on by index.html (deep links to field/sketch/). */
self.addEventListener('install', function(e){ e.waitUntil(self.skipWaiting()); });
self.addEventListener('activate', function(e){
  e.waitUntil(caches.keys().then(function(ks){
    return Promise.all(ks.filter(function(k){ return k.indexOf('plumbing-sketch-')===0; }).map(function(k){ return caches.delete(k); }));
  }).then(function(){ return self.registration.unregister(); }).then(function(){
    return self.clients.matchAll({type:'window'}).then(function(cs){
      var root=new URL(self.registration.scope).pathname;
      cs.forEach(function(c){
        try{
          var path=new URL(c.url).pathname;
          if(path===root||path===root+'index.html') c.navigate(c.url);
        }catch(err){}
      });
    });
  }));
});
