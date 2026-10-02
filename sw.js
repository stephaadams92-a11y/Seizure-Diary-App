const CACHE='untold-seizure-log-v5-beta4';
const CORE=['/','/index.html','/manifest.json','/icon-512.png','/download.html','/quick/log.html'];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET') return;
  const url=new URL(req.url);
  if(url.origin!==location.origin || url.pathname.startsWith('/api/')) return;
  event.respondWith(
    fetch(req).then(resp=>{
      const copy=resp.clone();
      caches.open(CACHE).then(c=>c.put(req,copy)).catch(()=>{});
      return resp;
    }).catch(()=>caches.match(req).then(r=>r||caches.match('/index.html')))
  );
});

self.addEventListener('push',event=>{
  let data={};
  try{data=event.data?.json?.()||{}}catch{data={body:event.data?.text?.()||''}}
  const title=data.title||'Untold Seizure Log';
  const options={
    body:data.body||'You have a reminder.',
    icon:'/icon-512.png',
    badge:'/icon-512.png',
    tag:data.tag||'untold-reminder',
    renotify:true,
    requireInteraction:true,
    silent:false,
    vibrate:[300,120,300,120,500],
    timestamp:Date.now(),
    data:{url:data.url||'/'}
  };
  event.waitUntil(self.registration.showNotification(title,options));
});

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const target=event.notification?.data?.url||'/';
  event.waitUntil(
    clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
      for(const client of list){
        if('navigate' in client) client.navigate(target).catch(()=>{});
        if('focus' in client) return client.focus();
      }
      return clients.openWindow?clients.openWindow(target):undefined;
    })
  );
});