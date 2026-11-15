// Costruisce dati/indirizzi.json: i numeri civici di Marsala (ANNCSU), compattati per la ricerca per indirizzo.
//
// Uso: node scripts/build-indirizzi.mjs [indirizzi_E974.gpkg]
//   default: docs/anncus/indirizzi_E974.gpkg (cartella solo locale: non è nel repository, il file va tenuto a mano)
//
// Il GeoPackage è l'estrazione ANNCSU del Comune (E974) pubblicata da PalermoHub su
// https://palermohub.opendatasicilia.it/anncus.html. Non fa parte dell'aggiornamento notturno: i civici
// cambiano piano, rilanciare a mano ogni tanto.
//
// Formato (v1): { v, e: [esponenti], s: [{ n: "Via Mazara", c: [civico, indiceEsponente, dLat, dLon, ...] }] }
//   coordinate in 1e-5 gradi, a delta dal civico precedente della stessa via (il primo è assoluto).

import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';

const ROOT = new URL('..', import.meta.url);
const src = process.argv[2] ?? new URL('docs/anncus/indirizzi_E974.gpkg', ROOT).pathname;

const SMALL = new Set(['di', 'del', 'della', 'dello', 'dei', 'degli', 'delle', 'da', 'e', 'ed', 'a', 'al', 'alla', 'in']);
const ROMAN = /^(?=[ivxlcdm]+$)m{0,3}(cm|cd|d?c{0,3})(xc|xl|l?x{0,3})(ix|iv|v?i{0,3})$/i;
/** "VIA GIUSEPPE GARIBALDI" -> "Via Giuseppe Garibaldi"; articoli e preposizioni minuscoli, numeri romani maiuscoli. */
function title(s) {
  return s.toLowerCase().split(/\s+/).map((w, i) => {
    if (ROMAN.test(w) && w.length > 1) return w.toUpperCase();
    const cap = (x) => x.charAt(0).toUpperCase() + x.slice(1);
    if (i > 0 && SMALL.has(w)) return w;
    // "dell'", "l'", "sant'": maiuscola dopo l'apostrofo
    return w.split("'").map((p, k, a) => (k === a.length - 1 || p.length > 1 ? cap(p) : p)).join("'");
  }).join(' ');
}

const db = new DatabaseSync(src, { readOnly: true });
const rows = db.prepare(
  'SELECT ODONIMO, CIVICO, ESPONENTE, latitude, longitude FROM indirizzi WHERE out_of_bounds = 0 AND ODONIMO IS NOT NULL AND CIVICO IS NOT NULL AND latitude IS NOT NULL AND longitude IS NOT NULL',
).all();

const esps = [''];
const espIdx = new Map([['', 0]]);
const streets = new Map();
const seen = new Set();
let dup = 0;
for (const r of rows) {
  const via = r.ODONIMO.trim().replace(/\s+/g, ' ');
  const civ = Math.round(r.CIVICO);
  const esp = (r.ESPONENTE ?? '').trim().toUpperCase();
  const key = `${via}|${civ}|${esp}`;
  if (seen.has(key)) { dup++; continue; } // punti doppi: si tiene il primo
  seen.add(key);
  if (!espIdx.has(esp)) { espIdx.set(esp, esps.length); esps.push(esp); }
  if (!streets.has(via)) streets.set(via, []);
  streets.get(via).push({ civ, e: espIdx.get(esp), la: Math.round(r.latitude * 1e5), lo: Math.round(r.longitude * 1e5) });
}

const s = [...streets.entries()]
  .sort((a, b) => a[0].localeCompare(b[0], 'it'))
  .map(([via, list]) => {
    list.sort((a, b) => a.civ - b.civ || a.e - b.e);
    const c = [];
    let pla = 0, plo = 0;
    for (const x of list) { c.push(x.civ, x.e, x.la - pla, x.lo - plo); pla = x.la; plo = x.lo; }
    return { n: title(via), c };
  });

const out = new URL('dati/indirizzi.json', ROOT);
fs.writeFileSync(out, JSON.stringify({ v: 1, e: esps, s }));
const total = s.reduce((n, x) => n + x.c.length / 4, 0);
console.log(`vie ${s.length}, civici ${total} (doppi scartati ${dup}), esponenti ${esps.length - 1}, ${(fs.statSync(out).size / 1024).toFixed(0)} KB`);
