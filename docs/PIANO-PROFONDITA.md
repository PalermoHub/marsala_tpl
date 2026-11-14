# Piano: Marsala TPL più profonda, non più grande

Stato al 2026-11-14. File locale (`docs/` non va online). Contesto: `PRODUCT.md`, `docs/PIANO.md`.

## Obiettivo

Stesse funzioni di oggi. Cambia la qualità di ciò che l'app afferma: ogni numero mostrato deve essere verificabile e ogni limite dei dati deve essere dichiarato. Nessuna funzione nuova visibile in Fase 1.

## Vincoli

- Mai mostrare un ritardo che i dati non sostengono.
- Online solo i file dell'app (regola in memoria). `git add` sempre con percorsi espliciti, mai `-A`, `.` o `commit -a`. Niente `--force`.
- Se qualcosa non è verificabile, si scrive "non verificato", non "fatto".

## Cosa farebbe un professionista (e non era stato chiesto)

1. Tratta il GTFS come un'affermazione da verificare (il difetto FER5 è stato trovato per caso: va cercato in modo sistematico).
2. Ricostruisce linea e corsa dai dati RT grezzi con map-matching, poi misura la puntualità reale.
3. Misura l'affidabilità (regolarità degli intervalli, corse effettuate), non solo la prossima partenza.
4. Usa la rete pedonale al posto della distanza in linea d'aria per "fermate vicine"; analizza la copertura sulla popolazione (sezioni ISTAT).
5. Pensa ai punti di rottura: scadenza feed (2027-06-13), corse oltre le 24:00, cambio ora legale, scioperi.
6. Va alla fermata: palo, cartello, uso con una mano al sole, rete lenta.

## Materia grezza (non digerita)

- `.txt` originali del GTFS, prima di `scripts/build-gtfs.mjs` e delle sue correzioni.
- Storico del `vehicle_positions` in protobuf grezzo: non esiste, va registrato da adesso.
- Orari stampati e determine del Comune (albo pretorio).
- OpenStreetMap: fermate, relazioni `route=bus`, rete pedonale.
- Sezioni censuarie ISTAT.
- Osservazione diretta alla fermata.

## Strumenti

| Scopo | Strumento |
|---|---|
| Validità del feed | `MobilityData/gtfs-validator`; `gtfs-kit` o `partridge` |
| Archivio RT | registratore su GitHub Actions (vedi sotto), Parquet, DuckDB |
| Linea/corsa dalle posizioni | map-matching HMM (Valhalla Meili o OSRM `match`) + DTW su `stop_times` |
| Isocrone e copertura | `r5py` o OpenTripPlanner 2 su OSM + GTFS |
| Qualità del servizio | metriche TCQSM; "puntuale" definito da −1 a +5 min |
| Test "prossime partenze" | `fast-check` contro un oracolo indipendente |
| Prestazioni e accessibilità | Lighthouse 3G, Playwright offline, `axe-core`, TalkBack |

## Fase 1: solo indagine, nessuna modifica all'app

1. **Audit del GTFS grezzo.** `gtfs-validator`; analisi di `stop_times` per velocità implausibili, fermate lontane dalla shape, corse oltre le 24:00, giorni di servizio senza corse. Ogni difetto con prova, distinguendo quelli del feed da quelli dell'app.
2. **Registratore RT** (in corso, vedi sotto). Dopo almeno una settimana: copertura reale del registro, poi map-matching sulle shapes. Riportare quanti mezzi si assegnano e con quale confidenza. Nessuna puntualità dichiarata per le fasce con copertura insufficiente.
3. **Fermate vicine:** confronto GTFS vs OSM; quante fermate "vicine" cambiano usando la distanza a piedi.

**Stato 2026-11-14:** punti 1 e 3 fatti, vedi `docs/REPORT-FASE1.md`. Il punto 2 (map-matching) aspetta la settimana di registro. Il confronto GTFS-OSM sulle posizioni non è praticabile (OSM ha 48 fermate su 592).

**Fase 2 (2026-11-14):** proposte 1 e 2 fatte in locale, la 3 esisteva già; vedi in fondo a `docs/REPORT-FASE1.md`. Non pubblicate.

## Fase 2: solo dopo l'ok al report della Fase 1

Applicare solo ciò che la Fase 1 ha dimostrato: correzioni ai dati con `meta.corrections` motivate, avviso di dati scaduti prima del 2027-06-13, "da orario" che diventa indicazione di affidabilità solo dove i dati la reggono.

## Prove di correttezza (verificatori esterni)

- Test differenziale: OpenTripPlanner o `gtfs-kit` sullo stesso GTFS contro `js/schedule.js`, almeno 5.000 coppie (fermata, data-ora), festivi e post-mezzanotte compresi. Ogni discrepanza è un bug dell'app o un difetto del feed.
- Zero errori in `gtfs-validator` dopo le correzioni, con registro delle correzioni fatte.
- ~~Scheda di verifica sul campo~~ Esclusa (2026-11-14): non si può andare sul campo; gli orari del Comune sono la fonte assunta.
- Storico RT registrato: timestamp che né l'utente né Claude hanno prodotto.
- Conferma del Comune sul difetto FER5.
- Lighthouse con throttling 3G e test offline con Playwright; 5 utenti su un compito reale, cronometrati.

## Registratore RT su GitHub Actions

Non c'è un host sempre acceso: si usa GitHub Actions.

- Script: `scripts/rt-log.mjs`. Interroga il feed ogni 30 s per ~55 min e salva il protobuf grezzo (base64 + istante di ricezione). Un file al giorno (UTC), `AAAA-MM-GG.ndjson.gz`, a membri gzip concatenati. Registra anche i tentativi falliti: i buchi si dichiarano.
- Workflow: `.github/workflows/rt-log.yml`, cron ogni 30 min, gruppo `concurrency` senza `cancel-in-progress` (un'esecuzione ritardata si accoda invece di sovrapporsi), `timeout-minutes` ~62.
- Dati: ramo orfano `rt-log`, mai su `main`, così Pages non li pubblica e resta valida la regola "online solo i file dell'app".
- Limiti noti: cron minimo 5 min, esecuzioni ritardate o saltate sotto carico, buchi inevitabili. Le Actions programmate si fermano dopo 60 giorni senza attività (i commit dei log contano come attività). I log sono pubblici perché il repo lo è.
- Dopo una settimana: convertire in Parquet in locale con DuckDB, calcolare la percentuale di minuti con almeno un campione.

### Prove del 2026-11-14

Su GitHub (run 43630684328, `minutes=3`): 6 campioni su 6, tutti validi (19 veicoli ciascuno), file letto dal ramo `rt-log` e decodificato con `js/rt.js`. Pages pubblica da `main`, quindi `rt-log` non viene servito. Il cron ogni 30 min è attivo dal push (commit a6b47fd): la prima registrazione completa da 55 min non è ancora stata osservata.

Prova locale:

2 minuti, intervallo 30 s: 5 campioni su 5 attesi, tutti validi, nessun fallimento. Il file `.ndjson.gz` risulta leggibile con `zcat` anche con due membri concatenati.

## Rischi aperti

- Il feed non ha `trip_id` né linea: l'assegnazione da map-matching sarà probabilistica. Per i mezzi fermi in deposito non c'è nulla da assegnare.
- Registro con buchi: la puntualità per fasce orarie poco coperte non va dichiarata.
- Il Comune può cambiare formato o URL del feed: lo script fallisce se nessun campione è valido.
- Il feed statico scade il 2027-06-13.

## Da chiedere al Comune

- Conferma del difetto FER5 nei festivi infrasettimanali (Supplemento Scuole, linea 21).
- Aggiunta di `trip_id`/`route_id` al `vehicle_positions` e popolamento di `trip_updates`.
- Colori ufficiali delle linee (`route_color` vuoto).
