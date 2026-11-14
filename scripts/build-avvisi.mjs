// Scarica il feed RSS delle news del Comune di Marsala e lo salva in dati/avvisi.json.
// Il feed pubblica solo le ultime 5 notizie e non ha CORS: lo si legge qui (GitHub Actions)
// e lo si accumula nello storico, così l'app mostra più di 5 voci e funziona offline.
// Uso: node scripts/build-avvisi.mjs [file-rss-locale]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const FEED_URL = 'https://www.comune.marsala.tp.it/it/news/feed';
const OUT = new URL('../dati/avvisi.json', import.meta.url);
const KEEP = 40;

// Parole che indicano una notizia sul trasporto pubblico o sulla circolazione.
const TRANSPORT = /\b(autobus|bus|trasporto pubblico|tpl|ast|fermat[ae]|navett[ae]|corse?|deviazion[ei]|mobilit[àa]|viabilit[àa]|circolazione|autostazione|capolinea)\b/i;

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decode = (s) => s
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
const text = (s) => decode(s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const tag = (xml, name) => xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`))?.[1] ?? '';
const httpsOnly = (u) => (/^https:\/\//i.test(u) ? u : '');

export function parseRss(xml) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, it]) => {
    const title = text(tag(it, 'title'));
    const raw = text(tag(it, 'description'));
    const summary = (raw.startsWith(title) ? raw.slice(title.length).replace(/^[\s.:–-]+/, '') : raw).slice(0, 280);
    const date = text(tag(it, 'dc:date')) || new Date(text(tag(it, 'pubDate'))).toISOString();
    return {
      title,
      link: httpsOnly(text(tag(it, 'link'))),
      date,
      summary,
      img: httpsOnly(it.match(/<enclosure[^>]*\surl="([^"]+)"/)?.[1] ?? ''),
      transport: TRANSPORT.test(`${title} ${summary}`),
    };
  }).filter((i) => i.title && i.link);
}

export function merge(old, fresh) {
  const byLink = new Map(old.map((i) => [i.link, i]));
  for (const i of fresh) byLink.set(i.link, i); // la versione nuova vince (titoli corretti, ecc.)
  return [...byLink.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, KEEP);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const xml = process.argv[2]
    ? readFileSync(process.argv[2], 'utf8')
    : await fetch(FEED_URL, { headers: { 'user-agent': 'marsala-tpl (+https://github.com/PalermoHub/marsala_tpl)' } })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); });
  const fresh = parseRss(xml);
  if (!fresh.length) throw new Error('Feed senza voci: non sovrascrivo lo storico');
  const old = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')).items ?? [] : [];
  const items = merge(old, fresh);
  // `updated` cambia solo se cambiano le voci, così il commit parte solo con novità vere.
  const prev = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : null;
  const same = prev && JSON.stringify(prev.items) === JSON.stringify(items);
  if (!same) writeFileSync(OUT, JSON.stringify({ updated: new Date().toISOString(), items }, null, 1) + '\n');
  console.log(same ? 'Nessuna novità.' : `Salvate ${items.length} voci (${fresh.length} dal feed).`);
}
