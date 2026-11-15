// Partenze e arrivi per luogo, calcolati dalle corse del Comune (js/orari-luoghi.js).
// Logica pura (niente DOM) così si può provare con scripts/test.mjs.
import { ORARI } from './orari-luoghi.js';

const NOMI_GIORNI = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'];

export const LUOGHI = ORARI.luoghi;
export const luogoById = (id) => LUOGHI.find((l) => l.id === id);
export const nomeLuogo = (id) => { const l = luogoById(id); return l ? l.breve || l.nome : id; };

function inPeriodo(mmdd, [da, a]) { return da <= a ? mmdd >= da && mmdd <= a : mmdd >= da || mmdd <= a; }

/** Regole dei giorni come sulla pagina del Comune. dow: lunedì = 0. */
function regolaGiorni(cod, dow, festivo) {
  const dom = dow === 6;
  if (cod === 'T') return true;
  if (cod === 'LS') return !dom && !festivo;
  if (cod === 'LV') return dow < 5 && !festivo;
  if (cod === 'H' || cod === 'DF') return dom || festivo;
  if (cod === 'D') return dom;
  return !festivo && cod.split(',').includes(NOMI_GIORNI[dow]);
}

/** La corsa c circola nel giorno ymd (AAAAMMGG) con giorno della settimana dow? */
export function corsaAttiva(c, ymd, dow) {
  const sv = ORARI.servizi[c.s];
  if (sv?.fino && String(ymd) > sv.fino.replace(/-/g, '')) return false;
  const s = String(ymd), mmdd = `${s.slice(4, 6)}-${s.slice(6, 8)}`;
  if (c.periodo && !inPeriodo(mmdd, c.periodo)) return false;
  let cod = c.g;
  for (const x of c.eccezioni || []) if (inPeriodo(mmdd, [x.dal, x.al])) cod = x.g;
  const festivo = ORARI.festivi.includes(`${s.slice(0, 4)}-${mmdd}`);
  return regolaGiorni(cod, dow, festivo);
}

/**
 * Corse che toccano il luogo id in quel giorno, ordinate per ora.
 * verso 'partenze': la corsa prosegue dopo il luogo (cap = ultima fermata);
 * verso 'arrivi': la corsa viene da un'altra fermata (cap = prima fermata).
 */
export function righeLuogo(id, verso, ymd, dow, servizi = null) {
  const out = [];
  for (const c of ORARI.corse) {
    const i = c.f.findIndex(([p, ora]) => p === id && ora);
    if (i < 0 || (servizi && !servizi.includes(c.s)) || !corsaAttiva(c, ymd, dow)) continue;
    const altro = verso === 'partenze' ? c.f[c.f.length - 1] : c.f[0];
    if (verso === 'partenze' ? i === c.f.length - 1 : i === 0) continue;
    const ora = c.f[i][1];
    out.push({ ora, secs: Number(ora.slice(0, 2)) * 3600 + Number(ora.slice(3)) * 60, s: c.s, n: c.n || '', cap: nomeLuogo(altro[0]), nota: c.nota || '' });
  }
  return out.sort((a, b) => a.secs - b.secs);
}
