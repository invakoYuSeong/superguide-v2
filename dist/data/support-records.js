// The datamine projectile record (db/source/weapons_data.json) of each support weapon mode's own
// hit, by weapon and combat mode id (combat-data.js weaponProfiles), for range falloff and the
// detailed stats block. scripts/test-support.mjs checks them against its datamine mapping.
export const supportProjectileRecords = {
  autocannon: { aphet: 'AC-8_P', flak: 'AC-8_P1' }, recoilless: { heat: 'GR-8_P', he: 'GR-8_P1' },
  'machine-gun': { standard: 'MG-43_P' }, stalwart: { standard: 'AR-23_P' }, 'heavy-machine-gun': { standard: 'MG-206_P' },
  'anti-materiel': { standard: 'APW-1_P' }, apex: { standard: 'AMW-20_P' }, maxigun: { standard: 'M-1000_P' },
  'bullet-storm': { standard: 'MGX-42_P' }, 'expendable-at': { standard: 'EAT-17_P' }, quasar: { standard: 'LAS-99_P' },
  nova: { standard: 'LAS-44_P' }, spear: { impact: 'FAF-14_P' }, commando: { standard: 'MLS-4X_P' },
  leveller: { standard: 'EAT-411_P' }, 'expendable-napalm': { standard: 'EAT-700_P' },
  railgun: { safe: 'RS-422_P', 'unsafe-max': 'RS-422_P' }, epoch: { standard: 'PLAS-45_P', charged: 'P3' },
  'grenade-launcher': { standard: 'GL-21_P' }, 'belt-fed-gl': { standard: 'GL-28_P' },
  'airburst-launcher': { flak: 'RL-77_P', cluster: 'RL-77_P2' }, wasp: { submunitions: 'StA-X3_P1' }, speargun: { direct: 'S-11_P' },
};

// Modes whose shot keeps its speed in flight (rocket-propelled), so range does not reduce its
// damage even though its record has drag (user decision 2026-11-23: the Leveller).
export const propelledModes = { leveller: ['standard'] };
