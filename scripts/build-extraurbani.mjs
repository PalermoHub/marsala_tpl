// Aggiorna le corse extraurbane (treni RFI, pullman AST e Autoservizi Salemi) di js/orari-luoghi.js.
//
// Uso: node scripts/build-extraurbani.mjs [--out file.js] [--solo fs,salemi] [--html rfi.html]
// Senza --out riscrive js/orari-luoghi.js. Solo `corse` (e le date dei servizi derivate dalla fonte) cambiano:
// luoghi, testi, festivi e flag a mano restano come sono.
//
// Regola: ogni servizio è isolato e "fail-closed". Se scarico, lettura o controlli di sanità falliscono, o se
// la fonte contiene qualcosa che non conosco (periodicità, stazione), il servizio resta com'era e lo script
// esce con un avviso (codice 3 se almeno un servizio non è stato aggiornato). Niente ipotesi.
import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const QUI = dirname(fileURLToPath(import.meta.url));
const FILE = resolve(QUI, '../js/orari-luoghi.js');
const RFI_URL = 'https://prm.rfi.it/qo_prm/QO_Partenze_SiPMR.aspx?Id=1543&lin=&dalle=00.00&alle=24.00&ora=00.00&guid=';
const UA = 'Mozilla/5.0'; // il sito Salemi chiude la connessione con user-agent più descrittivi

// Stazioni della zona di Marsala: nome RFI (minuscolo) → id del luogo in ORARI.luoghi.
const STAZIONI = { 'marsala': 'marsala', 'terrenove': 'terrenove', 'petrosino-strasatti': 'petrosino', 'spagnuola': 'spagnuola', 'mozia-birgi': 'mozia' };
// Periodicità RFI (testo esatto, maiuscolo) → codice giorni di luoghi.js.
const PERIODICITA = {
  '*NON CIRCOLA NEI GIORNI FESTIVI': 'LS',
  '*CIRCOLA NEI GIORNI FESTIVI': 'H',
  '*NON CIRCOLA NEI GIORNI FESTIVI E PREFESTIVI': 'LV',
};

const decodifica = (s) => s.replace(/&agrave;/g, 'à').replace(/&egrave;/g, 'è').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&#39;/g, "'");
const pulisci = (s) => decodifica(s.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const titolo = (s) => s.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase()).replace(/\b(Di|Del)\b/g, (m) => m.toLowerCase());

async function scarica(url, binario = false) {
  let ultimo;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(30000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return binario ? Buffer.from(await r.arrayBuffer()) : await r.text();
    } catch (e) { ultimo = e; await new Promise((ok) => setTimeout(ok, 3000 * (i + 1))); }
  }
  throw new Error(`${url}: ${ultimo.message}`);
}

// ---------- RFI: treni regionali ----------
export function leggiRfi(html) {
  const righe = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || [];
  const corse = [];
  for (let i = 0; i < righe.length; i++) {
    const r = righe[i];
    if (!/class="cellauno/.test(r)) continue;
    const celle = [...r.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => pulisci(m[1].replace(/<img[^>]*>/g, ' ')));
    // celle: ora partenza, numero, arrivo (ora), binario, servizi, impresa, precedenti, successive
    const ora = (celle[0].match(/^\d\d\.\d\d$/) || [])[0];
    const n = (celle[1].match(/\d{3,6}/) || [])[0];
    const arr = celle[2].match(/^(.+?) \((\d\d\.\d\d)\)$/);
    if (!ora || !n || !arr) throw new Error(`riga treno illeggibile: ${celle.slice(0, 3).join(' | ')}`);
    const fermate = (s) => [...s.matchAll(/([^()]+?) \((\d\d\.\d\d)\)/g)].map((m) => [m[1].trim(), m[2]]);
    const prec = fermate(celle[6] || '');
    const succ = fermate(celle[7] || '');
    // Periodicità: nella riga di dettaglio che segue.
    // Il dettaglio può mancare, o avere solo "Avvertenze": nessuna periodicità = circola tutti i giorni ('T').
    const det = /rowOpen/.test(righe[i + 1] || "") && new RegExp(`Treno ${n} delle`).test(righe[i + 1]) ? righe[i + 1] : "";
    const mp = det.match(/<h5>\s*Periodicit[^<]*<\/h5>([\s\S]*?)<\/div>/);
    const per = mp ? pulisci(mp[1]).toUpperCase() : '';
    if (mp ? !(per in PERIODICITA) : false) throw new Error(`treno ${n}: periodicità sconosciuta "${per}"`);
    const f = [];
    const tutte = [...prec, ['Marsala', ora], ...succ, [titolo(arr[1]), arr[2]]];
    tutte.forEach(([nome, h], k) => {
      const id = STAZIONI[nome.toLowerCase()];
      if (id) f.push([id, h]);
      else if (k === 0) f.push([titolo(nome)]); // origine fuori zona: solo il nome
      else if (k === tutte.length - 1) f.push([titolo(nome), h]); // destinazione
    });
    corse.push({ s: 'fs', n: `R ${n}`, g: mp ? PERIODICITA[per] : 'T', f });
  }
  if (corse.length < 20) throw new Error(`RFI: troppo poche corse (${corse.length})`);
  return corse;
}

// ---------- Salemi: solo rilevamento modifiche ----------
// I PDF hanno intestazioni a colonne con simboli e note a parte: non si leggono in modo affidabile. Si confronta
// l'impronta del testo con quella salvata in scripts/fonti-extraurbani.json: se cambia, serve una revisione a mano.
const SALEMI = {
  'salemi-marsala-palermo': 'https://www.autoservizisalemi.it/orari/MARSALA-PALERMO.pdf',
  'salemi-palermo-marsala': 'https://www.autoservizisalemi.it/orari/PALERMO-MARSALA.pdf',
};
const MANIFESTO = resolve(QUI, 'fonti-extraurbani.json');

async function impronte() {
  const r = {};
  for (const [id, url] of Object.entries(SALEMI)) {
    const pdf = await scarica(url, true);
    const testo = execFileSync('pdftotext', ['-layout', '-', '-'], { input: pdf, maxBuffer: 1 << 26 }).toString('utf8');
    const vigore = (testo.match(/ORARI IN VIGORE DAL\s+(\d\d\/\d\d\/\d{4})/) || [])[1];
    if (!vigore || testo.length < 2000) throw new Error(`${id}: PDF irriconoscibile`);
    r[id] = { vigore, hash: createHash('sha256').update(testo.replace(/\s+/g, ' ')).digest('hex').slice(0, 16) };
  }
  return r;
}

// ---------- scrittura ----------
function serializza(ORARI, intestazione) {
  return `${intestazione}\nexport const ORARI = ${JSON.stringify(ORARI)};\n`;
}

async function main() {
  const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
  const out = arg('--out') || FILE;
  const solo = (arg('--solo') || 'fs,salemi').split(',');
  const sorgente = readFileSync(FILE, 'utf8');
  const intestazione = sorgente.split('\n').filter((l) => l.startsWith('//')).join('\n');
  const { ORARI } = await import(`${pathToFileURL(FILE).href}?v=${Date.now()}`);
  const nuovo = structuredClone(ORARI);
  let falliti = 0;

  const per = (nome, fn) => fn().catch((e) => { falliti++; console.log(`::warning::${nome} NON aggiornato (restano le corse precedenti): ${e.message}`); return null; });

  if (solo.includes('fs')) {
    const corse = await per('Treni RFI', async () => leggiRfi(arg('--html') ? readFileSync(arg('--html'), 'utf8') : await scarica(RFI_URL)));
    if (corse) nuovo.corse = [...corse, ...nuovo.corse.filter((c) => c.s !== 'fs')];
  }

  if (solo.includes('salemi')) {
    const nuove = await per('Salemi', impronte);
    if (nuove) {
      const vecchie = existsSync(MANIFESTO) ? JSON.parse(readFileSync(MANIFESTO, 'utf8')) : {};
      const diverse = Object.keys(nuove).filter((k) => vecchie[k]?.hash !== nuove[k].hash);
      if (process.argv.includes('--accetta')) writeFileSync(MANIFESTO, JSON.stringify(nuove, null, 2) + '\n');
      else if (diverse.length) {
        const msg = diverse.map((k) => `${k} (in vigore dal ${nuove[k].vigore})`).join(', ');
        console.log(`::warning::Orari Salemi cambiati: ${msg}. Rivedere le corse "salemi" in js/orari-luoghi.js.`);
        if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `salemi_cambiato=true\nmessaggio=${msg}\n`);
        falliti++;
      } else console.log('Salemi: nessuna novità.');
    }
  }

  const testo = serializza(nuovo, intestazione);
  if (JSON.stringify(nuovo) !== JSON.stringify(ORARI) || out !== FILE) writeFileSync(out, testo);
  else console.log('Nessuna novità.');
  process.exitCode = falliti ? 3 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
