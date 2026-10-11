const PREFIX = 'palabras-prohibidas:';
let warned = false;
export const hasStorageWarning = () => warned;
function warn() {
  if (warned) return; warned = true;
  window.dispatchEvent(new CustomEvent('storage-warning'));
}
export function load(key, fallback = null) {
  try {const raw = localStorage.getItem(PREFIX + key); return raw ? JSON.parse(raw) : fallback;} catch {warn(); return fallback;}
}
export function save(key, value) {
  try {if (value === null) localStorage.removeItem(PREFIX + key); else localStorage.setItem(PREFIX + key, JSON.stringify(value)); return true;} catch {warn(); return false;}
}
