// Ritaglia gli edifici GlobalBuildingAtlas (TUM, CC BY-NC 4.0 / ODbL) vicino ai percorsi bus -> dati/edifici3d.json.
// Uso: node scripts/build-edifici3d.mjs <marsala_lod1_bbox.geojson>
import { readFileSync, writeFileSync } from 'node:fs';

const src = process.argv[2];
if (!src) { console.error('Uso: node scripts/build-edifici3d.mjs <geojson edifici con height>'); process.exit(1); }
const shapes = JSON.parse(readFileSync(new URL('../dati/shapes.json', import.meta.url), 'utf8'));
const CELL = 0.001; // ~100 m: si tiene l'edificio se il suo centro è nella cella di un punto del percorso o in una adiacente
const key = (lon, lat) => `${Math.floor(lon / CELL)},${Math.floor(lat / CELL)}`;
const near = new Set();
for (const flat of Object.values(shapes)) {
  for (let i = 0; i + 3 < flat.length; i += 2) {
    const [la0, lo0, la1, lo1] = [flat[i], flat[i + 1], flat[i + 2], flat[i + 3]];
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(la1 - la0), Math.abs(lo1 - lo0)) / (CELL / 2)));
    for (let k = 0; k <= n; k++) near.add(key(lo0 + (lo1 - lo0) * k / n, la0 + (la1 - la0) * k / n));
  }
}
const close = (lon, lat) => {
  const cx = Math.floor(lon / CELL), cy = Math.floor(lat / CELL);
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if (near.has(`${cx + dx},${cy + dy}`)) return true;
  return false;
};
const r5 = (x) => Math.round(x * 1e5) / 1e5;
const all = JSON.parse(readFileSync(src, 'utf8')).features;
const features = [];
for (const f of all) {
  if (f.geometry?.type !== 'Polygon') continue;
  const ring = f.geometry.coordinates[0];
  const lon = ring.reduce((s, c) => s + c[0], 0) / ring.length, lat = ring.reduce((s, c) => s + c[1], 0) / ring.length;
  if (!close(lon, lat)) continue;
  const h = Math.max(f.properties.height ?? 0, 3);
  features.push({ type: 'Feature', properties: { h: Math.round(h * 10) / 10 }, geometry: { type: 'Polygon', coordinates: [ring.map((c) => [r5(c[0]), r5(c[1])])] } });
}
const out = JSON.stringify({ type: 'FeatureCollection', features });
writeFileSync(new URL('../dati/edifici3d.json', import.meta.url), out);
console.log(`${features.length} edifici su ${all.length}, ${(out.length / 1e6).toFixed(2)} MB`);
