import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as g from '../src/game.js';
import {validateCards, normalize, selectCards, cycleDeck} from '../src/deck.js';
const cards = g.VOCABULARIES.flatMap(id => JSON.parse(fs.readFileSync(new URL(`../src/data/${id}.json`,import.meta.url))));
const pool = cards.filter(c=>c.vocabulary==='general').map(c=>c.id);
const create = (config = {}, ids = pool) => g.createGame({...g.defaults(),...config},ids,()=>.5);
const scores = s => s.teams.map(t=>t.score);
const validIds = new Set(cards.map(c=>c.id));
const cardMap = Object.fromEntries(cards.map(c=>[c.id,c]));

test('300 cartas originales: cantidad, identificadores, cinco prohibidas y objetivos únicos',()=>{
  assert.equal(validateCards(cards).length,300);
  assert.deepEqual(g.VOCABULARIES.map(v=>cards.filter(c=>c.vocabulary===v).length),[100,60,50,50,40]);
  assert.equal(new Set(cards.map(c=>normalize(c.target))).size,300);
});
test('validador rechaza cartas incompletas y objetivos/prohibidas duplicados',()=>{
  const c = {id:'x',target:'Árbol',forbidden:['Raíz','Tierra','Hoja','Bosque','Madera'],vocabulary:'general'};
  assert.throws(()=>validateCards([{...c,forbidden:['ÁRBOL','Tierra','Hoja','Bosque','Madera']}]));
  assert.throws(()=>validateCards([{...c,forbidden:['Raíz','RAIZ','Hoja','Bosque','Madera']}]));
  assert.throws(()=>validateCards([c,{...c,id:'y',target:'arbol'}]));
  assert.throws(()=>validateCards([{...c,forbidden:['Hoja']}]));
});
test('configuración: límites, nombres vacíos, duplicados, intervalos y vocabularios',()=>{
  assert.deepEqual(g.validateConfig({...g.defaults(),names:['','Azul']}).names,['Equipo 1','Azul']);
  for(const change of [{names:['a']},{names:['Ázul','azul']},{seconds:10},{seconds:61},{seconds:301},{rounds:0},{rounds:2.5},{vocabularies:[]},{vocabularies:['foo']},{penalty:'both'},{sound:'yes'},{names:Array(9).fill('a')}]) assert.throws(()=>g.validateConfig({...g.defaults(),...change}));
});
test('selección múltiple incluye solo vocabularios elegidos',()=>{
  const selected=selectCards(cards,['argentina','tecnologia']);
  assert.equal(selected.length,100);assert.ok(selected.every(c=>['argentina','tecnologia'].includes(c.vocabulary)));
});
test('el turno empieza con carta oculta y dos pases; acierto suma y conserva vencimiento',()=>{
  const s=create(); assert.equal(s.current,null);g.beginTurn(s,1000);
  const deadline=s.deadline,card=s.current;
  assert.equal(s.passesLeft,2);assert.ok(g.act(s,'correct',1500));assert.equal(s.teams[0].score,1);
  assert.notEqual(s.current,card);assert.equal(s.deadline,deadline);assert.equal(s.passesLeft,2);
});
test('resta solo al equipo actual y permite negativo',()=>{
  const s=create();g.beginTurn(s,1000);g.act(s,'forbidden',1500);
  assert.deepEqual(scores(s),[-1,0]);assert.equal(s.passesLeft,2);
});
test('receptor circular con tres equipos en modo rival',()=>{
  const s=create({names:['A','B','C'],penalty:'rival',rounds:1});
  for(let i=0;i<3;i++) {g.beginTurn(s,1000+i*70000);g.act(s,'forbidden',1500+i*70000);assert.equal(g.rivalTeam(s).id,(i+1)%3);g.expire(s,62000+i*70000);g.advance(s);}
  assert.deepEqual(scores(s),[1,1,1]);assert.equal(s.phase,'final');
});
test('dos pases en todo el turno, aciertos no los devuelven, tercer pase no cambia carta',()=>{
  const s=create();g.beginTurn(s,1000);
  g.act(s,'pass',1500);g.act(s,'correct',2000);g.act(s,'pass',2500);
  const card=s.current,index=s.deckIndex;
  assert.equal(s.passesLeft,0);assert.equal(s.stats.passes,2);
  assert.equal(g.act(s,'pass',3000),false);assert.equal(s.current,card);assert.equal(s.deckIndex,index);
  assert.deepEqual(scores(s),[1,0]);g.expire(s,61000);g.advance(s);assert.equal(s.passesLeft,2);
});
test('deshacer restaura carta, pase y posición; la siguiente vuelve a ser la misma y no devuelve tiempo',()=>{
  const s=create();g.beginTurn(s,1000);const original=s.current,deadline=s.deadline;
  g.act(s,'pass',2000);const next=s.current;
  assert.ok(g.undoAction(s,2500));assert.equal(s.current,original);assert.equal(s.passesLeft,2);assert.equal(s.deadline,deadline);assert.equal(s.undo,null);
  assert.equal(g.undoAction(s,3000),false);g.act(s,'correct',3500);assert.equal(s.current,next);
});
test('deshacer infracción revierte el punto del rival',()=>{
  const s=create({penalty:'rival'});g.beginTurn(s,1000);const card=s.current;
  g.act(s,'forbidden',1500);assert.deepEqual(scores(s),[0,1]);g.undoAction(s,2000);
  assert.deepEqual(scores(s),[0,0]);assert.equal(s.stats.forbidden,0);assert.equal(s.current,card);
});
test('doble toque no resuelve dos cartas; 320 ms permiten la próxima acción',()=>{
  const s=create();g.beginTurn(s,1000);g.act(s,'correct',1500);const card=s.current;
  assert.equal(g.act(s,'correct',1510),false);assert.equal(s.current,card);assert.equal(s.teams[0].score,1);
  assert.equal(g.act(s,'correct',1820),true);assert.equal(s.teams[0].score,2);
});
test('vencimiento bloquea acciones y deshacer; no penaliza la carta pendiente',()=>{
  const s=create();g.beginTurn(s,1000);assert.equal(g.act(s,'correct',61000),false);
  assert.equal(s.phase,'summary');assert.deepEqual(scores(s),[0,0]);assert.equal(s.current,null);
  assert.equal(g.expire(s,62000),false);assert.equal(g.act(s,'forbidden',62000),false);assert.equal(g.undoAction(s,62000),false);
});
test('recargar conserva mazo, puntos y vencimiento; el segundo plano no congela reloj',()=>{
  const s=create();g.beginTurn(s,1000);g.act(s,'correct',2000);
  const restored=JSON.parse(JSON.stringify(s));assert.ok(g.validSavedGame(restored,validIds,cardMap));
  assert.equal(g.remainingTime(restored,30000),31000);assert.deepEqual(restored.deck,s.deck);assert.equal(restored.current,s.current);
  assert.ok(g.expire(restored,61001));assert.deepEqual(scores(restored),[1,0]);
});
test('pausa conserva carta y cupo; reanudación crea nuevo vencimiento',()=>{
  const s=create();g.beginTurn(s,1000);g.act(s,'pass',1500);const card=s.current;
  assert.ok(g.pause(s,11000));assert.equal(s.remaining,50000);assert.equal(g.expire(s,999999),false);
  assert.equal(g.act(s,'correct',13000),false);assert.ok(g.resume(s,100000));assert.equal(s.deadline,150000);
  assert.equal(s.current,card);assert.equal(s.passesLeft,1);
});
test('tres equipos y dos rondas juegan exactamente seis turnos, confirmación duplicada no avanza',()=>{
  const s=create({names:['A','B','C'],rounds:2});const turns=[];
  for(let i=0;i<6;i++){turns.push([s.round,g.currentTeam(s).id]);assert.equal(s.current,null);g.beginTurn(s,i*70000);g.expire(s,i*70000+60000);assert.ok(g.advance(s));assert.equal(g.advance(s),false);}
  assert.deepEqual(turns,[[1,0],[1,1],[1,2],[2,0],[2,1],[2,2]]);assert.equal(s.phase,'final');
});
test('mazo agotado congela reloj y recicla conservando puntajes/pases sin repetición inmediata',()=>{
  const s=create({},pool.slice(0,3));g.beginTurn(s,1000);
  g.act(s,'pass',1500);g.act(s,'pass',2000);g.act(s,'correct',2500);
  assert.equal(s.phase,'exhausted');assert.equal(s.remaining,58500);assert.equal(s.undo,null);assert.equal(s.passesLeft,0);
  const last=s.last;g.recycle(s,100000,()=>.5);assert.notEqual(s.current,last);assert.equal(s.cycle,2);
  assert.equal(s.deadline,158500);assert.equal(s.passesLeft,0);assert.deepEqual(scores(s),[1,0]);
  assert.equal(g.undoAction(s,100001),false);
});
test('carta pendiente al vencer queda consumida; mazo agotado entre turnos avisa antes de repetir',()=>{
  const s=create({},pool.slice(0,1));g.beginTurn(s,0);g.expire(s,60000);g.advance(s);g.beginTurn(s,70000);
  assert.equal(s.phase,'exhausted');assert.equal(s.current,null);assert.equal(s.remaining,60000);
  g.recycle(s,80000);assert.equal(s.deadline,140000);assert.equal(s.current,pool[0]);
});
test('Fisher–Yates mantiene todas las cartas, sin repetir inmediatamente en nuevo ciclo',()=>{
  for(let i=0;i<30;i++){const deck=cycleDeck(pool,pool[0]);assert.equal(new Set(deck).size,pool.length);assert.notEqual(deck[0],pool[0]);}
});
test('corrección manual solo en resumen y registro separado del resultado automático',()=>{
  const s=create();assert.equal(g.correctScore(s,0,1),false);g.beginTurn(s,0);g.act(s,'correct',500);g.expire(s,60000);
  assert.ok(g.correctScore(s,0,-1));assert.ok(g.correctScore(s,1,1));assert.equal(s.stats.correct,1);
  assert.deepEqual(scores(s),[0,1]);assert.deepEqual(s.corrections,[{id:0,delta:-1},{id:1,delta:1}]);
  g.advance(s);assert.equal(s.corrections.length,0);assert.deepEqual(s.startScores,[0,1]);
});
test('desempate incluye solo líderes y rival circular entre ellos; todos juegan antes de evaluar',()=>{
  const s=create({names:['A','B','C','D'],rounds:1,penalty:'rival'});s.phase='final';s.teams[0].score=5;s.teams[2].score=5;
  assert.ok(g.startTiebreak(s));assert.deepEqual(s.order,[0,2]);assert.equal(g.rivalTeam(s).id,2);
  g.beginTurn(s,0);g.act(s,'correct',500);g.expire(s,60000);g.advance(s);
  assert.equal(s.phase,'ready');assert.equal(g.currentTeam(s).id,2);assert.equal(g.rivalTeam(s).id,0);
  g.beginTurn(s,70000);g.expire(s,130000);g.advance(s);assert.equal(s.phase,'final');
  assert.deepEqual(g.leaders(s).map(t=>t.id),[0]);assert.equal(g.startTiebreak(s),false);
});
test('empate repetido ofrece otra ronda de desempate con puntos conservados',()=>{
  const s=create({rounds:1});s.phase='final';
  for(let round=1;round<=2;round++){assert.ok(g.startTiebreak(s));assert.equal(s.overtime,round);for(let i=0;i<2;i++){g.beginTurn(s,0);g.expire(s,60000);g.advance(s);}assert.equal(s.phase,'final');}
});
test('guardado inválido se rechaza en vez de restaurar estado imposible',()=>{
  const good=create();assert.ok(g.validSavedGame(good,validIds,cardMap));
  for(const change of [{version:2},{phase:'bad'},{passesLeft:4},{deckIndex:999},{pool:['bad']},{order:[0,0]},{cursor:30},{round:0},{remaining:-1},{startScores:[]},{stats:{correct:0,forbidden:0,passes:2}},{cycle:0}]) assert.equal(g.validSavedGame({...good,...change},validIds,cardMap),false);
  g.beginTurn(good,0);g.act(good,'pass',500);assert.ok(g.validSavedGame(good,validIds,cardMap));
  const broken=JSON.parse(JSON.stringify(good));delete broken.undo.last;assert.equal(g.validSavedGame(broken,validIds,cardMap),false);
});
