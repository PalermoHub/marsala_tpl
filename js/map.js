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
  const map = new maplibregl.Map({ container: el, style: isDark() ? STYLE_DARK : STYLE_LIGHT, center: CENTER, zoom: 12.6, attributionControl: { compact: true } });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

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
  const stopFeatures = data.stops.map((s, i) => ({ type: 'Feature', properties: { id: s.id, name: s.name, i }, geometry: { type: 'Point', coordinates: [s.lon, s.lat] } }));

  const empty = { type: 'FeatureCollection', features: [] };
  await new Promise((r) => (map.loaded() ? r() : map.once('load', r)));

  map.addSource('lines', { type: 'geojson', data: { type: 'FeatureCollection', features: lineFeatures } });
  map.addSource('stops', { type: 'geojson', data: { type: 'FeatureCollection', features: stopFeatures } });
  map.addSource('buses', { type: 'geojson', data: empty });
  map.addSource('buses-nose', { type: 'geojson', data: empty });
  map.addSource('bus-pts', { type: 'geojson', data: empty });
  if (loc) map.addSource('me', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'Point', coordinates: [loc.lon, loc.lat] } } });

  const dim = focus >= 0;
  map.addLayer({ id: 'lines-casing', type: 'line', source: 'lines', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': isDark() ? '#0F1B3D' : '#FFFFFF', 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 4, 16, 10], 'line-opacity': dim ? ['case', ['==', ['get', 'r'], focus], 1, 0.15] : 0.9 } });
  map.addLayer({ id: 'lines', type: 'line', source: 'lines', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ['get', 'color'], 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 2, 16, 6], 'line-opacity': dim ? ['case', ['==', ['get', 'r'], focus], 1, 0.25] : 0.85 } });
  // Il numero di linea sul percorso: l'identità non dipende solo dal colore.
  map.addLayer({ id: 'line-labels', type: 'symbol', source: 'lines', minzoom: 10, layout: { 'symbol-placement': 'line', 'symbol-spacing': 360, 'text-field': ['get', 'label'], 'text-font': ['Noto Sans Bold'], 'text-size': 13, 'text-rotation-alignment': 'viewport', 'text-keep-upright': true }, paint: { 'text-color': '#14213D', 'text-halo-color': '#FBF7EE', 'text-halo-width': 2.5, 'text-opacity': dim ? ['case', ['==', ['get', 'r'], focus], 1, 0] : 1 } });
  map.addLayer({ id: 'stops', type: 'circle', source: 'stops', minzoom: 13.5, paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 13.5, 3, 17, 7], 'circle-color': '#FBF7EE', 'circle-stroke-color': '#1B3A94', 'circle-stroke-width': 2 } });
  // Mezzi: sagome allungate orientate come la marcia (muso scuro davanti), colorate come la linea stimata.
  map.addLayer({ id: 'buses-body', type: 'fill', source: 'buses', paint: { 'fill-color': ['get', 'color'], 'fill-opacity': ['case', ['==', ['get', 'state'], 'idle'], 0.55, 1], 'fill-outline-color': isDark() ? '#FBF7EE' : '#FFFFFF' } });
  map.addLayer({ id: 'buses-nose', type: 'fill', source: 'buses-nose', paint: { 'fill-color': isDark() ? '#FBF7EE' : '#14213D', 'fill-opacity': ['case', ['==', ['get', 'state'], 'idle'], 0.55, 1] } });
  map.addLayer({ id: 'bus-labels', type: 'symbol', source: 'bus-pts', filter: ['==', ['get', 'state'], 'active'], layout: { 'text-field': ['get', 'num'], 'text-font': ['Noto Sans Bold'], 'text-size': 11, 'text-offset': [0, -1.5], 'text-allow-overlap': true, 'text-ignore-placement': true }, paint: { 'text-color': ['get', 'ink'], 'text-halo-color': ['get', 'color'], 'text-halo-width': 3 } });
  if (loc) {
    map.addLayer({ id: 'me-halo', type: 'circle', source: 'me', paint: { 'circle-radius': 18, 'circle-color': '#1B3A94', 'circle-opacity': 0.2 } });
    map.addLayer({ id: 'me', type: 'circle', source: 'me', paint: { 'circle-radius': 8, 'circle-color': '#1B3A94', 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 3 } });
  }

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
  map.on('mouseenter', 'stops', () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'stops', () => { map.getCanvas().style.cursor = ''; });

  // Inquadra la linea scelta, oppure tutta la rete.
  const b = new maplibregl.LngLatBounds();
  lineFeatures.filter((f) => !dim || f.properties.r === focus).forEach((f) => f.geometry.coordinates.forEach((c) => b.extend(c)));
  if (!b.isEmpty()) map.fitBounds(b, { padding: { top: 72, right: 32, bottom: 40, left: 32 }, duration: 0, maxZoom: 15 });

  // Mezzi: aggiornamento periodico a scheda visibile. Tra due posizioni il mezzo scorre e ruota con continuità.
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lines = buildRouteLines(data, shapes);
  const routeOf = new Map();   // id mezzo -> ultima route riconosciuta
  const shown = new Map();     // id mezzo -> { lon, lat, brg } come disegnato
  let current = [];            // [{ v, state, r, brg }]
  let raf = 0;
  // Senza linea nota: inchiostro su mappa chiara, ocra su mappa scura (l'inchiostro sparirebbe).
  const IDLE = '#8A93A6', ACTIVE = isDark() ? '#F2C14E' : '#14213D';
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
  function draw() {
    const body = [], nose = [], pts = [];
    for (const item of current) {
      const p = shown.get(item.v.id);
      if (!p) continue;
      const idle = item.state === 'idle';
      const m = mpp(p.lat), L = (idle ? 18 : 28) * m, W = (idle ? 6 : 9) * m;
      const color = idle || item.r == null ? (idle ? IDLE : ACTIVE) : lineStyle(data.routes[item.r]).glaze.bg;
      const label = !idle && item.r != null ? lineStyle(data.routes[item.r]).label : '';
      const props = { id: item.v.id, num: item.v.id, rid: !idle && item.r != null ? data.routes[item.r].id : '', ink: item.r == null && isDark() ? '#14213D' : '#FFFFFF', plate: item.v.plate, state: item.state, color, label, when: formatClock(romeNow(new Date(item.v.ts * 1000)).secs) };
      body.push({ type: 'Feature', properties: props, geometry: { type: 'Polygon', coordinates: [quad(p.lon, p.lat, p.brg, -L / 2, L / 2, W / 2)] } });
      nose.push({ type: 'Feature', properties: props, geometry: { type: 'Polygon', coordinates: [quad(p.lon, p.lat, p.brg, L / 2 - L * 0.22, L / 2, W / 2)] } });
      pts.push({ type: 'Feature', properties: props, geometry: { type: 'Point', coordinates: [p.lon, p.lat] } });
    }
    map.getSource('buses')?.setData({ type: 'FeatureCollection', features: body });
    map.getSource('buses-nose')?.setData({ type: 'FeatureCollection', features: nose });
    map.getSource('bus-pts')?.setData({ type: 'FeatureCollection', features: pts });
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

  return { destroy() { destroyed = true; clearTimeout(timer); cancelAnimationFrame(raf); abort?.abort(); map.remove(); } };
}
