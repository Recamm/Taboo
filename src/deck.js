export const normalize = value => value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export function validateCards(cards) {
  const ids = new Set(), targets = new Set();
  for (const card of cards) {
    if (!card || typeof card.id !== 'string' || !card.id || ids.has(card.id)) throw new Error('Identificador de carta inválido o repetido');
    if (typeof card.target !== 'string' || !card.target.trim() || typeof card.vocabulary !== 'string') throw new Error('Carta incompleta');
    if (!Array.isArray(card.forbidden) || card.forbidden.length !== 5 || card.forbidden.some(w => typeof w !== 'string' || !w.trim())) throw new Error('Cada carta necesita cinco prohibidas');
    const words = card.forbidden.map(normalize), target = normalize(card.target);
    if (new Set(words).size !== 5 || words.includes(target) || targets.has(target)) throw new Error('Palabra repetida en las cartas');
    ids.add(card.id); targets.add(target);
  }
  return cards;
}
export function shuffle(ids, random = Math.random) {
  const result = [...ids];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export function cycleDeck(ids, last, random = Math.random) {
  const result = shuffle(ids, random);
  if (result.length > 1 && result[0] === last) [result[0], result[1]] = [result[1], result[0]];
  return result;
}
export function selectCards(cards, vocabularies) {
  const seen = new Set();
  return cards.filter(card => {
    const key = normalize(card.target);
    if (!vocabularies.includes(card.vocabulary) || seen.has(key)) return false;
    seen.add(key); return true;
  });
}
