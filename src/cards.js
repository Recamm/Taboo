import general from './data/general.json';
import argentina from './data/argentina.json';
import cultura from './data/cultura.json';
import deportes from './data/deportes.json';
import tecnologia from './data/tecnologia.json';
import {validateCards} from './deck.js';
export const cards = validateCards([...general, ...argentina, ...cultura, ...deportes, ...tecnologia]);
export const cardMap = Object.fromEntries(cards.map(card => [card.id, card]));
export const vocabInfo = {
  general: {name:'General',icon:'✦',count:100,description:'Objetos, naturaleza y cosas de todos los días.'},
  argentina: {name:'Argentina',icon:'☀',count:60,description:'Sabores, lugares y palabras bien nuestras.'},
  cultura: {name:'Cultura y entretenimiento',icon:'♫',count:50,description:'Cine, música, arte y juegos.'},
  deportes: {name:'Deportes',icon:'◉',count:50,description:'Disciplinas y la emoción de competir.'},
  tecnologia: {name:'Tecnología',icon:'⌘',count:40,description:'Dispositivos y el mundo digital.'}
};
