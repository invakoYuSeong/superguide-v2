// Support weapons against the wiki datamine snapshot (db/source/weapons_data.json):
// the combat profiles the engine uses (combat-data.js weaponProfiles) and the
// numbers the stratagem table shows (data-support.js). Every engine mode and every
// table row is tied to datamine records below or listed in notCompared with a
// reason, so a new mode or row cannot slip through unchecked. A value that differs
// from the datamine must be listed in `reviewed` with both values and the reason;
// an entry that no longer differs fails too, so the list stays current.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { weaponProfiles, unsupportedWeapons } from '../dist/data/combat-data.js';
import { support } from '../dist/data/data-support.js';
import { demolitionProfiles } from '../dist/data/demolition-data.js';

const snapshot = JSON.parse(await readFile(new URL('../db/source/weapons_data.json', import.meta.url), 'utf8'));
const { damage, projectile, explosion, beam, arc, spray, weapons } = snapshot.data;
let checks = 0;
const failures = [];   // collected so one run lists every difference
const ok = (value, message) => { checks++; if (!value) failures.push(message); return value; };

// --- Datamine lookups ------------------------------------------------------------------
const damageOf = (id, where) => ok(damage[id], `${where}: datamine damage ${id} exists`) ? damage[id] : null;
const hitOf = ([kind, id], where) => {
  if (kind === 'damage') return damageOf(id, where);
  const table = { projectile, beam, arc, spray }[kind];
  return ok(table?.[id], `${where}: datamine ${kind} ${id} exists`) ? damageOf(table[id].damage_id, where) : null;
};
const blastOf = (id, where) => {
  if (!ok(explosion[id], `${where}: datamine explosion ${id} exists`)) return null;
  const hit = damageOf(explosion[id].damage_id, where);
  return hit && { ...hit, r1: explosion[id].r1, r2: explosion[id].r2 };
};
// The explosion a record triggers on impact, if any.
const impactOf = (spec, where) => {
  if (spec.blast && spec.blast !== 'impact') return blastOf(spec.blast, where);
  const id = spec.blast === 'impact' && spec.hit?.[0] === 'projectile' ? projectile[spec.hit[1]]?.explode_on_impact_id : null;
  return id ? blastOf(id, where) : null;
};
// Charged shots: the last damage multiplier of the weapon's charge table.
const chargeMultiplier = name => {
  const multipliers = weapons[name]?.charge?.proj_multipliers?.damage_mod;
  return ok(multipliers, `${name}: datamine charge multipliers exist`) ? multipliers.at(-1) : NaN;
};

// --- Which datamine records each engine mode stands for ---------------------------------
// hit: the record of the direct hit; blast: 'impact' (the explosion that record
// triggers) or an explosion id; bomblet: the projectile of one bomblet or fragment;
// mult: a charge multiplier applied to the direct hit.
const shot = (id, extra = {}) => ({ hit: ['projectile', id], blast: 'impact', ...extra });
const engine = {
  autocannon: { aphet: shot('AC-8_P'), flak: shot('AC-8_P1', { bomblet: 'AC-8_P2' }) },
  recoilless: { heat: shot('GR-8_P'), he: shot('GR-8_P1') },
  'machine-gun': { standard: shot('MG-43_P') },
  stalwart: { standard: shot('AR-23_P') },
  'heavy-machine-gun': { standard: shot('MG-206_P') },
  'anti-materiel': { standard: shot('APW-1_P') },
  apex: { standard: shot('AMW-20_P') },
  maxigun: { standard: shot('M-1000_P') },
  'bullet-storm': { standard: shot('MGX-42_P') },
  'expendable-at': { standard: shot('EAT-17_P') },
  quasar: { standard: shot('LAS-99_P') },
  nova: { standard: shot('LAS-44_P') },
  spear: { impact: shot('FAF-14_P') },
  commando: { standard: shot('MLS-4X_P') },
  leveller: { standard: shot('EAT-411_P') },
  'expendable-napalm': { standard: shot('EAT-700_P') },
  railgun: { safe: shot('RS-422_P'), 'unsafe-max': shot('RS-422_P', { mult: chargeMultiplier('RS-422 RAILGUN') }) },
  epoch: { standard: shot('PLAS-45_P'), charged: shot('P3', { mult: chargeMultiplier('PLAS-45 EPOCH') }) },
  'grenade-launcher': { standard: shot('GL-21_P') },
  'belt-fed-gl': { standard: shot('GL-28_P') },
  'airburst-launcher': { flak: shot('RL-77_P', { bomblet: 'RL-77_P1' }), cluster: shot('RL-77_P2', { bomblet: 'RL-77_P3' }) },
  wasp: { submunitions: shot('StA-X3_P1', { bomblet: 'StA-X3_P' }) },
  speargun: { direct: shot('S-11_P') },
  'arc-thrower': { 'first-target': { hit: ['arc', 'ARC-3 ARC THROWER_A'] } },
  'de-escalator': { arc: { hit: ['arc', 'GL-52_P_IE_A'] } },
  meltagun: { near: { hit: ['beam', '40-K MELTAGUN_B'] } },
  'one-true-flag': { melee: { hit: ['damage', 'CQC-1 ONE TRUE FLAG_dm'] } },
  'breaching-hammer': {
    melee: { hit: ['damage', 'CQC-20 BREACHING HAMMER_dm'] },
    explosive: { hit: ['damage', 'CQC-20 BREACHING HAMMER_dm'], blast: 'CQC-20 BREACHING HAMMER_IE' },
  },
  'c4-pack': { charge: { blast: 'B/MD C4 PACK_E' } },
};

// --- Which datamine records each stratagem-table row stands for --------------------------
// Rows default to the engine spec of the same weapon (first mode, or the variant's id).
const table = {
  wasp: shot('StA-X3_P'),
  'breaching-hammer': { hit: ['damage', 'CQC-20 BREACHING HAMMER_dm'], blast: 'CQC-20 BREACHING HAMMER_IE' },
  'airburst-launcher': engine['airburst-launcher'].flak,
  'airburst-launcher:rocket': engine['airburst-launcher'].flak,
  'airburst-launcher:bomblet': shot('RL-77_P1'),
  'laser-cannon': { hit: ['beam', 'LAS-98 LASER CANNON_B'] },
  sterilizer: { hit: ['spray', 'TX-41 STERILIZER_S'] },
  'defoliation-tool': { hit: ['damage', 'CQC-9 DEFOLIATION TOOL_dm'] },
};

const notCompared = {
  'engine:meltagun/max-range': 'The 40% falloff at 15 m comes from the wiki page; the datamine has no range falloff.',
  'engine:solo-silo/standard': 'MS-11 Solo Silo is not in the datamine snapshot.',
  'table:solo-silo': 'MS-11 Solo Silo is not in the datamine snapshot.',
  'table:de-escalator': 'The table shows no single direct value (sources conflict); the engine arc mode is checked.',
  'table:flamethrower': 'The table shows the wiki page DPS; the datamine stores one spray particle.',
  'table:cremator': 'The table shows the wiki page DPS; the datamine stores one spray particle.',
};

// Values that differ from the datamine on purpose, checked by hand.
const reviewed = {
  'engine:grenade-launcher/standard.hit.standard': { site: 0, datamine: 20, why: 'The wiki page and patch notes give the grenade 0 direct damage; the datamine record still holds 20.' },
  'engine:grenade-launcher/standard.hit.durable': { site: 0, datamine: 2, why: 'Same as the direct damage: 0 per the wiki page.' },
  'engine:grenade-launcher/standard.hit.ap': { site: 4, datamine: 0, why: 'With 0 direct damage the direct AP has no effect.' },
  'table:grenade-launcher.hit.direct': { site: 0, datamine: 20, why: 'Same as the engine: 0 direct damage per the wiki page.' },
  'table:grenade-launcher.hit.ap': { site: 3, datamine: 0, why: 'The table shows the explosion AP 3 for a weapon with no direct damage.' },
  'table:defoliation-tool.hit.ap': { site: 5, datamine: 3, why: 'AP rises from 3 to 5 over 0.5 s of contact (wiki page); the datamine holds the starting 3.' },
};

// --- Comparison ----------------------------------------------------------------------------
const seenReviewed = new Set();
function same(key, site, datamine, label) {
  if (site === undefined || site === null) return;
  const equal = Math.abs(site - datamine) < 1;   // 562.5 is stored as 562; radii keep float noise
  const entry = reviewed[key];
  if (entry) {
    seenReviewed.add(key);
    ok(!equal, `${key}: reviewed difference no longer differs (${site}); remove it from reviewed`);
    ok(entry.site === site && Math.abs(entry.datamine - datamine) < 1, `${key}: reviewed as ${entry.site} vs ${entry.datamine}, now ${site} vs ${datamine}`);
    return;
  }
  ok(equal, `${label}: site ${site}, datamine ${datamine} (${key})`);
}

function compareHit(prefix, spec, values, where) {
  if (!spec.hit) return;
  const hit = hitOf(spec.hit, where);
  if (!hit) return;
  const mult = spec.mult ?? 1;
  for (const [field, value] of Object.entries(values.hit)) same(`${prefix}.hit.${field}`, value, field === 'ap' ? hit.ap1 : field === 'durable' ? hit.dmg2 * mult : hit.dmg * mult, `${where} ${field}`);
}
function compareBlast(prefix, spec, values, where) {
  const blast = impactOf(spec, where);
  if (!blast) {
    ok(!values.blast.damage, `${where}: shows explosion damage ${values.blast.damage} but its datamine records have no explosion`);
    return;
  }
  const source = { damage: blast.dmg, durable: blast.dmg2, ap: blast.ap1, innerRadius: blast.r1, radius: blast.r2 };
  for (const [field, value] of Object.entries(values.blast)) same(`${prefix}.blast.${field}`, value, source[field], `${where} explosion ${field}`);
}

// Engine profiles.
for (const [weaponId, profile] of Object.entries(weaponProfiles)) {
  for (const mode of profile.modes) {
    if (mode.unsupported) continue;   // a mode with no numbers, shown as not calculated
    const key = `engine:${weaponId}/${mode.id}`;
    if (notCompared[key]) continue;
    const spec = engine[weaponId]?.[mode.id];
    if (!ok(spec, `${key}: tie this engine mode to datamine records in scripts/test-support.mjs, or list it in notCompared`)) continue;
    const hit = mode.beam ? { standard: mode.beam.standardPerSecond, durable: mode.beam.durablePerSecond, ap: mode.ap } : { standard: mode.standard, durable: mode.durable, ap: mode.ap };
    compareHit(key, spec, { hit }, key);
    if (!spec.hit) ok(!mode.standard, `${key}: direct damage ${mode.standard} with no datamine hit record`);
    compareBlast(key, spec, { blast: { damage: mode.explosion, durable: mode.explosionDurable, ap: mode.explosion ? mode.explosionAp : undefined, innerRadius: mode.innerRadius, radius: mode.radius } }, key);
    if (spec.bomblet) {
      const bombletSpec = shot(spec.bomblet);
      const b = mode.bomblet;
      if (!ok(b, `${key}: datamine has a bomblet record but the mode has no bomblet`)) continue;
      compareHit(`${key}.bomblet`, bombletSpec, { hit: { standard: b.standard, durable: b.durable, ap: b.ap } }, `${key} bomblet`);
      compareBlast(`${key}.bomblet`, bombletSpec, { blast: { damage: b.explosion, durable: b.explosionDurable, ap: b.explosion ? b.explosionAp : undefined, innerRadius: b.innerRadius, radius: b.radius } }, `${key} bomblet`);
    } else ok(!mode.bomblet, `${key}: has bomblet numbers but no datamine bomblet record is tied to it`);
  }
}
for (const weaponId of Object.keys(engine)) ok(weaponProfiles[weaponId], `${weaponId}: engine spec for a weapon with no combat profile`);

// Stratagem table rows and their variants.
for (const item of support) {
  const rows = [{ key: item.id, row: item, spec: table[item.id] ?? (engine[item.id] && Object.values(engine[item.id])[0]) }];
  for (const variant of item.variants || []) rows.push({ key: `${item.id}:${variant.id}`, row: variant, spec: table[`${item.id}:${variant.id}`] ?? engine[item.id]?.[variant.id] });
  for (const { key, row, spec } of rows) {
    const prefix = `table:${key}`;
    if (notCompared[prefix] || (key !== item.id && notCompared[`table:${item.id}`])) continue;
    if (!ok(spec, `${prefix}: tie this stratagem table row to datamine records in scripts/test-support.mjs, or list it in notCompared`)) continue;
    compareHit(prefix, spec, { hit: { direct: row.direct, durable: row.durable, ap: row.ap } }, prefix);
    compareBlast(prefix, spec, { blast: { damage: row.splash, ap: row.splash ? row.splashAp : undefined, innerRadius: row.innerRadius, radius: row.radius } }, prefix);
  }
}
// Demolition force of direct-hit rifles against the datamine's demo value. The Apex
// and Nova take theirs from the datamine (the wiki Demolition summary lacks them);
// the Anti-Materiel Rifle's summary value 20 shows the two sources agree.
for (const [weaponId, projectileId] of [['anti-materiel', 'APW-1_P'], ['apex', 'AMW-20_P'], ['nova', 'LAS-44_P']]) {
  const hit = hitOf(['projectile', projectileId], `demolition:${weaponId}`);
  const force = demolitionProfiles[weaponId]?.modes[0]?.direct;
  if (hit) ok(force === hit.demo, `demolition:${weaponId}: force ${force}, datamine demo ${hit.demo}`);
}
for (const key of Object.keys(reviewed)) ok(seenReviewed.has(key), `${key}: reviewed entry matches no compared value; remove it`);
for (const key of Object.keys(notCompared)) {
  const [kind, rest] = key.split(':');
  const [weaponId, modeId] = rest.split('/');
  ok(kind === 'engine' ? weaponProfiles[weaponId]?.modes.some(mode => mode.id === modeId) : support.some(item => item.id === weaponId), `${key}: notCompared entry matches nothing; remove it`);
}
for (const id of Object.keys(unsupportedWeapons)) ok(support.some(item => item.id === id), `${id}: unsupported weapon has a table row`);
// Fire rates come from the wiki infobox and are optional. Only their shape is enforced. A datamine
// base rate that no longer matches (one of the selectable rates, or the single rate) is printed as
// a warning, so a refresh that moves a rate does not fail the check.
const rateWarnings = [];
for (const item of support.filter(item => item.rpmModes || item.rpm != null)) {
  const base = weapons[item.en.toUpperCase()]?.rpm ?? null;
  if (item.rpmModes) {
    ok(item.rpm == null, `${item.id}: selectable rates replace a single rate`);
    ok(item.rpmModes.length > 1 && item.rpmModes.every((rpm, i, all) => Number.isFinite(rpm) && rpm > 0 && (!i || rpm > all[i - 1])), `${item.id}: fire rates rise in order`);
    if (base != null && !item.rpmModes.includes(base)) rateWarnings.push(`${item.id}: datamine base rate ${base} is not one of ${item.rpmModes.join('/')}`);
  } else {
    ok(Number.isFinite(item.rpm) && item.rpm > 0, `${item.id}: fire rate is a positive number`);
    if (base != null && base !== item.rpm) rateWarnings.push(`${item.id}: datamine base rate ${base}, data says ${item.rpm}`);
  }
}
for (const message of rateWarnings) console.warn(`warning: support fire rate: ${message}`);

// Magazine and spare ammo come from the datamine weapon record and are optional. Their shape is
// enforced; a record that no longer matches (cap; mags, or rounds; a one-round weapon's spares
// count as rounds) is printed as a warning, so a refresh that moves a number does not fail.
const ammoWarnings = [];
const count = value => value == null || (Number.isInteger(value) && value > 0);
for (const item of support.filter(item => item.magazine != null || item.spareMags != null || item.spareRounds != null)) {
  ok(count(item.magazine) && count(item.spareMags) && count(item.spareRounds), `${item.id}: magazine and spare ammo are positive whole numbers`);
  ok(item.spareMags == null || item.spareRounds == null, `${item.id}: spare magazines or spare rounds, not both`);
  ok(item.magazineWiki == null || (count(item.magazineWiki) && item.magazineWiki !== item.magazine), `${item.id}: magazineWiki only records a different wiki capacity`);
  const record = weapons[item.en.toUpperCase()];
  if (!record) { ammoWarnings.push(`${item.id}: no datamine weapon record to compare`); continue; }
  const spare = record.roundtype === 'rounds' ? { rounds: record.rounds } : record.cap === 1 ? { rounds: record.mags } : { mags: record.mags };
  if (item.magazine != null && item.magazine !== record.cap) ammoWarnings.push(`${item.id}: magazine ${item.magazine}, datamine cap ${record.cap}`);
  if (item.spareMags != null && item.spareMags !== spare.mags) ammoWarnings.push(`${item.id}: spare magazines ${item.spareMags}, datamine ${spare.mags ?? 'none'}`);
  if (item.spareRounds != null && item.spareRounds !== spare.rounds) ammoWarnings.push(`${item.id}: spare rounds ${item.spareRounds}, datamine ${spare.rounds ?? 'none'}`);
}
for (const message of ammoWarnings) console.warn(`warning: support ammo: ${message}`);

assert(!failures.length, `${failures.length} support weapon checks failed:\n  ${failures.join('\n  ')}`);
console.log(`PASS support: ${checks} checks; ${Object.keys(weaponProfiles).length} combat profiles and ${support.length} table rows against the wiki datamine (revision ${snapshot.revision}); ${Object.keys(reviewed).length} reviewed differences.`);
