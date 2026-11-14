// Costruisce dati/walk.json: la rete pedonale di Marsala da OpenStreetMap, compattata per il browser.
// L'app la usa per misurare la distanza a piedi alle fermate (al posto della linea d'aria).
//
// Uso:
//   node scripts/build-walk.mjs --fetch            scarica da Overpass e costruisce
//   node scripts/build-walk.mjs <ways.json>        costruisce da un'estrazione Overpass già scaricata
//
// Dati © OpenStreetMap contributors, licenza ODbL: va mostrata l'attribuzione (vedi Info nell'app).
// Non fa parte dell'aggiornamento notturno: la rete stradale cambia piano, rilanciare a mano ogni tanto.

import fs from 'node:fs';

const ROOT = new URL('..', import.meta.url);
const KEEP_M = 1500; // si tengono solo i nodi entro questa distanza da una fermata (in linea d'aria)

const app = JSON.parse(fs.readFileSync(new URL('dati/app.json', ROOT), 'utf8'));
const stops = app.stops;

async function fetchWays() {
  const lat = stops.map((s) => s.lat), lon = stops.map((s) => s.lon);
  const m = 0.02;
  const bb = [Math.min(...lat) - m, Math.min(...lon) - m, Math.max(...lat) + m, Math.max(...lon) + m].map((v) => v.toFixed(5)).join(',');
  const q = `[out:json][timeout:180];
way["highway"]["highway"!~"motorway|motorway_link|trunk|trunk_link|proximity|construction|raceway|bus_guideway|proposed|abandoned"]["foot"!="no"]["access"!~"^(private|no)$"](${bb});
out geom;`;
  for (let i = 1; i <= 4; i++) {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'marsala-tpl-build/1.0' },
      body: 'data=' + encodeURIComponent(q),
    });
    const text = await res.text();
    if (res.ok && text.startsWith('{')) return JSON.parse(text);
    console.error(`Overpass tentativo ${i}: HTTP ${res.status}`);
    await new Promise((r) => setTimeout(r, 15000 * i));
  }
  throw new Error('Overpass non risponde');
}

const arg = process.argv[2];
if (!arg) { console.error('Uso: node scripts/build-walk.mjs --fetch | <ways.json>'); process.exit(2); }
const ways = (arg === '--fetch' ? await fetchWays() : JSON.parse(fs.readFileSync(arg, 'utf8'))).elements.filter((e) => e.type === 'way' && e.geometry);

// 1. Nodi e archi (consecutivi lungo ogni via).
const idx = new Map(); const LA = [], LO = [];
const nodeOf = (id, g) => { let k = idx.get(id); if (k === undefined) { k = LA.length; idx.set(id, k); LA.push(g.lat); LO.push(g.lon); } return k; };
const edges = new Set();
for (const w of ways) {
  const ns = w.nodes.map((id, i) => nodeOf(id, w.geometry[i]));
  for (let i = 0; i < ns.length - 1; i++) if (ns[i] !== ns[i + 1]) edges.add(ns[i] < ns[i + 1] ? ns[i] * 4194304 + ns[i + 1] : ns[i + 1] * 4194304 + ns[i]);
}
const E = [...edges].map((k) => [Math.floor(k / 4194304), k % 4194304]);

// 2. Si tengono i nodi vicini a una fermata (distanza in linea d'aria), poi la componente connessa più grande.
const kx = (lat) => 111320 * Math.cos((lat * Math.PI) / 180);
const cell = 0.02; const grid = new Map();
for (const s of stops) { const k = `${Math.floor(s.lat / cell)},${Math.floor(s.lon / cell)}`; (grid.get(k) ?? grid.set(k, []).get(k)).push(s); }
const nearStop = (la, lo) => {
  const ci = Math.floor(la / cell), cj = Math.floor(lo / cell);
  for (let di = -2; di <= 2; di++) for (let dj = -2; dj <= 2; dj++) for (const s of grid.get(`${ci + di},${cj + dj}`) ?? []) {
    if (Math.hypot((lo - s.lon) * kx(la), (la - s.lat) * 110540) <= KEEP_M) return true;
  }
  return false;
};
const near = LA.map((la, i) => nearStop(la, LO[i]));
const E1 = E.filter(([a, b]) => near[a] && near[b]);
const parent = Array.from({ length: LA.length }, (_, i) => i);
const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
for (const [a, b] of E1) parent[find(a)] = find(b);
const size = new Map(); for (const [a] of E1) size.set(find(a), (size.get(find(a)) ?? 0) + 1);
const big = [...size.entries()].sort((a, b) => b[1] - a[1])[0][0];
const E2 = E1.filter(([a]) => find(a) === big);

// 3. Rinumerazione ordinata per posizione (i delta restano piccoli e il JSON si comprime bene).
const used = [...new Set(E2.flat())].sort((a, b) => LA[a] - LA[b] || LO[a] - LO[b]);
const renum = new Map(used.map((o, i) => [o, i]));
const q5 = (v) => Math.round(v * 1e5);
const la = used.map((o) => q5(LA[o])), lo = used.map((o) => q5(LO[o]));
const dLa = la.map((v, i) => (i ? v - la[i - 1] : v)), dLo = lo.map((v, i) => (i ? v - lo[i - 1] : v));
const e = E2.map(([a, b]) => [renum.get(a), renum.get(b)]).sort((x, y) => x[0] - y[0] || x[1] - y[1]).flatMap(([a, b], i, all) => [i ? a - all[i - 1][0] : a, b]);

const out = { v: 1, src: '© OpenStreetMap contributors, ODbL', built: new Date().toISOString().slice(0, 10), la: dLa, lo: dLo, e };
const path = new URL('dati/walk.json', ROOT);
fs.writeFileSync(path, JSON.stringify(out));
const bytes = fs.statSync(path).size;
console.log(`walk.json: ${used.length} nodi, ${E2.length} archi, ${(bytes / 1024).toFixed(0)} KB (da ${LA.length} nodi e ${E.length} archi OSM)`);
