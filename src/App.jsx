import React, {useEffect,useReducer,useRef,useState} from 'react';
import * as engine from './game.js';
import {gameReducer} from './reducer.js';
import {cards,cardMap} from './cards.js';
import {selectCards} from './deck.js';
import {load,save,hasStorageWarning} from './storage.js';
import {configureUpdates,initPWA,installApp,hasUpdate,applyUpdate} from './pwa.js';
import {Action,Home,Setup,GameScreen,Scoreboard,Tutorial,Dialog} from './Screens.jsx';
import FreeMode from './FreeMode.jsx';

const storageNotice='No se pudo guardar en este navegador. Podés jugar, pero la partida puede perderse al cerrar.';
function restoreGame() {
  const stored=load('game');
  if(!engine.validSavedGame(stored,new Set(cards.map(c=>c.id)),cardMap))return {game:null,notice:stored?'La partida guardada no es compatible o está dañada. Podés empezar una nueva.':''};
  engine.expire(stored);return {game:stored,notice:''};
}
function preferences() {try{return engine.validateConfig(load('preferences')||engine.defaults());}catch{return engine.defaults();}}
export default function App() {
  const [restored]=useState(restoreGame);
  const [game,dispatch]=useReducer(gameReducer,restored.game);
  const [view,setView]=useState(()=>game&&location.hash==='#partida'?'game':'home');
  const [draft,setDraft]=useState(preferences);
  const [modal,setModal]=useState(()=>load('tutorialSeen',false)?null:{kind:'tutorial',index:0});
  const [error,setError]=useState('');
  const [corrections,setCorrections]=useState(false);
  const [now,setNow]=useState(Date.now);
  const [offline,setOffline]=useState(false);
  const [online,setOnline]=useState(navigator.onLine);
  const [update,setUpdate]=useState(false);
  const [visible,setVisible]=useState(document.visibilityState==='visible');
  const [notice,setNotice]=useState(()=>restored.notice||(hasStorageWarning()?storageNotice:''));
  const latest=useRef({game,view});latest.current={game,view};
  const audio=useRef(null),previous=useRef(game?.phase),main=useRef(null);
  function unlock() {
    if(!game?.config.sound)return;
    try {audio.current ||= new (window.AudioContext||window.webkitAudioContext)();audio.current.resume().catch(()=>{});}catch{}
  }
  function beep(end=false) {
    const context=audio.current;if(!game?.config.sound||context?.state!=='running')return;
    (end?[659,523,392]:[660]).forEach((frequency,index)=>{
      const oscillator=context.createOscillator(),gain=context.createGain(),start=context.currentTime+index*.18;
      oscillator.connect(gain);gain.connect(context.destination);oscillator.frequency.value=frequency;
      gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(.12,start+.015);gain.gain.exponentialRampToValueAtTime(.001,start+.14);oscillator.start(start);oscillator.stop(start+.16);
    });
  }
  useEffect(()=>{
    const handlers={
      'storage-warning':()=>setNotice(storageNotice),
      'offline-ready':()=>setOffline(true),
      'offline-failed':()=>setOffline(false),
      'online':()=>setOnline(true),'offline':()=>setOnline(false),
      'pwa-update':()=>setUpdate(hasUpdate()),
      'pagehide':()=>save('game',latest.current.game),
      'popstate':()=>{
        const current=latest.current;
        if(current.view==='game'&&current.game?.phase!=='final'){
          history.pushState(null,'','#partida');setModal({kind:'exit'});
        }else setView('home');
      }
    };
    for(const [name,handler]of Object.entries(handlers))window.addEventListener(name,handler);
    const visibility=()=>{setVisible(document.visibilityState==='visible');setNow(Date.now());dispatch({type:'expire',now:Date.now()});};
    document.addEventListener('visibilitychange',visibility);
    configureUpdates(()=>latest.current.view==='home'&&(!latest.current.game||latest.current.game.phase==='final'));
    const cleanup=initPWA(new URL(import.meta.env.BASE_URL,location.href));
    return ()=>{cleanup();for(const [name,handler]of Object.entries(handlers))window.removeEventListener(name,handler);document.removeEventListener('visibilitychange',visibility);};
  },[]);
  useEffect(()=>{save('game',game);},[game]);
  useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),5000);return ()=>clearTimeout(timer);},[notice]);
  useEffect(()=>{
    document.body.classList.toggle('playing',view==='game'||view==='free');
    main.current?.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});
  },[view,game?.phase]);
  useEffect(()=>{
    if(game?.phase!=='active')return;
    const tick=()=>{const time=Date.now();setNow(time);dispatch({type:'expire',now:time});};
    tick();const timer=setInterval(tick,100);return ()=>clearInterval(timer);
  },[game?.phase]);
  useEffect(()=>{
    if(previous.current==='active'&&game?.phase==='summary'){beep(true);setModal(null);}
    previous.current=game?.phase;
    if(game?.phase==='active'&&engine.remainingTime(game,now)<=10000&&!game.warningPlayed){beep();dispatch({type:'warning'});}
  },[game?.phase,game?.warningPlayed,now]);
  useEffect(()=>{
    if(game?.phase!=='active'||view!=='game'||!visible||!navigator.wakeLock)return;
    let canceled=false,lock;
    navigator.wakeLock.request('screen').then(value=>{if(canceled)value.release().catch(()=>{});else lock=value;}).catch(()=>{});
    return ()=>{canceled=true;lock?.release().catch(()=>{});};
  },[game?.phase,view,visible]);
  function navigate(next,clear=false) {
    if(clear)dispatch({type:'clear'});
    setModal(null);setView(next);history.pushState(null,'',next==='game'?'#partida':next==='setup'?'#configuracion':next==='free'?'#libre':'#inicio');
  }
  function setup() {setDraft(preferences());setError('');navigate('setup');}
  function closeModal() {if(modal?.kind==='tutorial')save('tutorialSeen',true);setModal(null);}
  function start() {
    try {
      const config=engine.validateConfig({...draft,seconds:Number(draft.seconds),rounds:Number(draft.rounds)});
      const next=engine.createGame(config,selectCards(cards,config.vocabularies).map(c=>c.id));
      save('preferences',config);dispatch({type:'replace',game:next});setCorrections(false);navigate('game');
    }catch(problem){setError(problem.message);}
  }
  async function action(type,details={}) {
    if(type==='free') {
      if(game?.phase==='active')dispatch({type:'pause',now:Date.now()});
      navigate('free');return;
    }
    if(type==='new'){if(game&&game.phase!=='final')setModal({kind:'replace'});else setup();return;}
    if(type==='replace'){dispatch({type:'clear'});setup();return;}
    if(type==='continue'){unlock();const time=Date.now();setNow(time);dispatch({type:'expire',now:time});navigate('game');return;}
    if(type==='home'){navigate('home');return;}
    if(type==='exit'){if(game&&game.phase!=='final')setModal({kind:'exit'});else navigate('home');return;}
    if(type==='save-exit'){navigate('home');return;}
    if(type==='abandon'){setModal({kind:'abandon'});return;}
    if(type==='confirm-abandon'||type==='finish'){navigate('home',true);return;}
    if(type==='replay'){save('preferences',game.config);dispatch({type:'clear'});setup();return;}
    if(type==='tutorial'||type==='scores'){
      if(game?.phase==='active'&&view==='game')dispatch({type:'pause',now:Date.now()});
      setModal({kind:type,index:0});return;
    }
    if(type==='tutorial-next'||type==='tutorial-back'){setModal(current=>({...current,index:current.index+(type==='tutorial-next'?1:-1)}));return;}
    if(type==='close-dialog'){closeModal();return;}
    if(type==='toggle-corrections'){setCorrections(current=>!current);return;}
    if(type==='install'){if(!await installApp())setModal({kind:'install'});return;}
    if(type==='update'){if(applyUpdate())setNotice('Aplicando actualización…');return;}
    if(['begin','resume','recycle','correct','forbidden','pass'].includes(type))unlock();
    if(type==='next')setCorrections(false);
    const time=Date.now();setNow(time);
    dispatch({type,now:time,...details,...(type==='recycle'?{randomValues:game.pool.map(()=>Math.random())}:{})});
  }
  const dialogTitles={replace:'¿Empezamos de nuevo?',exit:'¿Volvés al inicio?',abandon:'¿Abandonar la partida?',install:'Llevala a tu inicio.',scores:'Así van los equipos.'};
  const dialogTexts={replace:'Ya hay una partida guardada. Podés continuarla o reemplazarla para preparar otra.',exit:'Podés guardar y seguir después, o abandonar esta partida. Si el reloj está activo, seguirá corriendo: tocá Pausa antes si necesitás detenerlo.',abandon:'Se borrarán los puntos y el progreso de esta partida. Tus preferencias se conservan.',install:'En iPhone: abrí esta página en Safari, tocá Compartir y «Agregar a pantalla de inicio». En Android o computadora: buscá «Instalar app» en el menú del navegador. La primera visita necesita conexión; esperá el indicador «Lista sin conexión».',scores:game?.phase==='paused'?'El reloj está en pausa. Cerrá el marcador y tocá Seguir jugando.':'Cada palabra cuenta.'};
  const modalActions={replace:[['continue','Continuar','secondary'],['replace','Nueva partida','primary']],exit:[['save-exit','Guardar y salir','primary'],['abandon','Abandonar','secondary']],abandon:[['close-dialog','Seguir acá','secondary'],['confirm-abandon','Abandonar','primary']],install:[['close-dialog','Entendido','primary']],scores:[['close-dialog','Cerrar','primary']]};
  return <><header className="site-header"><a href="#inicio" className="brand" aria-label="Palabras Prohibidas, inicio" onClick={event=>{event.preventDefault();action(view==='game'?'exit':'home');}}><span className="brand-symbol" aria-hidden="true"><i/><b>p</b></span><span>palabras<br/><strong>prohibidas.</strong></span></a><div className="header-tools"><span className={`connection ${offline?'ready':''}`} title={offline?'Todos los recursos necesarios se guardaron para jugar sin conexión.':'El modo offline se prepara en la versión de producción.'}><i/>{offline?'Lista sin conexión':online?'Con conexión':'Sin conexión'}</span><button type="button" className="icon-button" aria-label="Cómo jugar" onClick={()=>action('tutorial')}>?</button></div></header><main id="app" ref={main} tabIndex={-1}>{view==='home'&&<Home saved={game&&game.phase!=='final'} onAction={action}/>} {view==='setup'&&<Setup draft={draft} setDraft={setDraft} error={error} onStart={start} onAction={action}/>} {view==='free'&&<FreeMode onExit={()=>navigate('home')}/>} {view==='game'&&game&&<GameScreen game={game} card={cardMap[game.current]} time={engine.remainingTime(game,now)} corrections={corrections} onAction={action}/>}</main><footer className="site-footer"><span>Un celular. Mil maneras de decirlo.</span><Action action="install" className="text-button" onAction={action}>Instalar app ↗</Action>{update&&view==='home'&&(!game||game.phase==='final')&&<Action action="update" className="text-button" onAction={action}>Actualizar app ↻</Action>}</footer>{notice&&<div id="toast" role="status" aria-live="polite">{notice}</div>}<Dialog content={modal} onClose={closeModal}>{modal?.kind==='tutorial'?<Tutorial index={modal.index} onAction={action}/>:modal&&<><span className="eyebrow">Palabras Prohibidas</span><h2 id="dialog-title">{dialogTitles[modal.kind]}</h2><p>{dialogTexts[modal.kind]}</p>{modal.kind==='scores'&&game&&<Scoreboard game={game}/>}<div className="dialog-buttons">{modalActions[modal.kind]?.map(([type,label,className])=><Action key={type} action={type} className={className} onAction={action}>{label}</Action>)}</div></>}</Dialog></>;
}
