// Piastrelle-linea: ogni linea ha un colore di smalto e un motivo geometrico propri.
// Il motivo ripete l'informazione del colore (utile a chi non distingue i colori) e il numero resta
// su una targhetta di smalto bianco, sempre leggibile.

// bg: smalto della linea, fg: tratto del motivo. Esadecimali, perché MapLibre non legge oklch.
export const GLAZES = [
  { bg: '#A3294F', fg: '#FFFFFF', name: 'bordeaux' },
  { bg: '#2E7D6B', fg: '#FFFFFF', name: 'verde rame' },
  { bg: '#3F6FD1', fg: '#FFFFFF', name: 'azzurro' },
  { bg: '#E0A526', fg: '#3A2A00', name: 'ocra' },
  { bg: '#6B46C1', fg: '#FFFFFF', name: 'violetto' },
  { bg: '#2C94A8', fg: '#FFFFFF', name: 'turchese' },
  { bg: '#D9525C', fg: '#FFFFFF', name: 'corallo' },
  { bg: '#6C8A2E', fg: '#FFFFFF', name: 'oliva' },
];

const R = (n) => Array.from({ length: n }, (_, i) => i);

const MOTIFS = [
  // 0 punti
  () => R(6).flatMap((i) => R(6).map((j) => `<circle cx="${4 + i * 8}" cy="${4 + j * 8}" r="1.7" fill="currentColor" fill-opacity=".42" stroke="none"/>`)).join(''),
  // 1 righe oblique
  () => R(9).map((i) => `<path d="M${i * 8 - 16} 48 L${i * 8 + 16} 0" stroke-width="2.2"/>`).join(''),
  // 2 rombi
  () => R(5).flatMap((i) => R(5).map((j) => `<path d="M${i * 12} ${j * 12 - 5} l5 5 l-5 5 l-5 -5z" stroke-width="1.4"/>`)).join(''),
  // 3 chevron
  () => R(6).map((j) => `<path d="M0 ${j * 9 + 2} l12 6 l12 -6 l12 6 l12 -6" stroke-width="2"/>`).join(''),
  // 4 quadrifoglio
  () => R(3).flatMap((i) => R(3).map((j) => { const x = 8 + i * 16, y = 8 + j * 16; return `<circle cx="${x - 3}" cy="${y}" r="4" stroke-width="1.3"/><circle cx="${x + 3}" cy="${y}" r="4" stroke-width="1.3"/><circle cx="${x}" cy="${y - 3}" r="4" stroke-width="1.3"/><circle cx="${x}" cy="${y + 3}" r="4" stroke-width="1.3"/>`; })).join(''),
  // 5 onde
  () => R(6).map((j) => `<path d="M-4 ${j * 9 + 4} q4 -6 8 0 t8 0 t8 0 t8 0 t8 0 t8 0 t8 0" stroke-width="1.8"/>`).join(''),
  // 6 croci
  () => R(5).flatMap((i) => R(5).map((j) => `<path d="M${i * 11 + 3} ${j * 11 + 3} h6 M${i * 11 + 6} ${j * 11} v6" stroke-width="1.8"/>`)).join(''),
  // 7 scacchi
  () => R(6).flatMap((i) => R(6).filter((j) => (i + j) % 2 === 0).map((j) => `<rect x="${i * 8}" y="${j * 8}" width="8" height="8" fill="currentColor" fill-opacity=".38" stroke="none"/>`)).join(''),
  // 8 anelli
  () => R(3).flatMap((i) => R(3).map((j) => `<circle cx="${8 + i * 16}" cy="${8 + j * 16}" r="6" stroke-width="1.6"/><circle cx="${8 + i * 16}" cy="${8 + j * 16}" r="2.4" stroke-width="1.2"/>`)).join(''),
  // 9 stelle a otto punte
  () => R(3).flatMap((i) => R(3).map((j) => { const x = 8 + i * 16, y = 8 + j * 16; return `<rect x="${x - 4.5}" y="${y - 4.5}" width="9" height="9" stroke-width="1.4"/><rect x="${x - 4.5}" y="${y - 4.5}" width="9" height="9" stroke-width="1.4" transform="rotate(45 ${x} ${y})"/>`; })).join(''),
  // 10 triangoli
  () => R(6).flatMap((j) => R(6).map((i) => `<path d="M${i * 9 + (j % 2) * 4.5 - 4} ${j * 9 + 8} l4.5 -7 l4.5 7z" stroke-width="1.4"/>`)).join(''),
  // 11 squame
  () => R(7).flatMap((j) => R(7).map((i) => `<path d="M${i * 10 + (j % 2) * 5 - 5} ${j * 6 + 6} a5 5 0 0 1 10 0" stroke-width="1.5"/>`)).join(''),
];

// Mappa fissa delle linee note: [smalto, motivo]. Le altre ricevono una coppia deterministica.
const KNOWN = {
  '1': [0, 0], '2': [1, 1], '2/5': [1, 2], '3': [2, 3], '4': [3, 4], '5': [3, 5], '5/6': [3, 6],
  '6': [4, 7], '7/10': [5, 8], '8/13': [6, 9], '15': [7, 10], '21': [4, 11], 'DOM': [0, 5],
};

function hash(s) {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** Identità visiva di una linea. Le navette (senza numero) usano la sigla "N". */
export function lineStyle(route) {
  const key = (route.short || '').trim().toUpperCase();
  const [g, m] = KNOWN[key] ?? [hash(route.id) % GLAZES.length, hash(route.id + 'm') % MOTIFS.length];
  return { label: key || 'N', glaze: GLAZES[g], motif: m };
}

/** SVG della piastrella. `size` in px. */
const escXml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Campo di motivo grande e tenue per lo sfondo del campo cobalto: stesso motivo della piastrella della linea. */
export function motifField(route) {
  const { motif } = lineStyle(route);
  return `<svg class="field" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-linecap="round" color="currentColor">${MOTIFS[motif]()}</g></svg>`;
}

export function tileSvg(route, size = 44) {
  const { label: raw, glaze } = lineStyle(route);
  const label = escXml(raw);
  const fs = raw.length <= 2 ? 22 : raw.length <= 4 ? 16 : 11;
  return `<svg class="tile" viewBox="0 0 48 48" width="${size}" height="${size}" role="img" aria-label="Linea ${label}" focusable="false">
<rect width="48" height="48" rx="10" fill="${glaze.bg}"/>
<text x="24" y="${24 + fs * 0.36}" text-anchor="middle" font-size="${fs}" font-weight="700" fill="${glaze.fg}" font-family="Atkinson Hyperlegible, system-ui, sans-serif">${label}</text>
</svg>`;
}
