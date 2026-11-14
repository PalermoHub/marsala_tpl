---
name: Marsala TPL
description: Orari e fermate del trasporto pubblico di Marsala, in smalto bianco e cobalto di maiolica siciliana.
colors:
  glaze: "oklch(97.5% 0.012 85)"
  glaze-2: "oklch(94.5% 0.02 85)"
  ink: "oklch(24% 0.07 262)"
  ink-2: "oklch(43% 0.06 262)"
  line: "oklch(86% 0.028 85)"
  edge: "oklch(58% 0.05 262)"
  cobalt: "oklch(37% 0.16 264)"
  cobalt-hi: "oklch(48% 0.18 262)"
  on-cobalt: "oklch(97% 0.012 85)"
  on-cobalt-2: "oklch(86% 0.05 262)"
  ocra: "oklch(83% 0.15 85)"
  ocra-soft: "oklch(94% 0.06 88)"
  rame: "oklch(50% 0.1 172)"
  terra: "oklch(48% 0.15 38)"
  terra-soft: "oklch(94% 0.04 45)"
  focus: "oklch(48% 0.18 262)"
  on-ocra: "oklch(24% 0.07 262)"
  map-ink: "#14213D"
  map-idle: "#8A93A6"
  map-glaze: "#FBF7EE"
  map-cobalt: "#1B3A94"
  map-ocra: "#F2C14E"
  wash: "oklch(100% 0 0 / 0.12)"
  wash-quiet: "oklch(100% 0 0 / 0.14)"
  wash-hover: "oklch(100% 0 0 / 0.2)"
  night-glaze: "oklch(19% 0.045 264)"
  night-glaze-2: "oklch(25% 0.055 264)"
  night-ink: "oklch(95% 0.012 85)"
  night-ink-2: "oklch(77% 0.04 262)"
  night-line: "oklch(33% 0.055 264)"
  night-edge: "oklch(58% 0.07 264)"
  night-cobalt: "oklch(31% 0.15 264)"
  night-cobalt-hi: "oklch(72% 0.13 262)"
  night-ocra-soft: "oklch(30% 0.05 85)"
  night-rame: "oklch(70% 0.11 172)"
  night-terra: "oklch(74% 0.13 45)"
  night-terra-soft: "oklch(28% 0.06 40)"
  night-focus: "oklch(80% 0.12 262)"
typography:
  hero-number:
    fontFamily: "Atkinson Hyperlegible, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "clamp(64px, 22vw, 96px)"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.03em"
  display:
    fontFamily: "Atkinson Hyperlegible, system-ui, sans-serif"
    fontSize: "40px"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Atkinson Hyperlegible, system-ui, sans-serif"
    fontSize: "30px"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Atkinson Hyperlegible, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.15
  row-title:
    fontFamily: "Atkinson Hyperlegible, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: 1.2
  body:
    fontFamily: "Atkinson Hyperlegible, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Atkinson Hyperlegible, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: 1.3
  tab:
    fontFamily: "Atkinson Hyperlegible, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 700
    lineHeight: 1.45
  stop-name:
    fontFamily: "Atkinson Hyperlegible, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.15
  subtitle:
    fontFamily: "Atkinson Hyperlegible, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.2
  unit:
    fontFamily: "Atkinson Hyperlegible, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1
  lead:
    fontFamily: "Atkinson Hyperlegible, system-ui, sans-serif"
    fontSize: "19px"
    fontWeight: 400
    lineHeight: 1.45
  caption:
    fontFamily: "Atkinson Hyperlegible, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.45
  readout:
    fontFamily: "Atkinson Hyperlegible, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    lineHeight: 1
  micro:
    fontFamily: "Atkinson Hyperlegible, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 700
    lineHeight: 1.45
rounded:
  tile: "7px"
  sm: "4px"
  tile-row: "8px"
  md: "10px"
  lg: "14px"
  pill: "99px"
  full: "50%"
spacing:
  gutter-min: "16px"
  col: "560px"
  tabs-h: "64px"
  row-min: "64px"
  tap: "48px"
  xs: "8px"
  sm: "12px"
  md: "14px"
  lg: "22px"
components:
  hero-field:
    backgroundColor: "{colors.cobalt}"
    textColor: "{colors.on-cobalt}"
    padding: "20px 16px 34px"
  hero-when:
    textColor: "{colors.ocra}"
    typography: "{typography.hero-number}"
  button:
    backgroundColor: "{colors.cobalt}"
    textColor: "{colors.on-cobalt}"
    rounded: "{rounded.md}"
    height: "48px"
    padding: "0 18px"
  button-quiet:
    backgroundColor: "{colors.glaze-2}"
    textColor: "{colors.ink}"
  button-on-field:
    backgroundColor: "{colors.ocra}"
    textColor: "{colors.ink}"
  departure-row:
    textColor: "{colors.ink}"
    typography: "{typography.row-title}"
    height: "64px"
  seg-selected:
    backgroundColor: "{colors.cobalt}"
    textColor: "{colors.on-cobalt}"
    rounded: "{rounded.md}"
    height: "48px"
  time-chip:
    backgroundColor: "{colors.glaze}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "44px"
    padding: "0 12px"
  time-chip-selected:
    backgroundColor: "{colors.ocra}"
    textColor: "{colors.ink}"
  tab-active-pill:
    backgroundColor: "{colors.ocra}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
  map-chip:
    backgroundColor: "{colors.glaze}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "9px 14px"
  page-head:
    backgroundColor: "{colors.cobalt}"
    textColor: "{colors.on-cobalt}"
    typography: "{typography.headline}"
    padding: "20px 16px 26px"
  banner-warn:
    backgroundColor: "{colors.terra-soft}"
    textColor: "{colors.terra}"
---

# Design System: Marsala TPL

## Overview

**Creative North Star: "La maiolica della fermata"**

Una PWA di orari costruita come una parete di maiolica siciliana: smalto bianco caldo per le liste, un campo pieno di cobalto a scala di pagina per la risposta, ocra per "il prossimo", verde rame per i mezzi in movimento e terracotta per gli avvisi. Lo scopo e' uno solo: chi e' alla fermata, al sole, con una mano, legge linea, destinazione e minuti in meno di tre secondi.

La densita' e' compatta e gli angoli sono piccoli, come il bordo di una piastrella (10px, mai pillole). Le cifre sono tabulari e grandi: i minuti sono il segno della schermata. Ogni linea e' una piastrella con smalto e motivo geometrico propri, cosi' si riconosce anche senza colore. Il tema scuro e' un indaco notturno con lo stesso cobalto, schiarito dove deve fare da accento.

Lo stato normale e calmo e' "da orario": nessuna partenza e' live (il feed non ha corse), quindi l'etichetta non e' un avviso e non porta colore d'allarme. Solo i bus in servizio sulla mappa usano il verde rame.

**Key Characteristics:**
- Campo cobalto pieno per la prossima partenza, con striscia di piastrelle ocra sul bordo inferiore.
- Cifra monumentale (fino a 96px) in ocra su cobalto.
- Piastrelle-linea: 8 smalti x 12 motivi SVG, targhetta bianca col numero.
- Piatto: nessuna ombra sulle liste; profondita' per toni e filetti da 1px.
- Un solo font, Atkinson Hyperlegible 400/700.

## Colors

Palette di smalti: cobalto saturo, bianchi caldi (tinta 85) e inchiostro indaco; ocra, rame e terracotta compaiono ciascuno con un solo compito.

### Primary
- **Cobalto di maiolica** (`{colors.cobalt}`): campo hero, pulsante primario, segmented selezionato, estremi della timeline. In scuro scende a `{colors.night-cobalt}`.
- **Cobalto vivo** (`{colors.cobalt-hi}`): bordi dei controlli, linea e nodi della timeline, bordo del campo in focus, cursore. In scuro diventa `{colors.night-cobalt-hi}` (chiaro) per restare leggibile.

### Secondary
- **Ocra del prossimo** (`{colors.ocra}`): la cifra dei minuti, il chip orario selezionato, la pillola della tab attiva, il pulsante sul campo, la selezione testo. Non cambia in scuro. `{colors.ocra-soft}` e' il fondo del banner informativo.

### Tertiary
- **Verde rame** (`{colors.rame}`): solo i bus in movimento sulla mappa (pallino del chip "in servizio"). Sulla mappa il bus è un punto inchiostro con anello ocra, volutamente fuori dalla palette delle linee, e la posizione dell'utente un punto cobalto con alone. In scuro `{colors.night-rame}`.
- **Terracotta** (`{colors.terra}`): avvisi e variazioni di servizio, testo su `{colors.terra-soft}`. In scuro `{colors.night-terra}`.

### Neutral
- **Smalto bianco caldo** (`{colors.glaze}`): sfondo pagina, tab bar, chip orari, chip mappa. `{colors.glaze-2}` per campi di ricerca e pulsante quieto.
- **Inchiostro indaco** (`{colors.ink}`): testo; `{colors.ink-2}` per testo secondario, direzione, righe passate.
- **Filetto** (`{colors.line}`): bordo delle righe e dei chip, 1px (2px sui controlli).
- **Su cobalto** (`{colors.on-cobalt}`, `{colors.on-cobalt-2}`): testo primario e secondario sul campo.
- Scuro: stesse variabili con prefisso `night-` (`night-glaze`, `night-ink`, `night-line`, ecc.), applicate tramite `prefers-color-scheme: dark` e `data-theme="dark"`.

### Named Rules
**The Calm Schedule Rule.** "Da orario" e' lo stato normale: testo secondario con icona orologio, mai ocra d'allarme, mai terracotta.
**The One Job Rule.** Ocra = il prossimo/selezionato; rame = bus in movimento; terracotta = avviso. Nessun colore svolge due compiti.
**The Glaze Pair Rule.** Gli smalti delle linee (bordeaux, verde rame, azzurro, ocra, violetto, turchese, corallo, oliva; il bordeaux sostituisce il terracotta per non confondersi con gli avvisi) vivono solo nelle piastrelle e nei tracciati mappa, mai come colore di interfaccia.

## Typography

**Display / Body Font:** Atkinson Hyperlegible (400 e 700, woff2 locale; fallback system-ui, -apple-system, Segoe UI, Roboto, sans-serif)

**Character:** Un solo carattere pensato per la leggibilita' al sole; il contrasto viene dal peso (400 corpo, 700 tutto il resto) e dalla scala, non da un secondo font. Cifre tabulari sul body.

### Hierarchy
- **Hero number** (700, clamp(64px, 22vw, 96px), 1, -0.03em): i minuti alla prossima partenza, in ocra; unita' a 28px.
- **Display** (700, 40px, 1.05, -0.02em): titolo del primo avvio.
- **Headline** (700, 30px, 1.1): titolo di sezione (`.h1`); nome fermata 22px, 30px da 700px.
- **Title** (700, 24px, 1.15-1.2): nome linea, orario partenza in lista (24px), titolo stato vuoto.
- **Row title** (700, 18px, 1.2): destinazione, nome fermata nelle righe; campo ricerca 18px.
- **Body** (400, 17px, 1.45): testo corrente, pulsanti 17px/700; lead 19px su 32ch.
- **Label** (700, 15px, 1.3): sottotitoli di sezione in `{colors.ink-2}`, segmented, banner, chip mappa; note 16px.
- **Tab** (700, 13px): etichette tab bar.
- **Readout** (700, 11px): solo il valore di zoom nel cerchio della mappa (36px).

### Named Rules
**The Minutes Are The Sign Rule.** In ogni schermata una sola cifra e' monumentale; il resto sta sotto i 30px.

## Layout

Colonna singola mobile-first, larga al massimo 560px, centrata con gutter `max(16px, (100% - 560px)/2)`; il campo hero e le righe lista sono a tutta larghezza con il contenuto inset sul gutter. Righe da almeno 64px, bersagli da almeno 48px (chip orari 44px). Ritmo verticale: blocchi 22px, titoli di sezione 26px sopra e 6px sotto, gap interni 8-14px. Tab bar fissa in basso (64px piu' safe-area, 4 voci: Vicino, Linee, Mappa, Info). La mappa occupa tutto lo spazio tra schermo e tab bar. Breakpoint: 700px (numero a 96px fissi, nome fermata 30px); 900px (colonna 680px, titoli di testata 40px); 1000px (desktop a due colonne: a sinistra il campo cobalto fermo, 440px, con fermata, linea o titolo di pagina; a destra le liste, 640px; barra in basso larga 1080px). Le schermate con testata di pagina (Linee, Cerca, Altro, Avvisi, Guida, Info) restano a colonna unica di 640px con la testata a tutta larghezza; la mappa ha a sinistra una colonna di 440px (testata cobalto, linee in servizio che mettono a fuoco la mappa, legenda sempre aperta; il pulsante Legenda sparisce) e a destra la mappa (640px, a tutta altezza): la pagina ha la stessa larghezza di 1080px di tutte le altre.

## Elevation & Depth

Piatto per tono: la profondita' viene dal cambio di smalto (glaze / glaze-2 / cobalto) e dai filetti da 1px. Le ombre esistono solo dove un oggetto galleggia sulla mappa, morbide e non offset: chip e messaggio mappa (`box-shadow: 0 2px 10px oklch(20% 0.05 262 / 0.28)`); le piastrelle hanno un lieve `drop-shadow(0 1px 1px oklch(20% 0.05 262 / 0.35))` per staccarsi dal fondo.

### Named Rules
**The Flat Glaze Rule.** Liste, righe, campi e pulsanti non hanno ombra; la tab bar si separa con un filetto.

## Shapes

Token: `--r-sm` 4px, `--r-tile` 7px, `--r` 10px, `--r-lg` 14px (schede a fisarmonica, cornice degli screenshot della guida), `--r-pill` 99px (solo etichette tipo "Trasporti", segnaposto "bus tra due fermate" e cursore zoom).

Angoli piccoli da bordo di piastrella: 10px per controlli, pulsanti, chip e righe attive (`--r`); 7px per le piastrelle-linea (8px sulla fila di piastrelle); 4px solo per l'anello di focus; cerchi (50%) per i nodi della timeline e il pallino live. Il segmented control e' un unico blocco con raggio 10px solo agli estremi e bordi da 2px. La striscia sul bordo del campo ripete un rombo ocra con due punti ai lati (modulo 24x12px, opacita' 0.85).

## Components

### Campo cobalto con striscia di piastrelle
Zona superiore a tutta larghezza su `{colors.cobalt}`: nome fermata (700 22px, 30px da 700px), direzione in `{colors.on-cobalt-2}`, tre azioni da 44px (cerca/cambia fermata, preferita, condividi; sfondo bianco al 12%, preferita premuta in ocra), poi piastrella 72px + destinazione (700 20px) e minuti in ocra. Sullo sfondo, a destra, il motivo della linea in arrivo grande e tenue (13% di opacità, sfumato a sinistra), che non deve mai ridurre il contrasto del testo. In basso la striscia di piastrelle da 12px, colorata con una maschera: segue lo stato dei dati (`data-strip`): ocra = normale, terracotta chiara = orari in scadenza o scaduti, azzurro-grigio al 60% = offline. Non è decorazione neutra: cambia solo per questi stati. Focus in ocra dentro il campo.

### Testata di pagina (`.page-head`)
Per le schermate senza risposta immediata (Linee, Cerca, Avvisi, Guida, Info, Privacy): campo cobalto compatto (20px sopra, 26px sotto) con titolo 30px/700, sottotitolo opzionale 17px in `{colors.on-cobalt-2}` (max 46ch), link "indietro" 44px e la stessa striscia di piastrelle di stato del campo grande. Genera `pageHead()` in `js/app.js`; non è mai usata dove c'è una partenza da mostrare (Home, Fermata, Percorso, Linea usano il campo grande).

### Piastrella-linea
SVG 48x48, raggio 7px, smalto della linea, motivo geometrico a tratto bianco al 42%, targhetta di smalto bianco (#FBF7EE, raggio 4.5) col numero in 700 (15px fino a 2 caratteri, 12px fino a 4, 9.5px oltre) in #14213D. Le linee note hanno coppia smalto/motivo fissa; le altre una coppia deterministica da hash. Il motivo ripete l'informazione del colore.

### Riga partenza
Griglia piastrella - destinazione - quando, minimo 64px, filetto 1px sotto. Destinazione 18px/700. A destra due righe allineate a destra: sotto i 60 minuti, i minuti in 24px/700 sopra e l'orario 15px in `{colors.ink-2}` sotto; da 60 minuti in poi l'orario 24px/700 sopra e il "tra 2 h 19 min" sotto. I minuti guidano, come nel campo cobalto. Hover: sottolineatura del titolo.

### Stati delle righe
Hover (solo con puntatore) e pressione: velo cobalto vivo al 7% / 10% che sborda di 8px ai lati senza spostare filetti e testo; nessuna ombra. Contrasti verificati (AA): `ink-2` su `glaze` 7,6:1 e su `glaze-2` 6,9:1; `on-cobalt-2` su `cobalt` 7,1:1; ocra su cobalto 6,4:1; terracotta su `terra-soft` 5,8:1; in scuro tutte le coppie ≥7,4:1 (bordi dei controlli ≥3,6:1).

### Riga fermata
Titolo 18px/700 + sottotitolo 15px, a destra fila di piastrelle (gap 4px, "+N" 14px) e chevron in `{colors.ink-2}`.

### Segmented control
Bottoni affiancati da 48px, bordo 2px `{colors.cobalt-hi}`, trasparenti; selezionato pieno `{colors.cobalt}` con testo `{colors.on-cobalt}`. Usato per direzione di linea, lingua e tema (radiogroup).

### Chips orari
Scorrimento orizzontale con snap, 44px, min 64px, bordo 2px `{colors.line}`; selezionato pieno ocra con testo inchiostro.

### Timeline fermate
Filo verticale da 2px in cobalto vivo (opacita' 0.55), nodo cerchio 12px con bordo 3px; primo e ultimo nodo pieni cobalto, filo tagliato a meta'. Righe da 48px, orari 700, fermate passate in `{colors.ink-2}`.

### Tab bar
Quattro voci uguali, 13px/700, icona SVG; la voce attiva ha una pillola ocra (raggio 10px) dietro l'icona e testo `{colors.ink}`; le altre `{colors.ink-2}`. Sfondo smalto con filetto superiore.

### Badge avvisi (tab Altro)
Cerchietto `{colors.terra}` con numero 11px/700 in `{colors.glaze}` (9+ oltre nove), angolo in alto a destra dell'icona; compare solo se ci sono avvisi sul trasporto piu' recenti dell'ultima apertura di «Avvisi». Chi apre l'app la prima volta parte da zero. Nella pagina Altro la riga Avvisi porta la stessa etichetta in forma estesa («1 nuovo avviso»). Terracotta = avviso, in linea con la One Job Rule.

### Chip mappa
Blocco a raggio 10px su smalto, 15px/700, ombra morbida; variante "live" con pallino rame da 12px e doppio anello (smalto, rame). I bus sono cerchi rame da 9px con bordo bianco 3px; fermate cerchi smalto con bordo cobalto 2px; tracciati nello smalto della linea con bordo bianco.

### Pulsanti e campi
Pulsante: 48px, raggio 10px, cobalto/`on-cobalt`, 700 17px, pressed 1px verso il basso. Quieto su `{colors.glaze-2}`. Sul campo cobalto: ocra con testo inchiostro. Campo ricerca: 52px, bordo 2px `{colors.edge}` (contrasto 3:1 sui controlli; `{colors.line}` resta solo per i filetti) su `{colors.glaze-2}`, in focus bordo `{colors.cobalt-hi}`. Avviso: banda `{colors.ocra-soft}` (info) o `{colors.terra-soft}` con testo terracotta (variazione di servizio).

### Movimento
Il momento principale resta `rise` all'apertura di una schermata (opacita' 0 e salita di 14px, 0.55s sulla cifra e sul titolo vuoto, 0.45s sulla destinazione, `cubic-bezier(0.16, 1, 0.3, 1)`). Altri tre momenti, tutti brevi e legati a un evento:
- **Cambio schermata:** dissolvenza di 0.18s con View Transitions, solo dove esistono; non da/verso la mappa.
- **Stella preferita:** `pop` di 0.35s quando una fermata viene salvata.
- **Bus imminente (<= 2 min):** la cifra "respira" (opacita' 1 -> 0.72, 1.8s, solo 3 volte), mai all'infinito.
Per il resto solo transizioni di stato da 0.15-0.3s. Con `prefers-reduced-motion` tutto si ferma, view transition comprese.

## Do's and Don'ts

### Do:
- **Do** dare al campo cobalto la risposta (linea, destinazione, minuti) e alla lista lo smalto bianco.
- **Do** mostrare "da orario" come testo calmo con icona orologio.
- **Do** dare a ogni linea smalto piu' motivo, e tenere il numero sulla targhetta bianca.
- **Do** tenere bersagli da 48px (44px per i chip) e anello di focus da 3px (`{colors.focus}`; ocra dentro il campo).
- **Do** usare raggio 10px e filetti da 1-2px; cifre tabulari.

### Don't:
- **Don't** usare terracotta o ocra d'allarme per "da orario" o per stati normali.
- **Don't** usare il verde rame fuori dai bus in movimento.
- **Don't** usare gli smalti delle linee come colore di interfaccia.
- **Don't** aggiungere ombre alle liste, ne' secondi font, ne' animazioni oltre `rise` e i tre momenti elencati in Movimento (mai cicli infiniti).
- **Don't** esprimere una linea con il solo colore: serve sempre il motivo.
