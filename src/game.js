import { normalize, shuffle, cycleDeck } from './deck.js';
export const VOCABULARIES = ['general', 'argentina', 'cultura', 'deportes', 'tecnologia'];
export const defaults = () => ({names: ['Equipo 1', 'Equipo 2'], seconds: 60, rounds: 5, penalty: 'subtract', vocabularies: ['general'], sound: true});
const copy = value => JSON.parse(JSON.stringify(value));
const blankStats = () => ({correct: 0, forbidden: 0, passes: 0});
export function validateConfig(config) {
  if (!config || !Array.isArray(config.names) || config.names.length < 2 || config.names.length > 8) throw new Error('Elegí entre 2 y 8 equipos.');
  const names = config.names.map((n, i) => typeof n === 'string' ? (n.trim() || `Equipo ${i + 1}`) : '');
  if (names.some(n => !n || n.length > 24)) throw new Error('Los nombres admiten hasta 24 caracteres.');
  if (new Set(names.map(normalize)).size !== names.length) throw new Error('Cada equipo necesita un nombre diferente.');
  if (!Number.isInteger(config.seconds) || config.seconds < 15 || config.seconds > 300 || config.seconds % 15) throw new Error('El tiempo debe ser de 15 a 300 segundos, en pasos de 15.');
  if (!Number.isInteger(config.rounds) || config.rounds < 1 || config.rounds > 20) throw new Error('Elegí entre 1 y 20 rondas.');
  if (!['subtract', 'rival'].includes(config.penalty)) throw new Error('Elegí una penalización.');
  if (!Array.isArray(config.vocabularies) || !config.vocabularies.length || config.vocabularies.some(v => !VOCABULARIES.includes(v)) || new Set(config.vocabularies).size !== config.vocabularies.length) throw new Error('Elegí al menos un vocabulario válido.');
  if (typeof config.sound !== 'boolean') throw new Error('Ajuste de sonido inválido.');
  return {...config, names};
}
export function createGame(config, ids, random = Math.random) {
  config = validateConfig(config);
  if (!ids.length || new Set(ids).size !== ids.length) throw new Error('El mazo no es válido.');
  return {version: 1, config: copy(config), teams: config.names.map((name, id) => ({id, name, score: 0})), order: config.names.map((_, i) => i), cursor: 0, round: 1, overtime: 0, phase: 'ready', pool: [...ids], deck: shuffle(ids, random), deckIndex: 0, cycle: 1, current: null, last: null, passesLeft: 2, stats: blankStats(), events: [], corrections: [], startScores: config.names.map(() => 0), remaining: config.seconds * 1000, deadline: null, undo: null, lastActionAt: null, warningPlayed: false};
}
export const currentTeam = state => state.teams[state.order[state.cursor]];
export const rivalTeam = state => state.teams[state.order[(state.cursor + 1) % state.order.length]];
export const remainingTime = (state, now = Date.now()) => state.phase === 'active' ? Math.max(0, state.deadline - now) : state.remaining;
function draw(state) {
  if (state.deckIndex >= state.deck.length) {state.current = null; return false;}
  state.current = state.deck[state.deckIndex++]; state.last = state.current; return true;
}
export function beginTurn(state, now = Date.now()) {
  if (state.phase !== 'ready') return false;
  state.remaining = state.config.seconds * 1000;
  state.deadline = now + state.remaining;
  state.phase = 'active';
  if (!draw(state)) {state.phase = 'exhausted'; state.deadline = null;}
  return true;
}
export function finishTurn(state) {
  if (!['active', 'paused', 'exhausted'].includes(state.phase)) return false;
  state.phase = 'summary'; state.remaining = 0; state.deadline = null; state.current = null; state.undo = null; return true;
}
export function expire(state, now = Date.now()) {
  if (state.phase === 'active' && now >= state.deadline) return finishTurn(state);
  return false;
}
export function act(state, action, now = Date.now()) {
  if (expire(state, now) || state.phase !== 'active' || !['correct', 'forbidden', 'pass'].includes(action)) return false;
  if (state.lastActionAt !== null && now - state.lastActionAt < 320) return false;
  if (action === 'pass' && state.passesLeft === 0) return false;
  state.undo = {scores: state.teams.map(t => t.score), current: state.current, deckIndex: state.deckIndex, last: state.last, passesLeft: state.passesLeft, stats: copy(state.stats), events: copy(state.events)};
  const team = currentTeam(state), rival = rivalTeam(state);
  if (action === 'correct') {team.score++; state.stats.correct++;}
  if (action === 'forbidden') {state.stats.forbidden++; if (state.config.penalty === 'subtract') team.score--; else rival.score++;}
  if (action === 'pass') {state.passesLeft--; state.stats.passes++;}
  state.events.push({card: state.current, action}); state.lastActionAt = now;
  if (!draw(state)) {state.remaining = remainingTime(state, now); state.deadline = null; state.phase = 'exhausted'; state.undo = null;}
  return true;
}
export function undoAction(state, now = Date.now()) {
  if (expire(state, now) || state.phase !== 'active' || !state.undo || (state.lastActionAt !== null && now - state.lastActionAt < 320)) return false;
  const old = state.undo;
  state.teams.forEach((t, i) => {t.score = old.scores[i];});
  for (const key of ['current', 'deckIndex', 'last', 'passesLeft', 'stats', 'events']) state[key] = copy(old[key]);
  state.undo = null; state.lastActionAt = now; return true;
}
export function pause(state, now = Date.now()) {
  if (expire(state, now) || state.phase !== 'active') return false;
  state.remaining = remainingTime(state, now); state.deadline = null; state.phase = 'paused'; return true;
}
export function resume(state, now = Date.now()) {
  if (state.phase !== 'paused') return false;
  state.deadline = now + state.remaining; state.phase = 'active'; return true;
}
export function recycle(state, now = Date.now(), random = Math.random) {
  if (state.phase !== 'exhausted') return false;
  state.deck = cycleDeck(state.pool, state.last, random); state.deckIndex = 0; state.cycle++; state.undo = null;
  draw(state); state.deadline = now + state.remaining; state.phase = 'active'; return true;
}
export function correctScore(state, id, delta) {
  if (state.phase !== 'summary' || !state.teams[id] || !Number.isInteger(delta) || Math.abs(delta) !== 1) return false;
  state.teams[id].score += delta; state.corrections.push({id, delta}); return true;
}
export function advance(state) {
  if (state.phase !== 'summary') return false;
  if (state.cursor + 1 < state.order.length) state.cursor++;
  else if (!state.overtime && state.round < state.config.rounds) {state.cursor = 0; state.round++;}
  else {state.phase = 'final'; return true;}
  resetTurn(state); return true;
}
function resetTurn(state) {
  state.phase = 'ready'; state.current = null; state.passesLeft = 2; state.stats = blankStats(); state.events = []; state.corrections = [];
  state.startScores = state.teams.map(t => t.score); state.remaining = state.config.seconds * 1000; state.deadline = null; state.undo = null; state.lastActionAt = null; state.warningPlayed = false;
}
export function leaders(state) {
  const best = Math.max(...state.teams.map(t => t.score)); return state.teams.filter(t => t.score === best);
}
export function startTiebreak(state) {
  const tied = leaders(state);
  if (state.phase !== 'final' || tied.length < 2) return false;
  state.order = tied.map(t => t.id); state.cursor = 0; state.overtime++; resetTurn(state); return true;
}
export function validSavedGame(state, validIds, cardMap = null) {
  try {
    if (!state || state.version !== 1) return false;
    const config = validateConfig(state.config);
    const phases = ['ready', 'active', 'paused', 'exhausted', 'summary', 'final'];
    if (!phases.includes(state.phase) || !Array.isArray(state.teams) || state.teams.length !== config.names.length || state.teams.some((t, i) => t.id !== i || t.name !== config.names[i] || !Number.isInteger(t.score))) return false;
    if (!Array.isArray(state.order) || state.order.length < 2 || new Set(state.order).size !== state.order.length || state.order.some(id => !state.teams[id])) return false;
    if (!Number.isInteger(state.cursor) || state.cursor < 0 || state.cursor >= state.order.length || !Number.isInteger(state.round) || state.round < 1 || state.round > config.rounds || !Number.isInteger(state.overtime) || state.overtime < 0) return false;
    if (!state.overtime && (state.order.length !== state.teams.length || state.order.some((id, i) => id !== i))) return false;
    if (!Array.isArray(state.pool) || !state.pool.length || new Set(state.pool).size !== state.pool.length || state.pool.some(id => !validIds.has(id) || (cardMap && !config.vocabularies.includes(cardMap[id]?.vocabulary)))) return false;
    if (!Array.isArray(state.deck) || state.deck.length !== state.pool.length || new Set(state.deck).size !== state.deck.length || state.deck.some(id => !state.pool.includes(id)) || !Number.isInteger(state.deckIndex) || state.deckIndex < 0 || state.deckIndex > state.deck.length) return false;
    if (!Number.isInteger(state.cycle) || state.cycle < 1 || !Number.isFinite(state.remaining) || state.remaining < 0 || state.remaining > config.seconds * 1000) return false;
    if (state.phase === 'active' && !Number.isFinite(state.deadline)) return false;
    if (state.phase !== 'active' && state.deadline !== null) return false;
    if (state.last !== null && !state.pool.includes(state.last)) return false;
    if (state.lastActionAt !== null && !Number.isFinite(state.lastActionAt)) return false;
    if (typeof state.warningPlayed !== 'boolean') return false;
    if (['active', 'paused'].includes(state.phase) && (!state.pool.includes(state.current) || state.deck[state.deckIndex - 1] !== state.current)) return false;
    if (!['active', 'paused'].includes(state.phase) && state.current !== null) return false;
    if (!Number.isInteger(state.passesLeft) || state.passesLeft < 0 || state.passesLeft > 2 || !state.stats || ['correct', 'forbidden', 'passes'].some(k => !Number.isInteger(state.stats[k]) || state.stats[k] < 0) || state.stats.passes + state.passesLeft !== 2) return false;
    if (!Array.isArray(state.startScores) || state.startScores.length !== state.teams.length || state.startScores.some(s => !Number.isInteger(s)) || !Array.isArray(state.events) || !Array.isArray(state.corrections)) return false;
    if (state.events.some(e => !state.pool.includes(e.card) || !['correct', 'forbidden', 'pass'].includes(e.action)) || state.corrections.some(c => !state.teams[c.id] || ![-1, 1].includes(c.delta))) return false;
    if (state.undo) {
      const u = state.undo;
      if (!Array.isArray(u.scores) || u.scores.length !== state.teams.length || u.scores.some(s => !Number.isInteger(s)) || !state.pool.includes(u.current) || !Number.isInteger(u.deckIndex) || u.deckIndex < 1 || u.deckIndex > state.deck.length || state.deck[u.deckIndex - 1] !== u.current || !Number.isInteger(u.passesLeft) || u.passesLeft < 0 || u.passesLeft > 2 || !u.stats || !Array.isArray(u.events)) return false;
      if (!state.pool.includes(u.last) || ['correct', 'forbidden', 'passes'].some(k => !Number.isInteger(u.stats[k]) || u.stats[k] < 0) || u.stats.passes + u.passesLeft !== 2 || u.events.some(evt => !state.pool.includes(evt.card) || !['correct', 'forbidden', 'pass'].includes(evt.action))) return false;
    }
    return true;
  } catch {return false;}
}
