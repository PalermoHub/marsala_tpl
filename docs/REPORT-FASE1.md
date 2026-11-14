# Report Fase 1 (parziale): audit del GTFS e fermate vicine

Data: 2026-11-14. Feed analizzato: `MARSALA-2026-EST+INV-r4+NOV12`, scaricato dal Comune il 2026-11-14 (334 corse, 592 fermate, 15 linee).
Il punto 2 della Fase 1 (storico RT, map-matching) non è ancora fatto: servono i dati di una settimana, vedi `docs/PIANO-PROFONDITA.md`.

Script e output grezzi: `docs/fase1/` (`audit*.py`, `walk.py` con `FASE1_DIR`, `*-out.txt`, `gtfs-validator-report.json`).

## Sintesi

| # | Esito | Cosa dimostra | Cosa NON dimostra |
|---|---|---|---|
| 1 | Difetto FER5 confermato | 6 festivi con servizio feriale e domenicale insieme; l'app li corregge già, stesse 6 date | Che il Comune lo consideri un errore: serve la sua conferma |
| 2 | Gli orari invernali sono al minuto, senza interpolazione | 20-40% delle fermate ha lo stesso orario della precedente; 66 segmenti implicano >80 km/h | Di quanto sbaglia l'orario reale a una fermata intermedia (serve il registro RT) |
| 3 | Gli orari estivi sono calcolati a 24 km/h | 130 corse su 130 con velocità media 24,0 km/h | Che gli orari estivi 2027 saranno così (il feed scade il 2027-06-13) |
| 4 | "Fermate vicine" in linea d'aria è ottimistico | Su 600 punti campione, 25,8% delle coppie supera gli 800 m a piedi | Il dato su popolazione reale: il campione non è pesato sui residenti |
| 5 | OSM non può verificare le fermate | 48 fermate OSM contro 592 | Nulla sulla qualità delle posizioni GTFS |

## 1. Difetto FER5 nei festivi: confermato

Nel `calendar_dates.txt` i festivi infrasettimanali aggiungono `DOM_INV_2627` e tolgono `FER6_INV_2627`, ma lasciano `FER5_INV_2627`.
Risultato nel feed grezzo: 8 dicembre 2026, 25 dicembre 2026, 1 gennaio, 6 gennaio, 29 marzo (Lunedì dell'Angelo) e 2 giugno 2027 hanno orario domenicale più 24 corse feriali.
Le 24 corse FER5 sono: linea 21 (6), 7/10 (5), 8/13 (5), 3 (3), 4 (3), 1 (2). Non è solo il Supplemento Scuole, come scrivevo in memoria: è un blocco di corse che girano solo dal lunedì al venerdì.
`build-gtfs.mjs` rimuove FER5 in queste 6 date. La mia analisi usa codice diverso (Python sul feed grezzo) e trova le stesse 6 date, quindi la correzione dell'app è coerente.
Limite: è la lettura più probabile (a scuole chiuse, corse scolastiche e feriali non hanno senso), ma l'intento del Comune non è dimostrato.
Fuori dall'orizzonte attuale: 15 agosto 2026 (sabato) e 29 giugno 2026 non hanno eccezioni nel calendario estivo. Sono già passati.

## 2. Orari invernali: precisione al minuto, fermate con lo stesso orario

Le corse in vigore (`FER5`, `FER6`, `DOM`, `NOV12`) hanno orari con secondi a zero: tra il 73% e il 100% degli orari è al minuto esatto, secondo il formato dell'identificativo (`INV…A` 78%, `INV…R` 73%, le altre 100%).
Il 20-40% delle fermate ha lo stesso orario della fermata precedente (524 su 2091 nelle corse `INV…A`, 416 su 1924 nelle `INV…R`).
Effetto sulle velocità: 267 segmenti tra fermate consecutive superano i 60 km/h e 66 gli 80 km/h (massimo 124,8 km/h in linea d'aria). Sono artefatti di arrotondamento, non corse reali così veloci: la velocità media di ogni corsa è tra 10 e 48 km/h, plausibile per un autobus urbano.
Conseguenza per l'app: a una fermata intermedia l'orario "da orario" è arrotondato al minuto, e dove il feed ripete lo stesso minuto su più fermate consecutive non può essere esatto per tutte. L'entità dell'errore non è misurata. L'app non lo diceva: ora lo segna con ≈ (Fase 2).
Non verificato: l'errore reale. Si misura confrontando questi orari con i passaggi ricostruiti dal registro RT.

## 3. Orari estivi: costruiti a 24 km/h

Tutte le 130 corse `EST_*` hanno velocità media 24,0 km/h (±0,15), calcolata su `shape_dist_traveled` / durata. Tra le 204 corse restanti, solo 2 cadono in quell'intervallo. La velocità tra fermate consecutive ha mediana 23,99 km/h (p1-p99: 22,9-24,9, la dispersione viene dall'arrotondamento al secondo).
Le fermate intermedie sono quindi stime proporzionali alla distanza, non orari pubblicati. Il feed in vigore non le usa (`EST_*` è scaduto il 2026-09-13), ma riguarderà l'estate 2027 se il Comune ripete il metodo.
Anche qui: è la lettura più semplice dei dati, non una conferma del Comune.

## 4. Fermate vicine: linea d'aria contro rete pedonale

Metodo: grafo pedonale da OpenStreetMap (4.018 vie, 29.210 nodi, 96% nella componente principale), 600 punti scelti a caso tra i nodi con almeno una fermata entro 800 m in linea d'aria (seme 42), percorso minimo con Dijkstra. Le 592 fermate GTFS sono agganciate al nodo più vicino (mediana 15 m, 12 oltre 100 m).
Confronto con il codice dell'app: `walkable()` (planner.js: ≤800 m, 4 più vicine, 1,2 m/s) e `nearestStops()` (schedule.js: 6 più vicine).

- Distanza a piedi / in linea d'aria: mediana 1,39; 90° percentile 2,57.
- 25,8% delle coppie "raggiungibili entro 800 m" supera gli 800 m a piedi. 0,5% non è raggiungibile sulla rete OSM (può essere un buco di OSM).
- Tempo di cammino sottostimato: mediana 1,8 minuti, 90° percentile 8, massimo 27,8.
- La fermata più vicina in linea d'aria è anche la più vicina a piedi nel 65,5% dei casi. Sovrapposizione media delle 6 fermate: 79%.
- Nel 39,8% dei punti la fermata più vicina in linea d'aria è almeno 1,5 volte più lontana a piedi.

Limiti: il campione è di nodi del grafo, non di residenti, e comprende anche strade di campagna (424 `track`). Il valore è indicativo; per un dato difendibile servono le sezioni censuarie ISTAT. Una parte dei casi "non raggiungibili" può dipendere da lacune di OSM, non dalla città.
Il bug trovato lungo il percorso: una media su colonne `object` (pandas 3.0) dava 0% per "oltre 800 m" mentre i dati mostravano 582 coppie su 2.257. L'ho individuato perché il massimo (27,8 minuti in più) era incompatibile con quello 0%.

## 5. OSM come verificatore delle fermate: non utilizzabile

OSM ha 48 nodi di fermata (47 `highway=bus_stop`, 1 `stop_position`) contro 592 nel GTFS, e 3 relazioni bus che sono tutte la linea extraurbana Marsala-Mazara-Palermo. Nessuna linea urbana. Il confronto tra posizioni GTFS e OSM non si può fare in modo significativo.
Opportunità, non risultato: le fermate GTFS possono essere un contributo a OSM, ma non senza verificare sul campo.

## Validatore ufficiale (MobilityData gtfs-validator 8.0.1)

Zero errori. 6 avvisi: 10 fermate senza orari, 1 shape inutilizzata (coincidono con il mio audit), 2 calendari scaduti (l'estate), 1 spazi iniziali/finali, 1 campo con maiuscole e minuscole, più 1 informazione sull'headsign.
Il validatore NON ha segnalato né il difetto FER5 né gli orari a 24 km/h né le fermate con lo stesso minuto: passare il validatore non basta, e il test differenziale resta necessario.

## Altri fatti rilevati

- Nessun giorno senza servizio tra 2026-06-15 e 2027-06-13.
- Nessun orario oltre le 24:00 (massimo 22:23:21); nessun orario negativo; nessuna corsa duplicata.
- Le fermate cadono tutte entro 29 m dalle loro shape (mediana e p95: 0 m): le shapes sono state costruite passando dalle fermate, quindi il confronto non verifica il percorso reale sulla strada.
- 10 fermate mai usate (Contrada Conca, Contrada Dara, Contrada Bufalata, Contrada Bosco); 8 fermate con coordinate identiche a un'altra (coppie dei due sensi di marcia); 1 `stop_code` duplicato (`094`, Via Virgilio); 11 nomi con doppi spazi.
- `route_color` vuoto in tutte e 15 le linee; due linee (navette 1-2 novembre) senza `route_short_name`.
- `NOV12_2026` esiste solo in `calendar_dates.txt` (ammesso dalla specifica).

## Cosa resta non verificato

- Il vero errore degli orari intermedi, e la puntualità reale: dipendono dal registro RT (settimana di raccolta, poi map-matching).
- ~~Test differenziale di `js/schedule.js`~~ **Eseguito** (2026-11-14, `gtfs-kit`, 12.000 query): 0 bug dell'app, tutte le differenze sui 6 festivi FER5 (difetto del feed). Vedi `docs/REPORT-DIFFERENZIALE.md`. Non coperti: `nearestStops`, `walk.js`; OpenTripPlanner non usato (manca Java).
- Il campo: nessuna fermata, palina o corsa è stata verificata fisicamente.
- Il registratore RT ha girato solo nel job di prova; il cron da 30 minuti non è ancora stato osservato in esecuzione.

## Da chiedere al Comune

1. I 6 festivi con FER5 e DOM attivi insieme sono un errore del feed?
2. Gli orari delle fermate intermedie sono pubblicati o calcolati (estate a 24 km/h; inverno a minuto intero con minuti ripetuti)?
3. Aggiungere `trip_id` e `route_id` al `vehicle_positions` e popolare `trip_updates`.
4. `route_color` e `route_short_name` per le navette.

## Proposta per la Fase 2 (da approvare)

In ordine di valore, solo se approvate:

1. **Distanze a piedi realistiche** in `walkable()` e `nearestStops()`: pre-calcolare una griglia di accessibilità con la rete OSM, oppure applicare un fattore conservativo (mediana 1,39) e dichiararlo. Costo: nuovo file di dati e script di build.
2. **Indicare la precisione dell'orario alle fermate intermedie** ("circa", ±1 min) e segnare come "stimato" i casi con stesso minuto della fermata precedente. Costo: bassa.
3. ~~Avviso di scadenza dei dati~~ **Errore del report:** esiste già nell'app (`feedStatus` in `js/schedule.js`, banner "soon" a 14 giorni e "expired", con test). Non serve fare nulla.
4. Il resto (puntualità, affidabilità per fascia oraria) solo dopo il registro RT.

## Fase 2: stato (2026-11-14, non ancora pubblicata)

Approvate dall'utente le tre proposte; la terza era già nell'app. Fatte in locale le prime due.

### 1. Distanza a piedi sulla rete
`js/walk.js` (2,5 KB compressi), `dati/walk.json` (374 KB, 130 KB compressi, caricato al primo uso della posizione e poi tenuto in cache dal service worker; non è nel precache), `scripts/build-walk.mjs` per rigenerarlo. Usata da "Vicino a te" e dal percorso da posizione. Senza rete (prima visita offline) le distanze sono linea d'aria × 1,39 con ≈ davanti. Una fermata che è sulla rete ma oltre 1,5 km a piedi non viene mai mostrata come vicina (la prima versione la stimava con il rapporto: errore trovato nella revisione e corretto).

Controlli fatti, con il loro valore reale:
- **Controllo di implementazione, non verifica indipendente.** Python (UTM, Dijkstra di scipy) e il JavaScript usano lo stesso estratto OSM e lo stesso aggancio al nodo più vicino. Dimostrano che il Dijkstra in JS è corretto (25 distanze, differenza massima 3,9 m / 1,1%), non che i metri siano veri.
- Su 600 punti, `walkable()` mostra le stesse fermate di Python nel 99,3% dei casi; le differenze sono solo al limite degli 800 m (801-802 m contro 800) o scambi al quarto posto tra fermate quasi alla stessa distanza. Le 6 più vicine: 95% di fermate in comune, 79% con lo stesso ordine (scambi tra fermate quasi alla stessa distanza).
- Browser vero (Playwright): distanze dalla rete, ripiego con ≈ a rete bloccata, offline con service worker installato (ricarica, posizione, distanze esatte senza ≈), sottopercorso `/marsala_tpl/`, percorso da posizione verso una fermata (lunedì 07:00 simulato). Nessun errore in console.
- Bug trovati dai controlli: `Float32Array` faceva scartare nodi validi (corretto); `getLoc()` non avviava il calcolo sulla rete (corretto).

Non verificato: i metri sul terreno (serve un confronto con un router esterno, per esempio OSRM o Valhalla con profilo foot su 10-20 coppie, o il cammino vero); Lighthouse con throttling 3G (il peso iniziale cambia solo di `js/walk.js`, il grafo è caricato dopo); la qualità di OSM dove mancano strade (0,5% delle coppie risultava non raggiungibile).

### 2. Orari indicativi
≈ davanti all'orario quando non è il capolinea di partenza e il feed dà lo stesso minuto della fermata precedente: righe di partenza, prossima partenza, orari di una corsa. Nota a piè di elenco e paragrafo in Info. I testi dicono il fatto (stesso minuto della fermata precedente) e non una cifra di errore, perché l'errore reale non è misurato. Verificato nel browser con un lunedì 07:00 simulato: ≈ nelle righe giuste, nota presente.
Attribuzione OpenStreetMap (ODbL) in Info.

### Dipendenza per il workflow notturno
`scripts/test.mjs` (lanciato dal workflow notturno) ora importa `js/walk.js` e legge `dati/walk.json`: vanno pubblicati nello stesso commit. Il test di confronto non dipende più dal feed vivo: le fermate di riferimento sono copiate nel file di test.
