import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createFreeSession,moveFree} from '../src/free.js';
const cards=['general','argentina','tecnologia'].flatMap(id=>JSON.parse(fs.readFileSync(new URL(`../src/data/${id}.json`,import.meta.url))));
test('modo libre incluye exclusivamente las categorías elegidas',()=>{
  const session=createFreeSession(cards,['argentina','tecnologia']);
  assert.equal(session.pool.length,100);assert.equal(new Set(session.history).size,100);
  assert.ok(session.pool.every(id=>id.startsWith('argentina-')||id.startsWith('tecnologia-')));
  assert.throws(()=>createFreeSession(cards,[]),/categoría/);
});
test('atrás recupera la misma carta y siguiente recorre el historial existente',()=>{
  const first=createFreeSession(cards,['general']);
  assert.strictEqual(moveFree(first,-1),first);
  const next=moveFree(first,1),back=moveFree(next,-1),again=moveFree(back,1);
  assert.equal(back.history[back.cursor],first.history[first.cursor]);assert.deepEqual(again,next);
  assert.equal(first.cursor,0);
});
test('al consumir las cartas permite continuar sin repetir inmediatamente y mantiene el historial',()=>{
  const small=cards.slice(0,3);let session=createFreeSession(small,['general'],()=>.5);
  session=moveFree(moveFree(session,1),1);const last=session.history[session.cursor];
  const next=moveFree(session,1,()=>.5);assert.equal(next.history.length,6);assert.notEqual(next.history[next.cursor],last);
  const back=moveFree(next,-1);assert.equal(back.history[back.cursor],last);
});
