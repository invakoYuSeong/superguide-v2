// Stratagem cooldowns and ship modules: the generated data matches the wiki
// snapshot, the module rates match the wiki Ship Modules page, and the computed
// "with modules" values agree with the wiki pages that list one.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stratagems } from '../dist/core/catalog.js';
import { stratagemStats } from '../dist/data/stratagem-stats.js';
import { shipModules, shipModulesSource } from '../dist/data/ship-modules.js';
import { timingOf, setModulesOn, modulesOn } from '../dist/core/modules.js';
import { statsOf, field, value, datamineEntry, forcesOf, ergonomicsOf, swayOf, PERMIT_OVERRIDES } from './stratagem-stats-parse.mjs';

const source = JSON.parse(await readFile(new URL('../db/source/wiki_stratagem_stats.json', import.meta.url), 'utf8'));
const strat = JSON.parse(await readFile(new URL('../db/source/stratagems_data.json', import.meta.url), 'utf8')).data;
const weaponData = JSON.parse(await readFile(new URL('../db/source/weapons_data.json', import.meta.url), 'utf8')).data;
let checks = 0;
const ok = (condition, message) => { assert(condition, message); checks++; };

// Wiki pages whose "with modules" value disagrees with the module rates (reviewed 2026-11-19).
// Bullet Storm lists 70 -> 66.5 s, only the 5% for all stratagems, without the support weapon 10%.
const REVIEWED = new Set(['bullet-storm:cooldown_upgraded']);

// --- Generated file = snapshot ----------------------------------------------------------
for (const item of stratagems) {
  const entry = source.stratagems[item.id];
  ok(entry && !entry.missing, `${item.id}: no wiki page in db/source/wiki_stratagem_stats.json (run fetch-stratagem-stats)`);
  const found = datamineEntry(item.id, entry.title, strat, weaponData);
  const forces = forcesOf(found, strat, weaponData);
  ok(JSON.stringify(stratagemStats[item.id]) === JSON.stringify({ ...statsOf(entry), ...(PERMIT_OVERRIDES[item.id] && { permit: PERMIT_OVERRIDES[item.id] }), ergonomics: ergonomicsOf(found), sway: swayOf(found), forces }), `${item.id}: dist/data/stratagem-stats.js is stale (run build-stratagem-stats)`);
  // Every weapon-type stratagem has stagger and push from the datamine.
  if (['support', 'orbital', 'eagle'].includes(item.category) && !['orbital-railcannon'].includes(item.id)) ok(forces.length, `${item.id}: no stagger or push in the attack datamine`);
}
const TYPES = { support: ['Support Weapon'], orbital: ['Orbital'], eagle: ['Eagle'], defense: ['Sentry', 'Emplacement'], backpack: ['Backpack'], vehicle: ['Vehicle'], mission: ['Ship', 'Objective', null] };
for (const item of stratagems) {
  const stats = stratagemStats[item.id];
  ok(TYPES[item.category].includes(stats.type), `${item.id}: wiki type ${stats.type} does not fit category ${item.category}`);
  if (item.category !== 'mission') ok(stats.cooldown > 0, `${item.id}: no cooldown on the wiki page`);
  // Cooldowns already written into the stratagem data agree with the pages.
  for (const known of [item.cooldown, item.defense?.cooldown]) if (known != null) ok(known === stats.cooldown, `${item.id}: data cooldown ${known} but wiki ${stats.cooldown}`);
}

// --- Module rates = Ship Modules page -----------------------------------------------------
// Compare against the page text with wiki links reduced to their shown words.
const plainText = source.shipModules.text.replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, '$1');
ok(source.shipModules.revision === shipModulesSource.revision, `Ship Modules revision ${source.shipModules.revision}, data says ${shipModulesSource.revision}: re-read the page and update dist/data/ship-modules.js`);
for (const module of shipModules) {
  ok(plainText.includes(`|${module.en}`), `${module.en} is not on the Ship Modules page`);
  ok(plainText.includes(module.text), `${module.en}: effect text changed on the wiki: ${module.text}`);
  const percent = module.cooldown ?? module.rearm;
  if (percent) ok(module.text.includes(`'''${Math.round((1 - percent) * 100)}%'''`), `${module.en}: rate ${percent} does not match its text`);
}

// Module names are the game's Korean (db/source/game_names_ko.json).
const game = JSON.parse(await readFile(new URL('../db/source/game_names_ko.json', import.meta.url), 'utf8'));
for (const module of shipModules) ok(module.name === game.strings.shipModules[module.en], `${module.en}: Korean name ${module.name} is not the game's ${game.strings.shipModules[module.en]}`);

// --- Computed values ------------------------------------------------------------------------
ok(modulesOn() === true, 'ship modules are on by default');
const near = (a, b) => Math.abs(a - b) <= 0.5;
for (const item of stratagems) {
  const on = timingOf(item, true), off = timingOf(item, false);
  ok(off.cooldown === off.cooldownBase && off.rearm === off.rearmBase && off.uses === off.usesBase && off.callIn === off.callInBase, `${item.id}: "off" must show the base values`);
  if (on.cooldown != null) ok(on.cooldown < on.cooldownBase, `${item.id}: modules should shorten the cooldown (every stratagem gets 5%)`);
  const entry = source.stratagems[item.id];
  for (const [key, calc] of [['cooldown_upgraded', on.cooldown], ['rearm_time_upgraded', on.rearm], ['uses_upgraded', on.uses]]) {
    const wiki = value(field(entry.statsTable, key));
    if (typeof wiki !== 'number' || REVIEWED.has(`${item.id}:${key}`)) continue;
    // Most pages leave out Morale Augmentation (5% for all stratagems); that is the only gap allowed.
    ok(near(wiki, calc) || (key === 'cooldown_upgraded' && near(wiki, calc / 0.95)), `${item.id}: wiki ${key} ${wiki}, computed ${calc}`);
  }
}
for (const id of REVIEWED) {
  const [item, key] = id.split(':');
  ok(typeof value(field(source.stratagems[item]?.statsTable, key)) === 'number', `${id}: reviewed difference no longer on the wiki, remove it`);
}
// Spot checks against the wiki pages that include Morale Augmentation.
const t = id => timingOf(stratagems.find(item => item.id === id), true);
ok(t('orbital-airburst').cooldown === 76.95 && Math.round(t('apex').cooldown) === 410, 'multiplied rates match Orbital Airburst and APEX');
ok(t('eagle-500kg').rearm === 120 && t('eagle-500kg').uses === 2 && t('eagle-500kg').cooldown === 7.125, 'Eagle rearm 150 -> 120, uses 1 -> 2, cooldown 15 -> 7.125');
setModulesOn(false); ok(timingOf(stratagems[0]).cooldown === 480, 'the toggle switches to base values'); setModulesOn(true);

// Ship unlock from the infobox: level and Requisition Slips; warbond (medal) and mission stratagems have none.
ok(JSON.stringify(stratagemStats.autocannon.unlock) === JSON.stringify({ level: 10, requisition: 7000 }), 'Autocannon unlocks at level 10 for 7,000 Requisition Slips');
ok(JSON.stringify(stratagemStats['machine-gun'].unlock) === JSON.stringify({ level: 1, requisition: 0 }), 'Machine Gun is free from level 1');
ok(!stratagemStats.apex.unlock && !stratagemStats.reinforce.unlock, 'warbond and mission stratagems have no ship unlock');
console.log(`PASS stratagem stats: ${checks} checks (${stratagems.length} stratagems, ${shipModules.length} ship modules, Ship Modules revision ${shipModulesSource.revision}, ${REVIEWED.size} reviewed difference).`);
