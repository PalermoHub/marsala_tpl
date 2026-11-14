// Mappa: MapLibre caricato solo quando si apre la scheda Mappa. Mostra percorsi, fermate e i bus in servizio.
import { lineStyle } from './tiles.js';
import { fetchVehicles } from './rt.js';
import { buildRouteLines, inferRoute } from './match.js';
import { formatClock, romeNow } from './schedule.js';

const ML_VERSION = '4.7.1';
const ML_JS = `https://cdn.jsdelivr.net/npm/maplibre-gl@${ML_VERSION}/dist/maplibre-gl.js`;
const ML_CSS = `https://cdn.jsdelivr.net/npm/maplibre-gl@${ML_VERSION}/dist/maplibre-gl.css`;
// Integrità (SRI) della versione bloccata: se il file sul CDN cambia, il browser lo rifiuta. Da rigenerare se si cambia ML_VERSION.
const ML_JS_SRI = 'sha384-SYKAG6cglRMN0RVvhNeBY0r3FYKNOJtznwA0v7B5Vp9tr31xAHsZC0DqkQ/pZDmj';
const ML_CSS_SRI = 'sha384-MinO0mNliZ3vwppuPOUnGa+iq619pfMhLVUXfC4LHwSCvF9H+6P/KO4Q7qBOYV5V';
const STYLE_LIGHT = 'https://tiles.openfreemap.org/styles/positron';
const STYLE_DARK = 'https://tiles.openfreemap.org/styles/dark';
const CENTER = [12.4437, 37.7985];
const POLL_MS = 10000;
// Provincia di Trapani con Egadi e Pantelleria (O, S, E, N): la mappa non esce da qui.
const BBOX = [[11.8, 36.55], [13.2, 38.3]];


// Vista della mappa nell'URL (?map=zoom/lat/lng/direzione): link condivisibile senza toccare il #/ delle rotte dell'app.
const HASH_KEY = 'map';
function readHash() {
  const v = new URLSearchParams(location.search).get(HASH_KEY)?.split('/').map(Number);
  if (!v || v.length < 3 || v.slice(0, 3).some((n) => !Number.isFinite(n)) || Math.abs(v[1]) > 85 || Math.abs(v[2]) > 180) return null;
  return { zoom: Math.min(22, Math.max(0, v[0])), center: [v[2], v[1]], bearing: Number.isFinite(v[3]) ? v[3] : 0 };
}
function writeHash(map) {
  const c = map.getCenter();
  const q = new URLSearchParams(location.search);
  q.set(HASH_KEY, `${map.getZoom().toFixed(2)}/${c.lat.toFixed(5)}/${c.lng.toFixed(5)}/${map.getBearing().toFixed(0)}`);
  history.replaceState(history.state, '', `${location.pathname}?${q.toString().replace(/%2F/g, '/')}${location.hash}`);
}
function clearHash() {
  const q = new URLSearchParams(location.search);
  if (!q.has(HASH_KEY)) return;
  q.delete(HASH_KEY);
  history.replaceState(history.state, '', `${location.pathname}${q.size ? `?${q}` : ''}${location.hash}`);
}

const SVG = (d) => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICON = {
  home: SVG('<path d="M4 11l8-7 8 7v9H4z"/><path d="M10 20v-6h4v6"/>'),
  locate: SVG('<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8"/><path d="M12 1.500v3M12 19.500v3M1.500 12h3M19.500 12h3"/>'),
  compass: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 2.500l4 9.500h-8z" fill="#C8412B"/><path d="M12 21.500l-4-9.500h8z" fill="currentColor" opacity="0.55"/></svg>',
  full: SVG('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  exit: SVG('<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>'),
};

let loading = null;
function loadMapLibre() {
  if (window.maplibregl) return Promise.resolve(window.maplibregl);
  loading ??= new Promise((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = ML_CSS;
    css.integrity = ML_CSS_SRI;
    css.crossOrigin = 'anonymous';
    document.head.append(css);
    const s = document.createElement('script');
    s.src = ML_JS;
    s.integrity = ML_JS_SRI;
    s.crossOrigin = 'anonymous';
    s.onload = () => resolve(window.maplibregl);
    s.onerror = () => { loading = null; reject(new Error('maplibre')); };
    document.head.append(s);
  });
  return loading;
}

const isDark = () => {
  const th = document.documentElement.dataset.theme;
  return th ? th === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
};

export async function mountMap(el, { data, shapes, focus, loc, countEl, t }) {
  const maplibregl = await loadMapLibre();
  const map = new maplibregl.Map({ container: el, style: isDark() ? STYLE_DARK : STYLE_LIGHT, center: CENTER, zoom: 12.6, maxBounds: BBOX, attributionControl: { compact: true, customAttribution: 'Edifici 3D: <a href="https://doi.org/10.5194/essd-17-6647-2025" target="_blank" rel="noopener">Zhu et al. 2025</a>, <a href="https://github.com/zhu-xlab/GlobalBuildingAtlas" target="_blank" rel="noopener">GlobalBuildingAtlas</a> (TUM), CC BY-NC 4.0 / ODbL' }, maxPitch: 70 });
  // Attribuzione chiusa all'avvio: si apre solo toccando la «i».
  const closeAttrib = () => { const a = el.querySelector('.maplibregl-ctrl-attrib'); a?.classList.remove('maplibregl-compact-show'); a?.removeAttribute('open'); };
  closeAttrib();
  map.once('load', closeAttrib);
  map.once('idle', closeAttrib);
  map.addControl(new maplibregl.ScaleControl({ maxWidth: 110, unit: 'metric' }), 'bottom-left');

  // Un percorso per ogni shape usata, colorato come la piastrella della linea.
  const seen = new Set();
  const lineFeatures = [];
  data.trips.forEach((trip) => {
    if (!trip.sh || seen.has(trip.sh) || !shapes[trip.sh]) return;
    seen.add(trip.sh);
    const flat = shapes[trip.sh];
    const coords = [];
    for (let i = 0; i < flat.length; i += 2) coords.push([flat[i + 1], flat[i]]);
    lineFeatures.push({ type: 'Feature', properties: { r: trip.r, color: lineStyle(data.routes[trip.r]).glaze.bg, label: lineStyle(data.routes[trip.r]).label }, geometry: { type: 'LineString', coordinates: coords } });
  });
  // Con una linea scelta la mappa mostra solo quella e le sue fermate; senza, tutta la rete.
  const dim = focus >= 0;
  const focusStops = new Set();
  if (dim) data.trips.forEach((trip) => { if (trip.r === focus) trip.s.forEach((i) => focusStops.add(i)); });
  const stopFeatures = data.stops.map((s, i) => ({ type: 'Feature', properties: { id: s.id, name: s.name, i }, geometry: { type: 'Point', coordinates: [s.lon, s.lat] } })).filter((f) => !dim || focusStops.has(f.properties.i));
  if (dim) lineFeatures.splice(0, lineFeatures.length, ...lineFeatures.filter((f) => f.properties.r === focus));

  const empty = { type: 'FeatureCollection', features: [] };
  await new Promise((r) => (map.loaded() ? r() : map.once('load', r)));

  map.addSource('lines', { type: 'geojson', data: { type: 'FeatureCollection', features: lineFeatures } });
  map.addSource('stops', { type: 'geojson', data: { type: 'FeatureCollection', features: stopFeatures } });
  map.addSource('buses', { type: 'geojson', data: empty });
  map.addSource('buses-nose', { type: 'geojson', data: empty });
  map.addSource('bus-pts', { type: 'geojson', data: empty });
  map.addSource('bus-clusters', { type: 'geojson', data: empty });
  if (loc) map.addSource('me', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'Point', coordinates: [loc.lon, loc.lat] } } });

  map.addLayer({ id: 'lines-casing', type: 'line', source: 'lines', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': isDark() ? '#0F1B3D' : '#FFFFFF', 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 4, 16, 10], 'line-opacity': dim ? ['case', ['==', ['get', 'r'], focus], 1, 0.15] : 0.9 } });
  map.addLayer({ id: 'lines', type: 'line', source: 'lines', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ['get', 'color'], 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 2, 16, 6], 'line-opacity': dim ? ['case', ['==', ['get', 'r'], focus], 1, 0.25] : 0.85 } });
  // Il numero di linea sul percorso: l'identità non dipende solo dal colore.
  map.addLayer({ id: 'line-labels', type: 'symbol', source: 'lines', minzoom: 10, layout: { 'symbol-placement': 'line', 'symbol-spacing': 360, 'text-field': ['get', 'label'], 'text-font': ['Noto Sans Bold'], 'text-size': 13, 'text-rotation-alignment': 'viewport', 'text-keep-upright': true, 'text-padding': 8 }, paint: { 'text-color': '#14213D', 'text-halo-color': '#FBF7EE', 'text-halo-width': 2.5, 'text-opacity': dim ? ['case', ['==', ['get', 'r'], focus], 1, 0] : 1 } });
  map.addLayer({ id: 'stops', type: 'circle', source: 'stops', minzoom: dim ? 11 : 13.5, paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], dim ? 11 : 13.5, 3, 17, 7], 'circle-color': '#FBF7EE', 'circle-stroke-color': '#1B3A94', 'circle-stroke-width': 2 } });
  // Mezzi: sagome allungate orientate come la marcia (muso scuro davanti), colorate come la linea stimata.
  // Mezzi: poligoni piatti in 2D, parallelepipedi (fill-extrusion) in 3D. Stessi id: i gestori di click/tooltip restano validi.
  const IDLE_COLOR = '#8A93A6';
  let is3d = false;
  function addBusLayers() {
    for (const id of ['buses-body', 'buses-nose']) if (map.getLayer(id)) map.removeLayer(id);
    const nose = isDark() ? '#FBF7EE' : '#14213D';
    if (is3d) {
      map.addLayer({ id: 'buses-body', type: 'fill-extrusion', source: 'buses', paint: { 'fill-extrusion-color': ['get', 'color'], 'fill-extrusion-height': ['get', 'h'], 'fill-extrusion-base': 0, 'fill-extrusion-opacity': 1 } }, 'bus-labels');
      map.addLayer({ id: 'buses-nose', type: 'fill-extrusion', source: 'buses-nose', paint: { 'fill-extrusion-color': nose, 'fill-extrusion-height': ['get', 'h'], 'fill-extrusion-base': 0, 'fill-extrusion-opacity': 1 } }, 'bus-labels');
    } else {
      map.addLayer({ id: 'buses-body', type: 'fill', source: 'buses', paint: { 'fill-color': ['get', 'color'], 'fill-opacity': ['case', ['==', ['get', 'state'], 'idle'], 0.55, 1], 'fill-outline-color': isDark() ? '#FBF7EE' : '#FFFFFF' } }, 'bus-labels');
      map.addLayer({ id: 'buses-nose', type: 'fill', source: 'buses-nose', paint: { 'fill-color': nose, 'fill-opacity': ['case', ['==', ['get', 'state'], 'idle'], 0.55, 1] } }, 'bus-labels');
    }
  }
  map.addLayer({ id: 'bus-labels', type: 'symbol', source: 'bus-pts', minzoom: 13, filter: ['==', ['get', 'state'], 'active'], layout: { 'text-field': ['get', 'num'], 'text-font': ['Noto Sans Bold'], 'text-size': 11, 'text-offset': [0, -1.5], 'text-allow-overlap': true, 'text-ignore-placement': true }, paint: { 'text-color': ['get', 'ink'], 'text-halo-color': ['get', 'color'], 'text-halo-width': 3 } });
  // Mezzi fermi vicini (tipicamente in deposito): a zoom largo un solo cerchio col numero, non 19 sagome sovrapposte.
  map.addLayer({ id: 'bus-clusters', type: 'circle', source: 'bus-clusters', paint: { 'circle-radius': 16, 'circle-color': IDLE_COLOR, 'circle-stroke-color': isDark() ? '#FBF7EE' : '#FFFFFF', 'circle-stroke-width': 3 } });
  map.addLayer({ id: 'bus-clusters-n', type: 'symbol', source: 'bus-clusters', layout: { 'text-field': ['get', 'n'], 'text-font': ['Noto Sans Bold'], 'text-size': 13, 'text-allow-overlap': true, 'text-ignore-placement': true }, paint: { 'text-color': '#14213D' } });
  addBusLayers();
  if (loc) {
    map.addLayer({ id: 'me-halo', type: 'circle', source: 'me', paint: { 'circle-radius': 18, 'circle-color': '#1B3A94', 'circle-opacity': 0.2 } });
    map.addLayer({ id: 'me', type: 'circle', source: 'me', paint: { 'circle-radius': 8, 'circle-color': '#1B3A94', 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 3 } });
  }

  // Edifici 3D (GlobalBuildingAtlas ritagliato sui percorsi): scaricati solo al primo uso del 3D, errori ignorati.
  let buildings = null;
  function addBuildings() {
    if (!buildings || map.getLayer('buildings-3d')) return;
    if (!map.getSource('edifici3d')) map.addSource('edifici3d', { type: 'geojson', data: buildings });
    map.addLayer({ id: 'buildings-3d', type: 'fill-extrusion', source: 'edifici3d', minzoom: 13, paint: { 'fill-extrusion-color': isDark() ? '#3A4256' : '#E4E0D8', 'fill-extrusion-height': ['get', 'h'], 'fill-extrusion-base': 0, 'fill-extrusion-opacity': 0.92 } }, 'buses-body');
  }
  // Colonna di comandi (home, zoom, posizione, schermo intero, 3D) e cursore di zoom.
  const mkBtn = (cls, html, label, fn) => {
    const bt = document.createElement('button');
    bt.type = 'button';
    bt.className = `map-btn ${cls}`;
    bt.innerHTML = html;
    bt.setAttribute('aria-label', label);
    bt.title = label;
    bt.addEventListener('click', fn);
    return bt;
  };
  const ctrls = document.createElement('div');
  ctrls.className = 'map-ctrls';
  const zoomBox = document.createElement('div');
  zoomBox.className = 'map-zoom';
  const zoomVal = document.createElement('output');
  zoomVal.className = 'map-zoom-val';
  const zoomRange = document.createElement('input');
  zoomRange.type = 'range';
  zoomRange.className = 'map-zoom-range';
  zoomRange.min = '8'; zoomRange.max = '19'; zoomRange.step = '0.1';
  zoomRange.setAttribute('aria-label', t('mapZoomSlider'));
  zoomRange.setAttribute('aria-orientation', 'vertical');
  zoomBox.append(zoomVal, zoomRange);
  const showZoom = () => { const z = map.getZoom(); zoomVal.textContent = z.toFixed(1); zoomRange.value = String(Math.min(19, Math.max(8, z))); };
  zoomRange.addEventListener('input', () => map.setZoom(Number(zoomRange.value)));
  map.on('zoom', showZoom);

  let meBusy = false;
  function placeMe(lon, lat) {
    const data = { type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] } };
    if (map.getSource('me')) { map.getSource('me').setData(data); return; }
    map.addSource('me', { type: 'geojson', data });
    map.addLayer({ id: 'me-halo', type: 'circle', source: 'me', paint: { 'circle-radius': 18, 'circle-color': '#1B3A94', 'circle-opacity': 0.2 } });
    map.addLayer({ id: 'me', type: 'circle', source: 'me', paint: { 'circle-radius': 8, 'circle-color': '#1B3A94', 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 3 } });
  }
  const locBtn = mkBtn('map-loc', ICON.locate, t('mapLocate'), () => {
    if (meBusy || !navigator.geolocation) return;
    meBusy = true;
    locBtn.setAttribute('aria-busy', 'true');
    navigator.geolocation.getCurrentPosition(
      (p) => { meBusy = false; locBtn.removeAttribute('aria-busy'); if (destroyed) return; placeMe(p.coords.longitude, p.coords.latitude); map.flyTo({ center: [p.coords.longitude, p.coords.latitude], zoom: Math.max(map.getZoom(), 15.5), duration: reduced ? 0 : 900 }); },
      () => { meBusy = false; locBtn.removeAttribute('aria-busy'); },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  });
  const fsTarget = el.parentElement;
  const fsBtn = mkBtn('map-fs', ICON.full, t('mapFullscreen'), () => { if (document.fullscreenElement) document.exitFullscreen?.(); else fsTarget.requestFullscreen?.().catch(() => {}); });
  const onFs = () => { const on = document.fullscreenElement === fsTarget; fsBtn.innerHTML = on ? ICON.exit : ICON.full; fsBtn.setAttribute('aria-label', t(on ? 'mapFullscreenExit' : 'mapFullscreen')); fsBtn.title = fsBtn.getAttribute('aria-label'); setTimeout(() => map.resize(), 50); };
  document.addEventListener('fullscreenchange', onFs);
  function initControls() {
    const homeBtn = mkBtn('map-home', ICON.home, t('mapHome'), () => goHome(reduced ? 0 : 700));
    ctrls.append(homeBtn); // lo zoom si fa col cursore (tastiera compresa), con pizzico o rotella: niente +/−
    const compassBtn = mkBtn('map-compass', ICON.compass, t('mapCompass'), () => map.resetNorth({ duration: reduced ? 0 : 400 }));
    const paintCompass = () => { compassBtn.firstElementChild.style.transform = `rotate(${-map.getBearing()}deg)`; };
    map.on('rotate', paintCompass);
    paintCompass();
    ctrls.append(compassBtn);
    if (navigator.geolocation) ctrls.append(locBtn);
    if (fsTarget?.requestFullscreen) ctrls.append(fsBtn);
    ctrls.append(btn3d, zoomBox);
    el.parentElement.append(ctrls);
    showZoom();
  }

  const btn3d = document.createElement('button');
  btn3d.type = 'button';
  btn3d.className = 'map-btn map-3d';
  const paintBtn = () => { btn3d.textContent = is3d ? '2D' : '3D'; btn3d.setAttribute('aria-pressed', String(is3d)); btn3d.setAttribute('aria-label', t(is3d ? 'map2d' : 'map3d')); };
  btn3d.addEventListener('click', async () => {
    is3d = !is3d;
    paintBtn();
    addBusLayers();
    if (is3d) {
      if (!buildings) buildings = await fetch('dati/edifici3d.json').then((r) => (r.ok ? r.json() : null)).catch(() => null);
      if (destroyed || !is3d) return;
      addBuildings();
    }
    if (map.getLayer('buildings-3d')) map.setLayoutProperty('buildings-3d', 'visibility', is3d ? 'visible' : 'none');
    map.easeTo({ pitch: is3d ? 60 : 0, duration: reduced ? 0 : 600 });
    draw();
  });
  paintBtn();

  map.on('click', 'stops', (e) => {
    const f = e.features?.[0];
    if (f) location.hash = `#/stop/${encodeURIComponent(f.properties.id)}`;
  });
  // Contenuto di tooltip (al passaggio) e popup (al tocco): numero mezzo, targa, stato, linea stimata, orario.
  function busInfo(p, full) {
    const box = document.createElement('div');
    const strong = document.createElement('strong');
    strong.textContent = `${t('busNum')} ${p.num}`;
    box.append(strong);
    const row = (txt) => { const d = document.createElement('div'); d.textContent = txt; box.append(d); };
    if (p.plate) row(`${t('busPlate')} ${p.plate}`);
    row(p.state === 'active' ? t('busActive') : t('busIdle'));
    if (p.label) row(t('busLine', p.label));
    if (p.rid) row(t('busOpen'));
    if (full) row(t('busUpdated', p.when));
    return box;
  }
  let tip = null;
  const dropTip = () => { tip?.remove(); tip = null; };
  for (const id of ['buses-body', 'buses-nose']) {
    map.on('click', id, (e) => {
      const f = e.features?.[0];
      if (!f) return;
      dropTip();
      // Linea nota: si apre la linea con il mezzo sul percorso. Altrimenti resta il popup con i dati disponibili.
      if (f.properties.rid) { location.hash = `#/bus/${encodeURIComponent(f.properties.rid)}/${encodeURIComponent(f.properties.id)}`; return; }
      new maplibregl.Popup({ offset: 14 }).setLngLat(e.lngLat).setDOMContent(busInfo(f.properties, true)).addTo(map);
    });
    map.on('mousemove', id, (e) => {
      map.getCanvas().style.cursor = 'pointer';
      const f = e.features?.[0];
      if (!f) return;
      dropTip();
      tip = new maplibregl.Popup({ offset: 14, closeButton: false, closeOnClick: false }).setLngLat(e.lngLat).setDOMContent(busInfo(f.properties, false)).addTo(map);
    });
    map.on('mouseleave', id, () => { map.getCanvas().style.cursor = ''; dropTip(); });
  }
  map.on('click', 'bus-clusters', (e) => { const f = e.features?.[0]; if (f) map.flyTo({ center: f.geometry.coordinates, zoom: Math.max(map.getZoom() + 3, 16), duration: reduced ? 0 : 700 }); });
  map.on('mouseenter', 'bus-clusters', () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'bus-clusters', () => { map.getCanvas().style.cursor = ''; });
  map.on('mouseenter', 'stops', () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'stops', () => { map.getCanvas().style.cursor = ''; });

  // Inquadra la linea scelta, oppure tutta la rete.
  const b = new maplibregl.LngLatBounds();
  lineFeatures.forEach((f) => f.geometry.coordinates.forEach((c) => b.extend(c)));
  const homeFit = { padding: { top: 72, right: 32, bottom: 40, left: 32 }, maxZoom: 15 };
  const goHome = (duration) => { if (!b.isEmpty()) map.fitBounds(b, { ...homeFit, duration, pitch: is3d ? 60 : 0, bearing: 0 }); };
  const shared = readHash();
  if (shared) map.jumpTo(shared); else goHome(0);
  initControls();
  const syncHash = () => writeHash(map);
  map.on('moveend', syncHash);
  if (shared) syncHash();

  // Mezzi: aggiornamento periodico a scheda visibile. Tra due posizioni il mezzo scorre e ruota con continuità.
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lines = buildRouteLines(data, shapes);
  const routeOf = new Map();   // id mezzo -> ultima route riconosciuta
  const shown = new Map();     // id mezzo -> { lon, lat, brg } come disegnato
  let current = [];            // [{ v, state, r, brg }]
  let raf = 0;
  // Senza linea nota: inchiostro su mappa chiara, ocra su mappa scura (l'inchiostro sparirebbe).
  const IDLE = IDLE_COLOR, ACTIVE = isDark() ? '#F2C14E' : '#14213D';
  const lerpAngle = (a, b, k) => { const d = ((b - a + 540) % 360) - 180; return (a + d * k + 360) % 360; };
  // Metri per pixel allo zoom corrente: la sagoma ha dimensione costante a schermo, quindi leggibile a ogni zoom.
  const mpp = (lat) => 78271.517 * Math.cos(lat * Math.PI / 180) / 2 ** map.getZoom();
  function quad(lon, lat, brg, s0, s1, halfW) {
    // Rettangolo lungo la direzione `brg` da s0 a s1 metri dal centro, largo 2*halfW metri.
    const r = brg * Math.PI / 180, fx = Math.sin(r), fy = Math.cos(r), rx = fy, ry = -fx;
    const kx = 111320 * Math.cos(lat * Math.PI / 180), ky = 110540;
    const pt = (s, w) => [lon + (s * fx + w * rx) / kx, lat + (s * fy + w * ry) / ky];
    return [pt(s0, -halfW), pt(s1, -halfW), pt(s1, halfW), pt(s0, halfW), pt(s0, -halfW)];
  }
  const CLUSTER_PX = 26, CLUSTER_MAXZ = 17;
  function draw() {
    const body = [], nose = [], pts = [], clusters = [];
    // Raggruppa i fermi entro CLUSTER_PX pixel (greedy); sotto CLUSTER_MAXZ i gruppi di 2+ diventano un cerchio col numero.
    const grouped = new Set();
    if (map.getZoom() < CLUSTER_MAXZ) {
      const idles = current.filter((it) => it.state === 'idle' && shown.has(it.v.id) && !(dim && it.r !== focus));
      const used = new Set();
      for (const a of idles) {
        if (used.has(a)) continue;
        const pa = map.project([shown.get(a.v.id).lon, shown.get(a.v.id).lat]);
        const grp = idles.filter((b) => { if (used.has(b)) return false; const pb = map.project([shown.get(b.v.id).lon, shown.get(b.v.id).lat]); return Math.hypot(pa.x - pb.x, pa.y - pb.y) <= CLUSTER_PX; });
        grp.forEach((g) => used.add(g));
        if (grp.length < 2) continue;
        grp.forEach((g) => grouped.add(g));
        const lon = grp.reduce((x, g) => x + shown.get(g.v.id).lon, 0) / grp.length;
        const lat = grp.reduce((x, g) => x + shown.get(g.v.id).lat, 0) / grp.length;
        clusters.push({ type: 'Feature', properties: { n: String(grp.length) }, geometry: { type: 'Point', coordinates: [lon, lat] } });
      }
    }
    for (const item of current) {
      if (dim && item.r !== focus) continue;
      if (grouped.has(item)) continue;
      const p = shown.get(item.v.id);
      if (!p) continue;
      const idle = item.state === 'idle';
      const m = mpp(p.lat), L = (idle ? 18 : 28) * m, W = (idle ? 6 : 9) * m;
      const color = idle || item.r == null ? (idle ? IDLE : ACTIVE) : lineStyle(data.routes[item.r]).glaze.bg;
      const label = !idle && item.r != null ? lineStyle(data.routes[item.r]).label : '';
      const props = { id: item.v.id, num: item.v.id, rid: idle ? '' : item.r != null ? data.routes[item.r].id : '-', ink: item.r == null && isDark() ? '#14213D' : '#FFFFFF', plate: item.v.plate, state: item.state, color, label, when: formatClock(romeNow(new Date(item.v.ts * 1000)).secs) };
      body.push({ type: 'Feature', properties: { ...props, h: L * 0.25 }, geometry: { type: 'Polygon', coordinates: [quad(p.lon, p.lat, p.brg, -L / 2, L / 2, W / 2)] } });
      nose.push({ type: 'Feature', properties: { ...props, h: L * 0.28 }, geometry: { type: 'Polygon', coordinates: [quad(p.lon, p.lat, p.brg, L / 2 - L * 0.22, L / 2, W / 2)] } });
      pts.push({ type: 'Feature', properties: props, geometry: { type: 'Point', coordinates: [p.lon, p.lat] } });
    }
    map.getSource('buses')?.setData({ type: 'FeatureCollection', features: body });
    map.getSource('buses-nose')?.setData({ type: 'FeatureCollection', features: nose });
    map.getSource('bus-pts')?.setData({ type: 'FeatureCollection', features: pts });
    map.getSource('bus-clusters')?.setData({ type: 'FeatureCollection', features: clusters });
  }
  function showBuses(list) {
    const from = new Map(shown);
    const t0 = performance.now();
    const D = reduced ? 1 : 2000;
    cancelAnimationFrame(raf);
    current = list.map(({ v, state }) => {
      let r = null;
      if (state === 'active') { r = inferRoute(lines, v, routeOf.get(v.id) ?? null); if (r == null) routeOf.delete(v.id); else routeOf.set(v.id, r); }
      const old = from.get(v.id);
      const moving = v.speed != null && v.speed > 1 && v.bearing != null;
      return { v, state, r, brg: moving ? v.bearing : old?.brg ?? v.bearing ?? 0 };
    });
    const frame = (now) => {
      const k = Math.min(1, (now - t0) / D);
      const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      for (const { v, brg } of current) {
        const f = from.get(v.id);
        shown.set(v.id, f ? { lon: f.lon + (v.lon - f.lon) * e, lat: f.lat + (v.lat - f.lat) * e, brg: lerpAngle(f.brg, brg, e) } : { lon: v.lon, lat: v.lat, brg });
      }
      draw();
      if (k < 1) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  }
  map.on('zoom', draw);
  let timer = null, abort = null, destroyed = false;
  async function poll() {
    if (destroyed) return;
    if (!document.hidden) {
      abort = new AbortController();
      try {
        const { active, idle } = await fetchVehicles(abort.signal);
        if (destroyed) return;
        showBuses([...idle.map((v) => ({ v, state: 'idle' })), ...active.map((v) => ({ v, state: 'active' }))]);
        const head = active.length ? t('busesRunning', active.length) : t('noBuses');
        countEl.textContent = idle.length ? `${head} · ${t('busesIdle', idle.length)}` : head;
        countEl.classList.toggle('live', active.length > 0);
      } catch {
        if (!destroyed) countEl.textContent = t('busesNote');
      }
    }
    timer = setTimeout(poll, POLL_MS);
  }
  poll();

  return { destroy() { destroyed = true; ctrls.remove(); zoomBox.remove(); clearHash(); document.removeEventListener('fullscreenchange', onFs); clearTimeout(timer); cancelAnimationFrame(raf); abort?.abort(); map.remove(); } };
}
