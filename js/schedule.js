// Logica degli orari: pura, senza DOM, usata dall'app e dai test.
// Tutti i calcoli sono in Europe/Rome, mai nel fuso del dispositivo.

const TZ = 'Europe/Rome';
const fmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

/** Istante -> { ymd: 20261114, dow: 0..6 (lun=0), secs: secondi dalla mezzanotte } a Marsala. */
export function romeNow(date = new Date()) {
  const p = Object.fromEntries(fmt.formatToParts(date).map((x) => [x.type, x.value]));
  const ymd = Number(p.year) * 10000 + Number(p.month) * 100 + Number(p.day);
  return { ymd, dow: dowOf(ymd), secs: Number(p.hour) * 3600 + Number(p.minute) * 60 + Number(p.second) };
}

const parts = (ymd) => [Math.floor(ymd / 10000), Math.floor((ymd % 10000) / 100), ymd % 100];

/** Giorno della settimana, lunedì = 0. */
export function dowOf(ymd) {
  const [y, m, d] = parts(ymd);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

export function addDays(ymd, n) {
  const [y, m, d] = parts(ymd);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.getUTCFullYear() * 10000 + (t.getUTCMonth() + 1) * 100 + t.getUTCDate();
}

/** Un servizio è attivo se rientra nel calendario settimanale e non è rimosso, oppure se è aggiunto. */
export function isServiceActive(service, ymd) {
  if (service.rem.includes(ymd)) return false;
  if (service.add.includes(ymd)) return true;
  return service.start <= ymd && ymd <= service.end && service.days[dowOf(ymd)] === 1;
}

/** Indice partenze per fermata: Map(stopIdx -> [{ trip, pos, t }]) ordinato per orario. */
export function buildIndex(data) {
  const byStop = new Map();
  data.trips.forEach((trip, ti) => {
    const last = trip.s.length - 1;
    trip.s.forEach((si, pos) => {
      if (pos === last) return; // al capolinea di arrivo non si sale
      if (!byStop.has(si)) byStop.set(si, []);
      byStop.get(si).push({ trip: ti, pos, t: trip.t[pos] });
    });
  });
  for (const list of byStop.values()) list.sort((a, b) => a.t - b.t);
  return byStop;
}

export function activeSet(data, ymd) {
  const set = new Set();
  data.services.forEach((s, i) => { if (isServiceActive(s, ymd)) set.add(i); });
  return set;
}

/**
 * Prossime partenze da una fermata.
 * Considera le corse di oggi, quelle di ieri che proseguono oltre la mezzanotte (orari >= 24:00)
 * e, se oggi non resta nulla, la prima partenza di domani.
 * Ritorna { items: [{ trip, pos, secs, dayOffset, mins }], tomorrow: item|null }
 * `secs` è il tempo dalla mezzanotte del giorno di servizio; `mins` i minuti da adesso.
 */
export function nextDepartures(data, index, stopIdx, now, limit = 6) {
  const list = index.get(stopIdx) ?? [];
  const today = activeSet(data, now.ymd);
  const yesterday = activeSet(data, addDays(now.ymd, -1));
  const items = [];
  for (const d of list) {
    const sv = data.trips[d.trip].v;
    if (today.has(sv) && d.t >= now.secs) items.push({ ...d, secs: d.t, dayOffset: 0, mins: Math.floor((d.t - now.secs) / 60) });
    if (yesterday.has(sv) && d.t >= 86400 && d.t - 86400 >= now.secs) {
      items.push({ ...d, secs: d.t - 86400, dayOffset: 0, mins: Math.floor((d.t - 86400 - now.secs) / 60) });
    }
  }
  items.sort((a, b) => a.secs - b.secs);
  let tomorrow = null;
  if (items.length < limit) {
    const next = activeSet(data, addDays(now.ymd, 1));
    for (const d of list) {
      if (next.has(data.trips[d.trip].v) && d.t < 86400) {
        tomorrow = { ...d, secs: d.t, dayOffset: 1, mins: Math.floor((86400 - now.secs + d.t) / 60) };
        break;
      }
    }
  }
  return { items: items.slice(0, limit), tomorrow };
}

/** Distanza in metri (equirettangolare, adatta a pochi km). */
export function distanceM(lat1, lon1, lat2, lon2) {
  const kx = 111320 * Math.cos(((lat1 + lat2) / 2) * (Math.PI / 180));
  return Math.hypot((lon2 - lon1) * kx, (lat2 - lat1) * 110540);
}

/**
 * Le n fermate più vicine. `dist(i, lineaAria)` (opzionale) converte la linea d'aria in metri a piedi
 * (vedi walk.js): senza, si ordina per linea d'aria.
 */
export function nearestStops(data, lat, lon, n = 6, dist = null) {
  return data.stops
    .map((s, i) => { const c = distanceM(lat, lon, s.lat, s.lon); return { i, m: dist ? dist(i, c) : c }; })
    .filter((x) => Number.isFinite(x.m))
    .sort((a, b) => a.m - b.m)
    .slice(0, n);
}

/**
 * true se l'orario a quella fermata è solo indicativo: non è il capolinea di partenza e il feed ufficiale
 * dà lo stesso minuto della fermata precedente (orari arrotondati al minuto, non interpolati).
 */
export const isApprox = (trip, pos) => pos > 0 && trip.t[pos] === trip.t[pos - 1];

/** "Corso Calatafimi dir. Autostazione" -> { base: "Corso Calatafimi", dir: "Autostazione" } */
export function splitStopName(name) {
  const m = name.match(/^(.*?)\s+dir(?:\.\s*|\s+)(.+)$/i);
  return m ? { base: m[1], dir: m[2] } : { base: name, dir: '' };
}

/** Fermate con lo stesso nome base entro 150 m: l'altro senso di marcia. */
export function siblingStops(data, stopIdx) {
  const s = data.stops[stopIdx];
  const base = splitStopName(s.name).base.toLowerCase();
  return data.stops
    .map((o, i) => ({ o, i }))
    .filter(({ o, i }) => i !== stopIdx && splitStopName(o.name).base.toLowerCase() === base && distanceM(s.lat, s.lon, o.lat, o.lon) < 150)
    .map(({ i }) => i);
}

export function formatClock(secs) {
  const s = ((secs % 86400) + 86400) % 86400;
  return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}`;
}

/** Orario come nel GTFS (`start_time`): senza ridurre le corse dopo la mezzanotte, quindi 25:10 resta 25:10. */
export function hms(secs) {
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Ritardo (secondi) per ogni fermata della corsa, a partire dagli aggiornamenti del feed trip_updates.
 * Nel feed un ritardo vale da quella fermata in avanti finché non ne arriva uno nuovo: qui si propaga.
 * Le fermate prima del primo aggiornamento restano `null` (il mezzo le ha già passate).
 * Le fermate si riconoscono per stop_id e, in mancanza, per stop_sequence (1-based).
 */
export function delaysByPos(stopIds, updates) {
  const known = new Map();
  for (const u of updates) {
    if (u.delay == null) continue; // solo l'ora prevista: il ritardo resta quello del punto prima
    let pos = u.stopId ? stopIds.indexOf(u.stopId) : -1;
    if (pos < 0 && Number.isFinite(u.seq) && u.seq > 0 && u.seq <= stopIds.length) pos = u.seq - 1;
    if (pos < 0) continue;
    known.set(pos, u.delay);
  }
  const out = new Array(stopIds.length).fill(null);
  let cur = null;
  for (let k = 0; k < stopIds.length; k++) {
    if (known.has(k)) cur = known.get(k);
    out[k] = cur;
  }
  return out;
}

/**
 * Aggancia una corsa agli aggiornamenti del feed trip_updates. Il feed del Comune non manda il trip_id
 * del GTFS statico, quindi si confrontano linea e ora di partenza (più la data, se c'è) e si tiene solo
 * l'aggiornamento le cui fermate esistono davvero in questa corsa: così non si scambiano corse omonime.
 * `start` è `hms` del primo orario della corsa, `stopIds` gli id delle sue fermate nell'ordine.
 * Ritorna l'aggiornamento con `delays` allineati alla corsa, oppure null.
 */
export function matchTripUpdate(updates, { routeId, start, day, stopIds }) {
  for (const u of updates) {
    if (u.routeId !== routeId || u.startTime !== start) continue;
    if (u.startDate && Number(u.startDate) !== day) continue;
    const delays = delaysByPos(stopIds, u.stops);
    if (!delays.some((d) => d != null)) continue;
    return { ...u, delays };
  }
  return null;
}

/**
 * Partenze con l'orario stimato dal feed: `secs` diventa quello previsto (programmato + ritardo), `sched`
 * resta il programmato e `delay` è il ritardo in secondi. Rimescola per ora prevista; le corse di domani
 * restano come sono (il feed non ne sa nulla).
 */
export function withDelays(data, rtTrips, items, now) {
  if (!rtTrips?.length) return items;
  return items
    .map((it) => {
      if (it.dayOffset) return it;
      const trip = data.trips[it.trip];
      const m = matchTripUpdate(rtTrips, {
        routeId: data.routes[trip.r].id,
        start: hms(trip.t[0]),
        day: now.ymd,
        stopIds: trip.s.map((si) => data.stops[si].id),
      });
      const d = m?.delays[it.pos];
      if (d == null) return it;
      const est = it.secs + d;
      return { ...it, delay: d, sched: it.secs, secs: est, mins: Math.floor((est - now.secs) / 60) };
    })
    .sort((a, b) => a.secs - b.secs);
}

/**
 * Partenze da una fermata con i ritardi del feed.
 * Con i ritardi si guarda anche un quarto d'ora indietro: una corsa che da orario è già passata ma che il
 * feed dà in ritardo deve ancora comparire. `mins` è sempre ricalcolato sull'ora attuale.
 */
export function departuresAt(data, index, stopIdx, now, rtTrips = [], limit = 7) {
  const back = rtTrips?.length ? 900 : 0;
  const { items, tomorrow } = nextDepartures(data, index, stopIdx, { ...now, secs: now.secs - back }, limit + (back ? 4 : 0));
  const shown = withDelays(data, rtTrips, items, now)
    .map((it) => ({ ...it, mins: Math.floor((it.secs - now.secs) / 60) }))
    .filter((it) => it.secs >= now.secs - 30);
  return { items: shown.slice(0, limit), tomorrow };
}

/** Stato di validità del feed rispetto a oggi: ok | soon (scade entro 14 giorni) | expired. */
export function feedStatus(meta, ymd) {
  if (!meta.validTo) return { state: 'ok', daysLeft: null };
  const daysLeft = Math.round((Date.UTC(...parts(meta.validTo).map((v, i) => (i === 1 ? v - 1 : v))) - Date.UTC(...parts(ymd).map((v, i) => (i === 1 ? v - 1 : v)))) / 86400000);
  if (ymd > meta.validTo) return { state: 'expired', daysLeft };
  return { state: daysLeft <= 14 ? 'soon' : 'ok', daysLeft };
}
