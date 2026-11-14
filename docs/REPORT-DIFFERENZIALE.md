# Test differenziale di `js/schedule.js` (2026-11-14, locale, non pubblicato)

## Metodo
- Riferimento indipendente: `gtfs-kit` 14.2.0 (calendario: `compute_trip_activity`, con `calendar_dates`) + pandas. Non usa `schedule.js` né `build-gtfs.mjs`. OpenTripPlanner non usato: manca Java.
- App: `build-gtfs.mjs` + `nextDepartures()` veri, non modificati, sullo stesso GTFS grezzo (`MARSALA-2026-EST+INV-r4+NOV12`).
- Regola di prodotto applicata al riferimento: al capolinea d'arrivo non si sale. A parità di orario l'ordine è libero.
- Due feed: reale (nessun orario oltre 24:00) e **sintetico** (47 corse serali +6h, fino a 28:23, una a 24:00:00 esatte). Il feed reale non esercita il ramo "ieri".
- 6.000 query (fermata, data-ora) per feed = 12.000, seme fisso. Date su tutto l'anno e fuori validità, 40% da date speciali (festivi, 1-2 nov, cambi ora, estremi). Orari: uniformi, notte 22-04, ±1 s da partenze vere, spillover da ieri.
- Ogni query confronta le prime 6 partenze e la prima di domani. Script: `docs/fase1/diff/`.

## Risultati
| Esecuzione | Query | Coincidenti | Diverse |
|---|---|---|---|
| App con correzione festivi, feed reale | 6.000 | 5.639 | 361 |
| App con correzione festivi, feed sintetico | 6.000 | 5.665 | 335 |
| App **senza** correzione (`--no-holiday-fix`), reale | 6.000 | 6.000 | 0 |
| App **senza** correzione, sintetico | 6.000 | 6.000 | 0 |

- **Bug dell'app: 0 trovati.** Con calendario identico l'app coincide col riferimento in 12.000 query su 12.000, post-mezzanotte compresa (171 query con partenze da servizio di ieri nel sintetico).
- **Tutte le 696 differenze** cadono sui 6 festivi FER5 (8 dic, 25 dic, 1 gen, 6 gen, 29 mar, 2 giu) o sul giorno prima (la "prima partenza di domani"). Nessuna altrove. Sono il **difetto del feed** (FER5 attivo insieme a DOM): il riferimento segue il feed grezzo, l'app lo corregge di proposito. Non è un errore dell'app, ma la correzione resta una decisione nostra finché il Comune non conferma.
- `romeNow`: 3.002 istanti (inclusi ±4 h dai cambi ora del 25 ott 2026 e 28 mar 2027) contro `zoneinfo`: 0 discrepanze.

## Sensibilità del test (mutazioni su una copia di `schedule.js`)
Rilevati: niente ramo "ieri", `>=`→`>` sull'orario, `end` esclusivo, niente "domani", capolinea incluso, `>=86400`→`>86400` (solo dopo aver aggiunto la corsa a 24:00:00 esatte; prima sopravviveva).
Non rilevati, e innocui sui dati: dow spostato solo l'11 nov 2026 (FER6 attivo comunque) e ordine add/rem sulla stessa data (nel feed non esiste).

## Limiti
- Il riferimento condivide con l'app la lettura del GTFS grezzo; non verifica che il GTFS rispecchi la realtà (serve il campo).
- Il feed sintetico prova la logica, non esiste nella realtà. Il feed reale non ha orari >24:00.
- Non testato: lo scarto GTFS "mezzogiorno meno 12 h" nei giorni di cambio ora (l'app usa l'ora a muro, come quasi tutti i consumer). Nel feed reale l'ultima corsa parte alle 22:23, quindi l'effetto non si presenta.
- `nearestStops` e `walk.js` non coperti (altra verifica).
