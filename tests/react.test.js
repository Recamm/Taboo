import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import {build} from 'vite';
import react from '@vitejs/plugin-react';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import * as engine from '../src/game.js';
import {gameReducer} from '../src/reducer.js';

test('reducer inmutable: acciones rápidas, caducidad, deshacer y cambios de turno',()=>{
  const initial=engine.createGame(engine.defaults(),['general-001','general-002','general-003','general-004']);
  const active=gameReducer(initial,{type:'begin',now:1000});
  assert.equal(initial.phase,'ready');assert.equal(active.phase,'active');
  const passed=gameReducer(active,{type:'pass',now:1500});assert.equal(active.passesLeft,2);assert.equal(passed.passesLeft,1);
  assert.strictEqual(gameReducer(passed,{type:'pass',now:1510}),passed);
  const undone=gameReducer(passed,{type:'undo',now:2000});assert.equal(undone.current,active.current);assert.equal(undone.passesLeft,2);
  const expired=gameReducer(undone,{type:'pause',now:61000});assert.equal(expired.phase,'summary');
  const next=gameReducer(expired,{type:'next'});assert.equal(next.phase,'ready');assert.equal(next.cursor,1);
  assert.strictEqual(gameReducer(next,{type:'next'}),next);
  const exhausted={...active,phase:'exhausted',current:null,remaining:50000,deadline:null};
  const recycle={type:'recycle',now:90000,randomValues:exhausted.pool.map(()=>.5)};
  assert.deepEqual(gameReducer(exhausted,recycle),gameReducer(exhausted,recycle));
  assert.equal(exhausted.phase,'exhausted');
});
test('componentes React: cartas ocultas, controles, nombres seguros y configuración',async()=>{
  const root=fileURLToPath(new URL('../',import.meta.url));
  const output=await mkdtemp(path.join(root,'.react-test-'));
  try {
    const built=await build({configFile:false,plugins:[react()],logLevel:'silent',build:{ssr:path.join(root,'src/Screens.jsx'),outDir:output}});
    const results=Array.isArray(built)?built:[built];
    const entry=results.flatMap(result=>result.output).find(chunk=>chunk.type==='chunk'&&chunk.isEntry);
    const ui=await import(pathToFileURL(path.join(output,entry.fileName)).href);
    const game=engine.createGame({...engine.defaults(),names:['<img src=x onerror=1>','B']},['general-001','general-002']);
    engine.beginTurn(game,0);const card={id:game.current,target:'PALABRA SECRETA',vocabulary:'general',forbidden:['a','b','c','d','e']};
    let html=renderToStaticMarkup(React.createElement(ui.GameScreen,{game,card,time:60000,onAction(){},corrections:false}));
    assert.ok(html.includes('PALABRA SECRETA'));assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<img src=x'));
    assert.ok(html.includes('data-action="correct"'));assert.ok(html.includes('data-action="forbidden"'));
    engine.pause(game,500);html=renderToStaticMarkup(React.createElement(ui.GameScreen,{game,card,time:59500,onAction(){},corrections:false}));assert.ok(!html.includes('PALABRA SECRETA'));
    const ready={...game,phase:'ready',current:null};html=renderToStaticMarkup(React.createElement(ui.GameScreen,{game:ready,card:null,time:60000,onAction(){}}));assert.ok(!html.includes('PALABRA SECRETA'));
    const draft={...engine.defaults(),names:['A','a']};html=renderToStaticMarkup(React.createElement(ui.Setup,{draft,setDraft(){},onStart(){},onAction(){},error:''}));assert.ok(html.includes('Ese nombre ya está'));assert.ok(html.includes('Vocabularios'));assert.ok(html.includes('100 cartas'));
  }finally{await rm(output,{recursive:true,force:true});}
});
