# Mappa 3D: edifici e bus reali (design breve, approvato)

**Perché.** Rendere la mappa simile al Palermo Digital Twin: edifici in rilievo e mezzi in 3D. Solo mezzi reali del feed RT, nessuna simulazione.

**Obiettivi.** Pulsante 3D (default 2D); bus reali come `fill-extrusion`; edifici GBA grigi estrusi; tema scuro; attribuzione.
**Non obiettivi.** Ombre, simulazione da orario, bussola/inclinazione extra.
**Anti-obiettivo.** Peggiorare caricamento o resa del 2D.

**Approcci.** (1) edifici da OpenFreeMap: altezze assenti a Marsala, scartato. (2) GBA completo 21 MB: troppo pesante. (3) GBA ritagliato a ~150 m dai percorsi, caricato al primo uso del 3D: scelto.

**Design.**
- `js/map.js`: `buses-body`/`buses-nose` diventano `fill-extrusion` (corpo ~3 m, muso ~3,3 m) solo in 3D, restano `fill` in 2D. Pulsante 3D: pitch ~60°, layer `buildings-3d` da zoom 13, altezza `max(height, 3)`.
- `dati/edifici3d.json`: dati GBA ritagliati e arrotondati, nella cache SW, scaricati lazy. Se > 4-5 MB, semplificare.
- Colori edifici adattati a stile chiaro/scuro. Attribuzione "GlobalBuildingAtlas (TUM), CC BY-NC 4.0 / ODbL".
- Sorgente dati: `~/dati_3d/marsala_gba/out/marsala_lod1_bbox.geojson`; script di ritaglio in `scripts/`.

**Lasciato al builder.** Soglie esatte di semplificazione, colori, testo i18n del pulsante, versione cache SW.
