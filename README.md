# Registro GTFS-RT vehicle_positions, Comune di Marsala

Un file al giorno (UTC) in `data/AAAA-MM-GG.ndjson.gz`, a membri gzip concatenati (`zcat` li legge di fila).
Una riga JSON per tentativo:

- `{"t":<ms>,"b64":"..."}`: protobuf grezzo (base64) ricevuto all'istante `t`
- `{"t":<ms>,"same":1}`: identico al campione precedente
- `{"t":<ms>,"err":"..."}`: tentativo fallito (i buchi sono dati)

Prodotto da `scripts/rt-log.mjs` (ramo `main`). Dati del Comune di Marsala, CC BY 4.0.
