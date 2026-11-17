// GTFS-Realtime: decodifica minima dei due feed (protobuf), senza librerie.
// - vehicle_positions: solo id, targa, posizione e timestamp (niente trip/route/stop).
// - trip_updates: dal 17 novembre 2026 pubblica corsa, fermata e ritardo in secondi. Il Comune scrive
//   però i campi del TripDescriptor fuori posto (route_id nel 5, start_time nel 2, start_date nel 3) e
//   il trip_id non è quello del GTFS statico: il decoder rimette ogni stringa al suo posto e l'app
//   aggancia la corsa per linea + ora di partenza + fermate, non per trip_id.

const RT_BASE = 'https://7ydpklv7b2.execute-api.eu-north-1.amazonaws.com/prod/gtfs_realtime_marsala';
export const RT_URL = `${RT_BASE}/vehicle_positions`;
export const TU_URL = `${RT_BASE}/trip_updates`;

// Deposito (dove i mezzi sostano con il GPS acceso): i veicoli lì vicino non sono in servizio.
const DEPOT = { lat: 37.7707, lon: 12.4898, radiusM: 350 };
const FRESH_S = 180;

function varint(b, i) {
  let r = 0, s = 0;
  for (;;) {
    const c = b[i++];
    r += (c & 0x7f) * 2 ** s;
    s += 7;
    if (!(c & 0x80)) return [r, i];
  }
}

function fields(b) {
  const out = [];
  let i = 0;
  while (i < b.length) {
    let k; [k, i] = varint(b, i);
    const f = Math.floor(k / 8), w = k & 7;
    let v;
    if (w === 0) [v, i] = varint(b, i);
    else if (w === 1) { v = b.subarray(i, i + 8); i += 8; }
    else if (w === 2) { let l; [l, i] = varint(b, i); v = b.subarray(i, i + l); i += l; }
    else if (w === 5) { v = b.subarray(i, i + 4); i += 4; }
    else throw new Error('wire type non supportato');
    out.push([f, v]);
  }
  return out;
}

const f32 = (v) => new DataView(v.buffer, v.byteOffset, 4).getFloat32(0, true);
const str = (v) => new TextDecoder().decode(v);

export function decodeVehicles(buf) {
  const top = fields(new Uint8Array(buf));
  let headerTs = null;
  const vehicles = [];
  for (const [f, v] of top) {
    if (f === 1) for (const [hf, hv] of fields(v)) if (hf === 3) headerTs = hv;
    if (f !== 2) continue;
    for (const [ef, ev] of fields(v)) {
      if (ef !== 4) continue;
      const veh = { id: '', plate: '', lat: NaN, lon: NaN, bearing: null, speed: null, ts: 0 };
      for (const [vf, vv] of fields(ev)) {
        if (vf === 2) for (const [pf, pv] of fields(vv)) {
          if (pf === 1) veh.lat = f32(pv);
          else if (pf === 2) veh.lon = f32(pv);
          else if (pf === 3) veh.bearing = f32(pv);
          else if (pf === 5) veh.speed = f32(pv);
        }
        else if (vf === 5) veh.ts = vv;
        else if (vf === 8) for (const [df, dv] of fields(vv)) { if (df === 1) veh.id = str(dv); if (df === 2) veh.plate = str(dv); }
      }
      if (Number.isFinite(veh.lat) && Number.isFinite(veh.lon)) vehicles.push(veh);
    }
  }
  return { headerTs, vehicles };
}

function distM(lat1, lon1, lat2, lon2) {
  const kx = 111320 * Math.cos(((lat1 + lat2) / 2) * (Math.PI / 180));
  return Math.hypot((lon2 - lon1) * kx, (lat2 - lat1) * 110540);
}

/**
 * Divide i veicoli in "in servizio" (posizione recente e fuori dal deposito) e "fermi" (in deposito o senza
 * aggiornamenti da più di 3 minuti). Non assegna mai una linea: il feed non la contiene.
 */
export function classify(feed, nowS = Date.now() / 1000) {
  const ref = feed.headerTs ?? nowS;
  const active = [], idle = [];
  for (const v of feed.vehicles) {
    const fresh = ref - v.ts <= FRESH_S;
    const atDepot = distM(v.lat, v.lon, DEPOT.lat, DEPOT.lon) <= DEPOT.radiusM;
    (fresh && !atDepot ? active : idle).push(v);
  }
  return { active, idle };
}

export async function fetchVehicles(signal) {
  const res = await fetch(RT_URL, { signal, cache: 'no-store' });
  if (!res.ok) throw new Error(`RT ${res.status}`);
  const feed = decodeVehicles(await res.arrayBuffer());
  return { feed, ...classify(feed), total: feed.vehicles.length };
}

const isClock = (s) => /^\d{1,2}:\d{2}:\d{2}$/.test(s);
const isDate = (s) => /^\d{8}$/.test(s);

/** TripDescriptor: accetta sia il GTFS-Realtime standard sia l'ordine di campi usato dal Comune. */
function tripDescriptor(buf) {
  const d = { tripId: '', routeId: '', startTime: '', startDate: '' };
  for (const [f, v] of fields(buf)) {
    if (typeof v === 'number') continue;
    const s = str(v);
    if (f === 1) d.tripId = s;
    else if (f === 2) { if (isClock(s)) d.startTime = s; else d.routeId = s; }
    else if (f === 3) { if (isDate(s)) d.startDate = s; else if (isClock(s)) d.startTime = s; }
    else if (f === 4) d.startTime = s;
    else if (f === 5) { if (isClock(s)) d.startTime = s; else if (isDate(s)) d.startDate = s; else d.routeId = s; }
  }
  return d;
}

/** StopTimeEvent: { delay, time } in secondi/epoch. */
function stopEvent(buf) {
  const e = { delay: null, time: null };
  for (const [f, v] of fields(buf)) {
    if (typeof v !== 'number') continue;
    if (f === 1) e.delay = v; // ritardo rispetto all'orario programmato
    else if (f === 2) e.time = v; // ora prevista (epoch)
  }
  return e;
}

/** StopTimeUpdate: fermata (stop_sequence e stop_id) con arrivo e partenza previsti. */
function stopTimeUpdate(buf) {
  const u = { seq: null, stopId: '', arrival: null, departure: null };
  for (const [f, v] of fields(buf)) {
    if (f === 1 && typeof v === 'number') u.seq = v;
    else if (f === 2 && v.subarray) u.arrival = stopEvent(v);
    else if (f === 3 && v.subarray) u.departure = stopEvent(v);
    else if (f === 4 && v.subarray) u.stopId = str(v);
  }
  const delay = u.arrival?.delay ?? u.departure?.delay ?? null;
  const time = u.arrival?.time ?? u.departure?.time ?? null;
  return { seq: u.seq, stopId: u.stopId, delay, time };
}

/**
 * Feed trip_updates -> { headerTs, trips: [{ tripId, routeId, startTime, startDate, vehicleId, ts, stops }] }
 * `stops[].delay` è in secondi, `null` quando il feed dà solo l'ora prevista (eredita dal punto prima).
 */
export function decodeTripUpdates(buf) {
  const top = fields(new Uint8Array(buf));
  let headerTs = null;
  const trips = [];
  for (const [f, v] of top) {
    if (f === 1) for (const [hf, hv] of fields(v)) if (hf === 3 && typeof hv === 'number') headerTs = hv;
    if (f !== 2) continue;
    for (const [ef, ev] of fields(v)) {
      if (ef !== 3) continue; // solo trip_update: vehicle e alert non servono qui
      const trip = { tripId: '', routeId: '', startTime: '', startDate: '', vehicleId: '', ts: 0, stops: [] };
      for (const [tf, tv] of fields(ev)) {
        if (tf === 1) Object.assign(trip, tripDescriptor(tv));
        else if (tf === 2) trip.stops.push(stopTimeUpdate(tv));
        else if (tf === 3) for (const [vf, vv] of fields(tv)) { if (vf === 1) trip.vehicleId = str(vv); }
        else if (tf === 4 && typeof tv === 'number') trip.ts = tv;
      }
      if (trip.stops.length) trips.push(trip);
    }
  }
  return { headerTs, trips };
}

export async function fetchTripUpdates(signal) {
  const res = await fetch(TU_URL, { signal, cache: 'no-store' });
  if (!res.ok) throw new Error(`TU ${res.status}`);
  const feed = decodeTripUpdates(await res.arrayBuffer());
  return { ...feed, total: feed.trips.length };
}
