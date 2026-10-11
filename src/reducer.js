import * as engine from './game.js';

export function gameReducer(state, action) {
  if (action.type === 'replace') return action.game;
  if (action.type === 'clear') return null;
  if (!state) return state;
  const next = structuredClone(state);
  let changed = false;
  switch (action.type) {
    case 'begin': changed = engine.beginTurn(next, action.now); break;
    case 'correct': case 'forbidden': case 'pass': changed = engine.act(next, action.type, action.now); break;
    case 'undo': changed = engine.undoAction(next, action.now); break;
    case 'pause': changed = engine.pause(next, action.now); break;
    case 'resume': changed = engine.resume(next, action.now); break;
    case 'expire': changed = engine.expire(next, action.now); break;
    case 'recycle': {
      if (!Array.isArray(action.randomValues) || action.randomValues.length < next.pool.length) return state;
      let index = 0;
      changed = engine.recycle(next, action.now, () => action.randomValues[index++]);
      break;
    }
    case 'adjust': changed = engine.correctScore(next, action.id, action.delta); break;
    case 'next': changed = engine.advance(next); break;
    case 'tiebreak': changed = engine.startTiebreak(next); break;
    case 'warning': if (!next.warningPlayed && next.phase === 'active') {next.warningPlayed = true; changed = true;} break;
  }
  return changed || next.phase !== state.phase ? next : state;
}
