# Marsala TPL

Web app installabile (PWA) per il trasporto pubblico locale di Marsala: quando passa il prossimo bus da una fermata, le linee e i loro percorsi, i bus in servizio sulla mappa. Funziona offline.

> App indipendente. Non è un servizio ufficiale del Comune di Marsala.

## Cosa fa

- **Prossime partenze** da ogni fermata, con minuti mancanti in grande. Le partenze sono sempre etichettate *da orario*: il feed del Comune non dice a quale corsa appartiene un bus, quindi l'app non inventa ritardi.
- **Fermate vicine** con la geolocalizzazione (resta nel browser, non viene inviata), ricerca per nome, fermate preferite, link condivisibile per ogni fermata (`#/stop/<id>`).
- **Linee**: percorso, fermate e orari di ogni corsa. Ogni linea ha una piastrella con colore e motivo propri, così si riconosce anche senza distinguere i colori.
- **Mappa** con i percorsi e i bus in servizio (posizione recente e fuori dal deposito).
- Italiano e inglese, tema chiaro/scuro, calendario in fuso `Europe/Rome`, festivi e servizi speciali (es. 1-2 novembre).

## Dati

| Fonte | Uso |
|---|---|
| [GTFS statico del Comune](https://www.comune.marsala.tp.it/it/page/orari-del-trasporto-pubblico-locale) | orari, fermate, percorsi (CC BY 4.0) |
| GTFS-Realtime `vehicle_positions` | posizione dei bus sulla mappa |

Il feed `trip_updates` oggi è vuoto e `vehicle_positions` non contiene corsa o linea: per questo non ci sono ritardi per singola corsa. La mappa mostra i mezzi in servizio (anello ocra, spostamento animato) e quelli fermi o in deposito (grigi); toccando un mezzo compaiono targa e ora dell'ultimo aggiornamento. Se il Comune li pubblicherà, vanno agganciati in `js/rt.js`.

### Correzione dei festivi

Nei festivi infrasettimanali il feed rimuove il servizio feriale `FER6` ma non `FER5` (che comprende il Supplemento Scuole). `scripts/build-gtfs.mjs` rimuove anche gli altri servizi settimanali nei giorni in cui compare il servizio domenicale, come il Comune fa per l'1-2 novembre. La correzione è elencata in `dati/app.json` (`meta.corrections`) e nella pagina Info; si disattiva con `--no-holiday-fix`. Va segnalata al Comune.

## Sviluppo

Serve solo Node 22 e un server statico qualsiasi.

```bash
# 1. scarica e compila i dati
curl -fsSL -o /tmp/gtfs.zip https://www.comune.marsala.tp.it/s3/3885/allegati/gtfs.zip
mkdir -p /tmp/gtfs && unzip -oq /tmp/gtfs.zip -d /tmp/gtfs
node scripts/build-gtfs.mjs /tmp/gtfs        # scrive dati/app.json e dati/shapes.json

# 2. test (calendari, festivi, orari oltre le 24:00, integrità dei dati)
node --test scripts/test.mjs

# 3. avvia in locale
python3 -m http.server 8080                   # poi apri http://localhost:8080
```

### Struttura

```
index.html, manifest.webmanifest, sw.js   guscio PWA e service worker
css/app.css                               design system (maiolica siciliana)
js/app.js                                 router e viste
js/schedule.js                            logica orari, pura e testata
js/planner.js                             pianificatore da A a B (diretto o un cambio), puro e testato
js/tiles.js                               piastrelle-linea (colore + motivo)
js/rt.js, js/map.js                       feed realtime e mappa (caricata solo quando serve)
dati/                                     generato da scripts/build-gtfs.mjs
scripts/                                  build dei dati e test
```

## Pubblicazione

Due workflow in `.github/workflows/`:

- `deploy.yml`: a ogni push su `main` esegue i test e pubblica su GitHub Pages **solo** i file dell'app (`index.html`, `css`, `js`, `fonts`, `dati`, `img`).
- `update-data.yml`: ogni notte scarica il GTFS, rigenera `dati/`, committa se c'è una novità e rilancia la pubblicazione. Emette un avviso quando il feed scade entro 14 giorni.

Per attivarli: *Settings → Pages → Source: GitHub Actions*. I percorsi sono tutti relativi, quindi l'app funziona anche sotto `/<repo>/`.

## Privacy

Nessun tracciamento né analytics. La posizione viene usata solo nel browser per trovare la fermata più vicina. Le preferenze sono nel `localStorage` del dispositivo.

## Licenza e attribuzioni

Dati: Comune di Marsala, licenza [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.it). Font: Atkinson Hyperlegible (Braille Institute, SIL OFL). Mappa: © OpenStreetMap contributors, tile OpenFreeMap, libreria MapLibre GL JS.
La licenza del codice va decisa dal proprietario del repository.
