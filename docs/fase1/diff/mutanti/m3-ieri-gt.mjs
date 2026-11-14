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
    if (yesterday.has(sv) && d.t > 86400 && d.t - 86400 >= now.secs) {
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

/** Stato di validità del feed rispetto a oggi: ok | soon (scade entro 14 giorni) | expired. */
export function feedStatus(meta, ymd) {
  if (!meta.validTo) return { state: 'ok', daysLeft: null };
  const daysLeft = Math.round((Date.UTC(...parts(meta.validTo).map((v, i) => (i === 1 ? v - 1 : v))) - Date.UTC(...parts(ymd).map((v, i) => (i === 1 ? v - 1 : v)))) / 86400000);
  if (ymd > meta.validTo) return { state: 'expired', daysLeft };
  return { state: daysLeft <= 14 ? 'soon' : 'ok', daysLeft };
}
