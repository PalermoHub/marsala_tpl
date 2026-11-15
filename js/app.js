// Marsala TPL: router, viste e stato. Vanilla ES modules, nessun framework.
import { romeNow, buildIndex, nextDepartures, nearestStops, splitStopName, siblingStops, formatClock, feedStatus, isServiceActive, addDays, isApprox, distanceM } from './schedule.js';
import { loadWalk, walkFrom, walkDist, walkBetween, isExactWalk } from './walk.js';
import { routeGeometry, streetNames } from './route.js';
import { tileSvg, motifField, lineStyle } from './tiles.js';
import { fetchVehicles } from './rt.js';
import { buildRouteLines, candidateRoutes, locateBus, stopsAlong, placeOnStops } from './match.js';
import { planJourney, groupOf, walkable } from './planner.js';
import { loadIndirizzi, searchIndirizzi } from './indirizzi.js';
import { t, setLang, getLang, detectLang } from './i18n.js';
import * as store from './store.js';
import { getConsent, setConsent, applyConsent } from './consent.js';

const $app = document.getElementById('app');
const $nav = document.getElementById('tabs');

const state = { mapRoute: null, plan: { from: null, to: null, time: null, mode: 'bus' }, groups: null, data: null, index: null, stopRoutes: null, loc: null, locStatus: 'idle', walkMap: null, cleanup: null, pickSide: null };

/** Oltre ~15 km/h (4,2 m/s) non si sta camminando: si è su un mezzo e i metri a piedi non servono. Dopo 5 minuti la posizione è «vecchia». */
const MOVING_MS = 4.2;
const POS_OLD_MIN = 5;
/** Salva una lettura GPS con l'ora e la velocità (del GPS, o stimata dallo spostamento dalla lettura precedente). */
function setLoc(p) {
  const prev = state.loc;
  const at = Date.now();
  const loc = { lat: p.coords.latitude, lon: p.coords.longitude, at };
  let v = p.coords.speed;
  if (v == null && prev && at - prev.at > 3000 && at - prev.at < 300000) v = distanceM(prev.lat, prev.lon, loc.lat, loc.lon) / ((at - prev.at) / 1000);
  loc.moving = v != null && v > MOVING_MS;
  state.loc = loc;
}

// ---------- utilità ----------
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeUrl = (u) => (/^https?:\/\//i.test(u || '') ? u : '#');
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const base = () => new URL('.', document.baseURI).href;
// Modalità embed (solo con ?embed=1): usata dalla pagina PalermoHub che incorpora l'app in un iframe.
// Qui i link da condividere puntano alla pagina esterna; l'apertura diretta resta invariata.
const EMBED_URL = 'https://palermohub.opendatasicilia.it/marsala_tpl.html';
const embedded = new URLSearchParams(location.search).get('embed') === '1' && window.self !== window.top;
if (embedded) document.documentElement.classList.add('embed');
const shareUrl = (hash = location.hash) => (embedded ? `${EMBED_URL}${hash}` : `${base()}${hash}`);

const ICON = {
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  star: '<path d="M12 3.6l2.5 5.2 5.7.8-4.1 4 1 5.7-5.1-2.7-5.1 2.7 1-5.7-4.1-4 5.7-.8z"/>',
  share: '<path d="M12 15V4M8 8l4-4 4 4M5 13v6h14v-6"/>',
  pin: '<path d="M12 21s6-5.6 6-10.5a6 6 0 10-12 0C6 15.400 12 21 12 21z"/><circle cx="12" cy="10.500" r="2.200"/>',
  list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
  map: '<path d="M9 4L3.500 6v14L9 18l6 2 5.500-2V4L15 6z M9 4v14M15 6v14"/>',
  bell: '<path d="M6 17V11a6 6 0 0112 0v6l1.500 2h-15zM10 21h4"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.500h.01"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.500 9.500a2.500 2.500 0 115 0c0 1.700-2.500 2-2.500 3.800M12 17h.01"/>',
  search: '<circle cx="11" cy="11" r="6.500"/><path d="M16 16l4.500 4.500"/>',
  clock: '<circle cx="12" cy="12" r="8.500"/><path d="M12 7.500V12l3 2"/>',
  locate: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8"/><path d="M12 1.500v3M12 19.500v3M1.500 12h3M19.500 12h3"/>',
  chevron: '<path d="M9 6l6 6-6 6"/>',
  back: '<path d="M15 6l-6 6 6 6"/>',
  home: '<path d="M4 11l8-7 8 7v9H4z"/><path d="M10 20v-6h4v6"/>',
  route: '<circle cx="6" cy="18" r="2.500"/><circle cx="18" cy="6" r="2.500"/><path d="M8.500 18H15a3 3 0 000-6H9a3 3 0 010-6h6.500"/>',
  linkedin: '<path d="M5 9.500h3V19H5zM6.500 5a1.700 1.700 0 110 3.400 1.700 1.700 0 010-3.400zM10.500 9.500h2.900v1.300c.5-.9 1.600-1.500 3-1.500 2.800 0 3.600 1.800 3.600 4.400V19h-3v-4.700c0-1.100-.2-2.200-1.600-2.200s-1.900 1-1.900 2.200V19h-3z"/>',
  spark: '<path d="M12 3v18M3 12h18M5.600 5.600l12.800 12.800M18.400 5.600L5.600 18.400"/>',
  scale: '<path d="M12 4v16M7 20h10M5 7h14M5 7l-3 7a3 3 0 006 0zM19 7l-3 7a3 3 0 006 0z"/>',
  heart: '<path d="M12 20s-7.500-4.600-7.500-10A4.200 4.200 0 0112 7.500 4.200 4.200 0 0119.500 10c0 5.400-7.500 10-7.500 10z"/>',
  sliders: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  more: '<circle cx="5.500" cy="12" r="1.500"/><circle cx="12" cy="12" r="1.500"/><circle cx="18.500" cy="12" r="1.500"/>',
  shield: '<path d="M12 3l7 3v5c0 4.500-3 8-7 10-4-2-7-5.500-7-10V6z"/>',
  flag: '<path d="M5 21V4M5 5h12l-2 4 2 4H5"/>',
  calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M8 3v4M16 3v4"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5H5V6h5"/>',
  phone: '<path d="M6.500 4h3l1.500 4-2 1.500a11 11 0 005 5L15.500 12.500l4 1.500v3a2 2 0 01-2 2A13 13 0 014.500 6a2 2 0 012-2z"/>',
  mail: '<rect x="3.500" y="5.500" width="17" height="13" rx="2"/><path d="M4 7l8 6 8-6"/>',
  pin: '<path d="M12 21s-6-5.500-6-11a6 6 0 0112 0c0 5.500-6 11-6 11z"/><circle cx="12" cy="10" r="2"/>',
  walk: '<circle cx="13" cy="4.500" r="1.800"/><path d="M10.500 21l1.800-6.500-2.800-2.500 1-5 3-1 2 3.500 3 1M9.500 12.500L7 14M12.300 14.500l2.700 2.500V21"/>',
  bus: '<rect x="4.500" y="3.500" width="15" height="14" rx="3"/><path d="M4.500 11h15M7.500 17.500v2.500M16.500 17.500v2.500M8 14.500h.01M16 14.500h.01"/>',
  now: '<circle cx="12" cy="12" r="8.500"/><circle cx="12" cy="12" r="3" fill="currentColor"/>',
  check: '<path d="M5 12.500l4.500 4.500L19 7.500"/>',
  reload: '<path d="M19.500 12a7.500 7.500 0 11-2.300-5.400M19.500 4.500v4h-4"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.500 2.600 3.800 5.600 3.800 9s-1.300 6.400-3.800 9c-2.500-2.600-3.800-5.600-3.800-9S9.500 5.600 12 3z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.500v2.500M12 19v2.500M2.500 12H5M19 12h2.500M5.300 5.300l1.800 1.800M16.900 16.900l1.800 1.800M5.300 18.700l1.800-1.800M16.900 7.100l1.800-1.800"/>',
  moon: '<path d="M20 14.500A8 8 0 019.500 4a8 8 0 1010.500 10.500z"/>',
  contrast: '<circle cx="12" cy="12" r="8.500"/><path d="M12 3.500v17a8.500 8.500 0 000-17z" fill="currentColor"/>',
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
// Avvisi: snapshot del feed RSS del Comune (dati/avvisi.json), assente o rotto = pagina senza elenco.
let avvisiPromise = null;
const loadAvvisi = () => (avvisiPromise ??= fetch('dati/avvisi.json').then((r) => { if (!r.ok) throw new Error('avvisi'); return r.json(); }).catch(() => { avvisiPromise = null; return null; }));

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

// Testata uniforme per le schermate senza risposta immediata (Linee, Cerca, Avvisi, Guida, Info, Privacy):
// campo cobalto compatto con titolo, sottotitolo opzionale e striscia di stato come sulle altre schermate.
function pageHead(title, { lead = '', back = null } = {}) {
  const backHtml = back ? `<a class="back" href="${esc(back[0])}">${icon('back', 22)}<span>${esc(back[1])}</span></a>` : '';
  return `<section class="hero page-head" data-strip="${stripState(romeNow())}">${backHtml}<h1>${esc(title)}</h1>${lead ? `<p class="lead">${esc(lead)}</p>` : ''}</section>`;
}

function departureRow(item) {
  const trip = state.data.trips[item.trip];
  const approx = isApprox(trip, item.pos);
  const clock = (approx ? '≈ ' : '') + formatClock(item.secs);
  const soon = item.mins < 60;
  const first = soon ? (item.mins < 1 ? t('now') : `${item.mins} ${t('min')}`) : clock;
  const second = soon ? clock : relText(item);
  return `<li class="dep">
  <a class="dep-link" href="#/linea/${esc(routeOfTrip(item.trip).id)}">
    ${tileSvg(routeOfTrip(item.trip), 40)}
    <span class="dep-main"><span class="dep-head">${esc(headOf(trip))}</span></span>
    <span class="dep-when"${approx ? ` title="${esc(t('approxTitle'))}"` : ''}><span class="dep-first">${esc(first)}</span><span class="dep-second">${esc(second)}</span></span>
  </a>
</li>`;
}

/** Stato della striscia di piastrelle sul campo cobalto: ok | warn (orari scaduti o in scadenza) | offline. */
function stripState(now) {
  if (feedStatus(state.data.meta, now.ymd).state !== 'ok') return 'warn';
  return navigator.onLine ? 'ok' : 'offline';
}

/** Link "torna alla linea" se si è arrivati alla fermata da una linea (resta valido tra più fermate). */
function backToLine() {
  const o = state.origin;
  const ri = o ? routeById(o.rid) : -1;
  if (ri < 0) return '';
  const r = state.data.routes[ri];
  return `<a class="back" href="#/linea/${esc(o.rid)}/fermata/${esc(o.stop)}">${icon('back', 22)}<span>${esc(t('backToLine'))} ${esc(r.short || r.long)}</span></a>`;
}

/** Schermata di una fermata: campo cobalto con la prossima partenza, poi le successive. */
function stopScreen(si, { home = false, origin = null } = {}) {
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
  <p class="next-when${first.mins <= 2 ? ' soon' : ''}" aria-live="polite"><span class="num">${esc(w.num)}</span>${w.unit ? `<span class="unit">${esc(w.unit)}</span>` : ''}</p>
  <p class="next-sub">${icon('clock', 16)}<span>${esc(t('scheduled'))} · ${esc(w.sub || formatClock(first.secs))}${isApprox(trip, first.pos) ? ` · ${esc(t('approxShort'))}` : ''}</span></p>
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

  const key = (r) => state.data.routes[r].short || '\uffff';
  const here = [...(state.stopRoutes.get(si) ?? [])].sort((a, b) => key(a).localeCompare(key(b), 'it', { numeric: true }));
  // per ogni linea che passa qui: il prossimo passaggio di oggi, così la lista dice anche "quando", non solo "quali"
  const nextByRoute = new Map();
  for (const it of nextDepartures(state.data, state.index, si, now, 80).items) { const r = state.data.trips[it.trip].r; if (!nextByRoute.has(r)) nextByRoute.set(r, it); }
  const hereSub = (r) => { const it = nextByRoute.get(r); return it ? `${t('nextPass')} ${formatClock(it.secs)} · ${relText(it)}` : t('noMoreLine'); };
  const hereHtml = here.length ? `<section class="block"><h2>${esc(t('linesHere'))}</h2><ul class="plain">${here.map((r) => `<li><a class="row" href="#/linea/${esc(state.data.routes[r].id)}/fermata/${esc(state.data.stops[si].id)}">
  ${tileSvg(state.data.routes[r], 44)}
  <span class="row-main"><span class="row-title">${state.data.routes[r].short ? `${esc(t('line'))} ${esc(state.data.routes[r].short)} · ` : ''}${esc(state.data.routes[r].long)}</span><span class="row-sub">${esc(hereSub(r))}</span></span>
  <span class="chev">${icon('chevron', 20)}</span></a></li>`).join('')}</ul></section>` : '';

  return `${banners(now)}
<section class="hero" data-strip="${stripState(now)}" aria-labelledby="stop-title">
  ${first ? motifField(routeOfTrip(first.trip)) : ''}
  ${home ? brandBar() : ''}
  ${backToLine()}
  <div class="hero-top">
    <div class="stopname">
      <h1 id="stop-title">${esc(name)}</h1>
      ${origin ? `<p class="dir dir-origin">${icon(origin === 'fav' ? 'star' : 'clock', 14, origin === 'fav')} ${esc(t(origin === 'fav' ? 'yourStop' : 'lastStop'))}</p>` : ''}
      <p class="dir">${dir ? `${esc(t('toward'))} ${esc(dir)}` : origin ? `${esc(t('stop'))} ${esc(code)}` : `${esc(t('stop'))} ${esc(code)}`}</p>
    </div>
    <div class="hero-actions">
      <a class="icon-btn" href="#/cerca" aria-label="${esc(t('searchStop'))}">${icon('search', 24)}</a>
      <button class="icon-btn" data-act="fav" data-id="${esc(s.id)}" aria-pressed="${fav}" aria-label="${esc(t(fav ? 'removeFav' : 'addFav'))}">${icon('star', 24, fav)}</button>
      <button class="icon-btn" data-act="share" data-id="${esc(s.id)}" aria-label="${esc(t('share'))}">${icon('share', 24)}</button>
    </div>
  </div>
  ${nextBlock}
</section>
${rest.length ? `<section class="block"><h2 class="sr">${esc(t('nextAfter'))}</h2><ul class="plain deps">${rest.map(departureRow).join('')}</ul>${rest.some((it) => isApprox(state.data.trips[it.trip], it.pos)) ? `<p class="muted note">${esc(t('approxNote'))}</p>` : ''}</section>` : ''}
${hereHtml}
${sibHtml}`;
}

function stopRow(si, meters, exact = true, strong = false) {
  const { name, dir } = stopTitle(si);
  const s = state.data.stops[si];
  return `<li><a class="row" href="#/stop/${esc(s.id)}">
  <span class="row-main"><span class="row-title">${esc(name)}</span><span class="row-sub">${dir ? `${esc(t('toward'))} ${esc(dir)}` : esc(`${t('stop')} ${s.code}`)}</span>${meters != null ? walkBadge(meters, { exact, strong, near: true }) : ''}</span>
  <span class="row-tiles">${routesOfStop(si, 26)}</span>
</a></li>`;
}

// ---------- viste ----------
/** Logo e nome dell'app in cima alla Home (sempre presente, anche nell'embed). */
const brandBar = () => `<div class="brandbar"><img src="img/icon-192.png" alt="" width="28" height="28"><b>${esc(t('appName'))}</b></div>`;

/** Distanza a piedi dalla posizione dell'utente: icona dell'omino e metri. `strong` = la fermata più vicina. */
const walkBadge = (m, { exact = true, strong = false, near = false } = {}) =>
  `<span class="wbadge${strong ? ' wbadge-strong' : ''}">${icon('walk', 14)}<span>${esc((exact ? '' : '≈ ') + t('meters', m))}${near ? ` ${esc(t('fromYou'))}` : ''}</span></span>`;

/**
 * Home: testata (cosa è l'app), poi i due gesti (posizione / cerca), poi «Vicino a te» che dice dove sei
 * e quali linee passano. Tre stati: posizione non nota, posizione recente, utente in movimento (sul bus).
 */
function viewHomeScreen() {
  const now = romeNow();
  const favs = store.get('favs', []).map(stopById).filter((i) => i >= 0);
  const loc = state.loc;
  const moving = !!loc?.moving;
  const ageMin = loc ? Math.floor((Date.now() - loc.at) / 60000) : 0;
  const old = !!loc && ageMin >= POS_OLD_MIN;
  const near = loc && !moving ? nearestStops(state.data, loc.lat, loc.lon, 6, walkDist(state.walkMap)) : [];
  const geoMsg = state.locStatus === 'asking' ? t('locating') : state.locStatus === 'denied' ? t('locDenied') : '';
  const status = !loc ? ['off', t('gpsOff')] : moving ? ['moving', t('gpsMoving')] : ['on', t('gpsOn')];
  const refreshBtn = (label) => `<button class="btn btn-ghost" data-act="geo">${icon('reload', 18)}<span>${esc(label)}</span></button>`;

  let body;
  if (!loc) {
    body = `<div class="here-card here-empty">
  <span class="here-ico" aria-hidden="true">${icon('pin', 26)}</span>
  <p class="here-title">${esc(t('gpsOffTitle'))}</p>
  <p>${esc(t('gpsOffHelp'))}</p>
  <p class="muted">${esc(t('gpsOffPrivacy'))}</p>
</div>
<p class="note">${esc(t('gpsOffAlt'))}</p>`;
  } else if (moving) {
    body = `<div class="here-card here-empty">
  <span class="here-ico here-ico-bus" aria-hidden="true">${icon('bus', 26)}</span>
  <p class="here-title">${esc(t('movingTitle'))}</p>
  <p>${esc(t('movingHelp'))}</p>
  ${refreshBtn(t('refreshPos'))}
</div>`;
  } else {
    const [n0] = near;
    body = `<div class="here-card here-on">
  <span class="here-ico" aria-hidden="true">${icon('pin', 20)}</span>
  <div class="here-main"><span class="here-sub">${esc(old ? t('posOld') : t('posAgo', ageMin))}</span>${n0 ? `<span class="here-name">${esc(t('youAreNear'))} ${esc(stopTitle(n0.i).name)}</span>` : ''}</div>
  ${refreshBtn(t('refresh'))}
</div>
<ul class="plain">${near.map((n, k) => stopRow(n.i, n.m, isExactWalk(state.walkMap, n.i), k === 0)).join('')}</ul>`;
  }

  const favBlock = favs.length ? `<section class="block"><h2>${esc(t('yourStops'))}</h2><ul class="plain">${favs.map((i) => stopRow(i)).join('')}</ul></section>` : '';
  return `${banners(now)}
<section class="hero hero-first hero-home" data-strip="${stripState(now)}">
  ${brandBar()}
  <h1>${esc(t('homeTitle'))}</h1>
  <p class="badge-unoff">${icon('info', 15)}<span>${esc(t('unofficial'))}</span></p>
  <p class="lead">${esc(t('heroSource'))}</p>
</section>
<div class="actions">
  <button class="btn" data-act="geo">${icon('locate', 20)}<span>${esc(t('myPosition'))}</span></button>
  <a class="btn btn-quiet" href="#/cerca">${icon('search', 20)}<span>${esc(t('searchStopShort'))}</span></a>
</div>
${geoMsg ? `<p class="note" role="status">${esc(geoMsg)}</p>` : ''}
<section class="block near-home" aria-live="polite"><div class="near-head"><h2>${esc(t('nearYou'))}</h2><span class="gps-state gps-${status[0]}"><i aria-hidden="true"></i>${esc(status[1])}</span></div>${body}</section>
${favBlock}${communityNote()}`;
}

function viewNear(home = false) {
  if (home) return viewHomeScreen();
  const favs = store.get('favs', []).map(stopById).filter((i) => i >= 0);
  const last = stopById(store.get('last', ''));
  // la fermata preferita ha la precedenza sull'ultima vista: chi ha salvato una fermata la ritrova subito
  const current = favs[0] ?? last;
  const near = state.loc ? nearestStops(state.data, state.loc.lat, state.loc.lon, 6, walkDist(state.walkMap)) : [];
  const geoMsg = state.locStatus === 'asking' ? t('locating') : state.locStatus === 'denied' ? t('locDenied') : '';

  const geoBtn = `<button class="btn" data-act="geo">${icon('locate', 20)}<span>${esc(t('useLocation'))}</span></button>`;
  const nearBlock = near.length
    ? `<section class="block"><h2>${esc(t('nearYou'))}</h2><ul class="plain">${near.map((n) => stopRow(n.i, n.m, isExactWalk(state.walkMap, n.i))).join('')}</ul></section>`
    : '';
  const favBlock = favs.length
    ? `<section class="block"><h2>${esc(t('yourStops'))}</h2><ul class="plain">${favs.map((i) => stopRow(i)).join('')}</ul></section>`
    : '';
  const searchLink = `<a class="btn btn-quiet" href="#/cerca">${icon('search', 20)}<span>${esc(t('searchStop'))}</span></a>`;

  if (current >= 0) {
    return `${stopScreen(current, { home, origin: home ? (favs[0] === current ? 'fav' : 'last') : null })}
<div class="actions">${geoBtn}${searchLink}</div>
${geoMsg ? `<p class="note" role="status">${esc(geoMsg)}</p>` : ''}${nearBlock}${favBlock}${home ? communityNote() : ''}`;
  }

  // Primo avvio: nessuna fermata, nessuna posizione.
  const active = activeRoutes();
  return `${banners(romeNow())}
<section class="hero hero-first" data-strip="${stripState(romeNow())}">
  ${home ? brandBar() : ''}
  <h1>${esc(t('whereAreYou'))}</h1>
  <p class="lead">${esc(t('whereHelp'))}</p>
  <div class="actions actions-hero">${geoBtn}${searchLink}</div>
  ${geoMsg ? `<p class="note note-hero" role="status">${esc(geoMsg)}</p>` : ''}
</section>
${nearBlock}
<section class="block"><h2>${esc(t('mainStops'))}</h2><ul class="plain">${mainStops().map((i) => stopRow(i)).join('')}</ul></section>
${home ? `<section class="block"><ul class="plain">${quick('#/percorso', 'route', 'homePlan', 'homePlanSub')}${quick('#/mappa', 'map', 'homeMap', 'homeMapSub')}</ul></section>
<section class="block"><h2>${esc(t('linesNow'))}</h2>${linesNowTiles()}</section>
<section class="block"><h2>${esc(t('howToRead'))}</h2>${howToRead()}</section>${communityNote()}`
  : `<section class="block"><h2>${esc(t('lines'))}</h2>
<ul class="tile-row">${active.map((r) => `<li><a href="#/linea/${esc(state.data.routes[r].id)}" aria-label="${esc(t('lines'))} ${esc(state.data.routes[r].short)}">${tileSvg(state.data.routes[r], 48)}</a></li>`).join('')}</ul></section>`}`;
}

const quick = (href, ic, title, sub) => `<li><a class="row" href="${href}">${icon(ic, 24)}<span class="row-main"><span class="row-title">${esc(t(title))}</span><span class="row-sub">${esc(t(sub))}</span></span><span class="chev">${icon('chevron', 20)}</span></a></li>`;
function linesNowTiles() {
  const run = runningRoutes();
  return run.length
    ? `<ul class="tile-row">${run.map((r) => `<li><a href="#/linea/${esc(state.data.routes[r].id)}" aria-label="${esc(t('lines'))} ${esc(state.data.routes[r].short)}">${tileSvg(state.data.routes[r], 48)}</a></li>`).join('')}</ul>`
    : `<p class="note">${esc(t('noLinesNow'))}</p>`;
}

// Home: risponde alla domanda "quando passa il bus?" con la fermata preferita (o l'ultima vista);
// senza fermata propone un solo gesto, cercarla o usare la posizione. Il resto sta sotto.
function viewHome() { return viewNear(true); }

/** Logo Open Data Sicilia con avviso: app della community, non un servizio ufficiale. */
function communityNote() {
  return `<aside class="community community-foot">
  <a class="osd-chip" href="https://opendatasicilia.it/" target="_blank" rel="noopener" title="Open Data Sicilia - https://opendatasicilia.it/"><img src="img/opendatasicilia.png" alt="${esc(t('osdTitle'))}" width="44" height="51"></a>
  <p>${esc(t('communityNote'))}</p>
</aside>`;
}

/** Il tracciato di una linea com'è sulla mappa: striscia colorata con il numero scritto sopra. */
function lineSample(route) {
  const { label, glaze } = lineStyle(route);
  return `<svg class="sample" viewBox="0 0 64 28" width="64" height="28" aria-hidden="true" focusable="false"><path d="M2 14h60" stroke="#fff" stroke-width="9" stroke-linecap="round"/><path d="M2 14h60" stroke="${glaze.bg}" stroke-width="5" stroke-linecap="round"/><text x="32" y="19" text-anchor="middle" font-size="14" font-weight="700" fill="#14213D" stroke="#FBF7EE" stroke-width="3.500" paint-order="stroke" font-family="Atkinson Hyperlegible, system-ui, sans-serif">${esc(label)}</text></svg>`;
}
// Sagoma di bus come sulla mappa: corpo, muso scuro davanti, numero del mezzo sopra. `cls` sceglie il colore del corpo.
function busSample(cls, fill, num) {
  const tag = num ? `<text x="32" y="11" text-anchor="middle" font-size="12" font-weight="700" fill="#14213D" stroke="#FBF7EE" stroke-width="3" paint-order="stroke" font-family="Atkinson Hyperlegible, system-ui, sans-serif">${esc(num)}</text>` : '';
  return `<svg class="sample" viewBox="0 0 64 32" width="64" height="32" aria-hidden="true" focusable="false">${tag}<rect x="8" y="16" width="48" height="13" rx="2" class="${cls}"${fill ? ` fill="${fill}"` : ''} stroke="#fff" stroke-width="1.5"/><rect x="46" y="16" width="10" height="13" rx="2" class="bus-nose"/></svg>`;
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

function legendList() {
  const ex = sampleRoute();
  const row = (sw, key) => `<li>${sw}<span>${esc(t(key))}</span></li>`;
  return `<ul class="legend-list">
    ${row(lineSample(ex), 'legendLine')}
    ${row(busSample('bus-line', lineStyle(ex).glaze.bg, '90020'), 'legendBusLine')}
    ${row(busSample('bus-unk', '', '90018'), 'legendBusUnk')}
    ${row(busSample('bus-idle', '', ''), 'legendBusOff')}
    ${row('<span class="dot dot-stop"></span>', 'legendStop')}
    ${row('<span class="dot dot-me"></span>', 'legendMe')}
  </ul>
  <p class="muted">${esc(t('howNumbers'))} ${esc(t('howSpecial'))}</p>`;
}
function legendPanel() {
  return `<div id="legend" class="legend" role="dialog" aria-label="${esc(t('legend'))}" hidden>
  <div class="legend-top"><h2>${esc(t('legend'))}</h2><button class="icon-btn icon-btn-quiet" data-act="legend" aria-label="${esc(t('close'))}">${icon('close', 22)}</button></div>
  ${legendList()}
</div>`;
}
// Colonna laterale della mappa (solo desktop, da 1000px): titolo, linee in servizio che mettono a fuoco la mappa, legenda sempre aperta.
function mapSide(rid) {
  const run = runningRoutes();
  const tiles = run.length
    ? `<ul class="tile-row">${run.map((r) => `<li><a href="#/mappa/${esc(state.data.routes[r].id)}" aria-label="${esc(t('lines'))} ${esc(state.data.routes[r].short)}">${tileSvg(state.data.routes[r], 48)}</a></li>`).join('')}</ul>`
    : `<p class="note">${esc(t('noLinesNow'))}</p>`;
  return `<aside class="map-side">${pageHead(t('mapTitle'), { lead: t('mapSideLead') })}
<section class="block"><h2>${esc(t('linesNow'))}</h2>${tiles}${rid ? `<p class="note"><a href="#/mappa">${esc(t('mapAll'))}</a></p>` : ''}</section>
<section class="block"><h2>${esc(t('legend'))}</h2>${legendList()}</section>
</aside>`;
}

function viewStop(id) {
  const si = stopById(id);
  if (si < 0) return `<section class="block"><p class="empty-title">${esc(t('noResults'))}</p><a class="btn" href="#/cerca">${icon('search', 20)}<span>${esc(t('searchStop'))}</span></a></section>`;
  store.set('last', id);
  return stopScreen(si);
}

function viewSearch() {
  return `${pageHead(t('searchStop'), { back: ['#/', t('tabHome')] })}<section class="block search-block">
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

/** Linee con una corsa in corso adesso: oggi è attiva la corsa e l'ora cade tra prima e ultima fermata. */
function runningRoutes() {
  const now = romeNow();
  const today = new Set();
  state.data.services.forEach((sv, i) => { if (isServiceActive(sv, now.ymd)) today.add(i); });
  const run = new Set();
  state.data.trips.forEach((tr) => { if (today.has(tr.v) && tr.t[0] <= now.secs && now.secs <= tr.t[tr.t.length - 1]) run.add(tr.r); });
  return [...run].sort((a, b) => state.data.routes[a].short.localeCompare(state.data.routes[b].short, 'it', { numeric: true }));
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
  return `${banners(now)}${pageHead(t('lines'))}<section class="block">
<h2>${esc(t('activeToday'))}</h2><ul class="plain">${act.map(row).join('')}</ul>
${off.length ? `<h2>${esc(t('notToday'))}</h2><ul class="plain dim">${off.map(row).join('')}</ul>` : ''}</section>`;
}

// Fila orari: porta al centro l'orario scelto (il più vicino a ora), senza muovere la pagina.
function centerChip() {
  document.querySelectorAll('.chips').forEach((ul) => {
    const b = ul.querySelector('[aria-selected="true"]');
    if (b) ul.scrollLeft = b.offsetLeft - (ul.clientWidth - b.offsetWidth) / 2;
  });
}
// Dopo ogni disegno della linea: pager tra le direzioni (la direzione vista resta in state.lineDir) e orari centrati.
function bindLine() {
  const pg = $app.querySelector('.gd-pages');
  if (!pg) return;
  const dirs = pg.dataset.dirs.split(',').map(Number);
  bindPager(Number(pg.dataset.cur), (i) => { state.lineDir = dirs[i]; });
  centerChip();
}
function viewLine(rid, tripSel) {
  const ri = routeById(rid);
  if (ri < 0) return `<section class="block"><p class="empty-title">${esc(t('noResults'))}</p></section>`;
  const route = state.data.routes[ri];
  const now = romeNow();
  const day = state.lineDay ?? now.ymd;
  const isToday = day === now.ymd;
  const activeToday = (tr) => isServiceActive(state.data.services[tr.v], day);
  const all = state.data.trips.map((tr, i) => ({ tr, i })).filter((x) => x.tr.r === ri);
  const todays = all.filter((x) => activeToday(x.tr));
  const dirs = [...new Set((todays.length ? todays : all).map((x) => x.tr.d))].sort();
  const focus = state.lineFocus ?? -1; // fermata da cui si arriva: la linea si apre su quella
  const dirWithFocus = focus >= 0 ? dirs.find((d) => (todays.length ? todays : all).some((x) => x.tr.d === d && x.tr.s.includes(focus))) : undefined;
  const dsel = state.lineDir != null && dirs.includes(state.lineDir) ? state.lineDir : (dirWithFocus ?? dirs[0]);
  state.lineView = { rid, day: state.lineDay };
  const head = (d) => {
    const c = {};
    (todays.length ? todays : all).filter((x) => x.tr.d === d).forEach((x) => { c[headOf(x.tr)] = (c[headOf(x.tr)] ?? 0) + 1; });
    return Object.entries(c).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
  };

  const iso = (y) => `${Math.floor(y / 10000)}-${String(Math.floor((y % 10000) / 100)).padStart(2, '0')}-${String(y % 100).padStart(2, '0')}`;
  const m = state.data.meta;
  const clockPlus = (secs) => `${formatClock(secs)}${secs >= 86400 ? ' (+1)' : ''}`;
  const statRow = (label, val) => `<div class="stat"><dt>${esc(t(label))}</dt><dd>${esc(val)}</dd></div>`;
  const dayHtml = `<section class="block line-stats"><label class="day-pick">${esc(t('day'))} <input type="date" id="line-day" value="${iso(day)}"${m.validFrom ? ` min="${iso(m.validFrom)}"` : ''}${m.validTo ? ` max="${iso(m.validTo)}"` : ''} aria-label="${esc(t('day'))}"></label></section>`;

  // Una pagina per direzione: orari, corsa scelta e fermate si leggono senza cambiare schermata.
  const dirPage = (d) => {
    const pool = (todays.length ? todays : all).filter((x) => x.tr.d === d).sort((a, b) => a.tr.t[0] - b.tr.t[0]);
    // Con una fermata di partenza, "prossima corsa" = la prima che ci passa da ora in poi.
    const at = (x) => x.tr.t[x.tr.s.indexOf(focus)];
    const upcoming = (focus >= 0 && isToday ? pool.find((x) => x.tr.s.includes(focus) && at(x) >= now.secs) : null)
      ?? (isToday ? pool.find((x) => x.tr.t[0] >= now.secs) : null) ?? pool[0];
    const sel = (tripSel != null && pool.find((x) => x.i === tripSel)) || upcoming;
    // con la posizione recente e da fermo, ogni fermata dice quanto dista a piedi da te; la più vicina è in evidenza
    const wd = walkDist(state.walkMap);
    // fermate fuori dalla rete pedonale (distanza non finita) o oltre 5 km (turista da casa): niente badge
    let dists = state.loc && !state.loc.moving && sel ? sel.tr.s.map((si) => { const o = state.data.stops[si]; const m = wd(si, distanceM(state.loc.lat, state.loc.lon, o.lat, o.lon)); return Number.isFinite(m) && m <= 5000 ? m : null; }) : null;
    const known = dists ? dists.filter((m) => m != null) : [];
    if (!known.length) dists = null;
    const nearK = dists ? dists.indexOf(Math.min(...known)) : -1;
    const stopsHtml = sel ? sel.tr.s.map((si, k) => {
      const { name } = stopTitle(si);
      const past = isToday && todays.length && sel.tr.t[k] < now.secs && sel.tr.t[0] <= now.secs;
      const here = si === focus;
      return `<li class="${k === 0 ? 'first' : ''}${k === sel.tr.s.length - 1 ? ' last' : ''}${past ? ' past' : ''}${here ? ' here' : ''}"><a href="#/stop/${esc(state.data.stops[si].id)}"${here ? ' aria-current="location"' : ''}><span class="st-name">${esc(name)}</span>${dists?.[k] != null ? walkBadge(dists[k], { exact: isExactWalk(state.walkMap, si), strong: k === nearK, near: k === nearK }) : ''}<span class="st-time">${isApprox(sel.tr, k) ? '≈ ' : ''}${formatClock(sel.tr.t[k])}</span></a></li>`;
    }).join('') : '';
    const dayPool = todays.filter((x) => x.tr.d === d).sort((a, b) => a.tr.t[0] - b.tr.t[0]);
    const starts = dayPool.map((x) => x.tr.t[0]);
    const first = starts[0], last = starts[starts.length - 1];
    const stats = dayPool.length ? `<dl class="stats">${statRow('tripsPerDay', String(dayPool.length))}${statRow('firstPass', clockPlus(first))}${statRow('lastPass', clockPlus(last))}${dayPool.length > 1 ? statRow('avgFreq', t('everyMin', Math.round((last - first) / 60 / (dayPool.length - 1)))) : ''}</dl>` : `<p class="note">${esc(t('noTripsDay'))}</p>`;
    return `<section class="gd-page" role="tabpanel" data-d="${d}" data-i="${sel?.i ?? ''}">
<section class="block line-stats">${stats}</section>
<section class="block"><h2>${esc(t(isToday ? 'departuresToday' : 'departuresDay'))}${pool[0] ? ` · ${esc(t('firstStopOf', stopTitle(pool[0].tr.s[0]).name))}` : ''}</h2>
<ul class="chips" role="listbox" aria-label="${esc(t('departuresToday'))}">${pool.map((x) => `<li><button role="option" aria-selected="${sel && x.i === sel.i}" data-act="trip" data-r="${esc(rid)}" data-i="${x.i}">${formatClock(x.tr.t[0])}</button></li>`).join('')}</ul></section>
<section class="block"><h2>${esc(t('stops'))}</h2><ol class="route-stops">${stopsHtml}</ol></section></section>`;
  };

  return `${banners(now)}
<section class="hero hero-line" data-strip="${stripState(now)}">
  <a class="back" href="#/linee">${icon('back', 22)}<span>${esc(t('lines'))}</span></a>
  <div class="line-head">${tileSvg(route, 60)}<h1>${esc(route.long)}</h1></div>
  <a class="btn btn-on-field" href="#/mappa/${esc(route.id)}">${icon('map', 20)}<span>${esc(t('showOnMap'))}</span></a>
</section>
${dirs.length > 1 ? `<div class="seg" role="tablist">${dirs.map((d, k) => `<button role="tab" aria-selected="${d === dsel}" data-gi="${k}">${esc(t('dir'))} ${esc(head(d))}</button>`).join('')}</div>` : ''}
${dayHtml}
${todays.length ? '' : `<p class="banner">${esc(t('noTripsToday'))}</p>`}
<div class="gd-pages" data-cur="${dirs.indexOf(dsel)}" data-dirs="${dirs.join(',')}">${dirs.map(dirPage).join('')}</div>`;
}

// ---------- mezzo sulla linea ----------
// rid '-' = linea non nota: tra le linee compatibili con la posizione si sceglie quella il cui orario programmato combacia meglio con l'ora.
function viewBus(rid) {
  const ri = rid === '-' ? -1 : routeById(rid);
  if (rid !== '-' && ri < 0) return `<section class="block"><p class="empty-title">${esc(t('noResults'))}</p></section>`;
  return `${banners(romeNow())}
<section class="hero hero-line" data-strip="${stripState(romeNow())}">
  <a class="back" href="#/mappa${rid === '-' ? '' : '/' + esc(rid)}" aria-label="${esc(t('busBack'))}">${icon('back', 22)}<span>${esc(t('busBack'))}</span></a>
  <div class="line-head" id="bus-head">${ri >= 0 ? `${tileSvg(state.data.routes[ri], 60)}<h1>${esc(state.data.routes[ri].long)}</h1>` : `<h1>${esc(t('busNum'))}</h1>`}</div>
</section>
<section class="block bus-track" id="bus-track" role="status" aria-live="polite"><p>${esc(t('busSearching'))}</p></section>
<section class="block"><h2>${esc(t('stops'))}</h2><ol class="route-stops" id="bus-stops"></ol></section>`;
}

async function bindBus(rid, vid) {
  const fixed = rid === '-' ? -1 : routeById(rid);
  const $info = document.getElementById('bus-track');
  const $stops = document.getElementById('bus-stops');
  const $head = document.getElementById('bus-head');
  if (!$info || (rid !== '-' && fixed < 0)) return;
  let destroyed = false, timer = null, abort = null, scrolled = false;
  state.cleanup = () => { destroyed = true; clearTimeout(timer); abort?.abort(); };
  let lines;
  try { lines = buildRouteLines(state.data, await loadShapes()); } catch { $info.innerHTML = `<p>${esc(t('mapError'))}</p>`; return; }
  if (destroyed) return;

  // Per una linea: tracciato più vicino al mezzo e, tra le sue corse di oggi, quella programmata più vicina all'ora attuale.
  function evalRoute(ri, v, now) {
    const loc = locateBus(lines, v, ri);
    if (!loc || loc.d > 80) return null;
    let best = null;
    const consider = (tr, strict) => {
      if (tr.r !== ri || tr.sh !== loc.sh) return;
      if (strict && !isServiceActive(state.data.services[tr.v], now.ymd)) return;
      const pl = placeOnStops(stopsAlong(loc.flat, tr.s.map((si) => state.data.stops[si])), loc.along);
      const gap = Math.abs(tr.t[Math.min(Math.max(pl.k, 0), tr.s.length - 1)] - now.secs);
      if (!best || gap < best.gap) best = { ri, tr, pl, gap: strict ? gap : gap + 86400 };
    };
    state.data.trips.forEach((tr) => consider(tr, true));
    if (!best) state.data.trips.forEach((tr) => consider(tr, false));
    return best;
  }

  function paint(v) {
    if (!v) { $info.innerHTML = `<p>${esc(t('busGone'))}</p>`; return; }
    const now = romeNow();
    const cands = fixed >= 0 ? [fixed] : candidateRoutes(lines, v);
    const evals = cands.map((ri) => evalRoute(ri, v, now)).filter(Boolean).sort((a, b) => a.gap - b.gap);
    if (!evals.length) { $info.innerHTML = `<p><strong>${esc(t('busNum'))} ${esc(v.id)}</strong></p><p>${esc(t('busLost'))}</p>`; return; }
    const { ri, tr, pl } = evals[0];
    const route = state.data.routes[ri];
    $head.innerHTML = `${tileSvg(route, 60)}<h1>${esc(route.long)}</h1>`;
    const name = (k) => stopTitle(tr.s[k]).name;
    const where = pl.at ? t('busAtStop', name(pl.k)) : pl.k < 0 ? t('busBefore') : pl.k >= tr.s.length - 1 ? t('busAfter') : t('busBetween', name(pl.k), name(pl.k + 1));
    const hh = formatClock(romeNow(new Date(v.ts * 1000)).secs);
    const others = evals.slice(1);
    const guess = fixed < 0 && evals.length > 1
      ? `<p class="bus-meta">${esc(t('busGuess'))}</p><ul class="tile-row bus-alt">${others.map((o) => `<li><a href="#/bus/${esc(state.data.routes[o.ri].id)}/${esc(encodeURIComponent(v.id))}" aria-label="${esc(t('lines'))} ${esc(state.data.routes[o.ri].short)}">${tileSvg(state.data.routes[o.ri], 40)}</a></li>`).join('')}</ul>`
      : fixed < 0 ? `<p class="bus-meta">${esc(t('busGuessOne'))}</p>` : '';
    $info.innerHTML = `<p class="bus-where">${icon('pin', 22)}<span>${esc(where)}</span></p>
<p>${esc(t('busToward', headOf(tr)))}</p>
<p class="bus-meta">${esc(t('busNum'))} ${esc(v.id)}${v.plate ? ` · ${esc(t('busPlate'))} ${esc(v.plate)}` : ''} · ${esc(t('busUpdated', hh))}</p>
${guess}<p class="bus-meta">${esc(t('busSchedNote'))}</p>`;
    $stops.innerHTML = tr.s.map((si, k) => {
      const cls = [k === 0 ? 'first' : '', k === tr.s.length - 1 ? 'last' : '', k < pl.k || (k === pl.k && !pl.at) ? 'past' : '', pl.at && k === pl.k ? 'here' : ''].filter(Boolean).join(' ');
      const row = `<li class="${cls}"${pl.at && k === pl.k ? ' aria-current="location"' : ''}><a href="#/stop/${esc(state.data.stops[si].id)}"><span class="st-name">${esc(stopTitle(si).name)}</span><span class="st-time">${isApprox(tr, k) ? '≈ ' : ''}${formatClock(tr.t[k])}</span></a></li>`;
      return !pl.at && k === pl.k && k < tr.s.length - 1 ? `${row}<li class="bus-between" aria-label="${esc(t('busHere'))}"><span>${icon('route', 18)} ${esc(t('busHere'))}</span></li>` : row;
    }).join('');
    if (pl.k < 0) $stops.insertAdjacentHTML('afterbegin', `<li class="bus-between" aria-label="${esc(t('busHere'))}"><span>${icon('route', 18)} ${esc(t('busHere'))}</span></li>`);
    if (!scrolled) { scrolled = true; $stops.querySelector('.here, .bus-between')?.scrollIntoView({ block: 'center' }); }
  }

  async function tick() {
    if (destroyed) return;
    if (!document.hidden) {
      abort = new AbortController();
      try {
        const { active } = await fetchVehicles(abort.signal);
        if (destroyed) return;
        paint(active.find((x) => x.id === vid));
      } catch { if (!destroyed && !$stops.children.length) $info.innerHTML = `<p>${esc(t('busFeedErr'))}</p>`; }
    }
    timer = setTimeout(tick, 10000);
  }
  tick();
}

function viewMap(rid) {
  return `${mapSide(rid)}<section class="map-wrap">
  <div id="map" role="application" aria-label="${esc(t('mapTitle'))}"></div>
  <div class="map-bar">${state.pickSide ? `<p class="chip chip-route" role="status"><span>${esc(t(state.pickSide === 'from' ? 'planPickFrom' : 'planPickTo'))}</span><button type="button" data-act="cancelpick" aria-label="${esc(t('planPickCancel'))}">${icon('close', 18)}</button></p>` : ''}<p id="bus-count" class="chip" role="status"${(state.mapRoute && !rid) || state.pickSide ? ' hidden' : ''}>${esc(t('busesNote'))}</p>${state.mapRoute && !rid ? `<p class="chip chip-route"><span>${esc(state.mapRoute.label)}</span><button type="button" data-act="closeroute" aria-label="${esc(t('planCloseRoute'))}">${icon('close', 18)}</button></p>` : ''}</div>
  <button id="legend-btn" class="legend-btn" data-act="legend" aria-expanded="false" aria-controls="legend">${icon('info', 20)}<span>${esc(t('legend'))}</span></button>
  ${legendPanel()}
  <a class="osd" href="https://opendatasicilia.it/" target="_blank" rel="noopener" title="Open Data Sicilia - https://opendatasicilia.it/"><img src="img/opendatasicilia.png" alt="${esc(t('osdTitle'))}" width="44" height="51"></a>
  <p id="map-msg" class="map-msg" hidden></p>
</section>`;
}
/** Punto scelto sulla mappa (id di fermata o «@lat,lon,etichetta») -> partenza/arrivo, poi si torna al pianificatore. */
function setPlanPoint(side, id) {
  const sd = resolveSide(id);
  if (!sd) return;
  state.plan[side] = sd;
  state.pickSide = null;
  state.mapRoute = null;
  location.hash = planHash();
}
async function bindMap(rid) {
  const msg = document.getElementById('map-msg');
  try {
    const [{ mountMap }, shapes] = await Promise.all([import('./map.js'), loadShapes()]);
    const ctl = await mountMap(document.getElementById('map'), { data: state.data, shapes, focus: rid ? routeById(rid) : -1, route: rid ? null : state.mapRoute, plan: rid ? null : { pick: state.pickSide, onPlan: setPlanPoint }, loc: state.loc, countEl: document.getElementById('bus-count'), t });
    state.cleanup = () => ctl.destroy();
  } catch (e) {
    msg.hidden = false;
    msg.textContent = navigator.onLine ? t('mapError') : t('mapOffline');
  }
}

// ---------- pianificatore di percorso ----------
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
/** "gps", "@lat,lon,etichetta" (un civico) oppure l'id di una fermata -> scelta del pianificatore. */
function resolveSide(id) {
  if (id === 'gps') return { kind: 'gps', id: 'gps' };
  if (id.startsWith('@')) {
    const m = id.match(/^@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(.+)$/);
    return m ? { kind: 'point', id, name: m[3], lat: Number(m[1]), lon: Number(m[2]) } : null;
  }
  const si = stopById(id);
  if (si < 0) return null;
  const g = stopGroups().find((x) => x.stops.includes(si));
  return g ? { kind: 'group', id: g.id, name: g.name, stops: g.stops } : null;
}
const sideLabel = (sd) => (sd.kind === 'gps' ? t('planMyPos') : sd.name);
const WALK_MAX_CROW_M = 5000, WALK_MAX_M = 7000; // a piedi: oltre queste distanze (linea d'aria / sulla rete) non si propone il percorso
const pointId = (lat, lon, label) => `@${lat.toFixed(5)},${lon.toFixed(5)},${label}`;

function viewPlan(m) {
  if (m[1]) {
    state.plan.from = resolveSide(decodeURIComponent(m[1])); state.plan.to = resolveSide(decodeURIComponent(m[2]));
    state.plan.mode = m[4] ? 'walk' : 'bus';
    const hh = m[3] ? Number(m[3].slice(0, 2)) : NaN, mm = m[3] ? Number(m[3].slice(2)) : NaN;
    state.plan.time = hh < 24 && mm < 60 ? hh * 3600 + mm * 60 : null;
  }
  const now = romeNow();
  const field = (side, key, ph) => `<div class="pf">
  <label class="pf-label" for="pf-${side}">${esc(t(key))}</label>
  <div class="field">${icon(side === 'from' ? 'pin' : 'route', 20)}<input id="pf-${side}" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${esc(t(ph))}" aria-controls="pl-${side}"><button type="button" class="field-map" data-act="pickonmap" data-side="${side}" aria-label="${esc(t('planPickMap'))}" title="${esc(t('planPickMap'))}">${icon('map', 22)}</button></div>
  <ul class="plain pf-list" id="pl-${side}"></ul>
</div>`;
  const atMode = state.plan.time != null;
  return `${banners(now)}
<section class="hero hero-line hero-plan" data-strip="${stripState(now)}">
  <a class="back" href="#/">${icon('back', 22)}<span>${esc(t('tabHome'))}</span></a>
  <h1 class="plan-h1">${esc(t('planTitle'))}</h1>
  <p class="lead">${esc(t('planHint'))}</p>
</section>
<section class="block plan-form">
  <div class="seg seg-inline pf-mode" role="radiogroup" aria-label="${esc(t('planModeLabel'))}">
    <button type="button" role="radio" aria-checked="${state.plan.mode !== 'walk'}" data-act="travelmode" data-v="bus">${icon('bus', 20)} ${esc(t('planModeBus'))}</button>
    <button type="button" role="radio" aria-checked="${state.plan.mode === 'walk'}" data-act="travelmode" data-v="walk">${icon('walk', 20)} ${esc(t('planModeWalk'))}</button>
  </div>
  ${field('from', 'planFrom', 'planFromPh')}
  <div class="swap-row"><button type="button" class="btn btn-quiet pf-reset" data-act="resetplan">${icon('close', 18)} ${esc(t('planReset'))}</button><button type="button" class="icon-btn icon-btn-quiet" data-act="swap" aria-label="${esc(t('planSwap'))}">${icon('swap', 22)}</button></div>
  ${field('to', 'planTo', 'planToPh')}
  <div class="pf-time">
    <div class="seg seg-inline" role="radiogroup">
      <button type="button" role="radio" aria-checked="${!atMode}" data-act="timemode" data-v="now">${icon('now', 18)} ${esc(t('planNow'))}</button>
      <button type="button" role="radio" aria-checked="${atMode}" data-act="timemode" data-v="at">${icon('clock', 18)} ${esc(t('planAt'))}</button>
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
      (p) => { setLoc(p); state.locStatus = 'ok'; refreshWalk(state.loc); res(true); },
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
      const mins = Math.max(1, Math.round(l.secs / 60));
      const g = o.geo?.legs[k];
      const lastLeg = k === legs.length - 1;
      const metres = g?.m ? Math.max(10, Math.round(g.m / 10) * 10) : 0;
      const walkTxt = metres ? t('stepWalkM', metres, mins) : t('stepWalk', mins);
      const names = g?.steps?.length ? streetNames(g.steps).join(' › ') : '';
      const dest = nextBus ? nameOf(d.trips[nextBus.trip].s[nextBus.from]) : lastLeg ? sideLabel(state.plan.to) : '';
      const where = [names, dest && `${t('stepUntil')} ${dest}`].filter(Boolean).join(' · ');
      const label = !first && nextBus ? `${t('stepChange')}: ${walkTxt.toLowerCase()}` : walkTxt;
      return `<li class="step step-walk"><span class="step-dot"></span><span class="step-body"><span class="wbadge wbadge-step">${icon('walk', 14)}<span>${esc(label)}</span></span>${where ? `<span class="step-sub">${esc(where)}</span>` : ''}</span></li>`;
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
  return `<li><details class="opt" open>
  <summary><span class="opt-head"><span class="opt-time">${tomorrow && !o.walkOnly ? esc(t('planTomorrow')) + ' ' : ''}${fmtHm(o.start)} → ${fmtHm(o.end)}</span><span class="opt-meta">${esc(t('planDuration', mins))} · ${esc(o.walkOnly ? t('planWalkMeta', Math.round((o.geo?.legs[0]?.m ?? 0) / 10) * 10) : t(o.transfers ? 'planTransfer' : 'planDirect'))}</span></span><span class="opt-tiles">${o.walkOnly ? `<span class="tile-walk">${icon('walk', 20)} ${esc(t('planWalkOnly'))}</span>` : tiles}</span></summary>
  <ol class="steps">${steps}<li class="step step-end"><span class="step-dot"></span><span class="step-body"><b>${esc(t('stepArrive', fmtHm(o.end)))}</b></span></li></ol>
  <button type="button" class="btn btn-quiet opt-map" data-act="showmap" data-i="${i}">${icon('map', 20)} ${esc(t('planOnMap'))}</button>
</details></li>`;
}

/** Testo di anteprima per la condivisione: tratta + migliore soluzione. */
function planShareText(o, tomorrow) {
  const { from, to } = state.plan;
  const lines = o.walkOnly ? t('planWalkOnly') : o.legs.filter((l) => l.kind === 'bus').map((l) => routeOfTrip(l.trip).short).join(' › ');
  return t('planShareText', sideLabel(from), sideLabel(to), `${tomorrow && !o.walkOnly ? t('planTomorrow') + ' ' : ''}${fmtHm(o.start)} → ${fmtHm(o.end)}`, lines);
}

async function runPlan() {
  const out = document.getElementById('plan-out');
  if (!out) return;
  const { from, to, time } = state.plan;
  if (!from || !to) { out.innerHTML = ''; return; }
  if (from.id === to.id) { out.innerHTML = `<p class="note">${esc(t('planSame'))}</p>`; return; }
  syncPlanUrl();
  const walkMode = state.plan.mode === 'walk';
  const ends = [], ctx = [];
  for (const sd of [from, to]) {
    if (sd.kind === 'gps' || sd.kind === 'point') {
      if (sd.kind === 'gps' && !(await getLoc())) { out.innerHTML = `<p class="note">${esc(t('planNeedLoc'))}</p>`; return; }
      const at = sd.kind === 'gps' ? state.loc : sd; // la posizione dell'utente oppure il civico scelto
      if (walkMode) { ctx.push({ at, wm: null }); continue; }
      const g = await loadWalk();
      const wm = g ? walkFrom(g, state.data.stops, at.lat, at.lon) : null;
      const w = walkable(state.data, at.lat, at.lon, 800, 4, walkDist(wm));
      if (!w.length) { out.innerHTML = `<p class="note">${esc(t('planFar'))}</p>`; return; }
      ends.push(w); ctx.push({ at, wm });
    } else { ends.push(sd.stops.map((stop) => ({ stop, walk: 0 }))); ctx.push({ at: null, wm: null }); }
  }
  const now = romeNow();
  const secs = time ?? now.secs;

  if (walkMode) { // solo a piedi: un unico percorso sulla rete pedonale
    const pt = (sd, c) => c.at ?? (sd.kind === 'group' ? state.data.stops[sd.stops[0]] : null);
    const pa = pt(from, ctx[0]), pb = pt(to, ctx[1]);
    const g = await loadWalk();
    const w = g && distanceM(pa.lat, pa.lon, pb.lat, pb.lon) <= WALK_MAX_CROW_M ? walkBetween(g, pa, pb, WALK_MAX_M) : null;
    const wo = w ? { walkOnly: true, start: secs, end: secs + w.secs, transfers: 0, legs: [{ kind: 'walk', secs: w.secs }], geo: { legs: [{ kind: 'walk', pts: w.pts, m: w.m, steps: w.steps, exact: true }], from: { lat: pa.lat, lon: pa.lon }, to: { lat: pb.lat, lon: pb.lon }, stops: [] } } : null;
    state.planOpts = wo ? [wo] : [];
    state.planShareText = wo ? planShareText(wo, false) : '';
    out.innerHTML = wo ? `<ul class="plain opts">${optionHtml(wo, 0, false)}</ul>
<div class="actions"><button type="button" class="btn btn-quiet" data-act="shareplan">${icon('share', 22)} ${esc(t('planShare'))}</button></div>` : `<p class="note">${esc(t('planWalkNone'))}</p>`;
    return;
  }

  let opts = planJourney(state.data, state.index, { from: ends[0], to: ends[1], ymd: now.ymd, secs });
  let tomorrow = false, msg = '';
  if (!opts.length) {
    opts = planJourney(state.data, state.index, { from: ends[0], to: ends[1], ymd: addDays(now.ymd, 1), secs: 0 });
    tomorrow = opts.length > 0;
    msg = t(tomorrow ? 'planNoneNow' : 'planNone');
  }
  let shapes = null;
  try { shapes = await loadShapes(); } catch { /* senza shape il tratto in bus è una retta fra le fermate */ }
  for (const o of opts) o.geo = routeGeometry(state.data, shapes, o, { from: ctx[0], to: ctx[1] });
  state.planOpts = opts;
  const best = opts[0];
  state.planShareText = best ? planShareText(best, tomorrow) : '';
  out.innerHTML = `${msg ? `<p class="note">${esc(msg)}</p>` : ''}${opts.length ? `<ul class="plain opts">${opts.map((o, i) => optionHtml(o, i, tomorrow)).join('')}</ul><p class="muted note">${esc(t('scheduledNote'))}</p>
<div class="actions"><button type="button" class="btn btn-quiet" data-act="shareplan">${icon('share', 22)} ${esc(t('planShare'))}</button></div>` : ''}`;
}

function planHash() {
  const { from, to } = state.plan;
  const tm = state.plan.time;
  const hhmm = tm == null ? '' : `/${String(Math.floor(tm / 3600) % 24).padStart(2, '0')}${String(Math.floor((tm % 3600) / 60)).padStart(2, '0')}`;
  return from && to ? `#/percorso/${encodeURIComponent(from.id)}/${encodeURIComponent(to.id)}${hhmm}${state.plan.mode === 'walk' ? '/piedi' : ''}` : '#/percorso';
}
function syncPlanUrl() {
  const h = planHash();
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
    let seq = 0;
    const show = async () => {
      const q = norm($in.value.trim());
      const my = ++seq;
      const items = [];
      const addr = q.length >= 2 ? await loadIndirizzi().then((db) => (db ? searchIndirizzi(db, $in.value) : [])) : [];
      if (my !== seq) return; // nel frattempo l'utente ha scritto altro
      if (!q || norm(t('planMyPos')).startsWith(q)) {
        items.push(`<li><button type="button" class="row row-btn" data-act="pick" data-side="${side}" data-id="gps"><span class="row-main"><span class="row-title">${icon('locate', 18)} ${esc(t('planMyPos'))}</span></span></button></li>`);
      }
      if (q) {
        const words = q.split(/\s+/);
        groups.filter((g) => words.every((w) => g.key.includes(w)))
          .sort((a, b) => (norm(a.name).startsWith(q) ? 0 : 1) - (norm(b.name).startsWith(q) ? 0 : 1))
          .slice(0, 6)
          .forEach((g) => items.push(`<li><button type="button" class="row row-btn" data-act="pick" data-side="${side}" data-id="${esc(g.id)}"><span class="row-main"><span class="row-title">${esc(g.name)}</span></span><span class="row-tiles">${routesOfStop(g.stops[0], 24, 4)}</span></button></li>`));
        for (const a of addr) {
          items.push(a.kind === 'street'
            ? `<li><button type="button" class="row row-btn" data-act="pickstreet" data-side="${side}" data-name="${esc(a.label)}"><span class="row-main"><span class="row-title">${icon('route', 18)} ${esc(a.label)}</span><span class="row-sub">${esc(t('planStreet'))}</span></span></button></li>`
            : `<li><button type="button" class="row row-btn" data-act="pick" data-side="${side}" data-id="${esc(pointId(a.lat, a.lon, a.label))}"><span class="row-main"><span class="row-title">${icon('pin', 18)} ${esc(a.label)}</span><span class="row-sub">${esc(t('planAddress'))}</span></span></button></li>`);
        }
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

// Contatti generali del Comune (centralino, PEC, sede), copiati da comune.marsala.tp.it/it/page/orari-del-trasporto-pubblico-locale
const COMUNE_CONTATTI = [
  ['tel:0923993111', 'phone', 'contactPhone', '0923 993111'],
  ['mailto:protocollo@pec.comune.marsala.tp.it', 'mail', 'contactPec', 'protocollo@pec.comune.marsala.tp.it'],
  ['https://www.google.com/maps/search/?api=1&query=Via+Giuseppe+Garibaldi+47+Marsala', 'pin', 'contactAddr', 'Via Giuseppe Garibaldi, 47 · 91025 Marsala'],
  ['https://www.comune.marsala.tp.it/it/help', 'external', 'contactHelp', 'comune.marsala.tp.it'],
  ['https://www.comune.marsala.tp.it/it/new-issue', 'external', 'contactIssue', 'comune.marsala.tp.it'],
];

const AVVISI_SOURCES = [
  ['https://www.comune.marsala.tp.it/it/news', 'newsComune'],
  ['https://www.comune.marsala.tp.it/it/page/mobilita-e-trasporti', 'newsMobility'],
  ['https://www.astsicilia.it/', 'newsAst'],
  ['https://www.comune.marsala.tp.it/it/news/feed', 'newsRss'],
];

function avvisoItem(i) {
  const d = new Date(i.date);
  const date = Number.isNaN(+d) ? '' : d.toLocaleDateString(getLang() === 'en' ? 'en-GB' : 'it-IT', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Rome' });
  return `<li class="news-item"><a href="${esc(safeUrl(i.link))}" target="_blank" rel="noopener">
  <span class="news-meta">${date ? `<time datetime="${esc(i.date)}">${esc(date)}</time>` : ''}${i.transport ? `<span class="news-tag">${esc(t('newsTransport'))}</span>` : ''}</span>
  <span class="news-title">${esc(i.title)}</span>
  ${i.summary ? `<span class="news-sum">${esc(i.summary)}</span>` : ''}
</a></li>`;
}

// "Altro": avvisi, guida, informazioni e privacy, fuori dalla barra per tenerla a 5 voci.
function viewMore() {
  const row = (href, ic, title, sub, tag = '') => `<li><a class="row" href="${href}">${icon(ic, 24)}<span class="row-main"><span class="row-title">${esc(t(title))}${tag ? ` <span class="news-tag">${esc(tag)}</span>` : ''}</span><span class="row-sub">${esc(t(sub))}</span></span><span class="chev">${icon('chevron', 20)}</span></a></li>`;
  return `${banners(romeNow())}${pageHead(t('tabMore'))}<section class="block"><ul class="plain">
${row('#/avvisi', 'bell', 'homeNews', 'homeNewsSub', state.newsUnread ? t('newsNew', state.newsUnread) : '')}
${row('#/guida', 'help', 'guideTitle', 'homeGuideSub')}
${row('#/info', 'info', 'info', 'moreInfoSub')}
${row('#/privacy', 'shield', 'privacyFull', 'morePrivacySub')}
</ul></section>`;
}

function viewAvvisi() {
  const src = AVVISI_SOURCES.map(([u, k]) => `<li><a class="row" href="${esc(u)}" target="_blank" rel="noopener"><span class="row-main"><span class="row-title">${esc(t(k))}</span><span class="row-sub">${esc(new URL(u).host)}</span></span>${icon('chevron', 20)}</a></li>`).join('');
  const cont = COMUNE_CONTATTI.map(([u, ic, k, sub]) => `<li><a class="row" href="${esc(u)}"${u.startsWith('http') ? ' target="_blank" rel="noopener"' : ''}>${icon(ic, 20)}<span class="row-main"><span class="row-title">${esc(t(k))}</span><span class="row-sub">${esc(sub)}</span></span>${icon('chevron', 20)}</a></li>`).join('');
  return `${banners(romeNow())}${pageHead(t('news'), { lead: t('newsLead'), back: ['#/altro', t('tabMore')] })}<section class="block">
<div id="news-list" class="gd-nest" aria-live="polite"><p class="note">${esc(t('newsLoading'))}</p></div></section>
<section class="block"><h2>${esc(t('newsSources'))}</h2><ul class="plain">${src}</ul><p class="note">${esc(t('newsNoAst'))}</p></section>
<section class="block"><h2>${esc(t('contactsH'))}</h2><ul class="plain">${cont}</ul><p class="note">${esc(t('contactsNote'))}</p></section>`;
}

function bindAvvisi() {
  loadAvvisi().then((d) => {
    const el = document.getElementById('news-list');
    if (!el) return; // si è già cambiata pagina
    if (!d?.items?.length) { el.innerHTML = `<p class="note">${esc(t('newsErr'))}</p>`; return; }
    refreshNews(true);
    const tr = d.items.filter((i) => i.transport);
    const rest = d.items.filter((i) => !i.transport);
    const list = (arr) => `<ul class="plain news">${arr.map(avvisoItem).join('')}</ul>`;
    const pages = [
      ['tr', t('newsTransport'), tr.length, tr.length ? `<h2>${esc(t('newsTransportH'))}</h2>${list(tr)}` : `<p class="note">${esc(t('newsNoTransport'))}</p>`],
      ...(rest.length ? [['alt', t('newsOther'), rest.length, list(rest)]] : []),
    ];
    // Due pagine affiancate (trasporti / altre notizie): chi cerca solo i bus non scorre tra le notizie del Comune.
    el.innerHTML = `${pages.length > 1 ? `<div class="gd-tabs" role="tablist">${pages.map(([id, ti, n], k) => `<button type="button" role="tab" data-gi="${k}" id="nt-${id}" aria-controls="np-${id}" aria-selected="${k === 0}" tabindex="${k === 0 ? 0 : -1}"><span>${esc(ti)} (${n})</span></button>`).join('')}</div>` : ''}
<div class="gd-pages">${pages.map(([id, , , html]) => `<section class="gd-page" role="tabpanel" id="np-${id}" aria-labelledby="nt-${id}">${html}</section>`).join('')}</div>
<p class="note">${esc(t('newsUpdated', new Date(d.updated).toLocaleString(getLang() === 'en' ? 'en-GB' : 'it-IT', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Rome' })))}</p>`;
    bindPager(0, () => {});
  });
}

let infoCur = 0, privCur = 0;
let guideCur = 0;
// Guida: una pagina per sezione, affiancate in orizzontale con snap; la barra di linguette segue lo scorrimento.
function viewGuida() {
  const doc = t('guideDoc');
  const tab = ([id, ic, title], i) => `<button type="button" role="tab" id="gt-${id}" data-gi="${i}" aria-controls="gp-${id}" aria-selected="${i === guideCur}" tabindex="${i === guideCur ? 0 : -1}">${icon(ic, 20)}<span>${esc(title)}</span></button>`;
  const page = ([id, , title, intro, steps, tip, shots]) => `<section class="gd-page" role="tabpanel" id="gp-${id}" aria-labelledby="gt-${id}"><div class="guide-body">
<h2 class="gd-h">${esc(title)}</h2>
${intro ? `<p>${esc(intro)}</p>` : ''}
<ol class="guide-steps">${steps.map((x) => `<li>${x}</li>`).join('')}</ol>
${tip ? `<p class="guide-tip"><b>${esc(t('guideTip'))}:</b> ${esc(tip)}</p>` : ''}
${shots.map(([f, alt]) => `<figure class="guide-shot"><img src="img/guida/${esc(f)}.webp" width="390" height="720" loading="lazy" decoding="async" alt="${esc(alt)}"></figure>`).join('')}
</div></section>`;
  return `${banners(romeNow())}${pageHead(t('guideTitle'), { lead: t('guideLead'), back: ['#/altro', t('tabMore')] })}<div class="gd-tabs" role="tablist">${doc.map(tab).join('')}</div><div class="gd-pages">${doc.map(page).join('')}</div>`;
}
// Pagine affiancate con snap + linguette: tocco sulla linguetta o swipe cambiano pagina; l'altezza segue la pagina visibile.
function bindPager(cur, onChange) {
  const pages = $app.querySelector('.gd-pages');
  const tabs = [...$app.querySelectorAll('[role=tab][data-gi]')];
  if (!pages || !pages.children.length) return;
  let i0 = Math.min(Math.max(cur, 0), pages.children.length - 1);
  const smooth = () => (reduceMotion.matches ? 'auto' : 'smooth');
  const fit = () => { const pg = pages.children[i0]; if (pg) pages.style.height = `${pg.offsetHeight}px`; };
  const ro = new ResizeObserver(fit);
  const mark = (i) => {
    i0 = i; fit(); ro.disconnect(); ro.observe(pages.children[i]);
    tabs.forEach((b, k) => { b.setAttribute('aria-selected', k === i); b.tabIndex = k === i ? 0 : -1; });
    const b = tabs[i], bar = b?.parentElement;
    if (bar) bar.scrollTo({ left: b.offsetLeft - (bar.clientWidth - b.offsetWidth) / 2, behavior: smooth() });
    onChange(i);
  };
  const go = (i) => pages.scrollTo({ left: i * pages.clientWidth, behavior: smooth() });
  tabs.forEach((b, i) => {
    b.addEventListener('click', () => go(i));
    b.addEventListener('keydown', (e) => {
      const n = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : -1;
      if (n < 0 || n >= tabs.length) return;
      e.preventDefault(); tabs[n].focus(); go(n);
    });
  });
  let tm;
  pages.addEventListener('scroll', () => {
    clearTimeout(tm);
    tm = setTimeout(() => { const i = Math.round(pages.scrollLeft / pages.clientWidth); if (i !== i0) mark(i); }, 60);
  }, { passive: true });
  fit(); ro.observe(pages.children[i0]);
  pages.scrollLeft = i0 * pages.clientWidth;
  const bar = tabs[i0]?.parentElement;
  if (bar) bar.scrollLeft = Math.max(0, tabs[i0].offsetLeft - 16);
}
function bindGuida() { bindPager(guideCur, (i) => { guideCur = i; }); }

function viewInfo() {
  const m = state.data.meta;
  const now = romeNow();
  const fs = feedStatus(m, now.ymd);
  const theme = store.get('theme', 'auto');
  const seg = (name, opts, cur) => `<div class="seg seg-inline" role="radiogroup">${opts.map(([v, l, ic]) => `<button role="radio" aria-checked="${v === cur}" data-act="${name}" data-v="${v}">${ic ? icon(ic, 18) + ' ' : ''}${esc(l)}</button>`).join('')}</div>`;
  const ext = (href, label, ic) => `<a class="info-link" href="${esc(href)}" target="_blank" rel="noopener" title="${esc(href)}">${icon(ic, 20)}<span>${esc(label)}</span>${icon('external', 16)}</a>`;
  const acc = (id, tone, ic, title, body) => [id, ic, title, body];
  const en = getLang() === 'en';
  const sections = [
    acc('src', 'rame', 'scale', t('sourcesLicenses'), `<p>${esc(t('sourceText'))}</p>
<p><a href="${esc(safeUrl(m.source))}" target="_blank" rel="noopener" title="${esc(m.source)}">${esc(t('sourcePage'))}</a></p>
<p>${esc(t('citeBuildings'))} <a href="https://doi.org/10.5194/essd-17-6647-2025" target="_blank" rel="noopener">doi:10.5194/essd-17-6647-2025</a> · <a href="https://github.com/zhu-xlab/GlobalBuildingAtlas" target="_blank" rel="noopener">GlobalBuildingAtlas</a></p>
<p>${esc(t('citeOrtho'))} <a href="https://map.sitr.regione.sicilia.it/gis/rest/services/ortofoto/ortofoto_2022_20cm_sicilia/ImageServer" target="_blank" rel="noopener">SITR Regione Siciliana</a></p>
<p>${esc(t('osmWalk'))} <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>, ODbL.</p>
<p>${esc(t('citeAddresses'))} <a href="https://palermohub.opendatasicilia.it/anncus.html" target="_blank" rel="noopener">PalermoHub</a> · <a href="https://www.anncsu.gov.it/it/consultazione-dellarchivio/open-data/" target="_blank" rel="noopener">ANNCSU</a></p>
<p>${esc(t('approxInfo'))}</p>
<p>${esc(t('notOfficial'))}</p>
<h2 class="h3">${esc(t('licenses'))}</h2>
<p>${esc(t('licData'))}: <a href="https://creativecommons.org/licenses/by/4.0/deed.${en ? 'en' : 'it'}" target="_blank" rel="noopener">CC BY 4.0</a><br>${esc(t('licCode'))}: <a href="https://github.com/PalermoHub/marsala_tpl/blob/main/LICENSE" target="_blank" rel="noopener">${esc(t('licCodeText'))}</a></p>`),
    acc('valid', 'cobalt', 'calendar', t('validity'), `<p>${m.validTo ? esc(t('validUntil', fmtDate(m.validTo))) : ''}</p><p class="muted">${esc(t('version'))}: ${esc(m.feedVersion ?? '–')}</p>`),
    acc('look', 'ocra', 'sliders', `${t('language')} · ${t('theme')}`, `<h2 class="h3">${esc(t('language'))}</h2>${seg('lang', [['it', 'Italiano', 'globe'], ['en', 'English', 'globe']], getLang())}<h2 class="h3">${esc(t('theme'))}</h2>${seg('theme', [['auto', t('themeAuto'), 'contrast'], ['light', t('themeLight'), 'sun'], ['dark', t('themeDark'), 'moon']], theme)}`),
    acc('err', 'terra', 'flag', t('reportError'), `<p>${esc(t('reportHelp'))}${m.contact ? ` <a href="${esc(safeUrl(m.contact))}" rel="noopener">${esc(t('reportError'))}</a>` : ''}</p>${m.corrections?.length ? `<h2 class="h3">${esc(t('corrections'))}</h2><p>${esc(t('correctionsText'))}</p>` : ''}`),
    acc('priv', 'cobalt', 'shield', t('privacy'), `<p>${esc(t('privacyText'))}</p><h2 class="h3">${esc(t('consentManage'))}</h2>${seg('consent', [['granted', t('consentOn'), 'check'], ['denied', t('consentOff'), 'close']], getConsent())}${getConsent() ? '' : `<p class="muted">${esc(t('consentNone'))}</p>`}<p><a href="#/privacy">${esc(t('privacyFull'))}</a></p>`),
    acc('cred', 'ocra', 'heart', t('credits'), `<p>${esc(t('creditsText'))}</p><div class="info-links">${ext('https://www.linkedin.com/in/gbvitrano/', '@gbvitrano · LinkedIn', 'linkedin')}${ext('https://claude.ai/', 'Claude AI · Anthropic', 'spark')}</div>`),
  ];
  const tab = ([id, ic, title], i) => `<button type="button" role="tab" id="it-${id}" data-gi="${i}" aria-controls="ip-${id}" aria-selected="${i === infoCur}" tabindex="${i === infoCur ? 0 : -1}">${icon(ic, 20)}<span>${esc(title)}</span></button>`;
  const page = ([id, , title, body]) => `<section class="gd-page" role="tabpanel" id="ip-${id}" aria-labelledby="it-${id}"><div class="guide-body"><h2 class="gd-h">${esc(title)}</h2>${body}</div></section>`;
  return `${banners(now)}${pageHead(t('info'), { back: ['#/altro', t('tabMore')] })}<div class="gd-tabs" role="tablist">${sections.map(tab).join('')}</div><div class="gd-pages">${sections.map(page).join('')}</div>`;
}
function bindInfo() { bindPager(infoCur, (i) => { infoCur = i; }); }

function viewPrivacy() {
  const link = (s) => esc(s).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
  const consent = `<div class="seg seg-inline" role="radiogroup">${[['granted', t('consentOn'), 'check'], ['denied', t('consentOff'), 'close']].map(([v, l, ic]) => `<button role="radio" aria-checked="${v === getConsent()}" data-act="consent" data-v="${v}">${icon(ic, 18)} ${esc(l)}</button>`).join('')}</div>`;
  const secs = [...t('privacyDoc').map(([h, ps]) => [h, ps.map((p) => `<p>${link(p)}</p>`).join('')]), [t('consentManage'), consent]];
  const tab = ([h], i) => `<button type="button" role="tab" id="pt-${i}" data-gi="${i}" aria-controls="pp-${i}" aria-selected="${i === privCur}" tabindex="${i === privCur ? 0 : -1}"><span>${esc(h)}</span></button>`;
  const page = ([h, body], i) => `<section class="gd-page prose" role="tabpanel" id="pp-${i}" aria-labelledby="pt-${i}"><h2>${esc(h)}</h2>${body}</section>`;
  return `${pageHead(t('privacyFull'), { lead: t('privacyUpdated'), back: ['#/info', t('info')] })}<div class="gd-tabs" role="tablist">${secs.map(tab).join('')}</div><div class="gd-pages">${secs.map(page).join('')}</div>`;
}
function bindPrivacy() { bindPager(privCur, (i) => { privCur = i; }); }

// Banner del consenso: non blocca l'uso dell'app, Accetta e Rifiuta hanno lo stesso peso.
function renderConsent() {
  document.getElementById('consent')?.remove();
  document.documentElement.style.setProperty('--consent-h', '0px');
  if (getConsent()) return;
  const el = document.createElement('section');
  el.id = 'consent';
  el.className = 'consent';
  el.setAttribute('aria-labelledby', 'consent-t');
  el.innerHTML = `<h2 id="consent-t" class="sr">${esc(t('consentTitle'))}</h2><p>${esc(t('consentText'))} <a href="#/privacy">${esc(t('consentInfo'))}</a></p>
<div class="consent-btns"><button class="btn btn-choice" data-act="consent" data-v="denied">${icon('close', 20)}<span>${esc(t('consentReject'))}</span></button><button class="btn btn-choice" data-act="consent" data-v="granted">${icon('check', 20)}<span>${esc(t('consentAccept'))}</span></button></div>`;
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act="consent"]');
    if (!b) return;
    setConsent(b.dataset.v === 'granted');
    renderConsent();
    rerenderKeepScroll();
    toast(t('consentSaved'));
  });
  document.body.appendChild(el);
  // l'altezza del banner entra nel padding dell'app e nei comandi in basso della mappa, così non copre nulla
  document.documentElement.style.setProperty('--consent-h', `${el.offsetHeight + 10}px`);
}

// ---------- router ----------
const routes = [
  [/^\/?$/, () => viewHome(), 'home'],
  [/^\/vicino$/, () => viewNear(), 'home'],
  [/^\/stop\/(.+)$/, (m) => viewStop(decodeURIComponent(m[1])), 'home'],
  [/^\/cerca$/, () => viewSearch(), 'home', bindSearch],
  [/^\/percorso(?:\/([^/]+)\/([^/]+)(?:\/(\d{4}))?(?:\/(piedi))?)?$/, (m) => viewPlan(m), 'plan', bindPlan],
  [/^\/linee$/, () => viewLines(), 'lines'],
  [/^\/linea\/([^/]+)(?:\/fermata\/(.+))?$/, (m) => {
    state.lineFocus = m[2] ? stopById(decodeURIComponent(m[2])) : -1;
    const rid = decodeURIComponent(m[1]), o = state.origin?.rid === rid ? state.origin : null;
    if (o) { state.lineDir = o.d; state.lineDay = o.day; } // si torna alla linea di partenza: stessa direzione, giorno e corsa
    return viewLine(rid, o?.i);
  }, 'lines', (m) => { bindLine(); if (m[2]) setTimeout(() => document.querySelector('.route-stops .here')?.scrollIntoView({ block: 'center' }), 0); }],
  [/^\/bus\/([^/]+)\/(.+)$/, (m) => viewBus(decodeURIComponent(m[1])), 'map', (m) => bindBus(decodeURIComponent(m[1]), decodeURIComponent(m[2]))],
  [/^\/mappa(?:\/(.+))?$/, (m) => viewMap(m[1] && decodeURIComponent(m[1])), 'map', (m) => bindMap(m[1] && decodeURIComponent(m[1]))],
  [/^\/altro$/, () => viewMore(), 'more'],
  [/^\/avvisi$/, () => viewAvvisi(), 'more', bindAvvisi],
  [/^\/guida$/, () => viewGuida(), 'more', bindGuida],
  [/^\/info$/, () => viewInfo(), 'more', bindInfo],
  [/^\/privacy$/, () => viewPrivacy(), 'more', bindPrivacy],
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

// Cambio schermata: dissolvenza breve con View Transitions dove esistono; senza, resta il solo `rise` della cifra.
// Si salta con "riduci movimento" e da/verso la mappa (WebGL: l'istantanea costa più di quanto serve).
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
// Nell'embed la pagina esterna riflette l'hash corrente nella barra degli indirizzi (condivisione e ricarica).
const syncParent = () => { if (embedded) parent.postMessage({ type: 'marsala-tpl-hash', hash: location.hash }, 'https://palermohub.opendatasicilia.it'); };
window.addEventListener('hashchange', syncParent);
window.addEventListener('hashchange', () => {
  state.lineDir = null; state.lineDay = null; state.lineFocus = -1;
  if (!/^#\/(stop|linea)\//.test(location.hash)) state.origin = null; // fuori dal giro linea↔fermate si riparte da zero
  const swap = () => { render(true); window.scrollTo(0, 0); };
  const fromMap = current?.tab === 'map';
  if (document.startViewTransition && !reduceMotion.matches && !fromMap && !/^#\/(mappa|bus)/.test(location.hash)) document.startViewTransition(swap);
  else swap();
});

// Aggiorna i minuti mentre l'app è aperta (non sulla mappa, né mentre si digita).
setInterval(() => {
  if (document.hidden || !current || current.tab === 'map' || document.activeElement?.id === 'q') return;
  if (/^\/(vicino|stop|linea)/.test(current.path)) rerenderKeepScroll();
}, 20000);

// ---------- azioni ----------
$app.addEventListener('change', (e) => {
  if (e.target.id !== 'line-day' || !e.target.value) return;
  const m = current?.path.match(/^\/linea\/([^/]+)/);
  if (!m) return;
  state.lineDay = Number(e.target.value.replaceAll('-', ''));
  $app.innerHTML = viewLine(decodeURIComponent(m[1]));
  bindLine();
});
// Da una fermata della linea: si ricorda la linea (direzione, giorno, corsa, fermata) per poter tornare, anche dopo più fermate.
$app.addEventListener('click', (e) => {
  const a = e.target.closest('.route-stops a');
  const pg = a?.closest('.gd-page');
  const v = state.lineView && pg ? { ...state.lineView, d: Number(pg.dataset.d), i: pg.dataset.i === '' ? undefined : Number(pg.dataset.i) } : null;
  if (!a || !v) return;
  const stop = decodeURIComponent(a.getAttribute('href').replace('#/stop/', ''));
  if (!state.origin) state.origin = { ...v, stop };
  else if (state.origin.rid === v.rid) state.origin = { ...state.origin, ...v, stop };
});
$app.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const act = b.dataset.act;
  if (act === 'fav') { store.toggleFav(b.dataset.id); rerenderKeepScroll(); if (isFav(b.dataset.id)) document.querySelector('[data-act="fav"]')?.classList.add('pop'); }
  else if (act === 'share') {
    const url = shareUrl(`#/stop/${b.dataset.id}`);
    const title = document.title;
    try {
      if (navigator.share) await navigator.share({ title, url });
      else { await navigator.clipboard.writeText(url); toast(t('linkCopied')); }
    } catch { /* annullato */ }
  } else if (act === 'shareplan') {
    const url = shareUrl();
    const text = state.planShareText || '';
    try {
      if (navigator.share) await navigator.share({ title: document.title, text, url });
      else { await navigator.clipboard.writeText(`${text}\n${url}`); toast(t('linkCopied')); }
    } catch { /* annullato */ }
  } else if (act === 'geo') locate();
  else if (act === 'trip') { $app.innerHTML = viewLine(b.dataset.r, Number(b.dataset.i)); bindLine(); }
  else if (act === 'pick') pickSide(b.dataset.side, b.dataset.id);
  else if (act === 'pickonmap') { state.pickSide = b.dataset.side === 'to' ? 'to' : 'from'; state.mapRoute = null; location.hash = '#/mappa'; }
  else if (act === 'cancelpick') { state.pickSide = null; location.hash = planHash(); }
  else if (act === 'showmap') {
    const o = state.planOpts?.[Number(b.dataset.i)];
    if (o?.geo) { state.mapRoute = { ...o.geo, label: `${sideLabel(state.plan.from)} → ${sideLabel(state.plan.to)}` }; location.hash = '#/mappa'; }
  } else if (act === 'closeroute') { state.mapRoute = null; $app.innerHTML = viewMap(); bindMap(); }
  else if (act === 'pickstreet') {
    const $i = document.getElementById(`pf-${b.dataset.side}`);
    $i.value = `${b.dataset.name} `; $i.focus(); $i.dispatchEvent(new Event('input'));
  }
  else if (act === 'swap') {
    [state.plan.from, state.plan.to] = [state.plan.to, state.plan.from];
    for (const sd of ['from', 'to']) { const $i = document.getElementById(`pf-${sd}`); $i.value = state.plan[sd] ? sideLabel(state.plan[sd]) : ''; }
    syncPlanUrl(); runPlan();
  } else if (act === 'resetplan') {
    // Azzera partenza, arrivo, orario, modalità e il percorso aperto in mappa.
    state.plan = { from: null, to: null, time: null, mode: 'bus' };
    state.planOpts = null; state.planShareText = ''; state.mapRoute = null;
    history.replaceState(null, '', '#/percorso');
    $app.innerHTML = viewPlan([]); bindPlan();
    document.getElementById('pf-from')?.focus();
  } else if (act === 'travelmode') {
    state.plan.mode = b.dataset.v === 'walk' ? 'walk' : 'bus';
    document.querySelectorAll('[data-act="travelmode"]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
    runPlan();
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
  else if (act === 'lang') { store.set('lang', b.dataset.v); setLang(b.dataset.v); renderChrome(); renderConsent(); rerenderKeepScroll(); }
  else if (act === 'consent') { setConsent(b.dataset.v === 'granted'); renderConsent(); rerenderKeepScroll(); toast(t('consentSaved')); }
  else if (act === 'theme') { store.set('theme', b.dataset.v); applyTheme(); rerenderKeepScroll(); }
});

/** Scarica la rete pedonale (una volta) e sostituisce le distanze approssimate con quelle sulle strade. */
async function refreshWalk(loc) {
  const g = await loadWalk();
  if (!g || state.loc !== loc) return; // offline senza cache, oppure nel frattempo la posizione è cambiata
  state.walkMap = walkFrom(g, state.data.stops, loc.lat, loc.lon);
  rerenderKeepScroll();
}

function locate() {
  if (!navigator.geolocation) { state.locStatus = 'denied'; rerenderKeepScroll(); return; }
  state.locStatus = 'asking';
  rerenderKeepScroll();
  navigator.geolocation.getCurrentPosition(
    (p) => {
      setLoc(p);
      state.locStatus = 'ok';
      const [n] = nearestStops(state.data, state.loc.lat, state.loc.lon, 1);
      // Se la posizione è lontana da Marsala (turista che prova l'app da casa) non forza nessuna fermata.
      if (n && n.m < 5000 && !store.get('last')) store.set('last', state.data.stops[n.i].id);
      state.walkMap = null;
      rerenderKeepScroll();
      refreshWalk(state.loc);
    },
    () => { state.locStatus = 'denied'; rerenderKeepScroll(); },
    { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }, // «Aggiorna» deve dare la posizione di adesso, non una in cache
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

// Barra inferiore: toggle on/off. Tab attiva + clic: da una sotto-pagina torna
// alla radice del tab (es. dettaglio linea -> lista linee), dalla radice spegne e va alla home.
const TAB_ROOT = { plan: '#/percorso', lines: '#/linee', map: '#/mappa', more: '#/altro' };
$nav.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-tab]');
  const root = a && TAB_ROOT[a.dataset.tab];
  if (!root || !a.hasAttribute('aria-current')) return;
  e.preventDefault();
  location.hash = location.hash === root ? '#/' : root;
});

function renderChrome() {
  $nav.setAttribute('aria-label', t('appName'));
  const items = [['home', '#/', 'home', 'tabHome'], ['plan', '#/percorso', 'route', 'tabPlan'], ['lines', '#/linee', 'list', 'tabLines'], ['map', '#/mappa', 'map', 'tabMap'], ['more', '#/altro', 'more', 'tabMore']];
  $nav.innerHTML = items.map(([tab, href, ic, key]) => `<a href="${href}" data-tab="${tab}">${icon(ic, 24)}<span>${esc(t(key))}</span></a>`).join('');
  paintNewsBadge();
}

// Avvisi nuovi sul trasporto: contano quelli più recenti dell'ultima volta che hai aperto «Avvisi».
// Chi apre l'app per la prima volta parte da zero: nessun arretrato da smaltire.
function paintNewsBadge() {
  const a = $nav.querySelector('[data-tab="more"]');
  a?.querySelectorAll('.tab-badge, .tab-badge-sr').forEach((e) => e.remove());
  const n = state.newsUnread ?? 0;
  if (a && n > 0) a.insertAdjacentHTML('beforeend', `<span class="tab-badge" aria-hidden="true">${n > 9 ? '9+' : n}</span><span class="sr tab-badge-sr">${esc(t('newsNew', n))}</span>`);
}
async function refreshNews(markSeen = false) {
  const d = await loadAvvisi();
  if (!d?.items) return;
  const dates = d.items.filter((i) => i.transport && i.date).map((i) => i.date).sort();
  const latest = dates.at(-1);
  if (!latest) return;
  const seen = store.get('newsSeen');
  if (markSeen || !seen) store.set('newsSeen', latest);
  state.newsUnread = markSeen || !seen ? 0 : dates.filter((x) => x > seen).length;
  paintNewsBadge();
}

// ---------- avvio ----------
async function boot() {
  setLang(detectLang(store.get('lang')));
  applyTheme();
  renderChrome();
  applyConsent();
  renderConsent();
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);
  window.addEventListener('online', rerenderKeepScroll);
  window.addEventListener('offline', rerenderKeepScroll);
  try {
    await loadData();
    render(true);
    refreshNews(); // in coda: non rallenta la prima schermata
  } catch {
    $app.innerHTML = `<section class="block"><p class="empty-title">${esc(t('loadError'))}</p><p>${esc(t('loadHelp'))}</p><button class="btn" data-act="reload">${icon('reload', 20)}<span>${esc(t('retry'))}</span></button></section>`;
  }
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}
boot();
