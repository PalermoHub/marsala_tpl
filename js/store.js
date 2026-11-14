// Preferenze per-persona nel browser. Ogni accesso è protetto: l'app funziona anche senza storage
// (finestra privata, dati bloccati).

const KEY = 'marsala-tpl:v1';
let mem = {};

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) ?? {}; } catch { return mem; }
}

export function get(name, fallback = null) {
  const v = load()[name];
  return v === undefined ? fallback : v;
}

export function set(name, value) {
  const all = { ...load(), [name]: value };
  mem = all;
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* storage non disponibile */ }
}

export function toggleFav(stopId) {
  const favs = get('favs', []);
  const next = favs.includes(stopId) ? favs.filter((x) => x !== stopId) : [stopId, ...favs].slice(0, 12);
  set('favs', next);
  return next.includes(stopId);
}
