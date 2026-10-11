import {selectCards,shuffle,cycleDeck} from './deck.js';
export function createFreeSession(cards,vocabularies,random=Math.random) {
  const pool=selectCards(cards,vocabularies).map(card=>card.id);
  if(!pool.length)throw new Error('Elegí al menos una categoría.');
  return {pool,history:shuffle(pool,random),cursor:0};
}
export function moveFree(session,direction,random=Math.random) {
  if(direction===-1)return session.cursor?{...session,cursor:session.cursor-1}:session;
  if(direction!==1)return session;
  const history=session.cursor+1<session.history.length?session.history:[...session.history,...cycleDeck(session.pool,session.history.at(-1),random)];
  return {...session,history,cursor:session.cursor+1};
}
