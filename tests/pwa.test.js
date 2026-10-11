import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../dist/',import.meta.url));
const source=await fs.readFile(path.join(root,'sw.js'),'utf8');
function worker(scope,missing=null){
  const listeners={},stores=new Map(),messages=[];let claimed=false;
  const caches={
    async open(name){if(!stores.has(name))stores.set(name,new Map());const data=stores.get(name);return {
      async addAll(requests){const entries=await Promise.all(requests.map(async request=>{
        const url=new URL(request.url),relative=url.pathname.slice(new URL(scope).pathname.length)||'index.html';
        if(relative===missing)throw new Error('Descarga interrumpida');
        const bytes=await fs.readFile(path.join(root,relative));return [request.url,new Response(bytes)];
      }));for(const [url,response]of entries)data.set(url,response);},
      async match(url){const key=typeof url==='string'?url:url.url;return data.get(key)?.clone();}
    };},
    async keys(){return [...stores.keys()];},
    async delete(name){return stores.delete(name);}
  };
  const self={registration:{scope},location:new URL(scope+'sw.js'),clients:{async claim(){claimed=true;}},skipWaiting(){},addEventListener(name,handler){listeners[name]=handler;}};
  vm.runInNewContext(source,{self,caches,Request,Response,URL,fetch(){throw new Error('Réseau hors ligne');}});
  async function event(name,extra={}){let promise,result;listeners[name]({...extra,waitUntil(p){promise=p;},respondWith(p){result=p;}});if(promise)await promise;return result?await result:undefined;}
  return {event,stores,messages,get claimed(){return claimed;}};
}
for(const prefix of ['','juegos/palabras/'])test(`cache completa y navegación offline ${prefix||'en la raíz'}`,async()=>{
  const scope='https://example.test/'+prefix,w=worker(scope);await w.event('install');await w.event('activate');
  assert.ok(w.claimed);const assets=[...w.stores.values()][0];assert.ok(assets.size>=8);
  const response=await w.event('fetch',{request:{url:scope+'?origen=instalada',method:'GET',mode:'navigate'}});
  assert.equal(response.status,200);assert.ok((await response.text()).includes('Palabras Prohibidas'));
  const bundleURL=[...assets.keys()].find(url=>url.endsWith('.js'));
  const module=await w.event('fetch',{request:new Request(bundleURL+'?version=1')});
  const code=await module.text();
  for(const target of ['Heladera','Mate','Película','Arquero','Contraseña'])assert.ok(code.includes(target));
  const messages=[];await w.event('message',{data:{type:'CHECK_OFFLINE'},source:{postMessage(value){messages.push(value);}}});
  assert.equal(messages[0].type,'OFFLINE_READY');
});
test('descarga incompleta no confirma offline y elimina la caché parcial',async()=>{
  const w=worker('https://example.test/','manifest.webmanifest');
  await assert.rejects(w.event('install'));assert.equal(w.stores.size,0);
  const messages=[];await w.event('message',{data:{type:'CHECK_OFFLINE'},source:{postMessage(value){messages.push(value);}}});assert.equal(messages.length,0);
});
test('activación elimina solo versiones anteriores de esta app y este scope',async()=>{
  const scope='https://example.test/palabras/',w=worker(scope);await w.event('install');
  const prefix='palabras-prohibidas:'+encodeURIComponent(scope)+':';
  w.stores.set(prefix+'v0',new Map());w.stores.set('otra-app:v1',new Map());w.stores.set('palabras-prohibidas:otro-scope:v1',new Map());
  await w.event('activate');assert.ok(!w.stores.has(prefix+'v0'));assert.ok(w.stores.has('otra-app:v1'));assert.ok(w.stores.has('palabras-prohibidas:otro-scope:v1'));
});
test('manifest e iconos existen con rutas relativas y dimensiones correctas',async()=>{
  const manifest=JSON.parse(await fs.readFile(path.join(root,'manifest.webmanifest'),'utf8'));
  assert.equal(manifest.start_url,'./');assert.equal(manifest.scope,'./');assert.equal(manifest.display,'standalone');
  for(const icon of manifest.icons){assert.ok(icon.src.startsWith('./'));const bytes=await fs.readFile(path.join(root,icon.src));const size=Number(icon.sizes.split('x')[0]);assert.equal(bytes.readUInt32BE(16),size);assert.equal(bytes.readUInt32BE(20),size);}
  const apple=await fs.readFile(path.join(root,'icons/apple-touch-icon.png'));assert.equal(apple.readUInt32BE(16),180);
});
