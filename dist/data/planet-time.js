// Planet clock speed: how many minutes of a planet's local time (the galaxy map's SEST)
// pass in one real minute. Not on the wiki: measured in game on the galaxy map on
// 2026-11-24 for the 42 planets with an open front that day (user's own measurement; the fast planets were
// re-read that afternoon about one planet day apart, so their average covers the speed changing through the day).
// rate < 0 = the clock runs backwards. averagedMinutes = rate is the average over a second
// reading that many real minutes later; without it, two readings 45 seconds apart.
export const planetTimeMeasuredAt = '2026-11-24';
export const planetTimeScales = [
  {"en": "ALAMAK VII", "rate": 59.33, "averagedMinutes": 57},
  {"en": "ALARAPH", "rate": 37.88, "averagedMinutes": 58},
  {"en": "GRAFMERE", "rate": 27.23, "averagedMinutes": 42},
  {"en": "HALDUS", "rate": 22.42, "averagedMinutes": 66},
  {"en": "CHARON PRIME", "rate": 22.39, "averagedMinutes": 63},
  {"en": "ASPEROTH PRIME", "rate": 22.37, "averagedMinutes": 82},
  {"en": "BORE ROCK", "rate": 22.12, "averagedMinutes": 64},
  {"en": "SANGIS", "rate": 21.39, "averagedMinutes": 93},
  {"en": "LUXURIANT", "rate": 21.24, "averagedMinutes": 61},
  {"en": "VALMOX", "rate": 21.21, "averagedMinutes": 45},
  {"en": "X-45", "rate": 21.2, "averagedMinutes": 74},
  {"en": "ALDERIDGE COVE", "rate": 20.24, "averagedMinutes": 60},
  {"en": "BRILLIANCE", "rate": 19.64, "averagedMinutes": 41},
  {"en": "HERTHON SECUNDUS", "rate": -18.66, "averagedMinutes": 54},
  {"en": "NIVEL 43", "rate": 18.01, "averagedMinutes": 44},
  {"en": "MERGA IV", "rate": 15.96, "averagedMinutes": 75},
  {"en": "BLISTICA", "rate": -15.79, "averagedMinutes": 82},
  {"en": "MINTORIA", "rate": 14.02, "averagedMinutes": 37},
  {"en": "IRO", "rate": 13.83, "averagedMinutes": 45},
  {"en": "TRANDOR", "rate": 13.08, "averagedMinutes": 53},
  {"en": "KHANDARK", "rate": 12.96, "averagedMinutes": 76},
  {"en": "SETIA", "rate": 12.75, "averagedMinutes": 88},
  {"en": "ROGUE 5", "rate": 5.12, "averagedMinutes": 51},
  {"en": "CHOEPESSA IV", "rate": 3.67, "averagedMinutes": 37},
  {"en": "KEID", "rate": 2.37, "averagedMinutes": 82},
  {"en": "HEZE BAY", "rate": 1.84, "averagedMinutes": 69},
  {"en": "MENKENT", "rate": 1.77, "averagedMinutes": 45},
  {"en": "MATAR BAY", "rate": 1.64, "averagedMinutes": 44},
  {"en": "MEISSA", "rate": 1.53, "averagedMinutes": 30},
  {"en": "OVERGOE PRIME", "rate": 1.52, "averagedMinutes": 54},
  {"en": "CHOOHE", "rate": 1.5, "averagedMinutes": 46},
  {"en": "GENESIS PRIME", "rate": 1.39, "averagedMinutes": 70},
  {"en": "ALAIRT III", "rate": 1.35, "averagedMinutes": 68},
  {"en": "SIEMNOT", "rate": 1.19, "averagedMinutes": 71},
  {"en": "HESOE PRIME", "rate": 1.14, "averagedMinutes": 68},
  {"en": "USTOTU", "rate": 1.12, "averagedMinutes": 30},
  {"en": "MARTALE", "rate": 1.11, "averagedMinutes": 43},
  {"en": "PEACOCK", "rate": 1.04, "averagedMinutes": 55},
  {"en": "K", "rate": 0.98, "averagedMinutes": 37},
  {"en": "RD-4", "rate": 0.95, "averagedMinutes": 67},
  {"en": "AURORA BAY", "rate": 0.87, "averagedMinutes": 47},
  {"en": "OMICRON", "rate": 0.87, "averagedMinutes": 54}
];
