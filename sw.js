const CACHE='untold-seizure-log-v5-beta1';
const CORE=['/','/index.html','/manifest.json','/icon-512.png','/download.html'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET') return;
  const url=new URL(req.url);
  if(url.origin!==location.origin || url.pathname.startsWith('/api/')) return;
  event.respondWith(fetch(req).then(resp=>{
    const copy=resp.clone();
    caches.open(CACHE).then(c=>c.put(req,copy)).catch(()=>{});
    return resp;
  }).catch(()=>caches.match(req).then(r=>r||caches.match('/index.html'))));
});