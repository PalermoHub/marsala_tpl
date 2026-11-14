#!/usr/bin/env node
// Compila il GTFS statico del Comune di Marsala in due file JSON per la PWA:
//   dati/app.json     rete, calendari, corse con fermate e orari (precache offline)
//   dati/shapes.json  percorsi semplificati (caricato solo da mappa e dettaglio linea)
//
// Uso: node scripts/build-gtfs.mjs <cartella-con-i-txt-del-gtfs> [--out dati]
// Nessuna dipendenza esterna.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const src = args.find((a) => !a.startsWith('--'));
const outIdx = args.indexOf('--out');
const out = outIdx >= 0 ? args[outIdx + 1] : 'dati';
if (!src) {
  console.error('Uso: node scripts/build-gtfs.mjs <cartella-gtfs> [--out dati]');
  process.exit(2);
}

/** Parser CSV minimo con virgolette, sufficiente per i file GTFS. */
function parseCsv(text) {
  text = text.replace(/^﻿/, '');
  const rows = [];
  let row = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else q = false;
      } else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  const head = rows.shift();
  return rows.filter((r) => r.length > 1 || r[0] !== '').map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
}

const read = (name, optional = false) => {
  try { return parseCsv(readFileSync(join(src, name), 'utf8')); }
  catch (e) { if (optional) return []; throw e; }
};

const secs = (hhmmss) => {
  const [h, m, s] = hhmmss.split(':').map(Number);
  return h * 3600 + m * 60 + (s || 0);
};
const cleanName = (s) => s.replace(/\s+/g, ' ').trim();

const routesRaw = read('routes.txt');
const stopsRaw = read('stops.txt');
const tripsRaw = read('trips.txt');
const stRaw = read('stop_times.txt');
const calRaw = read('calendar.txt', true);
const calDatesRaw = read('calendar_dates.txt', true);
const shapesRaw = read('shapes.txt', true);
const feedInfo = read('feed_info.txt', true)[0] ?? {};
const agency = read('agency.txt', true)[0] ?? {};

// --- servizi: calendar.txt + calendar_dates.txt (anche servizi presenti solo nelle eccezioni) ---
const services = {};
const svc = (id) => (services[id] ??= { id, days: [0, 0, 0, 0, 0, 0, 0], start: 0, end: 0, add: [], rem: [] });
for (const c of calRaw) {
  const s = svc(c.service_id);
  s.days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((d) => Number(c[d]));
  s.start = Number(c.start_date);
  s.end = Number(c.end_date);
}
for (const d of calDatesRaw) {
  const s = svc(d.service_id);
  (d.exception_type === '1' ? s.add : s.rem).push(Number(d.date));
}
// Correzione festivi: nel feed del Comune, i giorni festivi aggiungono il servizio domenicale e
// rimuovono FER6 ma non FER5 (che include il supplemento scuole). Se una data aggiunge un servizio
// solo-domenicale, gli altri servizi settimanali attivi quel giorno vengono rimossi (come il Comune
// fa per l'1-2 novembre). Disattivabile con --no-holiday-fix. Va segnalato al Comune.
const corrections = [];
if (!args.includes('--no-holiday-fix')) {
  const dowOf = (ymd) => (new Date(Date.UTC(Math.floor(ymd / 10000), Math.floor((ymd % 10000) / 100) - 1, ymd % 100)).getUTCDay() + 6) % 7;
  const weekly = Object.values(services).filter((s) => s.start);
  const sundayOnly = (s) => s.days.every((v, i) => (i === 6 ? v === 1 : v === 0));
  for (const dom of weekly.filter(sundayOnly)) {
    for (const date of dom.add) {
      for (const s of weekly) {
        if (s === dom || sundayOnly(s)) continue;
        const active = s.start <= date && date <= s.end && s.days[dowOf(date)] === 1;
        if (active && !s.rem.includes(date) && !s.add.includes(date)) {
          s.rem.push(date);
          corrections.push(`${date}: rimosso ${s.id} (festivo con servizio ${dom.id}, il feed lo lasciava attivo)`);
        }
      }
    }
  }
}
const serviceList = Object.values(services);
const serviceIdx = new Map(serviceList.map((s, i) => [s.id, i]));

// --- fermate usate ---
const stopTimesByTrip = new Map();
for (const r of stRaw) {
  if (!stopTimesByTrip.has(r.trip_id)) stopTimesByTrip.set(r.trip_id, []);
  stopTimesByTrip.get(r.trip_id).push(r);
}
const usedStops = new Set(stRaw.map((r) => r.stop_id));
const stopList = stopsRaw.filter((s) => usedStops.has(s.stop_id) && s.location_type !== '1');
const stopIdx = new Map(stopList.map((s, i) => [s.stop_id, i]));

// --- linee ---
const routeIdx = new Map(routesRaw.map((r, i) => [r.route_id, i]));
const routes = routesRaw.map((r) => ({
  id: r.route_id,
  short: r.route_short_name,
  long: cleanName(r.route_long_name),
  color: r.route_color || null,
}));

// --- corse ---
const shapeUse = new Set();
const trips = [];
const problems = [];
for (const t of tripsRaw) {
  const st = (stopTimesByTrip.get(t.trip_id) ?? []).sort((a, b) => Number(a.stop_sequence) - Number(b.stop_sequence));
  if (!st.length) { problems.push(`corsa senza orari: ${t.trip_id}`); continue; }
  if (!serviceIdx.has(t.service_id)) { problems.push(`corsa con servizio sconosciuto: ${t.trip_id} ${t.service_id}`); continue; }
  if (!routeIdx.has(t.route_id)) { problems.push(`corsa con linea sconosciuta: ${t.trip_id}`); continue; }
  const stops = st.map((r) => stopIdx.get(r.stop_id));
  if (stops.some((x) => x === undefined)) { problems.push(`corsa con fermata sconosciuta: ${t.trip_id}`); continue; }
  if (t.shape_id) shapeUse.add(t.shape_id);
  trips.push({
    r: routeIdx.get(t.route_id),
    v: serviceIdx.get(t.service_id),
    h: cleanName(t.trip_headsign),
    d: Number(t.direction_id || 0),
    sh: t.shape_id || null,
    s: stops,
    t: st.map((r) => secs(r.departure_time || r.arrival_time)),
  });
}

// --- shapes semplificate (Douglas-Peucker, ~4 m) ---
function simplify(pts, tolM) {
  const kx = 111320 * Math.cos((37.8 * Math.PI) / 180);
  const ky = 110540;
  const P = pts.map(([la, lo]) => [lo * kx, la * ky]);
  const keep = new Uint8Array(P.length);
  keep[0] = keep[P.length - 1] = 1;
  const stack = [[0, P.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let max = 0, idx = -1;
    const [ax, ay] = P[a], [bx, by] = P[b];
    const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = P[i];
      let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
      t = Math.max(0, Math.min(1, t));
      const d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
      if (d > max) { max = d; idx = i; }
    }
    if (max > tolM && idx > 0) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
const shapeRows = new Map();
for (const r of shapesRaw) {
  if (!shapeUse.has(r.shape_id)) continue;
  if (!shapeRows.has(r.shape_id)) shapeRows.set(r.shape_id, []);
  shapeRows.get(r.shape_id).push(r);
}
const shapes = {};
for (const [id, rows] of shapeRows) {
  rows.sort((a, b) => Number(a.shape_pt_sequence) - Number(b.shape_pt_sequence));
  const pts = rows.map((r) => [Number(r.shape_pt_lat), Number(r.shape_pt_lon)]);
  shapes[id] = simplify(pts, 4).flatMap(([la, lo]) => [Math.round(la * 1e5) / 1e5, Math.round(lo * 1e5) / 1e5]);
}

// --- controlli di coerenza ---
for (const t of trips) {
  for (let i = 1; i < t.t.length; i++) {
    if (t.t[i] < t.t[i - 1]) { problems.push(`orari non crescenti nella corsa ${routes[t.r].short} ${t.h}`); break; }
  }
  if (t.sh && !shapes[t.sh]) problems.push(`shape mancante: ${t.sh}`);
}
const unusedServices = serviceList.filter((s) => !trips.some((t) => serviceList[t.v] === s)).map((s) => s.id);

const meta = {
  feedVersion: feedInfo.feed_version || null,
  validFrom: Number(feedInfo.feed_start_date) || null,
  validTo: Number(feedInfo.feed_end_date) || null,
  agency: agency.agency_name || 'Marsala',
  contact: feedInfo.feed_contact_url || null,
  source: 'https://www.comune.marsala.tp.it/it/page/orari-del-trasporto-pubblico-locale',
  license: 'CC BY 4.0',
  corrections,
};

const stops = stopList.map((s) => ({
  id: s.stop_id,
  code: s.stop_code || '',
  name: cleanName(s.stop_name),
  lat: Math.round(Number(s.stop_lat) * 1e6) / 1e6,
  lon: Math.round(Number(s.stop_lon) * 1e6) / 1e6,
}));

mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'app.json'), JSON.stringify({ meta, routes, stops, services: serviceList, trips }));
writeFileSync(join(out, 'shapes.json'), JSON.stringify(shapes));

console.log(`linee ${routes.length}, fermate ${stops.length}, corse ${trips.length}, servizi ${serviceList.length}, shapes ${Object.keys(shapes).length}`);
if (corrections.length) console.log(`correzioni festivi applicate: ${corrections.length}\n  ${corrections.join('\n  ')}`);
if (unusedServices.length) console.log(`servizi senza corse: ${unusedServices.join(', ')}`);
if (problems.length) {
  console.error(`PROBLEMI (${problems.length}):\n- ${problems.slice(0, 20).join('\n- ')}`);
  process.exit(1);
}
