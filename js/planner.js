// Pianificatore di percorso: corse dirette o con un solo cambio, sugli orari programmati.
// Logica pura, senza DOM, usata dall'app e dai test.
import { activeSet, addDays, distanceM, siblingStops } from './schedule.js';

const WALK_SPEED = 1.2;        // m/s
const MAX_TRANSFER_M = 250;    // cambio a piedi fra fermate vicine
const BUFFER_SAME_STOP = 120;  // s di margine per cambiare alla stessa fermata
const BUFFER_WALK = 60;        // s di margine in più quando si cammina

/** Tutte le fermate "dello stesso posto": la fermata e quelle sull'altro senso di marcia. */
export const groupOf = (data, si) => [si, ...siblingStops(data, si)];

/** Fermate raggiungibili a piedi da un punto, con il tempo di cammino in secondi. */
export function walkable(data, lat, lon, maxM = 800, n = 4) {
  return data.stops
    .map((s, i) => ({ stop: i, m: distanceM(lat, lon, s.lat, s.lon) }))
    .filter((x) => x.m <= maxM)
    .sort((a, b) => a.m - b.m)
    .slice(0, n)
    .map((x) => ({ stop: x.stop, walk: Math.round(x.m / WALK_SPEED) }));
}

/**
 * @param from  [{ stop, walk }]  fermate di partenza, walk = secondi a piedi per raggiungerle
 * @param to    [{ stop, walk }]  fermate di arrivo, walk = secondi a piedi dalla fermata alla meta
 * @param ymd, secs               giorno e ora di partenza (Europe/Rome)
 * Ritorna al massimo `limit` opzioni { start, end, transfers, legs }, in ordine di partenza.
 * legs: { kind: 'walk', secs } oppure { kind: 'bus', trip, from, to, dep, arr } (from/to = posizioni nella corsa).
 */
export function planJourney(data, index, { from, to, ymd, secs, limit = 4 }) {
  const days = [activeSet(data, ymd), activeSet(data, addDays(ymd, -1))]; // la seconda dà le corse oltre la mezzanotte
  const offsCache = new Map();
  const offsOf = (ti) => {
    let o = offsCache.get(ti);
    if (!o) {
      const v = data.trips[ti].v;
      o = [];
      if (days[0].has(v)) o.push(0);
      if (days[1].has(v)) o.push(86400);
      offsCache.set(ti, o);
    }
    return o;
  };

  const toMap = new Map();
  for (const x of to) if (!toMap.has(x.stop) || toMap.get(x.stop) > x.walk) toMap.set(x.stop, x.walk);
  // Per ogni corsa: dove si può scendere per arrivare alla meta.
  const destPos = new Map();
  data.trips.forEach((trip, ti) => {
    trip.s.forEach((si, pos) => {
      if (toMap.has(si)) {
        if (!destPos.has(ti)) destPos.set(ti, []);
        destPos.get(ti).push({ pos, walk: toMap.get(si) });
      }
    });
  });

  /** Miglior discesa per la meta su una corsa salendo alla posizione `pos`. */
  const bestExit = (ti, pos, off) => {
    let best = null;
    for (const q of destPos.get(ti) ?? []) {
      if (q.pos <= pos) continue;
      const arr = data.trips[ti].t[q.pos] - off;
      if (!best || arr + q.walk < best.arr + best.walk) best = { pos: q.pos, arr, walk: q.walk };
    }
    return best;
  };

  const nbCache = new Map();
  const neighbours = (si) => {
    let l = nbCache.get(si);
    if (!l) {
      const s = data.stops[si];
      l = [{ stop: si, walk: 0 }];
      data.stops.forEach((o, i) => {
        if (i === si) return;
        const m = distanceM(s.lat, s.lon, o.lat, o.lon);
        if (m <= MAX_TRANSFER_M) l.push({ stop: i, walk: Math.round(m / WALK_SPEED) });
      });
      nbCache.set(si, l);
    }
    return l;
  };
  // Partenze da una fermata, solo di corse che poi arrivano alla meta.
  const feedCache = new Map();
  const feeders = (si) => {
    let l = feedCache.get(si);
    if (!l) { l = (index.get(si) ?? []).filter((e) => destPos.has(e.trip)); feedCache.set(si, l); }
    return l;
  };

  const options = [];
  const busLeg = (ti, from_, to_, off) => ({ kind: 'bus', trip: ti, from: from_, to: to_, dep: data.trips[ti].t[from_] - off, arr: data.trips[ti].t[to_] - off });
  const walkLeg = (s) => (s > 0 ? [{ kind: 'walk', secs: s }] : []);

  for (const o of from) {
    const ready = secs + o.walk;
    for (const e of index.get(o.stop) ?? []) {
      const trip1 = data.trips[e.trip];
      for (const off of offsOf(e.trip)) {
        const dep = e.t - off;
        if (dep < ready) continue;

        const direct = bestExit(e.trip, e.pos, off);
        if (direct) {
          options.push({ start: dep - o.walk, end: direct.arr + direct.walk, transfers: 0, legs: [...walkLeg(o.walk), busLeg(e.trip, e.pos, direct.pos, off), ...walkLeg(direct.walk)] });
          continue; // se c'è la diretta, il cambio per questa corsa non serve
        }

        // Un cambio: scendo in k, (a piedi) raggiungo Y, salgo su una seconda corsa che arriva alla meta.
        let best = null;
        for (let k = e.pos + 1; k < trip1.s.length; k++) {
          const arr1 = trip1.t[k] - off;
          for (const nb of neighbours(trip1.s[k])) {
            const ready2 = arr1 + nb.walk + (nb.walk === 0 ? BUFFER_SAME_STOP : BUFFER_WALK);
            const seen = new Set();
            for (const f of feeders(nb.stop)) {
              if (f.trip === e.trip) continue;
              const r2 = data.trips[f.trip].r;
              if (seen.has(r2)) continue;
              for (const off2 of offsOf(f.trip)) {
                if (f.t - off2 < ready2) continue;
                const ex = bestExit(f.trip, f.pos, off2);
                if (!ex) continue;
                seen.add(r2);
                const end = ex.arr + ex.walk;
                if (!best || end < best.end) {
                  best = { start: dep - o.walk, end, transfers: 1, legs: [...walkLeg(o.walk), busLeg(e.trip, e.pos, k, off), ...walkLeg(nb.walk), busLeg(f.trip, f.pos, ex.pos, off2), ...walkLeg(ex.walk)] };
                }
                break;
              }
            }
          }
        }
        if (best) options.push(best);
      }
    }
  }

  // Si tengono solo le opzioni non superate: una è superata se un'altra parte dopo (o insieme),
  // arriva prima (o insieme) e non ha più cambi. Un cambio che fa risparmiare meno di 5 minuti
  // rispetto a una diretta che parte dopo non vale la scomodità.
  const dominated = (b) => options.some((a) => a !== b && (
    (a.start >= b.start && a.end <= b.end && a.transfers <= b.transfers && (a.start > b.start || a.end < b.end || a.transfers < b.transfers))
    || (a.transfers < b.transfers && a.start >= b.start && a.end <= b.end + 300)
  ));
  const seenKey = new Set();
  return options
    .filter((b) => !dominated(b))
    .filter((b) => { const k = b.legs.filter((l) => l.kind === 'bus').map((l) => `${l.trip}:${l.from}`).join('|'); if (seenKey.has(k)) return false; seenKey.add(k); return true; })
    .sort((a, b) => a.start - b.start || a.end - b.end)
    .slice(0, limit);
}
