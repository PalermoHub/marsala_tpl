// Test della logica orari e dell'integrità dei dati. Uso: node --test scripts/
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { planJourney, groupOf, walkable } from '../js/planner.js';
import { romeNow, dowOf, addDays, isServiceActive, buildIndex, nextDepartures, splitStopName, siblingStops, feedStatus, formatClock, nearestStops, distanceM, isApprox } from '../js/schedule.js';
import { buildGraph, walkFrom, walkDist, isExactWalk, DETOUR } from '../js/walk.js';

const data = JSON.parse(readFileSync(new URL('../dati/app.json', import.meta.url), 'utf8'));
const index = buildIndex(data);
const svcIdx = (id) => data.services.findIndex((s) => s.id === id);
const activeIds = (ymd) => data.services.filter((s) => isServiceActive(s, ymd)).map((s) => s.id).sort();

test('romeNow usa Europe/Rome, non il fuso del dispositivo', () => {
  assert.deepEqual(romeNow(new Date('2026-11-14T23:30:00Z')), { ymd: 20261115, dow: 6, secs: 1800 }); // CET
  assert.deepEqual(romeNow(new Date('2026-07-01T22:30:00Z')), { ymd: 20260702, dow: 3, secs: 1800 }); // CEST
});

test('giorni della settimana e aritmetica delle date', () => {
  assert.equal(dowOf(20261114), 5); // sabato
  assert.equal(dowOf(20261115), 6); // domenica
  assert.equal(addDays(20261231, 1), 20270101);
  assert.equal(addDays(20260301, -1), 20260228);
});

test('servizi: feriale, domenica, festivi e servizio solo-eccezioni', () => {
  assert.deepEqual(activeIds(20261116), ['FER5_INV_2627', 'FER6_INV_2627']); // lunedì: FER5 (lun-ven) + FER6 (lun-sab)
  assert.deepEqual(activeIds(20261114), ['FER6_INV_2627']);                // sabato: solo FER6, niente supplemento scuole
  assert.deepEqual(activeIds(20261115), ['DOM_INV_2627']);                 // domenica
  assert.deepEqual(activeIds(20261101), ['NOV12_2026']);                   // 1 nov: solo servizio speciale, definito solo in calendar_dates
  assert.deepEqual(activeIds(20261208), ['DOM_INV_2627']);                 // festivo infrasettimanale
  assert.deepEqual(activeIds(20261225), ['DOM_INV_2627']);                 // Natale
  assert.deepEqual(activeIds(20260720), ['EST_FER']);                      // estate feriale
});

test('nessun servizio fuori dalla validità del feed (gennaio 2028)', () => {
  assert.deepEqual(activeIds(20280110), []);
});

test('di domenica compaiono solo corse del servizio domenicale', () => {
  const dom = svcIdx('DOM_INV_2627');
  const now = { ymd: 20261115, dow: 6, secs: 6 * 3600 };
  let checked = 0;
  for (const si of index.keys()) {
    const { items } = nextDepartures(data, index, si, now, 50);
    for (const it of items) { assert.equal(data.trips[it.trip].v, dom); checked++; }
  }
  assert.ok(checked > 0, 'almeno una partenza domenicale');
});

test('le partenze sono ordinate, future e non includono il capolinea di arrivo', () => {
  const now = { ymd: 20261116, dow: 0, secs: 9 * 3600 };
  for (const si of index.keys()) {
    const { items } = nextDepartures(data, index, si, now, 50);
    for (let i = 0; i < items.length; i++) {
      assert.ok(items[i].secs >= now.secs);
      if (i) assert.ok(items[i].secs >= items[i - 1].secs);
      assert.ok(items[i].pos < data.trips[items[i].trip].s.length - 1);
    }
  }
});

test('a fine giornata compare la prima partenza di domani', () => {
  const now = { ymd: 20261116, dow: 0, secs: 86399 };
  const si = [...index.keys()][0];
  const r = nextDepartures(data, index, si, now, 6);
  assert.equal(r.items.length, 0);
  assert.ok(r.tomorrow && r.tomorrow.dayOffset === 1 && r.tomorrow.mins > 0);
});

test('orari oltre le 24:00 restano visibili dopo la mezzanotte (se presenti nel feed)', () => {
  const late = [];
  data.trips.forEach((t, ti) => t.t.forEach((x, pos) => { if (x >= 86400 && pos < t.s.length - 1) late.push({ ti, pos, x }); }));
  if (!late.length) return; // il feed attuale non ha corse oltre la mezzanotte
  const l = late[0];
  const day = data.services[data.trips[l.ti].v];
  const ymd = [...Array(60).keys()].map((n) => addDays(day.start, n)).find((d) => isServiceActive(day, d));
  const after = { ymd: addDays(ymd, 1), dow: dowOf(addDays(ymd, 1)), secs: 0 };
  const r = nextDepartures(data, index, data.trips[l.ti].s[l.pos], after, 50);
  assert.ok(r.items.some((i) => i.trip === l.ti));
});

test('integrità: orari crescenti, fermate e servizi esistenti, nomi puliti', () => {
  for (const t of data.trips) {
    assert.equal(t.s.length, t.t.length);
    for (let i = 1; i < t.t.length; i++) assert.ok(t.t[i] >= t.t[i - 1]);
    assert.ok(t.v >= 0 && t.v < data.services.length);
    assert.ok(t.r >= 0 && t.r < data.routes.length);
    t.s.forEach((s) => assert.ok(data.stops[s]));
  }
  data.stops.forEach((s) => assert.equal(s.name, s.name.replace(/\s+/g, ' ').trim()));
});

test('nomi fermata e fermate sull\'altro senso', () => {
  assert.deepEqual(splitStopName('Corso Calatafimi dir. Autostazione'), { base: 'Corso Calatafimi', dir: 'Autostazione' });
  assert.deepEqual(splitStopName('Via Mazzini dir.FF.SS.'), { base: 'Via Mazzini', dir: 'FF.SS.' });
  assert.deepEqual(splitStopName('Via Mazzini dir Inam'), { base: 'Via Mazzini', dir: 'Inam' });
  assert.deepEqual(splitStopName('Via Dirk'), { base: 'Via Dirk', dir: '' });
  assert.deepEqual(splitStopName('Via Roma'), { base: 'Via Roma', dir: '' });
  const withSib = data.stops.findIndex((_, i) => siblingStops(data, i).length > 0);
  assert.ok(withSib >= 0);
});

test('validità del feed', () => {
  assert.equal(feedStatus({ validTo: 20270613 }, 20261114).state, 'ok');
  assert.equal(feedStatus({ validTo: 20270613 }, 20270601).state, 'soon');
  assert.equal(feedStatus({ validTo: 20270613 }, 20270614).state, 'expired');
  assert.equal(formatClock(86400 + 5 * 60), '00:05');
});

test('planner: la corsa diretta si trova, con orari coerenti', () => {
  const ymd = 20261116; // lunedì
  const ti = data.trips.findIndex((t) => isServiceActive(data.services[t.v], ymd) && t.s.length > 3);
  const tr = data.trips[ti];
  const a = tr.s[0], b = tr.s[tr.s.length - 1];
  const opts = planJourney(data, index, { from: [{ stop: a, walk: 0 }], to: [{ stop: b, walk: 0 }], ymd, secs: tr.t[0] - 60 });
  assert.ok(opts.length > 0);
  const o = opts[0];
  assert.ok(o.end > o.start);
  for (const l of o.legs.filter((x) => x.kind === 'bus')) {
    assert.ok(l.arr > l.dep && l.to > l.from);
  }
});

test('planner: con un cambio i tempi sono consistenti e non si parte prima dell\'ora scelta', () => {
  const ymd = 20261116;
  let found = null;
  const n = data.stops.length;
  for (let i = 0; i < n && !found; i += 7) {
    for (let j = 3; j < n && !found; j += 11) {
      if (i === j) continue;
      const o = planJourney(data, index, { from: [{ stop: i, walk: 0 }], to: [{ stop: j, walk: 0 }], ymd, secs: 8 * 3600 }).find((x) => x.transfers === 1);
      if (o) found = o;
    }
  }
  assert.ok(found, 'nessun percorso con cambio trovato nella rete');
  const bus = found.legs.filter((l) => l.kind === 'bus');
  assert.equal(bus.length, 2);
  assert.ok(bus[0].dep >= 8 * 3600);
  assert.ok(bus[1].dep > bus[0].arr, 'la seconda corsa parte dopo l\'arrivo della prima');
});

test('planner: stessa fermata, nessun risultato assurdo; gruppi e posizione', () => {
  const ymd = 20261116;
  assert.ok(groupOf(data, 0).includes(0));
  const c = data.stops[0];
  const w = walkable(data, c.lat, c.lon);
  assert.ok(w.length > 0 && w[0].walk <= 800);
  const o = planJourney(data, index, { from: [{ stop: 0, walk: 0 }], to: [{ stop: 0, walk: 0 }], ymd, secs: 8 * 3600 });
  assert.equal(o.length, 0);
});

test('mezzo sulla linea: posizione lungo il tracciato e tra le fermate', async () => {
  const { buildRouteLines, locateBus, stopsAlong, placeOnStops } = await import('../js/match.js');
  const shapes = JSON.parse(readFileSync(new URL('../dati/shapes.json', import.meta.url), 'utf8'));
  const lines = buildRouteLines(data, shapes);
  const ln = lines[0];
  const tr = data.trips.find((x) => x.sh === ln.sh);
  const stops = tr.s.map((si) => data.stops[si]);
  const alongs = stopsAlong(ln.flat, stops);
  assert.ok(alongs.every((a, i) => i === 0 || a >= alongs[i - 1]), 'fermate in ordine lungo il tracciato');
  // Mezzo esattamente su una fermata intermedia
  const k = Math.floor(stops.length / 2);
  const onStop = locateBus(lines, { lat: stops[k].lat, lon: stops[k].lon, speed: 0, bearing: null }, ln.r);
  assert.ok(onStop && onStop.d < 60);
  const p = placeOnStops(alongs, onStop.along);
  assert.equal(p.at, true);
  // Mezzo a metà tra due fermate
  const mid = (alongs[k] + alongs[k + 1]) / 2;
  const q = placeOnStops(alongs, mid);
  if (alongs[k + 1] - alongs[k] > 120) assert.deepEqual(q, { k, at: false });
  assert.deepEqual(placeOnStops(alongs, -500), { k: -1, at: false });
});

test('avvisi: parsing RSS, filtro trasporti, unione senza duplicati', async () => {
  const { parseRss, merge } = await import('./build-avvisi.mjs');
  const xml = `<rss><channel><item><title>Deviazione linea 3 &amp; 4</title><link>https://x.it/a</link>
<description><![CDATA[Corse <b>deviate</b> per lavori.<img src="https://x.it/i.jpg" />]]></description>
<enclosure url="https://x.it/i.jpg" length="1" type="image/jpeg"/><dc:date>2026-11-12T10:00:00Z</dc:date></item>
<item><title>Concorso</title><link>javascript:alert(1)</link><description>x</description><dc:date>2026-11-11T10:00:00Z</dc:date></item>
<item><title>Sagra</title><link>https://x.it/b</link><description>Festa in piazza</description><dc:date>2026-11-10T10:00:00Z</dc:date></item></channel></rss>`;
  const items = parseRss(xml);
  assert.equal(items.length, 2, 'scarta i link non https');
  assert.equal(items[0].title, 'Deviazione linea 3 & 4');
  assert.ok(!/[<>]/.test(items[0].summary), 'niente HTML nel riassunto');
  assert.equal(items[0].transport, true);
  assert.equal(items[1].transport, false);
  const merged = merge([{ ...items[1], title: 'vecchio' }, { title: 'Prima', link: 'https://x.it/c', date: '2026-11-01T00:00:00Z' }], items);
  assert.equal(merged.length, 3);
  assert.equal(merged.find((i) => i.link === 'https://x.it/b').title, 'Sagra');
  assert.deepEqual(merged.map((i) => i.date), [...merged.map((i) => i.date)].sort().reverse());
});

// ---------- distanza a piedi sulla rete ----------
// Grafo a U: due punti a 88 m in linea d'aria, ma il solo passaggio è 300 m a nord e poi 300 m a sud.
const U = buildGraph({
  v: 1,
  la: [3780000, 270, 0, -270],
  lo: [1244000, 0, 100, 0],
  e: [0, 1, 1, 2, 1, 3],
});
const uStops = [{ lat: 37.8, lon: 12.441 }, { lat: 37.8, lon: 12.44 }];

test('walkFrom: la rete obbliga al giro, la linea d\'aria no', () => {
  const crow = distanceM(37.8, 12.44, 37.8, 12.441);
  const m = walkFrom(U, uStops, 37.8, 12.44, 1500);
  assert.ok(m.get(0) > 650 && m.get(0) < 720, `a piedi ${m.get(0)}`); // 300 + 88 + 300
  assert.ok(crow < 100, `linea d'aria ${crow}`);
  assert.ok(m.get(1) < 1, 'la fermata sul punto di partenza è a 0 m');
});

test('walkFrom: aggancio al segmento, non al nodo (arco lungo in campagna)', () => {
  // Un solo arco di ~1,1 km (0,01° di latitudine); punto e fermata a metà strada, a 20 m dall'arco.
  const L = buildGraph({ v: 1, la: [3780000, 1000], lo: [1244000, 0], e: [0, 1] });
  const mid = 37.805, off = 20 / 111320;
  const m = walkFrom(L, [{ lat: mid, lon: 12.44 + off }, { lat: 37.8, lon: 12.44 }], mid + 0.0001, 12.44 - off, 1500);
  assert.ok(m.get(0) < 60, `a metà arco: ${m.get(0)} m (con l'aggancio al nodo sarebbe ~1100 m)`);
  assert.ok(m.get(1) > 540 && m.get(1) < 600, `capo dell'arco: ${m.get(1)} m`);
});

test('walkFrom: oltre maxM la fermata non compare; lontano dalla rete ritorna null', () => {
  const far = walkFrom(U, [...uStops, { lat: 37.9, lon: 12.5 }], 37.8, 12.44, 500);
  assert.equal(far.has(0), false);
  assert.equal(far.offNet.has(2), true);   // la fermata lontana dalla rete: la rete non sa
  assert.equal(far.offNet.has(0), false);  // la fermata sulla rete ma oltre 500 m: è lontana, non "sconosciuta"
  assert.equal(walkDist(far)(0, 88), Infinity);
  assert.equal(walkDist(far)(2, 1000), 1000 * DETOUR);
  assert.equal(walkFrom(U, uStops, 37.8, 12.44, 500).has(0), false);
  assert.equal(walkFrom(U, uStops, 37.9, 12.5, 1500), null);
});

test('walkDist: rete se c\'è; fermata sulla rete ma non raggiunta = lontana; rapporto solo dove la rete non copre', () => {
  const m = new Map([[3, 410]]); m.offNet = new Set([5]);
  assert.equal(walkDist(m)(3, 100), 410);
  assert.equal(walkDist(m)(4, 500), Infinity);          // sulla rete, oltre il raggio: non va mostrata come "695 m"
  assert.equal(walkDist(m)(5, 100), 100 * DETOUR);      // fuori dalla rete: la rete non sa, si stima
  assert.equal(walkDist(null)(4, 100), 100 * DETOUR);
  assert.deepEqual(nearestStops({ stops: [{ lat: 37.8, lon: 12.44 }] }, 37.8, 12.44, 1, () => Infinity), []); // mai in elenco con distanza infinita
  assert.equal(isExactWalk(m, 3), true);
  assert.equal(isExactWalk(m, 4), false);
  assert.equal(isExactWalk(null, 4), false);
});

test('nearestStops e walkable usano la distanza a piedi quando viene data', () => {
  const d = { stops: uStops };
  const crowFirst = nearestStops(d, 37.8, 12.4409, 2);                   // senza rete: la fermata a 10 m
  assert.equal(crowFirst[0].i, 0);
  const net = walkDist(new Map([[0, 700], [1, 50]]));
  const byWalk = nearestStops(d, 37.8, 12.4409, 2, net);                  // con rete: l'altra è molto più vicina
  assert.equal(byWalk[0].i, 1);
  assert.equal(byWalk[0].m, 50);
  const w = walkable(d, 37.8, 12.4409, 800, 4, walkDist(new Map([[0, 900], [1, 700]])));
  assert.deepEqual(w.map((x) => x.stop), [1]);                           // 900 m a piedi: fuori dal raggio di 800 m
  assert.equal(w[0].walk, Math.round(700 / 1.2));
});

// Riferimento indipendente: stesse distanze calcolate in Python (UTM, aggancio al segmento con shapely, Dijkstra di scipy): docs/fase1/diff/walk-ref-segmento.py.
// Differenze attese solo dalla quantizzazione a 1e-5 gradi e dalla formula equirettangolare.
const PY = [{"lat": 37.804909, "lon": 12.460815, "stops": [{"id": "21349", "m": 139.6}, {"id": "21350", "m": 147.1}, {"id": "21581", "m": 343.9}, {"id": "21352", "m": 381.1}, {"id": "21351", "m": 381.6}]}, {"lat": 37.709205, "lon": 12.476265, "stops": [{"id": "21095", "m": 364.3}, {"id": "21032", "m": 573.2}, {"id": "21093", "m": 661.9}, {"id": "21097", "m": 670.3}, {"id": "21096", "m": 894.4}]}, {"lat": 37.729782, "lon": 12.530687, "stops": [{"id": "21315", "m": 507.4}, {"id": "21313", "m": 601.3}, {"id": "21314", "m": 626.6}, {"id": "21316", "m": 804.7}, {"id": "21312", "m": 1015.4}]}, {"lat": 37.811862, "lon": 12.481299, "stops": [{"id": "21363", "m": 512.8}, {"id": "21365", "m": 508.3}, {"id": "21587", "m": 592.6}, {"id": "21369", "m": 616.1}, {"id": "21561", "m": 793.5}]}, {"lat": 37.798599, "lon": 12.428991, "stops": [{"id": "21645", "m": 41.2}, {"id": "21448", "m": 46.1}, {"id": "21644", "m": 350.6}, {"id": "21447", "m": 364.0}, {"id": "21449", "m": 359.7}]}];
// Le fermate di riferimento sono copiate qui (id, lat, lon): il test non dipende dal feed vivo, che il workflow notturno rigenera.
const PY_STOPS = [{"id": "21032", "lat": 37.704957, "lon": 12.476147}, {"id": "21093", "lat": 37.708891, "lon": 12.482425}, {"id": "21095", "lat": 37.707279, "lon": 12.476052}, {"id": "21096", "lat": 37.702512, "lon": 12.475754}, {"id": "21097", "lat": 37.709141, "lon": 12.482647}, {"id": "21312", "lat": 37.731863, "lon": 12.521099}, {"id": "21313", "lat": 37.730195, "lon": 12.525294}, {"id": "21314", "lat": 37.727241, "lon": 12.525976}, {"id": "21315", "lat": 37.726309, "lon": 12.527416}, {"id": "21316", "lat": 37.723938, "lon": 12.525921}, {"id": "21349", "lat": 37.805933, "lon": 12.460634}, {"id": "21350", "lat": 37.80589, "lon": 12.460545}, {"id": "21351", "lat": 37.805671, "lon": 12.46348}, {"id": "21352", "lat": 37.805648, "lon": 12.463463}, {"id": "21363", "lat": 37.808773, "lon": 12.481955}, {"id": "21365", "lat": 37.808749, "lon": 12.482013}, {"id": "21369", "lat": 37.810202, "lon": 12.486351}, {"id": "21447", "lat": 37.801044, "lon": 12.426441}, {"id": "21448", "lat": 37.798243, "lon": 12.429208}, {"id": "21449", "lat": 37.796218, "lon": 12.431546}, {"id": "21561", "lat": 37.816608, "lon": 12.47876}, {"id": "21581", "lat": 37.806443, "lon": 12.463232}, {"id": "21587", "lat": 37.815016, "lon": 12.477259}, {"id": "21644", "lat": 37.796287, "lon": 12.431482}, {"id": "21645", "lat": 37.7983, "lon": 12.429214}];
test('walkFrom coincide con il calcolo in Python sullo stesso estratto OSM (±4% o 15 m)', () => {
  const g = buildGraph(JSON.parse(readFileSync(new URL('../dati/walk.json', import.meta.url), 'utf8')));
  let checked = 0;
  for (const o of PY) {
    const m = walkFrom(g, PY_STOPS, o.lat, o.lon, 1500);
    assert.ok(m, 'punto sulla rete');
    for (const s of o.stops) {
      const i = PY_STOPS.findIndex((x) => x.id === s.id);
      const js = m.get(i);
      assert.ok(js !== undefined, `fermata ${s.id} non raggiunta (Python ${s.m} m)`);
      assert.ok(Math.abs(js - s.m) <= Math.max(15, s.m * 0.04), `fermata ${s.id}: JS ${js.toFixed(0)} m, Python ${s.m} m`);
      checked++;
    }
  }
  assert.equal(checked, 25);
});

test('isApprox: solo le fermate intermedie con lo stesso minuto della precedente', () => {
  const trip = { t: [28800, 28800, 28860, 28860, 28920] };
  assert.equal(isApprox(trip, 0), false);  // capolinea di partenza
  assert.equal(isApprox(trip, 1), true);   // stesso minuto della precedente
  assert.equal(isApprox(trip, 2), false);
  assert.equal(isApprox(trip, 3), true);
  assert.equal(isApprox(trip, 4), false);
});
