// Mappa: MapLibre caricato solo quando si apre la scheda Mappa. Mostra percorsi, fermate e i bus in servizio.
import { lineStyle } from './tiles.js';
import { fetchVehicles } from './rt.js';
import { formatClock, romeNow } from './schedule.js';

const ML_VERSION = '4.7.1';
const ML_JS = `https://cdn.jsdelivr.net/npm/maplibre-gl@${ML_VERSION}/dist/maplibre-gl.js`;
const ML_CSS = `https://cdn.jsdelivr.net/npm/maplibre-gl@${ML_VERSION}/dist/maplibre-gl.css`;
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
    document.head.append(css);
    const s = document.createElement('script');
    s.src = ML_JS;
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
  if (loc) map.addSource('me', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'Point', coordinates: [loc.lon, loc.lat] } } });

  const dim = focus >= 0;
  map.addLayer({ id: 'lines-casing', type: 'line', source: 'lines', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': isDark() ? '#0F1B3D' : '#FFFFFF', 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 4, 16, 10], 'line-opacity': dim ? ['case', ['==', ['get', 'r'], focus], 1, 0.15] : 0.9 } });
  map.addLayer({ id: 'lines', type: 'line', source: 'lines', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ['get', 'color'], 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 2, 16, 6], 'line-opacity': dim ? ['case', ['==', ['get', 'r'], focus], 1, 0.25] : 0.85 } });
  // Il numero di linea sul percorso: l'identità non dipende solo dal colore.
  map.addLayer({ id: 'line-labels', type: 'symbol', source: 'lines', minzoom: 10, layout: { 'symbol-placement': 'line', 'symbol-spacing': 360, 'text-field': ['get', 'label'], 'text-font': ['Noto Sans Bold'], 'text-size': 13, 'text-rotation-alignment': 'viewport', 'text-keep-upright': true }, paint: { 'text-color': '#14213D', 'text-halo-color': '#FBF7EE', 'text-halo-width': 2.5, 'text-opacity': dim ? ['case', ['==', ['get', 'r'], focus], 1, 0] : 1 } });
  map.addLayer({ id: 'stops', type: 'circle', source: 'stops', minzoom: 13.5, paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 13.5, 3, 17, 7], 'circle-color': '#FBF7EE', 'circle-stroke-color': '#1B3A94', 'circle-stroke-width': 2 } });
  // Mezzi fermi (deposito o senza aggiornamenti): grigi, sotto quelli in servizio.
  map.addLayer({ id: 'buses-idle', type: 'circle', source: 'buses', filter: ['==', ['get', 'state'], 'idle'], paint: { 'circle-radius': 6, 'circle-color': '#8A93A6', 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 2, 'circle-opacity': 0.9 } });
  // Mezzi in servizio: punto inchiostro con anello ocra, fuori dalla palette delle linee.
  map.addLayer({ id: 'buses', type: 'circle', source: 'buses', filter: ['==', ['get', 'state'], 'active'], paint: { 'circle-radius': 10, 'circle-color': '#14213D', 'circle-stroke-color': '#F2C14E', 'circle-stroke-width': 4 } });
  if (loc) {
    map.addLayer({ id: 'me-halo', type: 'circle', source: 'me', paint: { 'circle-radius': 18, 'circle-color': '#1B3A94', 'circle-opacity': 0.2 } });
    map.addLayer({ id: 'me', type: 'circle', source: 'me', paint: { 'circle-radius': 8, 'circle-color': '#1B3A94', 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 3 } });
  }

  map.on('click', 'stops', (e) => {
    const f = e.features?.[0];
    if (f) location.hash = `#/stop/${encodeURIComponent(f.properties.id)}`;
  });
  for (const id of ['buses', 'buses-idle']) {
    map.on('click', id, (e) => {
      const f = e.features?.[0];
      if (!f) return;
      const box = document.createElement('div');
      const strong = document.createElement('strong');
      strong.textContent = `${t('busPlate')} ${f.properties.plate || f.properties.id}`;
      const line1 = document.createElement('div');
      line1.textContent = f.properties.state === 'active' ? t('busActive') : t('busIdle');
      const line2 = document.createElement('div');
      line2.textContent = t('busUpdated', f.properties.when);
      box.append(strong, line1, line2);
      new maplibregl.Popup({ offset: 14 }).setLngLat(f.geometry.coordinates).setDOMContent(box).addTo(map);
    });
    map.on('mouseenter', id, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', id, () => { map.getCanvas().style.cursor = ''; });
  }
  map.on('mouseenter', 'stops', () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'stops', () => { map.getCanvas().style.cursor = ''; });

  // Inquadra la linea scelta, oppure tutta la rete.
  const b = new maplibregl.LngLatBounds();
  lineFeatures.filter((f) => !dim || f.properties.r === focus).forEach((f) => f.geometry.coordinates.forEach((c) => b.extend(c)));
  if (!b.isEmpty()) map.fitBounds(b, { padding: { top: 72, right: 32, bottom: 40, left: 32 }, duration: 0, maxZoom: 15 });

  // Mezzi: aggiornamento periodico a scheda visibile, con spostamento animato tra una posizione e la successiva.
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const shown = new Map();
  let raf = 0;
  const feature = (v, state, lon, lat) => ({ type: 'Feature', properties: { id: v.id, plate: v.plate, state, when: formatClock(romeNow(new Date(v.ts * 1000)).secs) }, geometry: { type: 'Point', coordinates: [lon, lat] } });
  function showBuses(list) {
    const from = new Map(shown);
    const t0 = performance.now();
    const D = reduced ? 1 : 1500;
    cancelAnimationFrame(raf);
    const frame = (now) => {
      const k = Math.min(1, (now - t0) / D);
      const e = 1 - (1 - k) ** 3;
      const features = list.map(({ v, state }) => {
        const f = from.get(v.id);
        const lon = f ? f.lon + (v.lon - f.lon) * e : v.lon;
        const lat = f ? f.lat + (v.lat - f.lat) * e : v.lat;
        shown.set(v.id, { lon, lat });
        return feature(v, state, lon, lat);
      });
      map.getSource('buses')?.setData({ type: 'FeatureCollection', features });
      if (k < 1) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  }
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
