// Esegue il vero js/schedule.js (non modificato) sulle query. Uso: node run-app.mjs <gtfs-raw> <exp.json> <out.json> [--no-holiday-fix]
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const REPO = '/home/coseerobe/GitHub-Clone/coseerobe/marsala_tpl';
const [raw, expF, outF, ...flags] = process.argv.slice(2);
const tmp = mkdtempSync(join(tmpdir(), 'diff-'));
execFileSync('node', [join(REPO, 'scripts/build-gtfs.mjs'), raw, '--out', tmp, ...flags], { stdio: 'pipe' });
const data = JSON.parse(readFileSync(join(tmp, 'app.json'), 'utf8'));
const { nextDepartures, buildIndex } = await import(process.env.SCHED_JS ?? join(REPO, 'js/schedule.js'));
const { q, order } = JSON.parse(readFileSync(expF, 'utf8'));
// app.json non ha trip_id: la corsa i è la i-esima di trips.txt (verificato sotto con il conteggio)
if (data.trips.length !== order.length) throw new Error(`corse app ${data.trips.length} != feed ${order.length}`);
const index = buildIndex(data);
const sidx = new Map(data.stops.map((s, i) => [s.id, i]));
const out = q.map((x) => {
  const si = sidx.get(x.stop);
  const r = nextDepartures(data, index, si, { ymd: x.ymd, secs: x.secs });
  const f = (d) => [d.secs + (d.dayOffset ? 0 : 0), order[d.trip], d.pos, d.dayOffset];
  return { items: r.items.map(f), tom: r.tomorrow ? [f(r.tomorrow)] : [] };
});
writeFileSync(outF, JSON.stringify(out));
console.log('app:', out.length, 'risposte; correzioni build:', JSON.stringify(JSON.parse(readFileSync(join(tmp,'app.json'),'utf8')).meta.corrections.length));
