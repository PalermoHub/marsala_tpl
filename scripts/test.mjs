// Test della logica orari e dell'integrità dei dati. Uso: node --test scripts/
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { planJourney, groupOf, walkable } from '../js/planner.js';
import { romeNow, dowOf, addDays, isServiceActive, buildIndex, nextDepartures, splitStopName, siblingStops, feedStatus, formatClock } from '../js/schedule.js';

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
