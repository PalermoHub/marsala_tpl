// Voli di Trapani-Birgi in tempo reale (fonte: Airgest). Li rilancia il Worker di Palermo Digital Twin, che aggiunge il CORS e fa da cache (60 s).
export const VOLI_URL = 'https://api.palermodigitaltwin.link/aeroporto-trapani';
export const VOLI_SOURCE = 'https://www.airgest.it/voli-del-giorno';

export async function loadVoli(signal) {
  const res = await fetch(VOLI_URL, { signal, cache: 'no-store' });
  if (!res.ok) throw new Error('voli');
  const d = await res.json();
  if (!Array.isArray(d.arrivi) || !Array.isArray(d.partenze)) throw new Error('voli');
  return d;
}
