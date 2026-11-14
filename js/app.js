// Marsala TPL: router, viste e stato. Vanilla ES modules, nessun framework.
import { romeNow, buildIndex, nextDepartures, nearestStops, splitStopName, siblingStops, formatClock, feedStatus, isServiceActive, addDays } from './schedule.js';
import { tileSvg, motifField } from './tiles.js';
import { t, setLang, getLang, detectLang } from './i18n.js';
import * as store from './store.js';

const $app = document.getElementById('app');
const $nav = document.getElementById('tabs');

const state = { data: null, index: null, stopRoutes: null, loc: null, locStatus: 'idle', cleanup: null };

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
function viewHome() {
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
  [/^\/?$/, () => viewHome(), 'near'],
  [/^\/stop\/(.+)$/, (m) => viewStop(decodeURIComponent(m[1])), 'near'],
  [/^\/cerca$/, () => viewSearch(), 'near', bindSearch],
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
    document.title = `${t('appName')}${tab === 'near' ? '' : ' · ' + t('tab' + tab[0].toUpperCase() + tab.slice(1))}`;
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
  if (/^\/(stop|linea)?/.test(current.path) && current.path !== '/cerca' && current.path !== '/info') rerenderKeepScroll();
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
  const items = [['near', '#/', 'pin', 'tabNear'], ['lines', '#/linee', 'list', 'tabLines'], ['map', '#/mappa', 'map', 'tabMap'], ['info', '#/info', 'info', 'tabInfo']];
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
