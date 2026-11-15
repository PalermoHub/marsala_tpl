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
  const fill = off.slice(0, n), adj = new Int32Array(2 * m), aid = new Int32Array(2 * m), w = new Float32Array(2 * m), elen = new Float64Array(m);
  for (let i = 0; i < m; i++) {
    const p = ea[i], q = eb[i];
    const len = Math.hypot((lon[q] - lon[p]) * kxAt((lat[p] + lat[q]) / 2), (lat[q] - lat[p]) * KY);
    elen[i] = len;
    aid[fill[p]] = i; adj[fill[p]] = q; w[fill[p]++] = len;
    aid[fill[q]] = i; adj[fill[q]] = p; w[fill[q]++] = len;
  }
  const grid = new Map();
  for (let i = 0; i < n; i++) {
    const k = Math.floor(lat[i] / CELL) * 100000 + Math.floor(lon[i] / CELL);
    const c = grid.get(k); if (c) c.push(i); else grid.set(k, [i]);
  }
  // Griglia degli archi: ogni arco è registrato in tutte le celle che il suo riquadro copre (in campagna gli archi sono lunghi).
  const egrid = new Map();
  for (let i = 0; i < m; i++) {
    const p = ea[i], q = eb[i];
    const i0 = Math.floor(Math.min(lat[p], lat[q]) / CELL), i1 = Math.floor(Math.max(lat[p], lat[q]) / CELL);
    const j0 = Math.floor(Math.min(lon[p], lon[q]) / CELL), j1 = Math.floor(Math.max(lon[p], lon[q]) / CELL);
    for (let a2 = i0; a2 <= i1; a2++) for (let b2 = j0; b2 <= j1; b2++) {
      const k = a2 * 100000 + b2, c = egrid.get(k); if (c) c.push(i); else egrid.set(k, [i]);
    }
  }
  return { n, lat, lon, off, adj, aid, w, nm: j.nm ?? [], en: j.en ?? null, grid, ea, eb, elen, egrid, stopsRef: null, stopEdge: null, stopT: null, stopSnap: null };
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

/**
 * Punto più vicino della rete (su un arco, non solo ai nodi): { e, t, m } con t in [0,1] lungo l'arco ea->eb
 * e m la distanza dal punto, oppure null se è oltre maxM. In campagna i nodi distano centinaia di metri:
 * agganciare al nodo allungava il percorso di un tratto che a piedi non si fa.
 */
export function nearestEdge(g, lat, lon, maxM = SNAP_MAX) {
  const ci = Math.floor(lat / CELL), cj = Math.floor(lon / CELL), kx = kxAt(lat);
  let best = null, bm = Infinity;
  const seen = new Set();
  for (let di = -2; di <= 2; di++) for (let dj = -2; dj <= 2; dj++) {
    for (const e of g.egrid.get((ci + di) * 100000 + cj + dj) ?? []) {
      if (seen.has(e)) continue;
      seen.add(e);
      const p = g.ea[e], q = g.eb[e];
      const ax = (g.lon[p] - lon) * kx, ay = (g.lat[p] - lat) * KY, bx = (g.lon[q] - lon) * kx, by = (g.lat[q] - lat) * KY;
      const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
      const t = l2 > 0 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2)) : 0;
      const d = Math.hypot(ax + t * dx, ay + t * dy);
      if (d < bm) { bm = d; best = { e, t, m: d }; }
    }
  }
  return best && bm <= maxM ? best : null;
}

function attachStops(g, stops) {
  if (g.stopsRef === stops) return;
  g.stopsRef = stops;
  g.stopEdge = new Int32Array(stops.length).fill(-1);
  g.stopT = new Float64Array(stops.length);
  g.stopSnap = new Float32Array(stops.length);
  stops.forEach((s, i) => {
    const r = nearestEdge(g, s.lat, s.lon, STOP_SNAP_MAX);
    if (r) { g.stopEdge[i] = r.e; g.stopT[i] = r.t; g.stopSnap[i] = r.m; }
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
  const o = nearestEdge(g, lat, lon, SNAP_MAX);
  if (!o) return null;
  const limit = maxM - o.m;
  const dist = new Float64Array(g.n).fill(Infinity); // Float64: con Float32 l'arrotondamento fa scartare nodi validi
  const prev = new Int32Array(g.n).fill(-1), pe = new Int32Array(g.n).fill(-1); // nodo e arco da cui si è arrivati (per ricostruire il tracciato)
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
  // Si parte da entrambi i capi dell'arco su cui cade il punto.
  const oa = g.ea[o.e], ob = g.eb[o.e], ol = g.elen[o.e];
  dist[oa] = o.t * ol; push(dist[oa], oa);
  dist[ob] = Math.min(dist[ob], (1 - o.t) * ol); push(dist[ob], ob);
  while (hd.length) {
    const [d, v] = pop();
    if (d > dist[v]) continue;
    if (d > limit) break;
    for (let k = g.off[v]; k < g.off[v + 1]; k++) {
      const u = g.adj[k], nd = d + g.w[k];
      if (nd < dist[u] && nd <= limit) { dist[u] = nd; prev[u] = v; pe[u] = g.aid[k]; push(nd, u); }
    }
  }
  const out = new Map();
  out.offNet = new Set();
  out.trace = { g, stops, dist, prev, pe, o, lat, lon };
  for (let i = 0; i < stops.length; i++) {
    const e = g.stopEdge[i];
    if (e < 0) { out.offNet.add(i); continue; }
    const el = g.elen[e], ts = g.stopT[i];
    let d = Math.min(dist[g.ea[e]] + ts * el, dist[g.eb[e]] + (1 - ts) * el);
    if (e === o.e) d = Math.min(d, Math.abs(ts - o.t) * el); // punto e fermata sullo stesso arco
    if (d === Infinity) continue;
    const m = o.m + d + g.stopSnap[i];
    if (m <= maxM) out.set(i, m);
  }
  return out;
}

const mix = (g, e, t) => [g.lat[g.ea[e]] + t * (g.lat[g.eb[e]] - g.lat[g.ea[e]]), g.lon[g.ea[e]] + t * (g.lon[g.eb[e]] - g.lon[g.ea[e]])];

/**
 * Tracciato a piedi dal punto di `walkFrom` alla fermata `i`, sulla rete: { pts: [[lat, lon], ...], m, steps: [{ name, m }] }.
 * `steps` raggruppa i tratti consecutivi con lo stesso nome di via (name '' = senza nome). Se la rete non copre il percorso
 * (fermata fuori rete, oltre il raggio) il tracciato è una linea retta e `exact` è false.
 */
export function walkPath(map, i) {
  const tr = map?.trace;
  const stop = tr?.stops[i];
  if (!tr || !stop) return null;
  const { g, dist, prev, pe, o } = tr;
  const origin = [tr.lat, tr.lon], dest = [stop.lat, stop.lon];
  const e = g.stopEdge[i], ts = g.stopT[i];
  if (e < 0 || !map.has(i)) return { pts: [origin, dest], m: Math.hypot((dest[1] - origin[1]) * kxAt(origin[0]), (dest[0] - origin[0]) * KY), steps: [], exact: false };
  const nameOf = (edge) => (g.en && g.en[edge] ? g.nm[g.en[edge] - 1] : '');
  const segs = [];
  const add = (edge, m) => { if (m > 0.5) segs.push({ name: nameOf(edge), m }); };
  const pts = [origin, mix(g, o.e, o.t)];
  const el = g.elen[e];
  const ca = dist[g.ea[e]] + ts * el, cb = dist[g.eb[e]] + (1 - ts) * el;
  const direct = e === o.e ? Math.abs(ts - o.t) * el : Infinity;
  if (direct <= Math.min(ca, cb)) {
    add(e, direct);
  } else {
    let v = ca <= cb ? g.ea[e] : g.eb[e];
    add(e, ca <= cb ? ts * el : (1 - ts) * el); // ultimo tratto, sull'arco della fermata
    const chain = []; // nodi dalla fermata verso l'origine
    for (let u = v; u >= 0; u = prev[u]) chain.push(u);
    for (let k = 0; k < chain.length - 1; k++) add(pe[chain[k]], g.elen[pe[chain[k]]]);
    const first = chain[chain.length - 1];
    add(o.e, first === g.ea[o.e] ? o.t * g.elen[o.e] : (1 - o.t) * g.elen[o.e]); // primo tratto, sull'arco del punto di partenza
    for (let k = chain.length - 1; k >= 0; k--) pts.push([g.lat[chain[k]], g.lon[chain[k]]]);
    segs.reverse();
  }
  pts.push(mix(g, e, ts), dest);
  const steps = [];
  for (const s of segs) { const last = steps[steps.length - 1]; if (last && last.name === s.name) last.m += s.m; else steps.push({ ...s }); }
  return { pts, m: map.get(i), steps, exact: true };
}

/**
 * Percorso a piedi da un punto a un altro sulla rete: { pts, m, secs, steps } oppure null se uno dei due è fuori rete
 * (oltre SNAP_MAX / STOP_SNAP_MAX) o la distanza supera maxM. Riusa la ricerca di walkFrom con la meta come unica "fermata",
 * lasciando intatta la cache delle fermate dell'app.
 */
export function walkBetween(g, a, b, maxM = 3500, speed = 1.2) {
  const saved = [g.stopsRef, g.stopEdge, g.stopT, g.stopSnap];
  try {
    const wm = walkFrom(g, [{ lat: b.lat, lon: b.lon }], a.lat, a.lon, maxM);
    if (!wm || !wm.has(0)) return null;
    const p = walkPath(wm, 0);
    return p?.exact ? { pts: p.pts, m: p.m, secs: Math.round(p.m / speed), steps: p.steps } : null;
  } finally {
    [g.stopsRef, g.stopEdge, g.stopT, g.stopSnap] = saved;
  }
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
    .then((j) => (j && (j.v === 1 || j.v === 2) ? buildGraph(j) : null))
    .catch(() => null)
    .then((g) => { if (!g) loading = null; return g; });
  return loading;
}
