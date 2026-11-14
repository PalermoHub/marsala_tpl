# Piano grafica: uniformità, gradevolezza, attrattività

Stato (2026-11-14): fasi 1-9 eseguite (9: colonna 680px da 900px e layout a due colonne da 1000px); 10 in parte (DESIGN.md, guida e screenshot home/linee/cerca aggiornati; restano gli screenshot fermata, percorso, mappa e il badge avvisi). Commit: fff7154, 393b4b4, 20166b8, a308749, bc1bec0 e successivi.
Metodo: critique + audit con la skill `impeccable` (modalità **Operate**), letti `PRODUCT.md`, `DESIGN.md`, `.impeccable/surfaces/index-html.md`, `css/app.css` (462 righe); screenshot a 390×844 di home, vicino, linee, percorso, mappa, avvisi, info (+ linee in scuro); detector `impeccable detect`.
⚠️ Esecuzione singolo contesto (A e B non isolati: nessun sub-agente richiesto dall'utente). Non verificati: schermata fermata con partenze, linea aperta, tema scuro completo, desktop ≥700px.

---

## 1. Come ragiona "Claude Design" con le skill

Non c'è un'unica skill "grafica": si combinano strumenti con ruoli diversi, in questo ordine.

| Passo | Strumento | A cosa serve qui |
|---|---|---|
| 1. Contesto | `impeccable context` → PRODUCT.md, DESIGN.md, surface brief | Fissa utenti, modalità (Operate), vincoli e la direzione "maiolica siciliana". **Il brief vince**: non si ridisegna l'identità, si rifinisce. |
| 2. Evidenza | screenshot Playwright 390px, `impeccable detect`, lettura CSS | Si guarda il renderizzato, non solo il codice. Il detector dà fatti (colori/raggi/font fuori token); lo sguardo dà giudizio. |
| 3. Giudizio | `impeccable critique` (10 euristiche Nielsen, carico cognitivo, persona) | Trova i problemi per gravità P0–P3 e li mappa su comandi. |
| 4. Verifica tecnica | `impeccable audit`, `chrome-devtools` (Lighthouse, a11y), `design:accessibility-review` | Contrasto, target, focus, performance su rete lenta. |
| 5. Esecuzione | comandi `impeccable`: `layout`, `typeset`, `colorize`, `harden`, `clarify`, `adapt`, `animate`, `delight`, `polish`, `document` | Un comando per fase, ognuno con ambito stretto. |
| 6. Chiusura | `polish` + `document` (aggiorna DESIGN.md) + `verification-before-completion` | Il design system resta la fonte di verità. |
| Opzionali | `frontend-design`, `design:design-system`/`design-critique`, `redesign-existing-projects` | Secondo parere; **non** usare `image-to-code`, `gpt-taste`, `high-end-visual-design` (spingono verso landing page e confliggono con Operate). |

Regola di fondo: in modalità Operate l'ambizione si esprime come **precisione e coerenza**, non come effetti.

---

## 2. Diagnosi (cosa funziona, cosa no)

### Punti di forza da non toccare
- Direzione riconoscibile e specifica del luogo: cobalto + ocra + smalto caldo, piastrelle-linea con motivo (ridondanza al colore = accessibilità vera).
- Un solo font leggibile (Atkinson), cifre tabulari, target ≥48px, rispetto di `prefers-reduced-motion`, tema scuro con token propri.
- Il campo hero con striscia di piastrelle: è l'elemento più memorabile.

### Problemi, per gravità

**P1: schermata d'ingresso non risponde alla domanda "quando passa il bus?"**
La home è un menu di 5 voci quasi uguali (`.card`), contro il principio 1 di PRODUCT.md. Senza fermata salvata, nessun contenuto utile sopra la piega; sotto la piega c'è un blocco "howto".

**P1: banner del consenso copre ~25% dello schermo su ogni schermata fino alla risposta**
Fisso sopra la tab bar (`.consent`, `max-height:70vh`), nasconde l'ultima riga di ogni lista e il comando "Legenda" della mappa. Pesa soprattutto al primo uso, quando si decide se l'app piace.

**P1: l'intestazione cambia logica da schermata a schermata**
Home, Percorso e Fermata hanno il campo cobalto; Linee, Avvisi, Info, Guida partono con un `h1` nudo su fondo smalto, senza striscia, senza contesto. Sembrano due app. È la perdita di uniformità più visibile.

**P2: tab bar a 6 voci**
Supera il limite di 5 (Miller/Cowan, convenzione mobile): etichette a 13px, "Trip" vs titolo "Plan your journey" (terminologia incoerente), "Guide" e "Info" vicine come ruolo.

**P2: mappa: controlli e colori in competizione**
Sette controlli a destra (home, +, −, bussola, posizione, schermo intero, 3D) più cursore e valore zoom. Il cerchio zoom usa **ocra**, violando la One Job Rule (ocra = "il prossimo"). Etichette delle linee (7/10, 15, 1) si sovrappongono nel centro urbano; i tracciati saturi a larghezza uniforme creano rumore sul fondo tenue.

**P2: scarto tra codice e DESIGN.md (il detector lo conferma)**
- Raggi fuori scala: 14px (`.acc`), 20px (zoom), 999px (`.news-tag`, `.bus-between`) vs "mai pillole, 10px".
- Dimensioni font fuori rampa: 32px (`.plan-h1`), 26px (`.icon-btn-quiet`), 11px (`.map-zoom-val`).
- Colori letterali non tokenizzati: `#14213D`, `#8A93A6`, `#1B3A94`, `#FBF7EE`, `#fff`, `rgba(242,193,78,.45)`; la variabile `--bg-2` non esiste (`.guide-tip`).
- Regole duplicate/sovrascritte (`.route-stops li.here` ×2, `::after` sovrascritto).
- Ombre colorate morbide sulla mappa e `.consent` (`dark-glow` del detector, probabilmente falso positivo su index.html, da verificare).

**P3: tono e ritmo**
Il cobalto uniforme è solido ma monotono; fuori dal hero l'ocra compare solo su tab, chip e zoom. Pochi momenti di piacere: nessuna transizione tra schermate, stato vuoto senza illustrazione, nessun segnale d'identità locale oltre alla striscia.

---

## 3. Fasi (indipendenti: si può eseguirne una qualunque, in qualunque ordine)

Ogni fase ha: obiettivo, ambito (file), azioni, criterio di fine, rischi, comando impeccable. Dopo ogni fase: `node --test` (16 test), controllo a 390px chiaro/scuro, `graphify update .`, aggiornare `sw.js` (versione cache), se si toccano asset.

### Fase 1: Token e igiene del design system *(fondazione, nessun cambio visibile)*
- **Obiettivo:** il CSS rispecchia DESIGN.md; ogni valore ha un token.
- **File:** `css/app.css`, `DESIGN.md`.
- **Azioni:** introdurre `--glaze-pure`, `--ink-fixed`, `--shadow-float`, scala raggi (`--r-sm 4`, `--r-tile 7`, `--r 10`, `--r-lg 14`), scala tipo (aggiungere 32, 11 o eliminarli); sostituire i letterali elencati sopra; eliminare `--bg-2` e le regole duplicate; raggruppare il blocco scuro che oggi è scritto due volte (media query + `data-theme`) con un selettore condiviso.
- **Fine:** `impeccable detect` senza avvisi `design-system-*`; `git diff` visivamente nullo (confronto screenshot).
- **Rischio:** basso. **Comando:** `/impeccable extract` poi `/impeccable document`.

### Fase 2: Intestazioni uniformi *(la più visibile)*
- **Obiettivo:** un solo schema di testata per tutte le schermate.
- **Proposta:** componente `.page-head` cobalto compatto (titolo 30px + sottotitolo 16px + striscia sottile 8px) per Linee, Avvisi, Info, Guida, Privacy; il campo "grande" resta solo per Home, Fermata, Percorso (dove c'è la risposta). La striscia segue lo stato dati su tutte.
- **File:** `js/app.js` (template di `viewLines/Avvisi/Info/Guida/Privacy`), `css/app.css`.
- **Fine:** schermate affiancate (7 screenshot) leggono come una famiglia; titolo sempre nella stessa posizione.
- **Rischio:** medio (altezza testata riduce spazio liste: tenerla ≤120px). **Comando:** `/impeccable layout`.

### Fase 3: Home che risponde subito
- **Obiettivo:** applicare il principio "la risposta prima di tutto".
- **Azioni:** se esiste una fermata preferita o una vicina nota → mostrare direttamente la prossima partenza (riuso del campo `.next`) con cambio fermata; altrimenti un unico CTA primario ("Trova la tua fermata", geolocalizza) e le altre voci come lista compatta secondaria (non 5 cartelle ugualmente pesanti). Rimuovere dal primo schermo l'avviso comunità (spostarlo in Info o in coda alla home).
- **File:** `js/app.js` (`viewHome`), `css/app.css`, `js/i18n.js`.
- **Fine:** con preferiti, risposta ≤3s senza tap; senza preferiti, un solo CTA evidente.
- **Rischio:** medio (cambia flusso; copre il caso primo avvio). **Comando:** `/impeccable shape` poi `/impeccable onboard`.

### Fase 4: Consenso meno invadente
- **Obiettivo:** informare senza coprire il contenuto.
- **Azioni:** banner compatto (2 righe + due pulsanti affiancati da 44px) ancorato sopra la tab bar, oppure inline in testa alla pagina Info e promemoria discreto; mai sovrapposto al comando Legenda; ricordare la scelta (già in `js/consent.js`); testo più breve, link informativa.
- **Vincolo legale:** conservare Rifiuta/Accetta con pari evidenza (non nascondere "Rifiuta").
- **File:** `js/consent.js`, `css/app.css`.
- **Fine:** altezza ≤ 140px a 390px; contenuto sotto ancora utilizzabile (padding dinamico).
- **Rischio:** basso-medio (conformità). **Comando:** `/impeccable harden`.

### Fase 5: Navigazione a 5 voci e terminologia
- **Obiettivo:** tab bar leggera e chiara.
- **Proposta:** Vicino · Linee · Percorso · Mappa · Altro (Avvisi + Guida + Info + Privacy dentro "Altro", con badge sugli avvisi nuovi). Allineare nomi: "Percorso/Journey" ovunque (non "Trip"); etichette ≥13px con testo corto.
- **File:** `index.html`, `js/app.js` (router: tab), `js/i18n.js`, `css/app.css` (`grid-template-columns`), test del router.
- **Fine:** 5 colonne, nessun troncamento in IT/EN; deep link esistenti invariati (QR delle fermate).
- **Rischio:** medio (URL e QR vanno preservati). **Comando:** `/impeccable clarify` + `/impeccable layout`.

### Fase 6: Mappa: gerarchia e quiete
- **Obiettivo:** meno rumore, più lettura.
- **Azioni:** raggruppare i comandi (1 pulsante home spostato nella testata; +/− collassati nel cursore; "Layers" per 3D/linee); sostituire l'ocra del cerchio zoom con neutro/cobalto; tracciati con larghezza variabile per zoom e opacità ridotta per le linee non selezionate; etichette linea con halo e `symbol-sort-key` per evitare sovrapposizioni; legenda raggiungibile sempre (z-index sopra il consenso).
- **File:** `js/map.js`, `css/app.css`.
- **Fine:** a 390px ≤5 controlli visibili; nessuna etichetta linea sovrapposta a zoom 12–14; verifica 2D/3D.
- **Rischio:** medio-alto (MapLibre style). **Comando:** `/impeccable quieter` + `/impeccable adapt`.

### Fase 7: Colore, ritmo e profondità
- **Obiettivo:** più calore senza cambiare palette.
- **Azioni:** applicare 2–3 livelli di superficie (glaze / glaze-2 / glaze-3) invece del piatto uniforme; sezioni con testata a filetto ocra tenue; stati vuoti con piastrella grande monocroma; `ocra-soft` come fondo del blocco "prossima partenza" in lista; verificare contrasto AA di `ink-2` su `glaze-2` (testo 15px) e su cobalto con motivo.
- **File:** `css/app.css`, `js/app.js` (marcature).
- **Fine:** audit contrasto zero fallimenti AA; screenshot chiaro/scuro coerenti.
- **Rischio:** basso. **Comando:** `/impeccable colorize` + `/impeccable typeset`.

### Fase 8: Movimento e piccoli piaceri *(opzionale)*
- **Obiettivo:** attrattività nei momenti giusti, nessun rumore.
- **Azioni:** transizione di vista 150–200ms (View Transitions API dove disponibile, fallback nullo); conteggio minuti che scorre quando cambia; "bus in arrivo" con piastrella pulsante lenta; tap su preferito con piccola animazione piastrella; tutto sotto `prefers-reduced-motion`.
- **Vincolo DESIGN.md:** oggi "una sola animazione `rise`": questa fase **richiede aggiornare la regola**.
- **Fine:** nessuna perdita di frame su telefono lento; test reduced-motion.
- **Rischio:** medio (performance). **Comando:** `/impeccable animate` + `/impeccable delight`.

### Fase 9: Desktop e tablet ≥700px *(opzionale)*
- **Obiettivo:** oggi una colonna da 560px su schermo largo = grandi vuoti.
- **Azioni:** layout a due colonne (lista/ dettaglio; mappa a lato) da 900px; hero a larghezza piena con contenuto centrato.
- **Fine:** tre larghezze verificate (390 / 768 / 1280).
- **Rischio:** medio. **Comando:** `/impeccable adapt`.

### Fase 10: Chiusura e prova
- **Azioni:** `/impeccable polish`; `/impeccable audit` (Lighthouse a11y/perf); aggiornare DESIGN.md (`document`); aggiornare README e screenshot in `img/guida/`; bump `sw.js`; `/impeccable critique` finale per confrontare il punteggio con la baseline.
- **Fine:** nessun P0/P1 aperto; punteggio critique ≥ +4 sul precedente.

---

## 4. Ordine consigliato (se si vuole una sola sequenza)

1 → 2 → 4 → 3 → 5 → 7 → 6 → (8, 9 se utili) → 10.
Motivo: prima si ripulisce la base (1) e si uniforma (2); si toglie ciò che copre (4); poi si cambia flusso (3, 5), che è più rischioso per URL e abitudini.

Se si può fare **una sola fase**: la **2** (uniformità visibile a costo contenuto).
Se se ne possono fare **due**: **2 + 4**.

## 5. Decisioni (confermate dall'utente il 2026-11-14)
1. **Fase 5: sì.** Avvisi, Guida e Info confluiscono in "Altro" (tab bar a 5 voci).
2. **Fase 3: sì.** La home mostra subito la fermata preferita, anche senza geolocalizzazione.
3. **Fase 8: sì.** La regola "una sola animazione" di DESIGN.md va ammorbidita (aggiornare il documento in fase 10).
4. **Google Analytics resta.** La Fase 4 è quindi necessaria: il banner va reso compatto, mantenendo Rifiuta/Accetta con pari evidenza. Nota: il principio 5 di PRODUCT.md ("senza tracking") è già in tensione con GA; valutare in fase 10 se riformularlo ("statistiche anonime solo con consenso").

## 6. Rischi trasversali
- Cache del service worker: ogni modifica a CSS/JS richiede bump di versione (`sw.js`).
- QR e URL per fermata sono un vincolo di prodotto: il router non deve rompere `#/stop/...`.
- Dati: il feed RT non ha corse; non introdurre mai etichette "live" per le partenze.
- Modifiche al CSS vanno verificate in chiaro, scuro (`data-theme` e media query) e IT/EN.
