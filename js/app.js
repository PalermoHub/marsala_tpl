// Marsala TPL: router, viste e stato. Vanilla ES modules, nessun framework.
import { romeNow, buildIndex, nextDepartures, nearestStops, splitStopName, siblingStops, formatClock, feedStatus, isServiceActive, addDays } from './schedule.js';
import { tileSvg, motifField, lineStyle } from './tiles.js';
import { planJourney, groupOf, walkable } from './planner.js';
import { t, setLang, getLang, detectLang } from './i18n.js';
import * as store from './store.js';

const $app = document.getElementById('app');
const $nav = document.getElementById('tabs');

const state = { plan: { from: null, to: null, time: null }, groups: null, data: null, index: null, stopRoutes: null, loc: null, locStatus: 'idle', cleanup: null };

// ---------- utilità ----------
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeUrl = (u) => (/^https?:\/\//i.test(u || '') ? u : '#');
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const base = () => new URL('.', document.baseURI).href;

const ICON = {
  star: '<path d="M12 3.6l2.5 5.2 5.7.8-4.1 4 1 5.7-5.1-2.7-5.1 2.7 1-5.7-4.1-4 5.7-.8z"/>',
  share: '<path d="M12 15V4M8 8l4-4 4 4M5 13v6h14v-6"/>',
  pin: '<path d="M12 21s6-5.6 6-10.5a6 6 0 10-12 0C6 15.400 12 21 12 21z"/><circle cx="12" cy="10.500" r="2.200"/>',
  list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
  map: '<path d="M9 4L3.500 6v14L9 18l6 2 5.500-2V4L15 6z M9 4v14M15 6v14"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.500h.01"/>',
  search: '<circle cx="11" cy="11" r="6.500"/><path d="M16 16l4.500 4.500"/>',
  clock: '<circle cx="12" cy="12" r="8.500"/><path d="M12 7.500V12l3 2"/>',
  locate: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8"/><path d="M12 1.500v3M12 19.500v3M1.500 12h3M19.500 12h3"/>',
  chevron: '<path d="M9 6l6 6-6 6"/>',
  back: '<path d="M15 6l-6 6 6 6"/>',
  home: '<path d="M4 11l8-7 8 7v9H4z"/><path d="M10 20v-6h4v6"/>',
  route: '<circle cx="6" cy="18" r="2.500"/><circle cx="18" cy="6" r="2.500"/><path d="M8.500 18H15a3 3 0 000-6H9a3 3 0 010-6h6.500"/>',
  swap: '<path d="M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3"/>',
};
const icon = (name, size = 22, filled = false) =>
  `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICON[name]}</svg>`;

function whenParts(item) {
  const m = item.mins;
  if (m < 1) return { num: t('now'), unit: '', sub: '' };
  if (m < 60) return { num: String(m), unit: t('min'), sub: '' };
  return { num: formatClock(item.secs), unit: '', sub: t('inHm', Math.floor(m / 60), m % 60) };
}
const relText = (item) => (item.mins < 1 ? t('now') : item.mins < 60 ? t('inMin', item.mins) : t('inHm', Math.floor(item.mins / 60), item.mins % 60));
const routeOfTrip = (ti) => state.data.routes[state.data.trips[ti].r];
const headOf = (trip) => trip.h || state.data.routes[trip.r].long;
const fmtDate = (ymd) => new Date(Date.UTC(Math.floor(ymd / 10000), Math.floor((ymd % 10000) / 100) - 1, ymd % 100)).toLocaleDateString(getLang(), { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

// ---------- dati ----------
async function loadData() {
  const res = await fetch('dati/app.json');
  if (!res.ok) throw new Error(`dati ${res.status}`);
  state.data = await res.json();
  state.index = buildIndex(state.data);
  state.stopRoutes = new Map();
  state.data.trips.forEach((trip) => trip.s.forEach((si) => {
    if (!state.stopRoutes.has(si)) state.stopRoutes.set(si, new Set());
    state.stopRoutes.get(si).add(trip.r);
  }));
}
let shapesPromise = null;
const loadShapes = () => (shapesPromise ??= fetch('dati/shapes.json').then((r) => { if (!r.ok) throw new Error('shapes'); return r.json(); }));

const stopById = (id) => state.data.stops.findIndex((s) => s.id === id);
const routeById = (id) => state.data.routes.findIndex((r) => r.id === id);
const isFav = (id) => store.get('favs', []).includes(id);

function routesOfStop(si, size = 26, max = 3) {
  const set = state.stopRoutes.get(si);
  if (!set) return '';
  const key = (r) => state.data.routes[r].short || '\uffff'; // le navette senza numero vanno in fondo
  const list = [...set].sort((a, b) => key(a).localeCompare(key(b), 'it', { numeric: true }));
  const shown = list.slice(0, max).map((r) => tileSvg(state.data.routes[r], size)).join('');
  return list.length > max ? `${shown}<span class="more" aria-label="${list.length - max}">+${list.length - max}</span>` : shown;
}
function stopTitle(si) {
  const s = state.data.stops[si];
  const { base: name, dir } = splitStopName(s.name);
  return { name, dir, code: s.code };
}

// ---------- componenti ----------
function banners(now) {
  const out = [];
  const fs = feedStatus(state.data.meta, now.ymd);
  if (fs.state === 'expired') out.push(`<p class="banner warn" role="status">${esc(t('feedExpired'))}</p>`);
  else if (fs.state === 'soon') out.push(`<p class="banner warn" role="status">${esc(t('feedSoon', fs.daysLeft))}</p>`);
  if (!navigator.onLine) out.push(`<p class="banner" role="status">${esc(t('offline'))}</p>`);
  return out.join('');
}

function departureRow(item) {
  const trip = state.data.trips[item.trip];
  const clock = formatClock(item.secs);
  const soon = item.mins < 60;
  const first = soon ? (item.mins < 1 ? t('now') : `${item.mins} ${t('min')}`) : clock;
  const second = soon ? clock : relText(item);
  return `<li class="dep">
  <a class="dep-link" href="#/linea/${esc(routeOfTrip(item.trip).id)}">
    ${tileSvg(routeOfTrip(item.trip), 40)}
    <span class="dep-main"><span class="dep-head">${esc(headOf(trip))}</span></span>
    <span class="dep-when"><span class="dep-first">${esc(first)}</span><span class="dep-second">${esc(second)}</span></span>
  </a>
</li>`;
}

/** Stato della striscia di piastrelle sul campo cobalto: ok | warn (orari scaduti o in scadenza) | offline. */
function stripState(now) {
  if (feedStatus(state.data.meta, now.ymd).state !== 'ok') return 'warn';
  return navigator.onLine ? 'ok' : 'offline';
}

/** Schermata di una fermata: campo cobalto con la prossima partenza, poi le successive. */
function stopScreen(si, { home = false } = {}) {
  const now = romeNow();
  const s = state.data.stops[si];
  const { name, dir, code } = stopTitle(si);
  const { items, tomorrow } = nextDepartures(state.data, state.index, si, now, 7);
  const fav = isFav(s.id);
  const first = items[0];

  let nextBlock;
  if (first) {
    const w = whenParts(first);
    const trip = state.data.trips[first.trip];
    nextBlock = `<div class="next">
  <div class="next-line">${tileSvg(routeOfTrip(first.trip), 72)}<p class="next-head">${esc(headOf(trip))}</p></div>
  <p class="next-when" aria-live="polite"><span class="num">${esc(w.num)}</span>${w.unit ? `<span class="unit">${esc(w.unit)}</span>` : ''}</p>
  <p class="next-sub">${icon('clock', 16)}<span>${esc(t('scheduled'))} · ${esc(w.sub || formatClock(first.secs))}</span></p>
</div>`;
  } else {
    nextBlock = `<div class="next next-empty">
  <p class="empty-title">${esc(t(tomorrow ? 'noMoreToday' : 'noService'))}</p>
  ${tomorrow ? `<p class="empty-sub">${esc(t('firstTomorrow', formatClock(tomorrow.secs)))}</p>` : ''}
</div>`;
  }

  const rest = items.slice(1);
  const sibs = siblingStops(state.data, si);
  const sibHtml = sibs.length ? `<section class="block"><h2>${esc(t('otherDirection'))}</h2><ul class="plain">${sibs.map((x) => stopRow(x)).join('')}</ul></section>` : '';

  return `${banners(now)}
<section class="hero" data-strip="${stripState(now)}" aria-labelledby="stop-title">
  ${first ? motifField(routeOfTrip(first.trip)) : ''}
  <div class="hero-top">
    <div class="stopname">
      <h1 id="stop-title">${esc(name)}</h1>
      <p class="dir">${dir ? `${esc(t('toward'))} ${esc(dir)}` : `${esc(t('stop'))} ${esc(code)}`}</p>
    </div>
    <div class="hero-actions">
      <a class="icon-btn" href="#/cerca" aria-label="${esc(t('searchStop'))}">${icon('search', 24)}</a>
      <button class="icon-btn" data-act="fav" data-id="${esc(s.id)}" aria-pressed="${fav}" aria-label="${esc(t(fav ? 'removeFav' : 'addFav'))}">${icon('star', 24, fav)}</button>
      <button class="icon-btn" data-act="share" data-id="${esc(s.id)}" aria-label="${esc(t('share'))}">${icon('share', 24)}</button>
    </div>
  </div>
  ${nextBlock}
</section>
${rest.length ? `<section class="block"><h2 class="sr">${esc(t('nextAfter'))}</h2><ul class="plain deps">${rest.map(departureRow).join('')}</ul></section>` : ''}
${sibHtml}`;
}

function stopRow(si, meters) {
  const { name, dir } = stopTitle(si);
  const s = state.data.stops[si];
  return `<li><a class="row" href="#/stop/${esc(s.id)}">
  <span class="row-main"><span class="row-title">${esc(name)}</span><span class="row-sub">${dir ? `${esc(t('toward'))} ${esc(dir)}` : esc(`${t('stop')} ${s.code}`)}${meters != null ? ` · ${esc(t('meters', meters))}` : ''}</span></span>
  <span class="row-tiles">${routesOfStop(si, 26)}</span>
</a></li>`;
}

// ---------- viste ----------
function viewNear() {
  const favs = store.get('favs', []).map(stopById).filter((i) => i >= 0);
  const last = stopById(store.get('last', ''));
  const current = last >= 0 ? last : favs[0] ?? -1;
  const near = state.loc ? nearestStops(state.data, state.loc.lat, state.loc.lon, 6) : [];
  const geoMsg = state.locStatus === 'asking' ? t('locating') : state.locStatus === 'denied' ? t('locDenied') : '';

  const geoBtn = `<button class="btn" data-act="geo">${icon('locate', 20)}<span>${esc(t('useLocation'))}</span></button>`;
  const nearBlock = near.length
    ? `<section class="block"><h2>${esc(t('nearYou'))}</h2><ul class="plain">${near.map((n) => stopRow(n.i, n.m)).join('')}</ul></section>`
    : '';
  const favBlock = favs.length
    ? `<section class="block"><h2>${esc(t('yourStops'))}</h2><ul class="plain">${favs.map((i) => stopRow(i)).join('')}</ul></section>`
    : '';
  const searchLink = `<a class="btn btn-quiet" href="#/cerca">${icon('search', 20)}<span>${esc(t('searchStop'))}</span></a>`;

  if (current >= 0) {
    return `${stopScreen(current, { home: true })}
<div class="actions">${geoBtn}${searchLink}</div>
${geoMsg ? `<p class="note" role="status">${esc(geoMsg)}</p>` : ''}${nearBlock}${favBlock}`;
  }

  // Primo avvio: nessuna fermata, nessuna posizione.
  const active = activeRoutes();
  return `${banners(romeNow())}
<section class="hero hero-first" data-strip="${stripState(romeNow())}">
  <h1>${esc(t('whereAreYou'))}</h1>
  <p class="lead">${esc(t('whereHelp'))}</p>
  <div class="actions actions-hero">${geoBtn}${searchLink}</div>
  ${geoMsg ? `<p class="note note-hero" role="status">${esc(geoMsg)}</p>` : ''}
</section>
${nearBlock}
<section class="block"><h2>${esc(t('mainStops'))}</h2><ul class="plain">${mainStops().map((i) => stopRow(i)).join('')}</ul></section>
<section class="block"><h2>${esc(t('lines'))}</h2>
<ul class="tile-row">${active.map((r) => `<li><a href="#/linea/${esc(state.data.routes[r].id)}" aria-label="${esc(t('lines'))} ${esc(state.data.routes[r].short)}">${tileSvg(state.data.routes[r], 48)}</a></li>`).join('')}</ul></section>`;
}

function viewHome() {
  const now = romeNow();
  const favs = store.get('favs', []).map(stopById).filter((i) => i >= 0);
  const card = (href, ic, title, sub, main) => `<a class="card${main ? ' card-main' : ''}" href="${href}">${icon(ic, 28)}<span class="card-text"><b>${esc(t(title))}</b><small>${esc(t(sub))}</small></span>${icon('chevron', 20)}</a>`;
  return `${banners(now)}
<section class="hero hero-first" data-strip="${stripState(now)}">
  <h1>${esc(t('appName'))}</h1>
  <p class="lead">${esc(t('homeLead'))}</p>
  <nav class="home-cards" aria-label="${esc(t('appName'))}">
    ${card('#/percorso', 'route', 'homePlan', 'homePlanSub', true)}
    ${card('#/vicino', 'pin', 'homeNext', 'homeNextSub')}
    ${card('#/mappa', 'map', 'homeMap', 'homeMapSub')}
  </nav>
</section>
${favs.length ? `<section class="block"><h2>${esc(t('yourStops'))}</h2><ul class="plain">${favs.map((i) => stopRow(i)).join('')}</ul></section>` : ''}
<section class="block"><h2>${esc(t('lines'))}</h2>
<ul class="tile-row">${activeRoutes().map((r) => `<li><a href="#/linea/${esc(state.data.routes[r].id)}" aria-label="${esc(t('lines'))} ${esc(state.data.routes[r].short)}">${tileSvg(state.data.routes[r], 48)}</a></li>`).join('')}</ul></section>
<section class="block"><h2>${esc(t('howToRead'))}</h2>${howToRead()}</section>`;
}

/** Il tracciato di una linea com'è sulla mappa: striscia colorata con il numero scritto sopra. */
function lineSample(route) {
  const { label, glaze } = lineStyle(route);
  return `<svg class="sample" viewBox="0 0 64 28" width="64" height="28" aria-hidden="true" focusable="false"><path d="M2 14h60" stroke="#fff" stroke-width="9" stroke-linecap="round"/><path d="M2 14h60" stroke="${glaze.bg}" stroke-width="5" stroke-linecap="round"/><text x="32" y="19" text-anchor="middle" font-size="14" font-weight="700" fill="#14213D" stroke="#FBF7EE" stroke-width="3.500" paint-order="stroke" font-family="Atkinson Hyperlegible, system-ui, sans-serif">${esc(label)}</text></svg>`;
}
const sampleRoute = () => state.data.routes.find((r) => r.short === '3') ?? state.data.routes[0];

function howToRead() {
  const ex = sampleRoute();
  return `<div class="howto">
  <div class="how-row">${tileSvg(ex, 44)}<p>${esc(t('howTile'))}</p></div>
  <div class="how-row">${lineSample(ex)}<p>${esc(t('howNumbers'))}</p></div>
  <p class="muted">${esc(t('howSpecial'))}</p>
</div>`;
}

function legendPanel() {
  const ex = sampleRoute();
  const row = (sw, key) => `<li>${sw}<span>${esc(t(key))}</span></li>`;
  return `<div id="legend" class="legend" role="dialog" aria-label="${esc(t('legend'))}" hidden>
  <div class="legend-top"><h2>${esc(t('legend'))}</h2><button class="icon-btn icon-btn-quiet" data-act="legend" aria-label="${esc(t('close'))}">×</button></div>
  <ul class="legend-list">
    ${row(lineSample(ex), 'legendLine')}
    ${row('<span class="dot dot-bus"></span>', 'legendBusOn')}
    ${row('<span class="dot dot-idle"></span>', 'legendBusOff')}
    ${row('<span class="dot dot-stop"></span>', 'legendStop')}
    ${row('<span class="dot dot-me"></span>', 'legendMe')}
  </ul>
  <p class="muted">${esc(t('howNumbers'))} ${esc(t('howSpecial'))}</p>
</div>`;
}

function viewStop(id) {
  const si = stopById(id);
  if (si < 0) return `<section class="block"><p class="empty-title">${esc(t('noResults'))}</p><a class="btn" href="#/cerca">${esc(t('searchStop'))}</a></section>`;
  store.set('last', id);
  return stopScreen(si);
}

function viewSearch() {
  return `<section class="block search-block">
  <h1 class="h1">${esc(t('searchStop'))}</h1>
  <label class="field">${icon('search', 20)}<input id="q" type="search" inputmode="search" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${esc(t('searchPh'))}" aria-label="${esc(t('searchStop'))}"></label>
  <ul class="plain" id="results"></ul>
</section>`;
}
function bindSearch() {
  const $q = document.getElementById('q');
  const $r = document.getElementById('results');
  const index = state.data.stops.map((s, i) => ({ i, k: norm(s.name) + ' ' + s.code }));
  const run = () => {
    const q = norm($q.value.trim());
    if (!q) { $r.innerHTML = ''; return; }
    const words = q.split(/\s+/);
    const hits = index.filter((x) => words.every((w) => x.k.includes(w))).slice(0, 40);
    $r.innerHTML = hits.length ? hits.map((h) => stopRow(h.i)).join('') : `<li class="note">${esc(t('noResults'))}</li>`;
  };
  $q.addEventListener('input', run);
  $q.focus({ preventScroll: true });
}

/** Fermate servite dal maggior numero di linee, una per nome (le sedi principali della rete). */
function mainStops(n = 5) {
  const seen = new Set();
  return [...state.stopRoutes.entries()]
    .sort((a, b) => b[1].size - a[1].size)
    .map(([i]) => i)
    .filter((i) => { const k = splitStopName(state.data.stops[i].name).base.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
    .slice(0, n);
}

function activeRoutes() {
  const now = romeNow();
  const today = new Set();
  state.data.services.forEach((s, i) => { if (isServiceActive(s, now.ymd)) today.add(i); });
  const counts = new Map();
  state.data.trips.forEach((tr) => { if (today.has(tr.v)) counts.set(tr.r, (counts.get(tr.r) ?? 0) + 1); });
  return [...counts.keys()].sort((a, b) => state.data.routes[a].short.localeCompare(state.data.routes[b].short, 'it', { numeric: true }));
}

function viewLines() {
  const now = romeNow();
  const today = new Set();
  state.data.services.forEach((s, i) => { if (isServiceActive(s, now.ymd)) today.add(i); });
  const total = new Map(), todayN = new Map();
  state.data.trips.forEach((tr) => {
    total.set(tr.r, (total.get(tr.r) ?? 0) + 1);
    if (today.has(tr.v)) todayN.set(tr.r, (todayN.get(tr.r) ?? 0) + 1);
  });
  const order = [...state.data.routes.keys()].filter((r) => total.has(r)).sort((a, b) => {
    const ta = todayN.has(a) ? 0 : 1, tb = todayN.has(b) ? 0 : 1;
    return ta - tb || state.data.routes[a].short.localeCompare(state.data.routes[b].short, 'it', { numeric: true });
  });
  const row = (r) => `<li><a class="row" href="#/linea/${esc(state.data.routes[r].id)}">
  ${tileSvg(state.data.routes[r], 44)}
  <span class="row-main"><span class="row-title">${esc(state.data.routes[r].long)}</span>${todayN.has(r) ? `<span class="row-sub">${esc(t('trips', todayN.get(r)))}</span>` : ''}</span>
  <span class="chev">${icon('chevron', 20)}</span></a></li>`;
  const act = order.filter((r) => todayN.has(r)), off = order.filter((r) => !todayN.has(r));
  return `${banners(now)}<section class="block"><h1 class="h1">${esc(t('lines'))}</h1>
<h2>${esc(t('activeToday'))}</h2><ul class="plain">${act.map(row).join('')}</ul>
${off.length ? `<h2>${esc(t('notToday'))}</h2><ul class="plain dim">${off.map(row).join('')}</ul>` : ''}</section>`;
}

function viewLine(rid, tripSel) {
  const ri = routeById(rid);
  if (ri < 0) return `<section class="block"><p class="empty-title">${esc(t('noResults'))}</p></section>`;
  const route = state.data.routes[ri];
  const now = romeNow();
  const activeToday = (tr) => isServiceActive(state.data.services[tr.v], now.ymd);
  const all = state.data.trips.map((tr, i) => ({ tr, i })).filter((x) => x.tr.r === ri);
  const todays = all.filter((x) => activeToday(x.tr));
  const dirs = [...new Set((todays.length ? todays : all).map((x) => x.tr.d))].sort();
  const dsel = state.lineDir != null && dirs.includes(state.lineDir) ? state.lineDir : dirs[0];
  const pool = (todays.length ? todays : all).filter((x) => x.tr.d === dsel).sort((a, b) => a.tr.t[0] - b.tr.t[0]);
  const upcoming = pool.find((x) => x.tr.t[0] >= now.secs) ?? pool[0];
  const sel = (tripSel != null && pool.find((x) => x.i === tripSel)) || upcoming;
  const head = (d) => {
    const c = {};
    (todays.length ? todays : all).filter((x) => x.tr.d === d).forEach((x) => { c[headOf(x.tr)] = (c[headOf(x.tr)] ?? 0) + 1; });
    return Object.entries(c).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
  };

  const stopsHtml = sel ? sel.tr.s.map((si, k) => {
    const { name } = stopTitle(si);
    const past = todays.length && sel.tr.t[k] < now.secs && sel.tr.t[0] <= now.secs;
    return `<li class="${k === 0 ? 'first' : ''}${k === sel.tr.s.length - 1 ? ' last' : ''}${past ? ' past' : ''}"><a href="#/stop/${esc(state.data.stops[si].id)}"><span class="st-name">${esc(name)}</span><span class="st-time">${formatClock(sel.tr.t[k])}</span></a></li>`;
  }).join('') : '';

  return `${banners(now)}
<section class="hero hero-line" data-strip="${stripState(now)}">
  <a class="back" href="#/linee" aria-label="${esc(t('back'))}">${icon('back', 22)}<span>${esc(t('lines'))}</span></a>
  <div class="line-head">${tileSvg(route, 60)}<h1>${esc(route.long)}</h1></div>
  <a class="btn btn-on-field" href="#/mappa/${esc(route.id)}">${icon('map', 20)}<span>${esc(t('showOnMap'))}</span></a>
</section>
${dirs.length > 1 ? `<div class="seg" role="tablist">${dirs.map((d) => `<button role="tab" aria-selected="${d === dsel}" data-act="dir" data-d="${d}" data-r="${esc(rid)}">${esc(t('dir'))} ${esc(head(d))}</button>`).join('')}</div>` : ''}
${todays.length ? '' : `<p class="banner">${esc(t('noTripsToday'))}</p>`}
<section class="block"><h2>${esc(t('departuresToday'))}${pool[0] ? ` · ${esc(t('firstStopOf', stopTitle(pool[0].tr.s[0]).name))}` : ''}</h2>
<ul class="chips" role="listbox" aria-label="${esc(t('departuresToday'))}">${pool.map((x) => `<li><button role="option" aria-selected="${sel && x.i === sel.i}" data-act="trip" data-r="${esc(rid)}" data-i="${x.i}">${formatClock(x.tr.t[0])}</button></li>`).join('')}</ul></section>
<section class="block"><h2>${esc(t('stops'))}</h2><ol class="route-stops">${stopsHtml}</ol></section>`;
}

function viewMap(rid) {
  return `<section class="map-wrap">
  <div id="map" role="application" aria-label="${esc(t('mapTitle'))}"></div>
  <div class="map-bar"><p id="bus-count" class="chip" role="status">${esc(t('busesNote'))}</p></div>
  <button id="legend-btn" class="legend-btn" data-act="legend" aria-expanded="false" aria-controls="legend">${icon('info', 20)}<span>${esc(t('legend'))}</span></button>
  ${legendPanel()}
  <a class="osd" href="https://opendatasicilia.it/" target="_blank" rel="noopener" title="Open Data Sicilia - https://opendatasicilia.it/"><img src="img/opendatasicilia.png" alt="${esc(t('osdTitle'))}" width="44" height="51"></a>
  <p id="map-msg" class="map-msg" hidden></p>
</section>`;
}
async function bindMap(rid) {
  const msg = document.getElementById('map-msg');
  try {
    const [{ mountMap }, shapes] = await Promise.all([import('./map.js'), loadShapes()]);
    const ctl = await mountMap(document.getElementById('map'), { data: state.data, shapes, focus: rid ? routeById(rid) : -1, loc: state.loc, countEl: document.getElementById('bus-count'), t });
    state.cleanup = () => ctl.destroy();
  } catch (e) {
    msg.hidden = false;
    msg.textContent = navigator.onLine ? t('mapError') : t('mapOffline');
  }
}

// ---------- pianificatore da A a B ----------
function stopGroups() {
  if (state.groups) return state.groups;
  const seen = new Set();
  state.groups = [];
  state.data.stops.forEach((s, i) => {
    if (seen.has(i)) return;
    const g = groupOf(state.data, i);
    g.forEach((x) => seen.add(x));
    const name = splitStopName(s.name).base;
    state.groups.push({ id: s.id, name, stops: g, key: `${norm(name)} ${g.map((x) => state.data.stops[x].code).join(' ')}` });
  });
  return state.groups;
}
/** "gps" oppure l'id di una fermata -> scelta del pianificatore. */
function resolveSide(id) {
  if (id === 'gps') return { kind: 'gps', id: 'gps' };
  const si = stopById(id);
  if (si < 0) return null;
  const g = stopGroups().find((x) => x.stops.includes(si));
  return g ? { kind: 'group', id: g.id, name: g.name, stops: g.stops } : null;
}
const sideLabel = (sd) => (sd.kind === 'gps' ? t('planMyPos') : sd.name);

function viewPlan(m) {
  if (m[1]) { state.plan.from = resolveSide(decodeURIComponent(m[1])); state.plan.to = resolveSide(decodeURIComponent(m[2])); }
  const now = romeNow();
  const field = (side, key, ph) => `<div class="pf">
  <label class="pf-label" for="pf-${side}">${esc(t(key))}</label>
  <div class="field">${icon(side === 'from' ? 'pin' : 'route', 20)}<input id="pf-${side}" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${esc(t(ph))}" aria-controls="pl-${side}"></div>
  <ul class="plain pf-list" id="pl-${side}"></ul>
</div>`;
  const atMode = state.plan.time != null;
  return `${banners(now)}
<section class="hero hero-line hero-plan" data-strip="${stripState(now)}">
  <a class="back" href="#/" aria-label="${esc(t('back'))}">${icon('back', 22)}<span>${esc(t('tabHome'))}</span></a>
  <h1 class="plan-h1">${esc(t('planTitle'))}</h1>
  <p class="lead">${esc(t('planHint'))}</p>
</section>
<section class="block plan-form">
  ${field('from', 'planFrom', 'planFromPh')}
  <div class="swap-row"><button type="button" class="icon-btn icon-btn-quiet" data-act="swap" aria-label="${esc(t('planSwap'))}">${icon('swap', 22)}</button></div>
  ${field('to', 'planTo', 'planToPh')}
  <div class="pf-time">
    <div class="seg seg-inline" role="radiogroup">
      <button type="button" role="radio" aria-checked="${!atMode}" data-act="timemode" data-v="now">${esc(t('planNow'))}</button>
      <button type="button" role="radio" aria-checked="${atMode}" data-act="timemode" data-v="at">${esc(t('planAt'))}</button>
    </div>
    <input id="pf-time" class="time-in" type="time" aria-label="${esc(t('planAt'))}" ${atMode ? '' : 'hidden'}>
  </div>
</section>
<section id="plan-out" class="block plan-out" aria-live="polite"></section>`;
}

function getLoc() {
  return new Promise((res) => {
    if (state.loc) return res(true);
    if (!navigator.geolocation) return res(false);
    state.locStatus = 'asking';
    navigator.geolocation.getCurrentPosition(
      (p) => { state.loc = { lat: p.coords.latitude, lon: p.coords.longitude }; state.locStatus = 'ok'; res(true); },
      () => { state.locStatus = 'denied'; res(false); },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    );
  });
}

const fmtHm = (secs) => formatClock(secs);
function optionHtml(o, i, tomorrow) {
  const d = state.data;
  const legs = o.legs;
  const bus = legs.filter((l) => l.kind === 'bus');
  const nameOf = (si) => d.stops[si].name;
  const mins = Math.max(1, Math.round((o.end - o.start) / 60));
  const tiles = bus.map((l) => tileSvg(routeOfTrip(l.trip), 34)).join('<span class="plus" aria-hidden="true">›</span>');
  const steps = legs.map((l, k) => {
    if (l.kind === 'walk') {
      const nextBus = legs.slice(k + 1).find((x) => x.kind === 'bus');
      const first = k === 0;
      const where = nextBus ? ` · ${nameOf(d.trips[nextBus.trip].s[nextBus.from])}` : '';
      const label = !first && nextBus ? `${t('stepChange')}: ${t('stepWalk', Math.max(1, Math.round(l.secs / 60))).toLowerCase()}` : t('stepWalk', Math.max(1, Math.round(l.secs / 60)));
      return `<li class="step step-walk"><span class="step-dot"></span><span class="step-body">${esc(label)}${esc(where)}</span></li>`;
    }
    const trip = d.trips[l.trip];
    const prev = legs[k - 1];
    const change = prev && prev.kind === 'bus' ? `<li class="step step-walk"><span class="step-dot"></span><span class="step-body">${esc(t('stepChange'))}</span></li>` : '';
    return `${change}<li class="step step-bus">
  <span class="step-tile">${tileSvg(routeOfTrip(l.trip), 30)}</span>
  <span class="step-body"><b>${esc(t('stepBoard', nameOf(trip.s[l.from]), fmtHm(l.dep)))}</b>
    <span class="step-sub">${esc(t('stepTo', headOf(trip)))} · ${esc(t('stepStops', l.to - l.from))}</span>
    <b>${esc(t('stepAlight', nameOf(trip.s[l.to]), fmtHm(l.arr)))}</b></span></li>`;
  }).join('');
  return `<li><details class="opt"${i === 0 ? ' open' : ''}>
  <summary><span class="opt-head"><span class="opt-time">${tomorrow ? esc(t('planTomorrow')) + ' ' : ''}${fmtHm(o.start)} → ${fmtHm(o.end)}</span><span class="opt-meta">${esc(t('planDuration', mins))} · ${esc(t(o.transfers ? 'planTransfer' : 'planDirect'))}</span></span><span class="opt-tiles">${tiles}</span></summary>
  <ol class="steps">${steps}<li class="step step-end"><span class="step-dot"></span><span class="step-body"><b>${esc(t('stepArrive', fmtHm(o.end)))}</b></span></li></ol>
</details></li>`;
}

async function runPlan() {
  const out = document.getElementById('plan-out');
  if (!out) return;
  const { from, to, time } = state.plan;
  if (!from || !to) { out.innerHTML = ''; return; }
  if (from.id === to.id) { out.innerHTML = `<p class="note">${esc(t('planSame'))}</p>`; return; }
  const ends = [];
  for (const sd of [from, to]) {
    if (sd.kind === 'gps') {
      if (!(await getLoc())) { out.innerHTML = `<p class="note">${esc(t('planNeedLoc'))}</p>`; return; }
      const w = walkable(state.data, state.loc.lat, state.loc.lon);
      if (!w.length) { out.innerHTML = `<p class="note">${esc(t('planFar'))}</p>`; return; }
      ends.push(w);
    } else ends.push(sd.stops.map((stop) => ({ stop, walk: 0 })));
  }
  const now = romeNow();
  const secs = time ?? now.secs;
  let opts = planJourney(state.data, state.index, { from: ends[0], to: ends[1], ymd: now.ymd, secs });
  let tomorrow = false, msg = '';
  if (!opts.length) {
    opts = planJourney(state.data, state.index, { from: ends[0], to: ends[1], ymd: addDays(now.ymd, 1), secs: 0 });
    tomorrow = opts.length > 0;
    msg = t(tomorrow ? 'planNoneNow' : 'planNone');
  }
  out.innerHTML = `${msg ? `<p class="note">${esc(msg)}</p>` : ''}${opts.length ? `<ul class="plain opts">${opts.map((o, i) => optionHtml(o, i, tomorrow)).join('')}</ul><p class="muted note">${esc(t('scheduledNote'))}</p>` : ''}`;
}

function syncPlanUrl() {
  const { from, to } = state.plan;
  const h = from && to ? `#/percorso/${encodeURIComponent(from.id)}/${encodeURIComponent(to.id)}` : '#/percorso';
  if (location.hash !== h) history.replaceState(null, '', h);
}

function pickSide(side, id) {
  const sd = resolveSide(id);
  if (!sd) return;
  state.plan[side] = sd;
  const $in = document.getElementById(`pf-${side}`);
  if ($in) $in.value = sideLabel(sd);
  document.getElementById(`pl-${side}`).innerHTML = '';
  syncPlanUrl();
  runPlan();
  const other = document.getElementById(`pf-${side === 'from' ? 'to' : 'from'}`);
  if (!state.plan[side === 'from' ? 'to' : 'from']) other?.focus();
}

function bindPlan() {
  const groups = stopGroups();
  for (const side of ['from', 'to']) {
    const $in = document.getElementById(`pf-${side}`);
    const $ul = document.getElementById(`pl-${side}`);
    if (state.plan[side]) $in.value = sideLabel(state.plan[side]);
    const show = () => {
      const q = norm($in.value.trim());
      const items = [];
      if (!q || norm(t('planMyPos')).startsWith(q)) {
        items.push(`<li><button type="button" class="row row-btn" data-act="pick" data-side="${side}" data-id="gps"><span class="row-main"><span class="row-title">${icon('locate', 18)} ${esc(t('planMyPos'))}</span></span></button></li>`);
      }
      if (q) {
        const words = q.split(/\s+/);
        groups.filter((g) => words.every((w) => g.key.includes(w)))
          .sort((a, b) => (norm(a.name).startsWith(q) ? 0 : 1) - (norm(b.name).startsWith(q) ? 0 : 1))
          .slice(0, 6)
          .forEach((g) => items.push(`<li><button type="button" class="row row-btn" data-act="pick" data-side="${side}" data-id="${esc(g.id)}"><span class="row-main"><span class="row-title">${esc(g.name)}</span></span><span class="row-tiles">${routesOfStop(g.stops[0], 24, 4)}</span></button></li>`));
        if (items.length === 0 || (items.length === 1 && items[0].includes('data-id="gps"'))) items.push(`<li class="note">${esc(t('noResults'))}</li>`);
      }
      $ul.innerHTML = items.join('');
    };
    $in.addEventListener('input', () => { state.plan[side] = null; document.getElementById('plan-out').innerHTML = ''; show(); });
    $in.addEventListener('focus', () => { $in.select(); show(); });
    $in.addEventListener('focusout', () => setTimeout(() => { if (document.activeElement !== $in) $ul.innerHTML = ''; }, 250));
  }
  const $time = document.getElementById('pf-time');
  const hm = (secs) => `${String(Math.floor(secs / 3600) % 24).padStart(2, '0')}:${String(Math.floor((secs % 3600) / 60)).padStart(2, '0')}`;
  if (state.plan.time != null) $time.value = hm(state.plan.time);
  $time.addEventListener('change', () => {
    const [h, mi] = $time.value.split(':').map(Number);
    if (Number.isFinite(h)) { state.plan.time = h * 3600 + mi * 60; runPlan(); }
  });
  runPlan();
}

function viewInfo() {
  const m = state.data.meta;
  const now = romeNow();
  const fs = feedStatus(m, now.ymd);
  const theme = store.get('theme', 'auto');
  const seg = (name, opts, cur) => `<div class="seg seg-inline" role="radiogroup">${opts.map(([v, l]) => `<button role="radio" aria-checked="${v === cur}" data-act="${name}" data-v="${v}">${esc(l)}</button>`).join('')}</div>`;
  return `${banners(now)}<section class="block"><h1 class="h1">${esc(t('info'))}</h1>
<h2>${esc(t('validity'))}</h2>
<p>${m.validTo ? esc(t('validUntil', fmtDate(m.validTo))) : ''}${fs.state === 'ok' ? '' : ''}</p>
<p class="muted">${esc(t('version'))}: ${esc(m.feedVersion ?? '–')}</p>
<h2>${esc(t('language'))}</h2>${seg('lang', [['it', 'Italiano'], ['en', 'English']], getLang())}
<h2>${esc(t('theme'))}</h2>${seg('theme', [['auto', t('themeAuto')], ['light', t('themeLight')], ['dark', t('themeDark')]], theme)}
<h2>${esc(t('source'))}</h2>
<p>${esc(t('sourceText'))} <a href="${esc(safeUrl(m.source))}" rel="noopener">comune.marsala.tp.it</a></p>
<p>${esc(t('notOfficial'))}</p>
<h2>${esc(t('reportError'))}</h2>
<p>${esc(t('reportHelp'))}${m.contact ? ` <a href="${esc(safeUrl(m.contact))}" rel="noopener">${esc(t('reportError'))}</a>` : ''}</p>
${m.corrections?.length ? `<h2>${esc(t('corrections'))}</h2><p>${esc(t('correctionsText'))}</p>` : ''}
<h2>${esc(t('privacy'))}</h2><p>${esc(t('privacyText'))}</p></section>`;
}

// ---------- router ----------
const routes = [
  [/^\/?$/, () => viewHome(), 'home'],
  [/^\/vicino$/, () => viewNear(), 'home'],
  [/^\/stop\/(.+)$/, (m) => viewStop(decodeURIComponent(m[1])), 'home'],
  [/^\/cerca$/, () => viewSearch(), 'home', bindSearch],
  [/^\/percorso(?:\/([^/]+)\/([^/]+))?$/, (m) => viewPlan(m), 'plan', bindPlan],
  [/^\/linee$/, () => viewLines(), 'lines'],
  [/^\/linea\/(.+)$/, (m) => viewLine(decodeURIComponent(m[1])), 'lines'],
  [/^\/mappa(?:\/(.+))?$/, (m) => viewMap(m[1] && decodeURIComponent(m[1])), 'map', (m) => bindMap(m[1] && decodeURIComponent(m[1]))],
  [/^\/info$/, () => viewInfo(), 'info'],
];
let current = null;

function render(nav = false) {
  if (!state.data) return;
  const path = location.hash.replace(/^#/, '') || '/';
  if (state.cleanup) { state.cleanup(); state.cleanup = null; }
  for (const [re, view, tab, bind] of routes) {
    const m = path.match(re);
    if (!m) continue;
    current = { path, tab };
    $app.innerHTML = view(m);
    $app.classList.toggle('enter', nav);
    $nav.querySelectorAll('a').forEach((a) => a.toggleAttribute('aria-current', a.dataset.tab === tab));
    if (bind) bind(m);
    document.title = `${t('appName')}${tab === 'home' ? '' : ' · ' + t('tab' + tab[0].toUpperCase() + tab.slice(1))}`;
    return;
  }
  location.hash = '#/';
}

function rerenderKeepScroll() {
  const y = window.scrollY;
  render();
  window.scrollTo(0, y);
}

window.addEventListener('hashchange', () => { state.lineDir = null; render(true); window.scrollTo(0, 0); });

// Aggiorna i minuti mentre l'app è aperta (non sulla mappa, né mentre si digita).
setInterval(() => {
  if (document.hidden || !current || current.tab === 'map' || document.activeElement?.id === 'q') return;
  if (/^\/(vicino|stop|linea)/.test(current.path)) rerenderKeepScroll();
}, 20000);

// ---------- azioni ----------
$app.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const act = b.dataset.act;
  if (act === 'fav') { store.toggleFav(b.dataset.id); rerenderKeepScroll(); }
  else if (act === 'share') {
    const url = `${base()}#/stop/${b.dataset.id}`;
    const title = document.title;
    try {
      if (navigator.share) await navigator.share({ title, url });
      else { await navigator.clipboard.writeText(url); toast(t('linkCopied')); }
    } catch { /* annullato */ }
  } else if (act === 'geo') locate();
  else if (act === 'dir') { state.lineDir = Number(b.dataset.d); $app.innerHTML = viewLine(b.dataset.r); }
  else if (act === 'trip') { $app.innerHTML = viewLine(b.dataset.r, Number(b.dataset.i)); }
  else if (act === 'pick') pickSide(b.dataset.side, b.dataset.id);
  else if (act === 'swap') {
    [state.plan.from, state.plan.to] = [state.plan.to, state.plan.from];
    for (const sd of ['from', 'to']) { const $i = document.getElementById(`pf-${sd}`); $i.value = state.plan[sd] ? sideLabel(state.plan[sd]) : ''; }
    syncPlanUrl(); runPlan();
  } else if (act === 'timemode') {
    const at = b.dataset.v === 'at';
    document.querySelectorAll('[data-act="timemode"]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
    const $t = document.getElementById('pf-time');
    $t.hidden = !at;
    if (at) { const n = romeNow(); const v = `${String(Math.floor(n.secs / 3600)).padStart(2, '0')}:${String(Math.floor((n.secs % 3600) / 60)).padStart(2, '0')}`; $t.value ||= v; state.plan.time = Number($t.value.slice(0, 2)) * 3600 + Number($t.value.slice(3, 5)) * 60; $t.focus(); } else state.plan.time = null;
    runPlan();
  } else if (act === 'legend') {
    const p = document.getElementById('legend');
    p.hidden = !p.hidden;
    document.getElementById('legend-btn').setAttribute('aria-expanded', String(!p.hidden));
  }
  else if (act === 'lang') { store.set('lang', b.dataset.v); setLang(b.dataset.v); renderChrome(); rerenderKeepScroll(); }
  else if (act === 'theme') { store.set('theme', b.dataset.v); applyTheme(); rerenderKeepScroll(); }
});

function locate() {
  if (!navigator.geolocation) { state.locStatus = 'denied'; rerenderKeepScroll(); return; }
  state.locStatus = 'asking';
  rerenderKeepScroll();
  navigator.geolocation.getCurrentPosition(
    (p) => {
      state.loc = { lat: p.coords.latitude, lon: p.coords.longitude };
      state.locStatus = 'ok';
      const [n] = nearestStops(state.data, state.loc.lat, state.loc.lon, 1);
      // Se la posizione è lontana da Marsala (turista che prova l'app da casa) non forza nessuna fermata.
      if (n && n.m < 5000 && !store.get('last')) store.set('last', state.data.stops[n.i].id);
      rerenderKeepScroll();
    },
    () => { state.locStatus = 'denied'; rerenderKeepScroll(); },
    { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
  );
}

let toastTimer;
function toast(msg) {
  let el = document.getElementById('toast');
  if (!el) { el = document.createElement('p'); el.id = 'toast'; el.setAttribute('role', 'status'); document.body.append(el); }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

function applyTheme() {
  const th = store.get('theme', 'auto');
  if (th === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.dataset.theme = th;
  const dark = th === 'dark' || (th === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0F1B3D' : '#1B3A94');
}

function renderChrome() {
  $nav.setAttribute('aria-label', t('appName'));
  const items = [['home', '#/', 'home', 'tabHome'], ['plan', '#/percorso', 'route', 'tabPlan'], ['lines', '#/linee', 'list', 'tabLines'], ['map', '#/mappa', 'map', 'tabMap'], ['info', '#/info', 'info', 'tabInfo']];
  $nav.innerHTML = items.map(([tab, href, ic, key]) => `<a href="${href}" data-tab="${tab}">${icon(ic, 24)}<span>${esc(t(key))}</span></a>`).join('');
}

// ---------- avvio ----------
async function boot() {
  setLang(detectLang(store.get('lang')));
  applyTheme();
  renderChrome();
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);
  window.addEventListener('online', rerenderKeepScroll);
  window.addEventListener('offline', rerenderKeepScroll);
  try {
    await loadData();
    render(true);
  } catch {
    $app.innerHTML = `<section class="block"><p class="empty-title">${esc(t('loadError'))}</p><p>${esc(t('loadHelp'))}</p><button class="btn" data-act="reload">${esc(t('retry'))}</button></section>`;
  }
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}
boot();
