# Ripartenza: cosa chiedere nella prossima chat

Stato al 2026-11-14, sera. File locale (`docs/` non va online).
Nella nuova chat la memoria di progetto si carica da sola. Il contesto completo è in `docs/PIANO-PROFONDITA.md` e `docs/REPORT-FASE1.md`.

## Test differenziale: già fatto

Vedi `docs/REPORT-DIFFERENZIALE.md`.

## Se riparti dal 21 novembre: dati RT (punti 1-3)

> Riprendiamo Marsala TPL dal registratore RT. Prima controlla le esecuzioni di "Registra posizioni bus" su Actions e dimmi se il cron è partito davvero. Poi scarica il ramo `rt-log`, conta i campioni per giorno (attesi circa 2.880), calcola la copertura in percentuale di minuti e dimmi dove sono i buchi. Solo dopo prova il map-matching sulle shapes. Riporta quanti mezzi assegni e con quale confidenza, e non dichiarare la puntualità nelle fasce con copertura insufficiente. Segui `docs/PIANO-PROFONDITA.md`. Non pubblicare nulla senza il mio ok.

## Cosa aggiungere al messaggio

- **Cosa non toccare.** Regola fissa: `git add` con percorsi espliciti, mai `-A` né `.`.
- **Aggiornamento notturno.** Facoltativo: "Controlla anche se l'aggiornamento notturno del 15 novembre è passato con i nuovi test" (primo giro con `walk.js` e `walk.json` online).
- **Esecuzioni manuali.** Se avvii a mano il registratore (come quella delle 19:48 UTC del 14 novembre), scrivilo, così non la scambio per un cron.
- **Stile.** Rispondo in italiano. La modalità "caveman" si attiva da sola: per toglierla scrivi "normal mode".

## Cosa resta da fare

**Dai dati RT (dal 21 novembre)**
1. Verificare che il cron del registratore sia partito davvero (all'ultimo controllo non era partita nessuna esecuzione programmata, solo manuali).
2. Contare i campioni per giorno e calcolare la copertura (percentuale di minuti con almeno un campione).
3. Map-matching sulle shapes per assegnare linea e corsa; poi puntualità reale nelle fasce coperte e, con essa, l'errore degli orari "indicativi" (≈), oggi non misurato.

**Verifiche esterne mancanti**
4. ~~Test differenziale di `js/schedule.js`~~ **Fatto il 2026-11-14** con `gtfs-kit` (12.000 query, 0 bug app, differenze solo sui 6 festivi FER5). Report: `docs/REPORT-DIFFERENZIALE.md`.
5. ~~Verifica sul campo~~ **Esclusa** (decisione 2026-11-14): non è possibile andare in loco; si assume come fonte il feed del Comune.
6. Metri a piedi: confronto di 10-20 coppie con OSRM o Valhalla (profilo foot) o con una camminata vera. Oggi è provato solo che il calcolo in JavaScript è corretto, non che i metri siano veri.
7. Controllo del sito pubblico su un telefono vero (distanze, ≈, offline) e Lighthouse con rete 3G.

**Da controllare nei prossimi giorni**
8. L'aggiornamento notturno delle 03:30 UTC del 15 novembre (primo con i nuovi test).
9. Il primo aggiornamento reale degli orari con ripubblicazione di Pages (mai avvenuto in produzione).

**Dal Comune** (da scrivere a mano)
10. Conferma del difetto FER5 nei 6 festivi: 8 dic, 25 dic, 1 gen, 6 gen, 29 mar, 2 giu.
11. Gli orari intermedi sono pubblicati o calcolati? (estate a 24 km/h, inverno al minuto con minuti ripetuti).
12. `trip_id` e `route_id` nel `vehicle_positions`; `route_color` e `route_short_name` per le navette.

## Scadenze

- Il feed degli orari scade il **13 giugno 2027** (banner nell'app già presente).
- Le Actions programmate si fermano dopo 60 giorni senza attività nel repo; i commit del registro RT dovrebbero evitarlo, ma non è ancora stato osservato.

## Dove trovare le cose

| Cosa | Dove |
|---|---|
| Piano e stato | `docs/PIANO-PROFONDITA.md` |
| Risultati dell'audit e della Fase 2 | `docs/REPORT-FASE1.md` |
| Script e output dell'audit | `docs/fase1/` (`audit*.py`, `walk.py` con `FASE1_DIR`, `*-out.txt`, `gtfs-validator-report.json`) |
| Registratore RT | `.github/workflows/rt-log.yml`, `scripts/rt-log.mjs`, log sul ramo `rt-log` (`data/AAAA-MM-GG.ndjson.gz`) |
| Rete pedonale | `js/walk.js`, `dati/walk.json`, `scripts/build-walk.mjs` |
| Leggere i log | `gh api -H "Accept: application/vnd.github.raw" "repos/PalermoHub/marsala_tpl/contents/data/<giorno>.ndjson.gz?ref=rt-log" \| zcat` |

I file di prova nello scratchpad della sessione (`/tmp/claude-1000/...`) possono sparire: quello che conta è già in `docs/fase1/`.

## Decisione: fonte di verità

Gli orari pubblicati dal Comune si assumono corretti. L'obiettivo è che l'app li rappresenti fedelmente (verificato: `docs/REPORT-DIFFERENZIALE.md`). Niente verifica sul campo. Il registro RT resta utile solo come funzione facoltativa (puntualità), non come verifica degli orari.
