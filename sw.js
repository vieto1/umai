/* UMAI offline shell, v3: recipe data remains locally stored on each device. */
const VERSION='umai-shell-v5';
const SHELL=['./','./index.html','./manifest.webmanifest','./assets/icon-512.svg','./assets/icon-192.png','./assets/icon-512.png','./assets/authors-memory.svg','./assets/recipe-placeholder.svg','./assets/umai-logo.svg','./assets/umai-icon.svg','./assets/fettuccine-alfredo.svg','./assets/coffee-finish.svg','./assets/coffee-mix.svg','./assets/coffee-cream.svg'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(VERSION).then(cache=>Promise.allSettled(SHELL.map(path=>cache.add(path)))).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('umai-')&&k!==VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{
const req=event.request;if(req.method!=='GET')return;
const url=new URL(req.url);
if(url.origin===self.location.origin){
 if(req.mode==='navigate'){event.respondWith(fetch(req).then(response=>{if(response.ok){const copy=response.clone();caches.open(VERSION).then(c=>c.put('./index.html',copy))}return response}).catch(()=>caches.match('./index.html')));return}
 event.respondWith(caches.match(req).then(cached=>cached||fetch(req).then(response=>{if(response.ok){const copy=response.clone();caches.open(VERSION).then(c=>c.put(req,copy))}return response})));return;
}
if(req.destination==='image'){event.respondWith(caches.match(req).then(cached=>cached||fetch(req).then(response=>{if(response.ok||response.type==='opaque'){const copy=response.clone();caches.open(VERSION).then(c=>c.put(req,copy))}return response}).catch(()=>cached||Response.error())));}
});