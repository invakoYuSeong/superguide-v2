// Ship module tab: dist/data/ship-module-upgrades.js is what build-ship-module-upgrades.mjs makes from
// the wiki table and the game's text, every section has five upgrades whose costs add up to the
// wiki Total row, the icons are the checked files, and every module the stratagem catalogue applies
// (dist/data/ship-modules.js) is linked from its upgrade.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { shipModuleSections, shipModuleTotal, shipModuleUpgradesSource } from '../dist/data/ship-module-upgrades.js';
import { shipModules, shipModulesSource } from '../dist/data/ship-modules.js';
import { buildShipModuleUpgrades } from './build-ship-module-upgrades.mjs';

let checks = 0;
const ok = (value, message) => { assert(value, message); checks++; };
const eq = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks++; };

const built = await buildShipModuleUpgrades();
eq(shipModuleSections, built.sections, 'ship-module-upgrades.js is out of date: run node scripts/build-ship-module-upgrades.mjs');
eq(shipModuleTotal, built.total, 'total matches the wiki Total row');
eq(shipModuleUpgradesSource, built.source, 'source revision');
ok(shipModuleUpgradesSource.revision === shipModulesSource.revision, 'costs and the catalogue rates read the same Ship Modules revision');
ok(shipModuleSections.length === 6, `6 ship sections, found ${shipModuleSections.length}`);
const modules = shipModuleSections.flatMap(section => section.modules);
for (const section of shipModuleSections) {
  eq(section.modules.map(module => module.tier), [1, 2, 3, 4, 5], `${section.en}: tiers 1-5`);
  const bytes = await readFile(new URL(`../dist/${section.icon.src.slice(2)}`, import.meta.url));
  ok(createHash('sha256').update(bytes).digest('hex') === section.icon.sha256, `${section.en}: icon file matches its sha256`);
}
for (const module of modules) {
  ok(/[가-힣]/.test(module.name) && /[가-힣]/.test(module.effect), `${module.en}: Korean name and effect`);
  ok(!/#VALUE|<[ci]/.test(module.effect + module.effectEn), `${module.en}: no game markup left`);
  ok(module.cost.common > 0, `${module.en}: every upgrade costs Common samples`);
}
for (const module of shipModules) ok(modules.some(item => item.stratagemModule === module.id && item.en === module.en), `${module.en}: linked from the ship module tab`);
console.log(`PASS ship modules: ${checks} checks (${shipModuleSections.length} sections, ${modules.length} upgrades, Ship Modules revision ${shipModuleUpgradesSource.revision}).`);
