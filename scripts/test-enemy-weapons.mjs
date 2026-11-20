// Enemy attacks: dist/data/enemy-weapons.js is what build-enemy-weapons.mjs makes from the wiki
// loadout boxes, and the rough hit counts follow the wiki armor table (health / (damage x chest x
// armor factor), rounded up) only for plain single hits. Attacks without a Korean name yet (shown in
// English) and unused names are only counted as 'to check' (user decision 2026-11-19: do not block deploys).
import assert from 'node:assert/strict';
import { enemyWeapons, helldiverArmor } from '../dist/data/enemy-weapons.js';
import { enemies } from '../dist/data/combat-data.js';
import { buildEnemyWeapons } from './build-enemy-weapons.mjs';
import { ARMOR_RATINGS } from './enemy-weapon-parse.mjs';

let checks = 0;
const ok = (value, message) => { assert(value, message); checks++; };
const eq = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks++; };

const built = await buildEnemyWeapons();
eq(enemyWeapons, built.byEnemy, 'enemy-weapons.js is out of date: run node scripts/build-enemy-weapons.mjs');
eq(helldiverArmor, built.helldiver, 'Helldiver armor table');
ok(helldiverArmor.health === 125 && helldiverArmor.factors[100] === 1, 'wiki armor table: health 125, armor 100 takes full damage');
const ids = new Set(enemies.map(enemy => enemy.id));
const attacks = Object.entries(enemyWeapons).flatMap(([id, item]) => { ok(ids.has(id), `${id} is an enemy on the enemy view`); return item.attacks; });
for (const attack of attacks) {
  ok(attack.name === attack.en || /[가-힣]/.test(attack.name), `${attack.en}: a Korean name or the English one`);
  if (!attack.hits) continue;
  ok(attack.damage > 0 && attack.explosion == null, `${attack.en}: hit counts only for a plain single hit`);
  for (const rating of ARMOR_RATINGS) {
    const taken = attack.damage * helldiverArmor.chest * helldiverArmor.factors[rating];
    const n = attack.hits[rating];
    ok(n >= 1 && taken * n >= helldiverArmor.health - 1e-9 && taken * (n - 1) < helldiverArmor.health - 1e-9, `${attack.en}: ${n} torso hits at armor ${rating}`);
  }
}
// A known case: the Devastator's Fusion Assault Cannon (35) takes 3 / 4 / 5 torso hits at 50 / 100 / 150.
eq(enemyWeapons.devastator.attacks.find(attack => attack.en === 'Fusion Assault Cannon').hits, { 50: 3, 100: 4, 150: 5 }, 'Devastator Fusion Assault Cannon');
const toCheck = [built.missing.length && `${built.missing.length} attacks without a Korean name (English shown)`, built.unused.length && `${built.unused.length} unused Korean names`].filter(Boolean);
console.log(`PASS enemy attacks: ${checks} checks (${Object.keys(enemyWeapons).length} enemies, ${attacks.length} attacks, ${attacks.filter(a => a.hits).length} with a rough hit count)${toCheck.length ? `; to check: ${toCheck.join(', ')} (node scripts/build-enemy-weapons.mjs lists them)` : ''}.`);
