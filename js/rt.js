// GTFS-Realtime: decodifica minima del feed vehicle_positions (protobuf), senza librerie.
// Il feed del Comune oggi non contiene trip/route/stop: solo id, targa, posizione e timestamp.
// Per questo l'app mostra "bus in servizio" sulla mappa e non promette ritardi per singola corsa.

export const RT_URL = 'https://7ydpklv7b2.execute-api.eu-north-1.amazonaws.com/prod/gtfs_realtime_marsala/vehicle_positions';

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
