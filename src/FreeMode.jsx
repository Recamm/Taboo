import React,{useState} from 'react';
import {cards,cardMap,vocabInfo} from './cards.js';
import {createFreeSession,moveFree} from './free.js';
import {load,save} from './storage.js';

export function FreeCard({card,onPrevious,onNext,canPrevious}) {
  return <><section className="game-card"><div className="card-meta"><span>{vocabInfo[card.vocabulary].name}</span><span>Modo libre</span></div><span className="card-label">La palabra es…</span><h2>{card.target.toLocaleUpperCase('es-AR')}</h2><span className="card-label">No podés decir</span><ul className="forbidden-list">{card.forbidden.map(word=><li key={word}>{word}</li>)}</ul></section><div className="free-actions"><button type="button" className="secondary" onClick={onPrevious} disabled={!canPrevious}>← Atrás</button><button type="button" className="primary" onClick={onNext}>Siguiente →</button></div></>;
}
export default function FreeMode({onExit}) {
  const [selected,setSelected]=useState(()=>{
    const stored=load('freeVocabularies',['general']);
    return Array.isArray(stored)&&stored.length&&stored.every(id=>vocabInfo[id])?[...new Set(stored)]:['general'];
  });
  const [session,setSession]=useState(null);
  const [error,setError]=useState('');
  function start(event) {
    event.preventDefault();
    try {setSession(createFreeSession(cards,selected));save('freeVocabularies',selected);setError('');}catch(problem){setError(problem.message);}
  }
  return <div className="play-shell"><div className="play-nav"><button type="button" className="text-button" onClick={onExit}>← Inicio</button><span className="round-label">Modo libre</span>{session?<button type="button" className="text-button" onClick={()=>setSession(null)}>Categorías ↗</button>:<span/>}</div>{session?<FreeCard card={cardMap[session.history[session.cursor]]} canPrevious={session.cursor>0} onPrevious={()=>setSession(moveFree(session,-1))} onNext={()=>setSession(moveFree(session,1))}/>:<form className="panel" onSubmit={start}><span className="eyebrow">A su ritmo</span><h1 className="free-title">Modo libre.</h1><p className="panel-subtitle">Elegí las categorías. Después, solo cartas y botones para ir hacia adelante o volver atrás.</p>{Object.entries(vocabInfo).map(([id,info])=><label className="choice" key={id}><input type="checkbox" checked={selected.includes(id)} onChange={event=>{setError('');setSelected(event.target.checked?[...selected,id]:selected.filter(value=>value!==id));}}/><span><strong>{info.icon} {info.name}</strong><small>{info.description}</small></span><span className="count">{info.count} cartas</span></label>)}<p className="config-error" role="alert">{error}</p><button type="submit" className="primary free-start">Ver cartas →</button></form>}</div>;
}
