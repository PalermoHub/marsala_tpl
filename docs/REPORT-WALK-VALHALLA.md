# Distanze a piedi: app contro Valhalla (2026-11-14, locale)

Metodo: 40 coppie (punto a 150-900 m in linea d'aria da una fermata scelta a caso, seme 42). Distanza dell'app = `walkFrom()` su `dati/walk.json`; riferimento = Valhalla `pedestrian` (server pubblico valhalla1.openstreetmap.de, dati OSM). Inviate solo coordinate. Script e dati grezzi: `docs/fase1/diff/walk-valhalla.mjs`, `walk-valhalla-out.json`.

| Misura | Valore |
|---|---|
| Coppie con risposta | 40/40 |
| App − Valhalla, mediana | +41 m (p10 +5, p90 +178, min −14, max +279) |
| App / Valhalla, mediana | 1,06 (p10 1,00, p90 1,49) |
| Entro ±10% / ±20% | 24 / 26 su 40 |
| Linea d'aria / Valhalla, mediana | 0,78 |
| App più lunga di Valhalla (>5 m) | 36 su 40; più corta: 1 |

Lettura: l'app non sottostima i metri, tende a sovrastimarli (mai di molto in centro). La linea d'aria li sottostimava del 22%, quindi la correzione di Fase 2 va nella direzione giusta.
I 6 casi peggiori (+167…+279 m) sono tutti fermate di contrada (Ponte Fiumarella, Spagnola, Bufalata, Via dei Platani…) dove Valhalla dà quasi la linea d'aria: passa per tratti che l'app non ha nel grafo. Causa indagata:
- Non è il filtro dei tag. `build-walk.mjs` esclude solo autostrade/superstrade, `access=private|no` e `foot=no`; nel caso peggiore (Ponte Fiumarella) una query Overpass sull'area non trova vie escluse (92 vie, nessuna esclusa). Due altre query sono fallite per Overpass saturo: gli altri casi non sono controllati.
- È l'aggancio al **nodo** invece che al segmento: `nearestNode()` sceglie il nodo del grafo più vicino (non il punto sulla strada), e in contrada i nodi distano centinaia di metri. Distanza di aggancio (punto + fermata) media: 110 m nei 10 casi peggiori, 58 m negli altri 30. Correlazione tra scarto e aggancio: 0,75 (40 coppie).
- Resta un'ipotesi forte, non una prova causale: non ho riprovato il calcolo con l'aggancio al segmento.
Correzione possibile (modifica all'app, non fatta): agganciare punto e fermata al segmento più vicino. Effetto atteso: scarto mediano sotto i +41 m e casi peggiori molto ridotti.

Limiti: 40 coppie non sono rappresentative dei residenti; Valhalla è un altro modello su OSM, non la realtà (il campo è escluso); stessi dati OSM, quindi errori di OSM non emergono.

## Dopo la correzione (aggancio al segmento, 2026-11-14)
Stesse 40 coppie, stesso seme. `js/walk.js`: `nearestEdge()` al posto di `nearestNode()`; partenza dai due capi dell'arco; test aggiunto (arco lungo) e riferimento Python rigenerato con aggancio al segmento (`docs/fase1/diff/walk-ref-segmento.py`). Test: 23/23.

| Misura | Prima | Dopo |
|---|---|---|
| App − Valhalla, mediana | +41 m | +34 m |
| p90 | +178 m | +86 m |
| max | +279 m | +113 m |
| App / Valhalla, mediana (p90) | 1,06 (1,49) | 1,05 (1,24) |
| Entro ±10% / ±20% | 24 / 26 | 30 / 34 |

Resta una sovrastima mediana di ~34 m (5%): non spiegata, probabilmente il modello di Valhalla (attraversamenti, percorsi su aree pedonali). Dati: `docs/fase1/diff/walk-valhalla-dopo.json`.
