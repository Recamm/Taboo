let registration=null,prompt=null,approved=false,safeToUpdate=()=>false;
export const configureUpdates = check => {safeToUpdate=check;};
export const hasUpdate = () => Boolean(registration?.waiting);
export async function installApp() {
  if(!prompt)return false;
  const current=prompt;prompt=null;
  try {await current.prompt();await current.userChoice;return true;}catch{return false;}
}
export function applyUpdate() {
  if(!safeToUpdate()||!registration?.waiting)return false;
  approved=true;registration.waiting.postMessage({type:'SKIP_WAITING'});return true;
}
export function initPWA(baseURL) {
  const onInstall = event => {event.preventDefault();prompt=event;};
  const onMessage = event => {if(event.data?.type==='OFFLINE_READY')window.dispatchEvent(new CustomEvent('offline-ready'));};
  let disposed=false,reloading=false;
  const onChange=()=>{if(approved&&!reloading&&safeToUpdate()){reloading=true;location.reload();}};
  window.addEventListener('beforeinstallprompt',onInstall);
  if('serviceWorker' in navigator && import.meta.env.PROD) {
    navigator.serviceWorker.addEventListener('message',onMessage);
    navigator.serviceWorker.addEventListener('controllerchange',onChange);
    navigator.serviceWorker.register(new URL('sw.js',baseURL),{scope:baseURL.pathname,updateViaCache:'none'}).then(async reg=>{
      if(disposed)return;
      registration=reg;
      reg.addEventListener('updatefound',()=>{
        const installing=reg.installing;
        installing?.addEventListener('statechange',()=>{if(installing.state==='installed'&&navigator.serviceWorker.controller)window.dispatchEvent(new CustomEvent('pwa-update'));});
      });
      if(reg.waiting)window.dispatchEvent(new CustomEvent('pwa-update'));
      const ready=await navigator.serviceWorker.ready;
      if(!disposed)ready.active?.postMessage({type:'CHECK_OFFLINE'});
    }).catch(()=>window.dispatchEvent(new CustomEvent('offline-failed')));
  }
  return ()=>{disposed=true;window.removeEventListener('beforeinstallprompt',onInstall);navigator.serviceWorker?.removeEventListener('message',onMessage);navigator.serviceWorker?.removeEventListener('controllerchange',onChange);};
}
