// Stima della linea di un mezzo: il feed RT non porta la route, quindi la si deduce dalla posizione e dalla direzione.
// Si assegna una linea solo se è l'unica compatibile; altrimenti il mezzo resta senza linea (mai una scelta a caso).

const MAX_DIST_M = 25;        // distanza massima dal tracciato
const MAX_ANGLE = 50;         // scarto massimo tra rotta del mezzo e direzione del tracciato (gradi)
const KEEP_DIST_M = 45;       // tolleranza per mantenere la linea già riconosciuta

const KX = (lat) => 111320 * Math.cos(lat * Math.PI / 180);
const KY = 110540;

/** Prepara i tracciati: un elenco di polilinee in coordinate [lat, lon] con la route di ciascuna. */
export function buildRouteLines(data, shapes) {
  const seen = new Set();
  const lines = [];
  for (const trip of data.trips) {
    if (!trip.sh || seen.has(trip.sh) || !shapes[trip.sh]) continue;
    seen.add(trip.sh);
    lines.push({ r: trip.r, sh: trip.sh, flat: shapes[trip.sh] });
  }
  return lines;
}

const angleDiff = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

/** Miglior segmento di una polilinea: distanza in metri e direzione (gradi da nord) del segmento. */
function nearest(flat, lat, lon) {
  const kx = KX(lat);
  let best = { d: Infinity, bearing: 0, along: 0 };
  let cum = 0; // metri percorsi lungo il tracciato fino all'inizio del segmento
  for (let i = 0; i + 3 < flat.length; i += 2) {
    const ax = (flat[i + 1] - lon) * kx, ay = (flat[i] - lat) * KY;
    const bx = (flat[i + 3] - lon) * kx, by = (flat[i + 2] - lat) * KY;
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const k = len2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0;
    const d = Math.hypot(ax + k * dx, ay + k * dy);
    const seg = Math.sqrt(len2);
    if (d < best.d) best = { d, bearing: (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360, along: cum + k * seg };
    cum += seg;
  }
  return best;
}

/**
 * Ritorna la route compatibile con la posizione del mezzo, oppure null.
 * `prev` è la route riconosciuta in precedenza: la si tiene finché il mezzo resta vicino al suo tracciato.
 */
export function inferRoute(lines, v, prev = null) {
  const moving = v.speed != null && v.speed > 1 && v.bearing != null;
  const cands = new Set();
  let prevOk = false;
  for (const ln of lines) {
    const n = nearest(ln.flat, v.lat, v.lon);
    if (ln.r === prev && n.d <= KEEP_DIST_M && (!moving || angleDiff(n.bearing, v.bearing) <= MAX_ANGLE)) prevOk = true;
    if (n.d > MAX_DIST_M) continue;
    if (moving && angleDiff(n.bearing, v.bearing) > MAX_ANGLE) continue;
    cands.add(ln.r);
  }
  if (cands.size === 1) return [...cands][0];
  if (prevOk && prev != null) return prev;
  return null;
}

/**
 * Dove si trova il mezzo sulla linea `r`: sceglie il tracciato (cioè il verso) più vicino, tenendo conto della rotta.
 * Ritorna { sh, flat, along, d } con `along` = metri dall'inizio del tracciato, oppure null.
 */
export function locateBus(lines, v, r) {
  const moving = v.speed != null && v.speed > 1 && v.bearing != null;
  let best = null, bestAny = null;
  for (const ln of lines) {
    if (ln.r !== r) continue;
    const n = nearest(ln.flat, v.lat, v.lon);
    const cand = { sh: ln.sh, flat: ln.flat, along: n.along, d: n.d };
    if (!bestAny || n.d < bestAny.d) bestAny = cand;
    if (moving && angleDiff(n.bearing, v.bearing) > MAX_ANGLE) continue;
    if (!best || n.d < best.d) best = cand;
  }
  return best ?? bestAny;
}

/** Posizione (metri dall'inizio del tracciato) di ciascuna fermata; non decrescente, anche sui percorsi ad anello. */
export function stopsAlong(flat, stops) {
  let max = 0;
  return stops.map((s) => (max = Math.max(max, nearest(flat, s.lat, s.lon).along)));
}

const AT_STOP_M = 40;
/** Colloca il mezzo tra le fermate: { k, at } con k = indice dell'ultima fermata superata (-1 prima della prima), at = è lì. */
export function placeOnStops(alongs, busAlong) {
  let k = -1;
  for (let i = 0; i < alongs.length; i++) if (alongs[i] <= busAlong + AT_STOP_M) k = i;
  const at = k >= 0 && Math.abs(busAlong - alongs[k]) <= AT_STOP_M;
  return { k, at };
}

/** Tutte le route compatibili con posizione e direzione del mezzo (anche più d'una, sui tratti condivisi). */
export function candidateRoutes(lines, v) {
  const moving = v.speed != null && v.speed > 1 && v.bearing != null;
  const out = new Set();
  for (const ln of lines) {
    const n = nearest(ln.flat, v.lat, v.lon);
    if (n.d > KEEP_DIST_M) continue;
    if (moving && angleDiff(n.bearing, v.bearing) > MAX_ANGLE) continue;
    out.add(ln.r);
  }
  return [...out];
}
