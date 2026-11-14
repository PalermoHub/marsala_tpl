// Confronta walkFrom() dell'app (rete OSM di dati/walk.json) con Valhalla pedestrian (OSM, server pubblico).
import { readFileSync, writeFileSync } from 'node:fs';
const R = '/home/coseerobe/GitHub-Clone/coseerobe/marsala_tpl';
const { buildGraph, walkFrom } = await import(`${R}/js/walk.js`);
const { distanceM } = await import(`${R}/js/schedule.js`);
const app = JSON.parse(readFileSync(`${R}/dati/app.json`, 'utf8'));
const g = buildGraph(JSON.parse(readFileSync(`${R}/dati/walk.json`, 'utf8')));
let seed = 42; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const pairs = [];
while (pairs.length < 40) {
  const si = Math.floor(rnd() * app.stops.length), s = app.stops[si];
  const m = 150 + rnd() * 750, a = rnd() * 2 * Math.PI;
  const lat = s.lat + (m * Math.sin(a)) / 110540, lon = s.lon + (m * Math.cos(a)) / (111320 * Math.cos(s.lat * Math.PI / 180));
  const w = walkFrom(g, app.stops, lat, lon, 1500);
  if (!w || !w.has(si)) continue;
  pairs.push({ lat, lon, si, aria: distanceM(lat, lon, s.lat, s.lon), app: w.get(si) });
}
const rows = [];
for (const p of pairs) {
  const s = app.stops[p.si];
  const r = await fetch('https://valhalla1.openstreetmap.de/route', { method: 'POST', body: JSON.stringify({ locations: [{ lat: p.lat, lon: p.lon }, { lat: s.lat, lon: s.lon }], costing: 'pedestrian' }) });
  const j = await r.json(); const val = j.trip?.summary?.length != null ? j.trip.summary.length * 1000 : null;
  rows.push({ ...p, stop: s.name, valhalla: val }); await new Promise((x) => setTimeout(x, 600));
}
writeFileSync(process.argv[2], JSON.stringify(rows, null, 1));
const ok = rows.filter((r) => r.valhalla != null), d = ok.map((r) => r.app - r.valhalla), rel = ok.map((r) => r.app / r.valhalla);
const q = (a, p) => [...a].sort((x, y) => x - y)[Math.floor(p * (a.length - 1))];
console.log('coppie', rows.length, 'con risposta', ok.length);
console.log('app - valhalla (m): mediana', q(d, .5).toFixed(0), 'p10', q(d, .1).toFixed(0), 'p90', q(d, .9).toFixed(0), 'min', Math.min(...d).toFixed(0), 'max', Math.max(...d).toFixed(0));
console.log('app/valhalla: mediana', q(rel, .5).toFixed(2), 'p10', q(rel, .1).toFixed(2), 'p90', q(rel, .9).toFixed(2));
console.log('|diff|<=10%:', ok.filter((r) => Math.abs(r.app / r.valhalla - 1) <= .1).length, '<=20%:', ok.filter((r) => Math.abs(r.app / r.valhalla - 1) <= .2).length);
console.log('linea d\'aria/valhalla mediana', q(ok.map((r) => r.aria / r.valhalla), .5).toFixed(2));
