// Geometria di un percorso pianificato: tratti a piedi sulla rete, tratti in bus sulle shape, per mostrarlo in mappa.
// Logica pura, senza DOM: usata dall'app e dai test.
import { walkPath } from './walk.js';
import { distanceM } from './schedule.js';

const sq = (v) => v * v;
const d2 = (flat, i, lat, lon) => sq(flat[i] - lat) + sq((flat[i + 1] - lon) * 0.79); // 0.79 ≈ cos(37.8°): basta per confrontare vertici vicini

/**
 * Tratto di una shape (lat, lon appiattiti) fra due fermate: dal vertice più vicino alla fermata di salita
 * al vertice più vicino alla fermata di discesa che la segue. Ritorna [[lat, lon], ...].
 * Le linee circolari passano due volte dallo stesso posto: per questo la discesa si cerca solo dopo la salita.
 */
export function sliceShape(flat, a, b) {
  if (!flat || flat.length < 4) return [[a.lat, a.lon], [b.lat, b.lon]];
  let ia = 0, best = Infinity;
  for (let i = 0; i < flat.length; i += 2) { const d = d2(flat, i, a.lat, a.lon); if (d < best) { best = d; ia = i; } }
  let ib = flat.length - 2; best = Infinity;
  for (let i = ia; i < flat.length; i += 2) { const d = d2(flat, i, b.lat, b.lon); if (d < best) { best = d; ib = i; } }
  const out = [[a.lat, a.lon]];
  for (let i = ia; i <= ib; i += 2) out.push([flat[i], flat[i + 1]]);
  out.push([b.lat, b.lon]);
  return out;
}

/**
 * Geometria di una soluzione di planJourney.
 * @param ctx { from, to }: ciascuno { at: {lat, lon} | null, wm } con `wm` la mappa di walkFrom (null se la scelta era una fermata)
 * Ritorna { legs: [{ kind: 'walk', pts, m, steps, exact } | { kind: 'bus', pts, trip }], from, to, stops: [{ lat, lon, kind }] }
 * con un elemento per ogni leg della soluzione, nello stesso ordine.
 */
export function routeGeometry(data, shapes, option, ctx) {
  const stopAt = (si) => data.stops[si];
  const legs = option.legs;
  const geo = [];
  const marks = [];
  legs.forEach((l, k) => {
    if (l.kind === 'bus') {
      const trip = data.trips[l.trip];
      const a = stopAt(trip.s[l.from]), b = stopAt(trip.s[l.to]);
      geo.push({ kind: 'bus', trip: l.trip, pts: sliceShape(shapes?.[trip.sh], a, b) });
      marks.push({ lat: a.lat, lon: a.lon, kind: 'board' }, { lat: b.lat, lon: b.lon, kind: 'alight' });
      return;
    }
    const nextBus = legs.slice(k + 1).find((x) => x.kind === 'bus');
    const prevBus = legs.slice(0, k).reverse().find((x) => x.kind === 'bus');
    if (!prevBus && nextBus) { // dalla partenza alla prima fermata
      const si = data.trips[nextBus.trip].s[nextBus.from];
      const w = ctx.from?.wm ? walkPath(ctx.from.wm, si) : null;
      geo.push({ kind: 'walk', ...(w ?? straight(ctx.from?.at, stopAt(si))) });
    } else if (prevBus && !nextBus) { // dall'ultima fermata alla meta
      const si = data.trips[prevBus.trip].s[prevBus.to];
      const w = ctx.to?.wm ? walkPath(ctx.to.wm, si) : null;
      const r = w ?? straight(ctx.to?.at, stopAt(si));
      geo.push({ kind: 'walk', ...r, pts: [...r.pts].reverse(), steps: [...r.steps].reverse() });
    } else { // cambio a piedi fra due fermate vicine
      const a = stopAt(data.trips[prevBus.trip].s[prevBus.to]), b = stopAt(data.trips[nextBus.trip].s[nextBus.from]);
      geo.push({ kind: 'walk', ...straight(a, b) });
    }
  });
  return { legs: geo, from: ctx.from?.at ?? null, to: ctx.to?.at ?? null, stops: marks };
}

function straight(a, b) {
  if (!a) return { pts: [], m: 0, steps: [], exact: false };
  return { pts: [[a.lat ?? a[0], a.lon ?? a[1]], [b.lat, b.lon]], m: distanceM(a.lat, a.lon, b.lat, b.lon), steps: [], exact: false };
}

/** Riassunto dei nomi di via di un tratto a piedi: le prime `max` vie con almeno `minM` metri. */
export function streetNames(steps, { max = 3, minM = 25 } = {}) {
  const out = [];
  for (const s of steps) if (s.name && s.m >= minM && !out.includes(s.name)) out.push(s.name);
  return out.slice(0, max);
}
