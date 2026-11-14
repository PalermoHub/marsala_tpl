// Registratore del feed GTFS-RT vehicle_positions del Comune di Marsala.
// Il feed non ha storico: per misurare la puntualità reale bisogna registrarlo noi.
//
// Uso: node scripts/rt-log.mjs --out <cartella> [--minutes 55] [--interval 30]
//
// Salva il protobuf grezzo (base64), senza decodificarlo, così l'analisi futura non dipende
// da come lo interpreto oggi. Un file al giorno (UTC): <out>/AAAA-MM-GG.ndjson.gz.
// Ogni esecuzione aggiunge un "membro" gzip in coda: la concatenazione di membri gzip è un gzip valido.
//
// Una riga per tentativo:
//   {"t":<ms ricezione>,"b64":"..."}   payload nuovo
//   {"t":<ms>,"same":1}                payload identico al precedente (non si ripete)
//   {"t":<ms>,"err":"..."}             tentativo fallito (i buchi vanno registrati, non nascosti)

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const RT_URL = 'https://7ydpklv7b2.execute-api.eu-north-1.amazonaws.com/prod/gtfs_realtime_marsala/vehicle_positions';

const arg = (name, def) => {
  const i = process.argv.indexOf('--' + name);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
};
const out = arg('out');
const minutes = Number(arg('minutes', 55));
const interval = Number(arg('interval', 30));
if (!out || !(minutes > 0) || !(interval >= 5)) {
  console.error('Uso: node scripts/rt-log.mjs --out <cartella> [--minutes 55] [--interval >=5]');
  process.exit(2);
}
fs.mkdirSync(out, { recursive: true });

const lines = []; // [giornoUTC, riga]
let prev = null;
let ok = 0, same = 0, fail = 0;

async function sample() {
  const t = Date.now();
  const day = new Date(t).toISOString().slice(0, 10);
  try {
    const res = await fetch(RT_URL, { cache: 'no-store', signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const b64 = Buffer.from(await res.arrayBuffer()).toString('base64');
    if (b64 === prev) { same++; lines.push([day, { t, same: 1 }]); }
    else { ok++; prev = b64; lines.push([day, { t, b64 }]); }
  } catch (e) {
    fail++;
    lines.push([day, { t, err: String(e.message || e).slice(0, 120) }]);
  }
}

function flush() {
  const perDay = new Map();
  for (const [day, row] of lines) {
    if (!perDay.has(day)) perDay.set(day, []);
    perDay.get(day).push(JSON.stringify(row));
  }
  for (const [day, rows] of perDay) {
    fs.appendFileSync(path.join(out, day + '.ndjson.gz'), zlib.gzipSync(rows.join('\n') + '\n'));
  }
}

// Se il job viene fermato (timeout, cancellazione) i campioni già raccolti non vanno persi.
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => { flush(); process.exit(0); });

const start = Date.now();
const end = start + minutes * 60_000;
let n = 0;
while (Date.now() < end) {
  const tick = start + n * interval * 1000;
  await sample();
  n++;
  const wait = start + n * interval * 1000 - Date.now(); // cadenza fissa, senza deriva
  if (Date.now() + Math.max(wait, 0) >= end) break;
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
}
flush();

const expected = Math.floor((minutes * 60) / interval);
const msg = `Campioni: ${lines.length} tentativi (attesi ~${expected}) · nuovi ${ok} · identici ${same} · falliti ${fail}`;
console.log(msg);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, msg + '\n');
// Un job in cui nessun tentativo è andato a buon fine è un fallimento: il feed è giù o cambiato.
if (ok + same === 0) { console.error('Nessun campione valido.'); process.exit(1); }
