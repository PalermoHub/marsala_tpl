// Coincidenze con treni, pullman extraurbani e aeroporti.
// Fonte: pagina del Comune https://www.comune.marsala.tp.it/it/page/413680 (letta il 15/11/2026).
// Dati a mano, solo giorni feriali; gli orari dei treni sono quelli programmati da RFI, quelli dei pullman sono indicativi.
// Testi come [it, en]; le tabelle di orari non hanno bisogno di traduzione.

export const FONTE = 'https://www.comune.marsala.tp.it/it/page/413680';

// Numero di linea → id della linea nel feed (si usa solo se è presente nel feed caricato).
export const LINEA_ID = { 1: '1925', 2: '1930', 3: '1906', 4: '1909', 5: 'INV_1947', 6: '1905' };

export const STAZIONI = [
  // [nome, linee, sensi, distanza m, note]
  { n: 'Marsala', lines: '2 · 5 · 6', m: 0, stop: '20984', d: ['Viale Fazio: in andata passano le linee 2, 5 e 6; al ritorno da Corso Calatafimi (a circa 100 m) passano 1, 2, 5 e 6.', 'Viale Fazio: lines 2, 5 and 6 pass on the outbound run; on the way back lines 1, 2, 5 and 6 pass on Corso Calatafimi (about 100 m).'] },
  { n: 'Terrenove', lines: '1', m: 60, d: ['Fermata C.da Fossarunza, solo in andata: corse delle 6.25, 8.00, 12.50 e 14.40 da Piazza del Popolo. Le corse delle 10.40 e 17.00 seguono la SS.115 e non ci passano.', 'C.da Fossarunza stop, outbound only: the 6.25, 8.00, 12.50 and 14.40 runs from Piazza del Popolo. The 10.40 and 17.00 runs take the SS.115 and skip it.'] },
  { n: 'Petrosino-Strasatti', lines: '1', m: 220, d: ['Fermata Via dei Platani, solo al ritorno: tutte e sei le corse dal capolinea. Da Strasatti o Bivio Triglia si va a Mazara e Castelvetrano senza passare da Marsala.', 'Via dei Platani stop, return only: all six runs from the terminus. From Strasatti or Bivio Triglia you can reach Mazara and Castelvetrano without going through Marsala.'] },
  { n: 'Spagnuola', lines: '4', m: 100, d: ['Fermata C.da Spagnola, in entrambi i sensi.', 'C.da Spagnola stop, both directions.'] },
  { n: 'Mozia-Birgi', lines: '4', m: 110, d: ['Fermata C.da Birgi, in entrambi i sensi. È la stazione più vicina all’aeroporto (circa 1,6 km) e la più servita: oltre venti treni al giorno.', 'C.da Birgi stop, both directions. It is the closest station to the airport (about 1.6 km) and the busiest: over twenty trains a day.'] },
];

// Dalle contrade al treno: [treno, [linea, partenza dal capolinea][]]
export const AL_TRENO = [
  ['08.21', 'Trapani', [['1', '7.05'], ['5/6', '7.10'], ['2', '7.25']]],
  ['09.12', 'Trapani', [['2', '8.45']]],
  ['10.32', 'Trapani', [['2', '10.00']]],
  ['11.50', 'Trapani', [['5/6', '11.00']]],
  ['12.25', 'Piraineto', [['1', '11.10']]],
  ['13.49', 'Trapani', [['2', '13.15']]],
  ['14.16', 'Castelvetrano', [['5/6', '13.35']]],
  ['16.35', 'Trapani', [['1', '15.25'], ['2', '16.10']]],
  ['18.02', 'Castelvetrano', [['2', '17.15'], ['5/6', '17.25']]],
  ['18.22', 'Trapani', [['1', '17.30']]],
];

export const PULLMAN = [
  { az: 'AST', t: ['Marsala · Aeroporto Vincenzo Florio · Paceco · Trapani', 'Marsala · Vincenzo Florio Airport · Paceco · Trapani'], d: ['Lun-sab. Da Trapani coincidenze per Erice, Valderice, Custonaci e San Vito Lo Capo (feriali).', 'Mon-Sat. From Trapani, connections to Erice, Valderice, Custonaci and San Vito Lo Capo (weekdays).'] },
  { az: 'AST', t: ['Marsala · Terrenove · Strasatti · Mazara del Vallo · Castelvetrano', 'Marsala · Terrenove · Strasatti · Mazara del Vallo · Castelvetrano'], d: ['Alcune corse proseguono per Santa Ninfa e Partanna. Fermate a Marsala (stazione, Viale Fazio), Terrenove e Strasatti. Gli orari si riducono d’estate.', 'Some runs continue to Santa Ninfa and Partanna. Stops in Marsala (station, Viale Fazio), Terrenove and Strasatti. Timetables are reduced in summer.'] },
  { az: 'Autoservizi Salemi', t: ['Marsala · Aeroporto Florio · Mazara · Castelvetrano · Salemi · Aeroporto di Palermo · Palermo', 'Marsala · Florio Airport · Mazara · Castelvetrano · Salemi · Palermo Airport · Palermo'], d: ['Tutti i giorni, dal capolinea di Viale Fazio. Non tutte le corse fanno tutte le fermate.', 'Every day, from the Viale Fazio terminus. Not every run makes every stop.'] },
  { az: 'Autoservizi Salemi', t: ['Marsala · Mandriglie (urbana)', 'Marsala · Mandriglie (local)'], d: ['Feriali, da Piazza del Popolo come le linee comunali: Amabilina, Misilla, Paolini, Casazze, Perinello, Perino Maletto, Mandriglie.', 'Weekdays, from Piazza del Popolo like the municipal lines: Amabilina, Misilla, Paolini, Casazze, Perinello, Perino Maletto, Mandriglie.'] },
];

// Stesso schema dei treni: un pullman per riga, con l'autobus comunale da prendere e quando parte.
// [pullman, [[linea, partenza dell'autobus]...]]. Pullman: "ora destinazione · azienda (nota)". Solo feriali.
// Dall'autobus comunale al pullman (entro circa mezz'ora dalla partenza dell'autobus).
export const A_PULLMAN = [
  ['6.45 Palermo · Salemi', [['5/6', '6.35']]],
  ['6.50 Trapani · AST', [['5/6', '6.35']]],
  ['7.00 Palermo · Salemi', [['5/6', '6.35']]],
  ['7.30 Palermo · Salemi (lun-ven)', [['2', '6.55']]],
  ['8.10 Trapani · AST (coincidenza stretta)', [['5/6', '8.00']]],
  ['8.30 Palermo · Salemi', [['5/6', '8.00'], ['2', '8.15']]],
  ['10.00 Palermo · Salemi (lun-ven)', [['2', '9.30']]],
  ['10.30 Palermo · Salemi (lun-ven)', [['5/6', '10.15']]],
  ['13.00 Palermo · Salemi (coincidenza stretta)', [['2', '12.45'], ['5/6', '12.50']]],
  ['13.25 Trapani · AST', [['2', '12.45'], ['5/6', '12.50']]],
  ['13.55 Mazara-Castelvetrano · AST', [['2', '13.15 (ritorno)']]],
  ['14.00 Palermo · Salemi', [['2', '13.15 (ritorno)']]],
  ['14.25 Trapani · AST', [['2', '13.15 (ritorno)']]],
  ['15.20 Mazara · AST', [['2/5/6', '14.40']]],
  ['17.00 Palermo · Salemi', [['2/5/6', '16.45']]],
];

// Dal pullman all'autobus comunale: arrivi in Viale Fazio.
export const DA_PULLMAN = [
  ['6.50 da Mazara · AST', [['2', '6.55']]],
  ['7.50 da Trapani · AST', [['5/6', '8.00'], ['2', '8.15']]],
  ['8.10 da Castelvetrano-Mazara · AST', [['2', '8.15']]],
  ['9.05 da Palermo · Salemi', [['2', '9.30']]],
  ['10.05 da Palermo · Salemi', [['5/6', '10.15']]],
  ['12.25 da Palermo · Salemi', [['2', '12.45'], ['5/6', '12.50']]],
  ['12.40 da Palermo · Salemi', [['2', '12.45'], ['5/6', '12.50']]],
  ['14.25 da Castelvetrano-Mazara · AST', [['2/5/6', '14.40']]],
  ['14.25 da Palermo · Salemi', [['2/5/6', '14.40']]],
  ['15.20 da Trapani · AST', [['2', '15.45']]],
  ['15.25 da Palermo · Salemi', [['2', '15.45']]],
  ['16.30 da Palermo · Salemi', [['2/5/6', '16.45']]],
  ['16.35 da Palermo · Salemi', [['2/5/6', '16.45']]],
];

export const LINK = [
  ['https://prm.rfi.it/qo_prm/QO_Partenze_SiPMR.aspx?Id=1543&lin=&dalle=00.00&alle=24.00&ora=00.00&guid=', ['Partenze treni da Marsala (RFI)', 'Train departures from Marsala (RFI)'], 'clock'],
  ['https://www.trenitalia.com/', ['Biglietti treno (Trenitalia)', 'Train tickets (Trenitalia)'], 'external'],
  ['http://www.aziendasicilianatrasporti.it:8080/', ['Orari AST: scegli Marsala, Terrenove o Strasatti', 'AST timetables: pick Marsala, Terrenove or Strasatti'], 'bus'],
  ['https://www.autoservizisalemi.it/orari/MARSALA-PALERMO.pdf', ['Salemi: orario Marsala-Palermo (PDF)', 'Salemi: Marsala-Palermo timetable (PDF)'], 'external'],
  ['https://www.autoservizisalemi.it/orari/PALERMO-MARSALA.pdf', ['Salemi: orario Palermo-Marsala (PDF)', 'Salemi: Palermo-Marsala timetable (PDF)'], 'external'],
  ['https://www.autoservizisalemi.it/orari/Marsala_Urbano-1-1.pdf', ['Salemi: linea urbana Marsala-Mandriglie (PDF)', 'Salemi: local line Marsala-Mandriglie (PDF)'], 'external'],
  ['https://www.airgest.it/', ['Aeroporto Vincenzo Florio Trapani-Birgi', 'Trapani-Birgi airport'], 'external'],
  ['https://www.aeroportodipalermo.it/', ['Aeroporto di Palermo Falcone e Borsellino', 'Palermo Falcone and Borsellino airport'], 'external'],
];
