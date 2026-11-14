# Marsala TPL — Piano di progetto

PWA statica, ospitata su GitHub Pages, per chi usa il trasporto pubblico locale di Marsala.
Data: 2026-11-14. Stato: piano approvato dall'utente ("parti con le tue scelte"). Le scelte tecniche sono mie e correggibili.

## 1. Scopo

Rispondere in meno di 3 secondi a "quando passa il prossimo bus da qui?", anche offline e anche con un telefono lento.

Utenti, in ordine di priorità:
1. Chi è alla fermata o sta per uscire di casa: prossime partenze, bus in arrivo.
2. Chi pianifica: orari di una linea, percorso, fermate.
3. Studenti e turisti: interfaccia chiara, italiano e inglese.

### Obiettivi
- Orari consultabili offline (service worker + dati pre-compilati).
- Fermata come unità base: ogni fermata ha un URL stabile e un QR stampabile.
- Posizione dei bus in tempo reale sulla mappa, quando il feed è sano.
- Aggiornamento automatico dei dati da GTFS ufficiale, senza intervento manuale.
- Aspetto moderno, veloce, accessibile (WCAG AA), installabile come app.

### Non-obiettivi (v1)
- Pianificatore di percorso A→B con cambi (candidato v2, algoritmo RAPTOR su dati pre-compilati).
- Account, notifiche push, biglietteria, tariffe (non ci sono dati ufficiali).
- Backend proprio. Eccezione ammessa: un proxy minimo per il RT se manca CORS.

### Anti-obiettivi
- Mostrare un ritardo o un "in arrivo" inventato. Meglio "da orario" che un dato falso.
- Tracking, cookie, analytics invasivi. La geolocalizzazione resta nel browser.

## 2. Dati di partenza (verificati 2026-11-14)

| Fonte | URL | Note |
|---|---|---|
| Pagina Comune | https://www.comune.marsala.tp.it/it/page/orari-del-trasporto-pubblico-locale | licenza CC BY 4.0, attribuzione obbligatoria |
| GTFS statico | https://www.comune.marsala.tp.it/s3/3885/allegati/gtfs.zip | 592 fermate, 334 corse, ~8 linee, shapes; feed `MARSALA-2026-EST+INV-r4+NOV12` valido 2026-06-15 → 2027-06-13 |
| GTFS-RT posizioni | https://7ydpklv7b2.execute-api.eu-north-1.amazonaws.com/prod/gtfs_realtime_marsala/vehicle_positions | HTTP 200, senza chiave |
| GTFS-RT ritardi | https://7ydpklv7b2.execute-api.eu-north-1.amazonaws.com/prod/gtfs_realtime_marsala/trip_updates | idem |
| PDF orari | .../s3/3885/allegati/orari-invernali-2026-2027-dal-14-settembre-del-2026.pdf | non necessario, il GTFS lo sostituisce |

Calendari: `EST_FER`, `EST_DOM` (estate, fino al 13/09/2026); `FER6_INV_2627`, `FER5_INV_2627`, `DOM_INV_2627` (inverno dal 14/09/2026) più `calendar_dates` per le eccezioni. Gestore in `agency.txt`: "Marsala" (Comune).

### Problemi noti
- **ID RT ≠ ID statici.** Il RT usa `trip_id` come `58349` e `route_id` `1973`. Il GTFS statico usa `1925_F_0_1` e `1925`. I ritardi per singola corsa non sono incrociabili finché il Comune non li allinea.
- **CORS non verificato** sull'API AWS. Se manca, un sito statico non può leggere il RT dal browser.
- **Bus fantasma**: posizioni ferme o vecchie nel feed RT.

## 3. Architettura

```
GTFS zip ──► scripts/build-gtfs.mjs ──► dati/*.json ──► PWA (GitHub Pages)
   ▲            (GitHub Action notturna)                    │
   └─ controllo scadenza/validità                           ├─ service worker (cache offline)
                                                            └─ RT: fetch diretto o proxy ──► vehicle_positions
```

### Stack
- **Frontend**: HTML + JavaScript ES modules, senza framework. Router a hash (compatibile con GitHub Pages). Poche dipendenze, caricamento veloce.
- **Mappa**: MapLibre GL JS con tile OpenStreetMap/OpenFreeMap. Percorsi da `shapes.txt` semplificati.
- **Decodifica RT**: protobuf GTFS-RT con decoder leggero (`gtfs-realtime-bindings` o decoder minimo in-house).
- **Dati**: script Node che compila il GTFS in JSON pre-indicizzati:
  - `dati/meta.json` (versione feed, validità, attribuzione)
  - `dati/routes.json`
  - `dati/stops.json` (con indice geografico a griglia per "vicino a me")
  - `dati/stop-times/<stop_id>.json` (partenze per servizio, caricate a richiesta)
  - `dati/shapes/<route_id>.geojson`
- **Hosting**: GitHub Pages dal branch `main` (cartella radice o `/docs` da decidere con la struttura finale).
- **PWA**: manifest, icone già presenti in `img/`, service worker con cache dei dati e stale-while-revalidate sul resto.

### Logica degli orari
- Servizio attivo oggi = `calendar` ∩ `calendar_dates` (aggiunte/rimozioni), fuso `Europe/Rome`.
- Gestire orari oltre le 24:00 (`25:10:00`) come proseguimento del giorno di servizio precedente.
- Partenze mostrate: prossime N dalla fermata, raggruppate per linea e direzione.

### Logica RT
1. All'avvio, test del feed: raggiungibile, CORS ok, `header.timestamp` fresco (< 2 min).
2. Posizioni sulla mappa solo se fresche. Filtro bus fantasma: scarto veicoli con timestamp vecchio o fermi da molto fuori da capolinea.
3. Abbinamento veicolo→corsa tramite euristica (linea + vicinanza alla shape + orario), mai tramite `trip_id` finché gli ID non coincidono. Il risultato è marcato "stimato".
4. Se il RT non è utilizzabile: l'app mostra solo gli orari teorici con etichetta "da orario", senza errori visibili.
5. Se manca CORS: proxy su Cloudflare Worker (poche righe, cache 15 s).

## 4. Schermate (v1)

1. **Home / Vicino a me**: fermate vicine (geolocalizzazione opzionale), prossime partenze, bus in arrivo, ricerca fermata.
2. **Fermata**: prossime partenze per linea, mappa piccola, preferito, QR/condividi.
3. **Linee**: elenco con colore; dettaglio linea con percorso, fermate e orari per giorno.
4. **Mappa live**: percorsi, fermate, bus in tempo reale.
5. **Info**: validità orari, fonte e licenza CC BY 4.0, contatto del Comune, segnala un errore, lingua.

Preferiti salvati in `localStorage` (con try/catch, l'app funziona anche senza).

## 5. Qualità e rifinitura

- Design: direzione visiva definita con la skill `impeccable` (DESIGN.md), poi applicata. Mobile-first, modalità chiara/scura, tipografia leggibile all'aperto.
- Accessibilità: contrasto AA, focus visibili, etichette per screen reader, tocco ≥ 44 px, `prefers-reduced-motion`.
- Prestazioni: obiettivo Lighthouse ≥ 90 su tutte le categorie, primo caricamento sotto 150 KB di JS.
- Test: script di build con controlli sui dati (fermate orfane, corse senza orari, feed scaduto); test unitari sulla logica calendario/orari oltre 24:00.
- i18n: italiano (default) e inglese, dizionario JSON.
- Segnalazione errori: link precompilato verso il contatto in `feed_info`.

## 6. Automazione

- **GitHub Action notturna**: scarica `gtfs.zip`, confronta `feed_version`, rigenera `dati/`, apre commit/PR se cambia. Fallisce con avviso se il feed scade entro 14 giorni.
- **Action di deploy** su Pages.
- Dopo ogni modifica al codice: `graphify update .` (regola del progetto).

## 7. Fasi

| Fase | Contenuto | Esito verificabile |
|---|---|---|
| 0 | Piano (questo file), direzione di design con `impeccable` → `DESIGN.md` | file salvati |
| 1 | Pipeline dati: build GTFS → JSON, test dati | `dati/` generato, test verdi |
| 2 | Shell PWA: router, tema, Home, Fermata, Linee (solo orari teorici) | funziona offline |
| 3 | Mappa con percorsi e fermate | percorso di ogni linea visibile |
| 4 | RT: verifica CORS, posizioni live, filtro fantasmi, stato "da orario" | bus in movimento sulla mappa |
| 5 | Preferiti, QR fermate, i18n, pagina Info | QR stampabili |
| 6 | Action notturna, deploy Pages, audit Lighthouse/accessibilità | URL pubblico |
| 7 (opz.) | Pianificatore A→B | v2 |

## 8. Rischi

| Rischio | Mitigazione |
|---|---|
| ID RT non allineati | abbinamento euristico marcato "stimato"; segnalare al Comune con esempi |
| Nessun CORS sul RT | proxy Cloudflare Worker |
| Feed statico scaduto o cambiato | Action con controllo di validità, avviso in app |
| Mappa pesante su telefoni lenti | caricamento differito, shapes semplificate, tile leggeri |
| Dati con orari >24:00 o servizi sovrapposti | test unitari dedicati |

## 9. Da decidere più avanti
- Nome dell'app e dominio (default: `<utente>.github.io/marsala_tpl`).
- Tile provider definitivo (OpenFreeMap vs OSM raster) in base ai limiti d'uso.
- Se contattare il Comune per allineare gli ID RT e fornire contatto tecnico.
