const VERSION = '__VERSION__';
const ASSETS = [];
const PREFIX = `palabras-prohibidas:${encodeURIComponent(self.registration.scope)}:`;
const CACHE = PREFIX + VERSION;
const urls = ASSETS.map(file=>new URL(file,self.registration.scope).href);
self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    try{await cache.addAll(urls.map(url=>new Request(url,{cache:'reload'})));}
    catch(error){await caches.delete(CACHE);throw error;}
  })());
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    for(const key of await caches.keys())if(key.startsWith(PREFIX)&&key!==CACHE)await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener('message',event=>{
  if(event.data?.type==='SKIP_WAITING'){self.skipWaiting();return;}
  if(event.data?.type==='CHECK_OFFLINE')event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    if((await Promise.all(urls.map(url=>cache.match(url)))).every(Boolean))event.source?.postMessage({type:'OFFLINE_READY'});
  })());
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin||!url.href.startsWith(self.registration.scope))return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    if(event.request.mode==='navigate')return await cache.match(new URL('./index.html',self.registration.scope).href)||fetch(event.request);
    url.search='';return await cache.match(url.href)||fetch(event.request);
  })());
});
