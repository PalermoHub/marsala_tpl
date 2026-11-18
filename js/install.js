// Invito a installare l'app (PWA). Android/Chrome/Edge: usa l'evento `beforeinstallprompt` e il pulsante
// «Installa» apre la finestra di sistema. iPhone/iPad (Safari non ha l'evento): spiega «Condividi → Aggiungi a Home».
// Non compare se l'app è già installata; «Non ora» lo nasconde per 14 giorni, l'installazione per sempre.
import * as store from './store.js';
import { t } from './i18n.js';

const DELAY = 6000;
const SNOOZE = 14 * 24 * 3600 * 1000;
let deferred = null;
let timer = null;

const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const snoozed = () => { const ts = store.get('installAsk'); return ts === 'done' || (typeof ts === 'number' && Date.now() - ts < SNOOZE); };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function hide() {
  clearTimeout(timer);
  document.getElementById('install')?.remove();
}

function show() {
  if (document.getElementById('install') || standalone() || snoozed()) return;
  const ios = !deferred && isIos();
  if (!deferred && !ios) return;
  const el = document.createElement('section');
  el.id = 'install';
  el.className = 'install';
  el.setAttribute('aria-labelledby', 'install-t');
  el.innerHTML = `<h2 id="install-t" class="sr">${esc(t('installTitle'))}</h2><p>${esc(t(ios ? 'installIos' : 'installText'))}</p>
<div class="install-btns">${ios ? '' : `<button class="btn install-yes" data-act="yes">${esc(t('installYes'))}</button>`}<button class="btn install-no" data-act="no">${esc(t(ios ? 'installOk' : 'installLater'))}</button></div>`;
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'yes' && deferred) {
      const ev = deferred;
      deferred = null;
      hide();
      try { await ev.prompt(); const r = await ev.userChoice; store.set('installAsk', r.outcome === 'accepted' ? 'done' : Date.now()); } catch { store.set('installAsk', Date.now()); }
    } else { store.set('installAsk', Date.now()); hide(); }
  });
  document.body.appendChild(el);
}

function schedule() {
  clearTimeout(timer);
  if (standalone() || snoozed()) return;
  timer = setTimeout(show, DELAY);
}

/** Da chiamare all'avvio. */
export function initInstall() {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; schedule(); });
  window.addEventListener('appinstalled', () => { deferred = null; store.set('installAsk', 'done'); hide(); });
  if (isIos()) schedule();
}

/** Aggiorna la lingua del popup già aperto. */
export function rerenderInstall() {
  if (!document.getElementById('install')) return;
  hide();
  show();
}
