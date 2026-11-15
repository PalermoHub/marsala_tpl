// Percorsi salvati nel browser e hash del pianificatore (con giorno a scelta). Logica pura, senza DOM.
import { get, set } from './store.js';

const MAX_ROUTES = 20;
const same = (a, b) => a.from === b.from && a.to === b.to && a.mode === b.mode;
const norm = (r) => ({ from: r.from, to: r.to, mode: r.mode === 'walk' ? 'walk' : 'bus' });

export function listRoutes() {
  const l = get('routes', []);
  return Array.isArray(l) ? l.filter((r) => r && typeof r.from === 'string' && typeof r.to === 'string').map(norm) : [];
}

/** Aggiunge in testa (senza duplicati, al massimo 20) e ritorna la lista. */
export function saveRoute(r) {
  const n = norm(r);
  const next = [n, ...listRoutes().filter((x) => !same(x, n))].slice(0, MAX_ROUTES);
  set('routes', next);
  return next;
}

export function removeRoute(r) {
  const n = norm(r);
  const next = listRoutes().filter((x) => !same(x, n));
  set('routes', next);
  return next;
}

export const isSaved = (r) => listRoutes().some((x) => same(x, norm(r)));

/** '2026-11-17' -> 20261117; null se vuota, malformata o inesistente. */
export function ymdFromInput(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s ?? '');
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d ? y * 10000 + mo * 100 + d : null;
}

export const ymdToInput = (ymd) => `${Math.floor(ymd / 10000)}-${String(Math.floor((ymd % 10000) / 100)).padStart(2, '0')}-${String(ymd % 100).padStart(2, '0')}`;

/** Gruppi della rotta: 1 da, 2 a, 3 HHMM, 4 YYYYMMDD, 5 'piedi'. */
export function parsePlanHash(m) {
  const hh = m[3] ? Number(m[3].slice(0, 2)) : NaN, mm = m[3] ? Number(m[3].slice(2)) : NaN;
  return {
    from: decodeURIComponent(m[1]),
    to: decodeURIComponent(m[2]),
    time: hh < 24 && mm < 60 ? hh * 3600 + mm * 60 : null,
    ymd: m[4] ? ymdFromInput(`${m[4].slice(0, 4)}-${m[4].slice(4, 6)}-${m[4].slice(6)}`) : null,
    mode: m[5] ? 'walk' : 'bus',
  };
}

export function buildPlanHash({ from, to, time, ymd, mode }) {
  if (!from || !to) return '#/percorso';
  const t = time ?? (ymd ? 0 : null);
  const hhmm = t == null ? '' : `/${String(Math.floor(t / 3600) % 24).padStart(2, '0')}${String(Math.floor((t % 3600) / 60)).padStart(2, '0')}`;
  return `#/percorso/${encodeURIComponent(from)}/${encodeURIComponent(to)}${hhmm}${ymd ? `/${ymd}` : ''}${mode === 'walk' ? '/piedi' : ''}`;
}
