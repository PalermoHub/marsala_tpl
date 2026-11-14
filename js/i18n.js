// Traduzioni italiano / inglese. L'italiano è la lingua di riferimento.

const IT = {
  appName: 'Marsala TPL',
  tabNear: 'Vicino', tabLines: 'Linee', tabMap: 'Mappa', tabInfo: 'Info',
  stop: 'Fermata', toward: 'direzione',
  now: 'ora', min: 'min', inMin: (n) => `tra ${n} min`, inHm: (h, m) => (m ? `tra ${h} h ${m} min` : `tra ${h} h`),
  atTime: (t) => `alle ${t}`,
  scheduled: 'da orario', scheduledNote: 'Orario teorico: non è la posizione del bus.',
  nextAfter: 'Poi', noMoreToday: 'Nessun’altra corsa oggi',
  firstTomorrow: (t) => `Prima corsa domani alle ${t}`,
  noService: 'Oggi non c’è servizio da questa fermata',
  otherDirection: 'Altro senso di marcia',
  addFav: 'Salva fermata', removeFav: 'Rimuovi dai preferiti', share: 'Condividi',
  linkCopied: 'Link copiato',
  yourStops: 'Le tue fermate',
  whereAreYou: 'Dove sei?', whereHelp: 'Scegli una fermata per vedere quando passa il prossimo bus.',
  useLocation: 'Usa la mia posizione', locating: 'Cerco la tua posizione…',
  locDenied: 'Posizione non disponibile. Cerca la fermata per nome.',
  searchStop: 'Cerca una fermata', searchPh: 'Es. Piazza della Repubblica', noResults: 'Nessuna fermata trovata',
  nearYou: 'Vicino a te', mainStops: 'Fermate principali', meters: (m) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`),
  lines: 'Linee', activeToday: 'In servizio oggi', notToday: 'Non in servizio oggi',
  trips: (n) => `${n} corse`,
  stops: 'Fermate', departuresToday: 'Partenze di oggi', firstStopOf: (s) => `Da ${s}`,
  showOnMap: 'Mostra sulla mappa', noTripsToday: 'Nessuna corsa oggi su questa linea',
  mapTitle: 'Mappa', busesRunning: (n) => (n === 1 ? '1 bus in servizio' : `${n} bus in servizio`),
  noBuses: 'Nessun bus in servizio in questo momento', busesIdle: (n) => (n === 1 ? '1 fermo' : `${n} fermi`), busPlate: 'Targa', busUpdated: (h) => `aggiornato alle ${h}`, busActive: 'In servizio', busIdle: 'Fermo, non in servizio', busesNote: 'Posizioni dal feed del Comune. Non indicano la linea né il ritardo.',
  mapOffline: 'La mappa richiede la connessione.', mapError: 'Impossibile caricare la mappa.',
  info: 'Informazioni', validity: 'Validità degli orari', validUntil: (d) => `Orari validi fino al ${d}`,
  feedSoon: (n) => `Gli orari scadono tra ${n} giorni`, feedExpired: 'Gli orari ufficiali sono scaduti: potrebbero non essere aggiornati.',
  offline: 'Offline · orari salvati nel telefono',
  language: 'Lingua', theme: 'Aspetto', themeAuto: 'Automatico', themeLight: 'Chiaro', themeDark: 'Scuro',
  source: 'Fonte dei dati', sourceText: 'Orari e fermate: Comune di Marsala, GTFS pubblicato come dato aperto, licenza CC BY 4.0.',
  notOfficial: 'Questa app non è un servizio ufficiale del Comune di Marsala.',
  reportError: 'Segnala un errore', reportHelp: 'Un orario o una fermata sbagliati? Scrivi al Comune: i dati sono suoi.',
  privacy: 'Privacy', privacyText: 'Nessun tracciamento. La posizione resta nel tuo telefono e non viene mai inviata.',
  corrections: 'Correzioni ai dati', correctionsText: 'Nei giorni festivi il feed del Comune lascia attive corse feriali. L’app le nasconde.',
  version: 'Versione orari', back: 'Indietro', close: 'Chiudi', retry: 'Riprova',
  loadError: 'Non riesco a caricare gli orari.', loadHelp: 'Controlla la connessione e riprova.',
  dir: 'verso',
};

const EN = {
  ...IT,
  tabNear: 'Nearby', tabLines: 'Lines', tabMap: 'Map', tabInfo: 'Info',
  stop: 'Stop', toward: 'toward',
  now: 'now', inMin: (n) => `in ${n} min`, inHm: (h, m) => (m ? `in ${h} h ${m} min` : `in ${h} h`),
  atTime: (t) => `at ${t}`,
  scheduled: 'scheduled', scheduledNote: 'Scheduled time, not the bus’s actual position.',
  nextAfter: 'Then', noMoreToday: 'No more buses today',
  firstTomorrow: (t) => `First bus tomorrow at ${t}`,
  noService: 'No service from this stop today',
  otherDirection: 'Other direction',
  addFav: 'Save stop', removeFav: 'Remove from saved', share: 'Share', linkCopied: 'Link copied',
  yourStops: 'Your stops',
  whereAreYou: 'Where are you?', whereHelp: 'Pick a stop to see when the next bus comes.',
  useLocation: 'Use my location', locating: 'Finding your location…',
  locDenied: 'Location unavailable. Search for the stop by name.',
  searchStop: 'Search for a stop', searchPh: 'E.g. Piazza della Repubblica', noResults: 'No stops found',
  nearYou: 'Near you', mainStops: 'Main stops',
  lines: 'Lines', activeToday: 'Running today', notToday: 'Not running today', trips: (n) => `${n} trips`,
  stops: 'Stops', departuresToday: 'Today’s departures', firstStopOf: (s) => `From ${s}`,
  showOnMap: 'Show on map', noTripsToday: 'No trips today on this line',
  mapTitle: 'Map', busesRunning: (n) => (n === 1 ? '1 bus running' : `${n} buses running`),
  noBuses: 'No buses running right now', busesIdle: (n) => (n === 1 ? '1 parked' : `${n} parked`), busPlate: 'Plate', busUpdated: (h) => `updated at ${h}`, busActive: 'In service', busIdle: 'Parked, not in service', busesNote: 'Positions from the city’s feed. They do not show the line or delays.',
  mapOffline: 'The map needs a connection.', mapError: 'Could not load the map.',
  info: 'About', validity: 'Timetable validity', validUntil: (d) => `Timetables valid until ${d}`,
  feedSoon: (n) => `Timetables expire in ${n} days`, feedExpired: 'The official timetables have expired and may be out of date.',
  offline: 'Offline · timetables saved on your phone',
  language: 'Language', theme: 'Appearance', themeAuto: 'Automatic', themeLight: 'Light', themeDark: 'Dark',
  source: 'Data source', sourceText: 'Timetables and stops: Comune di Marsala, open GTFS data, CC BY 4.0 licence.',
  notOfficial: 'This app is not an official service of the Comune di Marsala.',
  reportError: 'Report a mistake', reportHelp: 'Wrong time or stop? Write to the Comune: the data is theirs.',
  privacy: 'Privacy', privacyText: 'No tracking. Your location stays on your phone and is never sent anywhere.',
  corrections: 'Data corrections', correctionsText: 'On public holidays the city’s feed leaves weekday trips active. The app hides them.',
  version: 'Timetable version', back: 'Back', close: 'Close', retry: 'Retry',
  loadError: 'Could not load the timetables.', loadHelp: 'Check your connection and try again.',
  dir: 'toward',
};

const DICT = { it: IT, en: EN };
let lang = 'it';

export function setLang(l) { lang = DICT[l] ? l : 'it'; document.documentElement.lang = lang; }
export function getLang() { return lang; }
export function detectLang(saved) {
  if (saved && DICT[saved]) return saved;
  return (navigator.language || 'it').toLowerCase().startsWith('it') ? 'it' : 'en';
}
/** t('key') o t('key', arg1, arg2) per le voci che sono funzioni. */
export function t(key, ...a) {
  const v = DICT[lang][key] ?? IT[key] ?? key;
  return typeof v === 'function' ? v(...a) : v;
}
