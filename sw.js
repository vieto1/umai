/* UMAI: network-first app updates, offline fallback for installed PWA. */
const VERSION='umai-shell-v7';
const CORE=['./','./index.html','./manifest.webmanifest','./assets/umai-enhancements.css','./assets/umai-enhancements.js','./assets/recipe-placeholder.svg','./assets/icon-192.png','./assets/icon-512.png'];
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(VERSION).then(cache=>Promise.allSettled(CORE.map(p=>cache.add(new Request(p,{cache:'reload'}))))).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('umai-shell-')&&k!==VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
 const req=event.request;if(req.method!=='GET')return;
 const url=new URL(req.url);
 if(url.origin!==self.location.origin){
  if(req.destination==='image')event.respondWith(fetch(req).then(response=>{if(response.ok||response.type==='opaque'){const copy=response.clone();caches.open(VERSION).then(c=>c.put(req,copy)).catch(()=>{})}return response}).catch(()=>caches.match(req).then(x=>x||Response.error())));
  return;
 }
 if(!url.pathname.startsWith(new URL(self.registration.scope).pathname))return;
 // Always fetch current HTML, JS, CSS, manifest and SW-related resources when online.
 // Fall back to cached resources when offline.
 const fresh=req.mode==='navigate'||/\.(html|js|css|webmanifest|json)$/i.test(url.pathname)||url.pathname.endsWith('/umai/');
 if(fresh){
  event.respondWith(fetch(new Request(req,{cache:'no-store'})).then(response=>{
   if(response.ok){const copy=response.clone();caches.open(VERSION).then(cache=>cache.put(req.mode==='navigate'?'./index.html':req,copy)).catch(()=>{})}
   return response;
  }).catch(async()=>await caches.match(req)||await caches.match('./index.html')||Response.error()));
 }else{
  event.respondWith(caches.match(req).then(cached=>cached||fetch(req).then(response=>{if(response.ok){const copy=response.clone();caches.open(VERSION).then(c=>c.put(req,copy)).catch(()=>{})}return response})));
 }
});
