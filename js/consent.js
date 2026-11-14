// Consenso alle statistiche (Google Analytics 4), in linea con le Linee guida cookie del Garante (10/06/2021)
// e con l'art. 122 del Codice privacy. Principi:
// - prima del consenso NON si carica nulla da Google e non si imposta nessun cookie;
// - rifiutare è semplice quanto accettare, e l'app funziona identica;
// - la scelta si ricorda 6 mesi, poi la si richiede; si può cambiare in ogni momento da Info.
import * as store from './store.js';

export const GA_ID = 'G-KHR1GHDRQS';
const SIX_MONTHS = 182 * 24 * 3600 * 1000;
let loaded = false;

/** 'granted' | 'denied' | null (nessuna scelta, o scelta scaduta). */
export function getConsent() {
  const c = store.get('consent');
  if (!c || typeof c.ts !== 'number' || Date.now() - c.ts > SIX_MONTHS) return null;
  return c.analytics === true ? 'granted' : c.analytics === false ? 'denied' : null;
}

export function setConsent(granted) {
  store.set('consent', { analytics: !!granted, ts: Date.now() });
  if (granted) loadAnalytics(); else revokeAnalytics();
}

/** Da chiamare all'avvio: carica Analytics solo se l'utente ha già acconsentito. */
export function applyConsent() {
  if (getConsent() === 'granted') loadAnalytics();
}

function loadAnalytics() {
  if (loaded) { window[`ga-disable-${GA_ID}`] = false; return; }
  loaded = true;
  window[`ga-disable-${GA_ID}`] = false;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() { window.dataLayer.push(arguments); };
  // Consent Mode v2: tutto negato tranne la sola misurazione, mai la pubblicità.
  window.gtag('consent', 'default', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
  window.gtag('consent', 'update', { analytics_storage: 'granted' });
  window.gtag('js', new Date());
  window.gtag('config', GA_ID, { anonymize_ip: true, allow_google_signals: false, allow_ad_personalization_signals: false });
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(s);
}

function revokeAnalytics() {
  window[`ga-disable-${GA_ID}`] = true; // ferma subito l'invio di dati, anche se lo script è già in pagina
  window.gtag?.('consent', 'update', { analytics_storage: 'denied' });
  // Cancella i cookie di Analytics (_ga, _ga_<ID>) su host e sul dominio padre.
  const parts = location.hostname.split('.');
  const domains = ['', location.hostname, ...(parts.length > 2 ? [`.${parts.slice(-2).join('.')}`] : [])];
  for (const name of document.cookie.split(';').map((c) => c.split('=')[0].trim()).filter((n) => n === '_ga' || n.startsWith('_ga_') || n === '_gid' || n.startsWith('_gat'))) {
    for (const d of domains) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${d ? `; domain=${d}` : ''}`;
  }
}
