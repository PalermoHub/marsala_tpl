# Product

<!-- impeccable:product-schema 1 -->

> Nota: ricavato dal brief e da `docs/PIANO.md`, senza intervista (l'utente ha delegato le scelte). I fatti marcati [ipotesi] non sono stati confermati dall'utente.

## Platform

web

## Stack
Delegato: HTML + JavaScript ES modules senza framework, PWA statica su GitHub Pages, MapLibre GL JS per la mappa, dati GTFS pre-compilati in JSON da uno script Node. Motivo: hosting solo statico, caricamento veloce su telefoni lenti, poche dipendenze. Dettagli in `docs/PIANO.md`.

## Users
- [ipotesi] Residenti di Marsala che prendono l'autobus: alla fermata (spesso all'aperto, sole forte, una mano sola) o a casa che pianificano l'uscita.
- [ipotesi] Studenti e pendolari che ripetono ogni giorno le stesse 2-3 fermate/linee.
- [ipotesi] Turisti e stagionali (Marsala è meta turistica), spesso non italofoni.

Il lavoro principale è "quando passa il prossimo bus da qui?".

## Product Purpose
Web app installabile (PWA) per il trasporto pubblico locale (TPL) del Comune di Marsala. Successo: chi è alla fermata ha la risposta in meno di 3 secondi, anche offline e su rete lenta.

## Positioning
Unica app dedicata al TPL di Marsala costruita sui dati ufficiali del Comune (GTFS statico + GTFS-RT), con la fermata come unità base (URL e QR per ogni fermata) e onestà esplicita tra "da orario" e "in tempo reale". Un'app generica di mobilità non offre né l'URL per fermata né la distinzione tra dato teorico e dato live.

## Operating Context
- Fonte: pagina del Comune https://www.comune.marsala.tp.it/it/page/orari-del-trasporto-pubblico-locale
- GTFS statico (`gtfs.zip`): 592 fermate, 334 corse, ~8 linee (1, 2/5, 3, 4, 6, 7/10, 8/13…), shapes; feed `MARSALA-2026-EST+INV-r4+NOV12`, valido dal 2026-06-15 al 2027-06-13; orario invernale dal 2026-09-14. Gestore in `agency.txt`: "Marsala".
- GTFS-RT pubblici su AWS (vehicle_positions, trip_updates), senza chiave. Gli ID RT non coincidono con il GTFS statico: i ritardi per corsa non sono incrociabili finché il Comune non li allinea. CORS non verificato.
- Licenza dati: CC BY 4.0, attribuzione obbligatoria.
- Calendari: feriale a 6 giorni, a 5 giorni, domenica, più `calendar_dates`.

## Capabilities and Constraints
- Prossime partenze per fermata, fermate vicine (geolocalizzazione solo nel browser), elenco e dettaglio linee con percorso, mappa con bus live, preferiti, QR/condivisione fermata, italiano e inglese, offline.
- Tariffe, abbonamenti, biglietteria: nessun dato ufficiale, fuori scopo.
- Non mostrare mai un ritardo inventato: se il RT non è affidabile, etichetta "da orario".
- Pianificatore A→B con cambi: non in v1.
- Nome dell'app e dominio: non decisi (provvisorio "Marsala TPL").

## Brand Commitments
Nessuno confermato. Obbligo di legge: attribuzione CC BY 4.0 e riferimento al Comune di Marsala come fonte. L'app non è un servizio ufficiale del Comune [ipotesi]: va dichiarato.

## Evidence on Hand
- Dati reali: GTFS statico e feed RT (vedi sopra). Icone PWA già presenti in `img/` (`icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `favicon.*`) e logo `img/opendatasicilia.png`.
- Assenti: stemma o identità visiva del Comune, colori ufficiali delle linee (`route_color` vuoto nel GTFS), foto, testimonianze, dati di utilizzo. Non inventarli.

## Product Principles
1. La risposta prima di tutto: la prossima partenza compare senza tap né caricamenti.
2. Dato onesto: "da orario" e "live" sono sempre distinguibili.
3. Funziona dove serve: offline, rete lenta, schermo al sole, una mano.
4. La fermata è l'unità base, condivisibile con un URL.
5. Leggero e senza tracking.

## Accessibility & Inclusion
WCAG AA come minimo: contrasto alto per uso all'aperto, tocco ≥ 44 px, `prefers-reduced-motion`, etichette per screen reader, italiano e inglese. [ipotesi] Utenti anziani e con vista ridotta tra i frequentatori: testo grande per le informazioni chiave.
