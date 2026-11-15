// Ricerca per indirizzo sui civici di Marsala (ANNCSU, dati/indirizzi.json).
// Logica pura, senza DOM: usata dall'app e dai test. Il file viene scaricato solo alla prima ricerca.
// Dati: ANNCSU (Agenzia delle Entrate / ISTAT), estrazione PalermoHub.

const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9/' ]+/g, ' ').replace(/\s+/g, ' ').trim();

/** Decodifica il JSON compatto (coordinate a delta in 1e-5 gradi) in vie con i loro civici. */
export function buildIndirizzi(j) {
  const streets = j.s.map((s) => {
    const civ = [];
    let la = 0, lo = 0;
    for (let i = 0; i < s.c.length; i += 4) {
      la += s.c[i + 2]; lo += s.c[i + 3];
      civ.push({ n: s.c[i], e: j.e[s.c[i + 1]], lat: la / 1e5, lon: lo / 1e5 });
    }
    return { name: s.n, key: norm(s.n), civ };
  });
  return { streets };
}

let loading = null;
export function loadIndirizzi(url = 'dati/indirizzi.json') {
  loading ??= fetch(url)
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => (j && j.v === 1 ? buildIndirizzi(j) : null))
    .catch(() => null)
    .then((d) => { if (!d) loading = null; return d; });
  return loading;
}

/** "via mazzini 12/b" -> { street: 'via mazzini', civico: 12, esp: 'B' }; senza numero civico è null. */
export function parseQuery(q) {
  const s = norm(q);
  const m = s.match(/^(.*?)\s*\b(\d{1,4})\s*(?:\/\s*|\s+)?([a-z]{0,3}\d{0,2})$/);
  if (!m || !m[1]) return { street: s, civico: null, esp: '' };
  return { street: m[1], civico: Number(m[2]), esp: m[3].toUpperCase() };
}

export const civicoLabel = (street, c) => `${street.name} ${c.n}${c.e ? `/${c.e}` : ''}`;

/**
 * Risultati per quello che l'utente sta scrivendo.
 * - solo via (o via con numero parziale): { kind: 'street', street } per le vie, poi i civici
 * - via e numero: { kind: 'civico', label, lat, lon }
 */
export function searchIndirizzi(db, q, { maxStreets = 4, maxCivici = 6 } = {}) {
  const { street, civico, esp } = parseQuery(q);
  if (street.length < 2) return [];
  const words = street.split(' ');
  const hits = db.streets
    .filter((s) => words.every((w) => s.key.split(' ').some((k) => k.startsWith(w))))
    .sort((a, b) => (b.key.startsWith(street) - a.key.startsWith(street)) || (a.key.length - b.key.length));
  if (!hits.length) return [];
  if (civico == null) {
    const out = hits.slice(0, maxStreets).map((s) => ({ kind: 'street', street: s, label: s.name }));
    // una sola via, o una via scritta per intero: mostra subito i primi civici
    const exact = hits.length === 1 || hits[0].key === street;
    if (exact) {
      const s = hits[0];
      for (const c of s.civ.slice(0, maxCivici)) out.push({ kind: 'civico', label: civicoLabel(s, c), lat: c.lat, lon: c.lon });
    }
    return out;
  }
  const out = [];
  for (const s of hits.slice(0, 3)) {
    const num = String(civico);
    const list = s.civ.filter((c) => (esp ? String(c.n) === num && c.e.startsWith(esp) : String(c.n).startsWith(num)));
    // il numero esatto prima dei numeri che iniziano con le stesse cifre
    list.sort((a, b) => (Number(b.n === civico) - Number(a.n === civico)) || a.n - b.n || a.e.localeCompare(b.e));
    for (const c of list) {
      out.push({ kind: 'civico', label: civicoLabel(s, c), lat: c.lat, lon: c.lon });
      if (out.length >= maxCivici) return out;
    }
  }
  return out;
}
