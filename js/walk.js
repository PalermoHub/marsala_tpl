// Distanza a piedi sulla rete stradale (OpenStreetMap, dati/walk.json), al posto della linea d'aria.
// Logica pura, senza DOM: usata dall'app e dai test. La rete viene scaricata solo quando serve la posizione.
// Dati © OpenStreetMap contributors, ODbL.

/** Rapporto mediano tra distanza a piedi e linea d'aria a Marsala (misura del 2026-11-14), usato se la rete non c'è. */
export const DETOUR = 1.39;
const SNAP_MAX = 150;      // oltre questa distanza dalla rete l'utente è "fuori strada": si usa il rapporto
const STOP_SNAP_MAX = 250; // idem per le fermate
const CELL = 0.002;        // ~200 m: griglia per trovare il nodo più vicino

const KY = 110540;
const kxAt = (lat) => 111320 * Math.cos((lat * Math.PI) / 180);

/** Costruisce il grafo (liste di adiacenza compatte) dal JSON di dati/walk.json. */
export function buildGraph(j) {
  const n = j.la.length;
  const lat = new Float64Array(n), lon = new Float64Array(n);
  let a = 0, b = 0;
  for (let i = 0; i < n; i++) { a += j.la[i]; b += j.lo[i]; lat[i] = a / 1e5; lon[i] = b / 1e5; }
  const m = j.e.length / 2;
  const ea = new Int32Array(m), eb = new Int32Array(m);
  let cur = 0;
  for (let i = 0; i < m; i++) { cur += j.e[2 * i]; ea[i] = cur; eb[i] = j.e[2 * i + 1]; }
  const off = new Int32Array(n + 1);
  for (let i = 0; i < m; i++) { off[ea[i] + 1]++; off[eb[i] + 1]++; }
  for (let i = 0; i < n; i++) off[i + 1] += off[i];
  const fill = off.slice(0, n), adj = new Int32Array(2 * m), w = new Float32Array(2 * m);
  for (let i = 0; i < m; i++) {
    const p = ea[i], q = eb[i];
    const len = Math.hypot((lon[q] - lon[p]) * kxAt((lat[p] + lat[q]) / 2), (lat[q] - lat[p]) * KY);
    adj[fill[p]] = q; w[fill[p]++] = len;
    adj[fill[q]] = p; w[fill[q]++] = len;
  }
  const grid = new Map();
  for (let i = 0; i < n; i++) {
    const k = Math.floor(lat[i] / CELL) * 100000 + Math.floor(lon[i] / CELL);
    const c = grid.get(k); if (c) c.push(i); else grid.set(k, [i]);
  }
  return { n, lat, lon, off, adj, w, grid, stopsRef: null, stopNode: null, stopSnap: null };
}

/** Nodo della rete più vicino a un punto: { node, m } oppure null se è oltre maxM. */
export function nearestNode(g, lat, lon, maxM = SNAP_MAX) {
  const ci = Math.floor(lat / CELL), cj = Math.floor(lon / CELL), kx = kxAt(lat);
  let best = -1, bm = Infinity;
  for (let di = -2; di <= 2; di++) for (let dj = -2; dj <= 2; dj++) {
    for (const i of g.grid.get((ci + di) * 100000 + cj + dj) ?? []) {
      const d = Math.hypot((g.lon[i] - lon) * kx, (g.lat[i] - lat) * KY);
      if (d < bm) { bm = d; best = i; }
    }
  }
  return best >= 0 && bm <= maxM ? { node: best, m: bm } : null;
}

function attachStops(g, stops) {
  if (g.stopsRef === stops) return;
  g.stopsRef = stops;
  g.stopNode = new Int32Array(stops.length).fill(-1);
  g.stopSnap = new Float32Array(stops.length);
  stops.forEach((s, i) => {
    const r = nearestNode(g, s.lat, s.lon, STOP_SNAP_MAX);
    if (r) { g.stopNode[i] = r.node; g.stopSnap[i] = r.m; }
  });
}

/**
 * Distanze a piedi da un punto alle fermate, sulla rete stradale.
 * Ritorna Map(indice fermata -> metri) per le fermate raggiunte entro maxM, oppure null se il punto è
 * troppo lontano dalla rete (in quel caso si usa il rapporto DETOUR).
 * La mappa ha una proprietà `offNet`: le fermate troppo lontane dalla rete per essere agganciate, per le quali
 * la rete non può dire nulla. Una fermata né nella mappa né in offNet è sulla rete ma non raggiunta entro maxM.
 */
export function walkFrom(g, stops, lat, lon, maxM = 1500) {
  attachStops(g, stops);
  const o = nearestNode(g, lat, lon, SNAP_MAX);
  if (!o) return null;
  const limit = maxM - o.m;
  const dist = new Float64Array(g.n).fill(Infinity); // Float64: con Float32 l'arrotondamento fa scartare nodi validi
  // Dijkstra con heap binario di coppie (distanza, nodo).
  const hd = [], hn = [];
  const push = (d, v) => {
    let i = hd.length; hd.push(d); hn.push(v);
    while (i > 0) { const p = (i - 1) >> 1; if (hd[p] <= d) break; hd[i] = hd[p]; hn[i] = hn[p]; i = p; }
    hd[i] = d; hn[i] = v;
  };
  const pop = () => {
    const d0 = hd[0], v0 = hn[0], d = hd.pop(), v = hn.pop();
    if (hd.length) {
      let i = 0;
      for (;;) {
        let c = 2 * i + 1; if (c >= hd.length) break;
        if (c + 1 < hd.length && hd[c + 1] < hd[c]) c++;
        if (hd[c] >= d) break;
        hd[i] = hd[c]; hn[i] = hn[c]; i = c;
      }
      hd[i] = d; hn[i] = v;
    }
    return [d0, v0];
  };
  dist[o.node] = 0; push(0, o.node);
  while (hd.length) {
    const [d, v] = pop();
    if (d > dist[v]) continue;
    if (d > limit) break;
    for (let k = g.off[v]; k < g.off[v + 1]; k++) {
      const u = g.adj[k], nd = d + g.w[k];
      if (nd < dist[u] && nd <= limit) { dist[u] = nd; push(nd, u); }
    }
  }
  const out = new Map();
  out.offNet = new Set();
  for (let i = 0; i < stops.length; i++) {
    const s = g.stopNode[i];
    if (s < 0) { out.offNet.add(i); continue; }
    if (dist[s] === Infinity) continue;
    const m = o.m + dist[s] + g.stopSnap[i];
    if (m <= maxM) out.set(i, m);
  }
  return out;
}

/**
 * Funzione (indice fermata, linea d'aria) -> metri a piedi.
 * Rete disponibile: la distanza sulla rete; Infinity se la fermata è sulla rete ma oltre il raggio (non va mostrata come
 * vicina); rapporto DETOUR solo per le fermate che la rete non copre. Senza rete: rapporto DETOUR per tutte.
 */
export const walkDist = (map) => (i, crowM) => {
  if (!map) return crowM * DETOUR;
  if (map.has(i)) return map.get(i);
  return map.offNet?.has(i) ? crowM * DETOUR : Infinity;
};
/** true se la distanza di quella fermata viene dalla rete stradale e non dal rapporto. */
export const isExactWalk = (map, i) => !!map?.has(i);

let loading = null;
/** Scarica la rete una sola volta; ritorna il grafo oppure null (offline senza cache, file assente): allora si usa il rapporto. */
export function loadWalk(url = 'dati/walk.json') {
  loading ??= fetch(url)
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => (j && j.v === 1 ? buildGraph(j) : null))
    .catch(() => null)
    .then((g) => { if (!g) loading = null; return g; });
  return loading;
}
