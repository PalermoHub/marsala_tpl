// Service worker: orari sempre disponibili offline.
// - Codice (html/js/css): prima la rete (con timeout), poi la cache: online si ha sempre una versione coerente.
// - Dati, font, icone: dalla cache, aggiornati in background.
// - MapLibre dalla CDN: cache al primo uso. Feed RT e tile della mappa non vengono mai messi in cache da qui.
const VERSION = 'v109';
const CACHE = `marsala-tpl-${VERSION}`;
const PRECACHE = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/schedule.js', 'js/planner.js', 'js/tiles.js', 'js/i18n.js', 'js/store.js', 'js/rt.js', 'js/map.js', 'js/match.js', 'js/consent.js', 'js/walk.js', 'js/indirizzi.js', 'js/route.js',
  'dati/app.json', 'dati/shapes.json', 'dati/avvisi.json', 'dati/indirizzi.json',
  'fonts/atkinson-hyperlegible-400.woff2', 'fonts/atkinson-hyperlegible-700.woff2',
  'img/opendatasicilia.png', ...['home', 'cerca', 'fermata', 'linee-fermata', 'percorso-da', 'percorso-risultati', 'percorso-condividi', 'percorso-piedi', 'percorso-mappa-bus', 'percorso-mappa-piedi', 'linee', 'mappa', 'mappa-3d'].map((n) => `img/guida/${n}.webp`), 'img/icon-192.png', 'img/icon-512.png', 'img/favicon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('marsala-tpl-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const isCode = (url) => /\.(?:js|css|html|webmanifest)$/.test(url.pathname) || url.pathname.endsWith('/');

// Le chiavi di cache non devono contenere il frammento (#/stop/...): sono la stessa pagina.
const keyOf = (req) => { const u = new URL(req.url); u.hash = ''; return new Request(u.href); };

async function networkFirst(req, ms) {
  const cache = await caches.open(CACHE);
  try {
    const res = await Promise.race([fetch(req, { cache: 'no-cache' }), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
    if (res.ok) cache.put(keyOf(req), res.clone());
    return res;
  } catch {
    return (await cache.match(keyOf(req), { ignoreSearch: true })) ?? (await cache.match('index.html')) ?? (await cache.match('./')) ?? Response.error();
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  const fresh = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
  return hit ?? (await fresh) ?? Response.error();
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    e.respondWith(isCode(url) || url.pathname.endsWith('/avvisi.json') || req.mode === 'navigate' ? networkFirst(req, 3000) : staleWhileRevalidate(req));
  } else if (url.hostname === 'cdn.jsdelivr.net') {
    e.respondWith(cacheFirst(req));
  }
});
