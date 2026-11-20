// Quick melee and one-handed weapons: dist/data/melee.js is what build-melee.mjs makes from the wiki
// datamine and weapon pages, the gear detail shows the right strike, and the one-handed badge
// follows the wiki infobox trait.
import assert from 'node:assert/strict';
import { quickMelee, bayonetWeapons, meleeSource } from '../dist/data/melee.js';
import { personalWeapons } from '../dist/data/personal-weapons.js';
import { buildMelee } from './build-melee.mjs';

let checks = 0;
const ok = (value, message) => { assert(value, message); checks++; };
const eq = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks++; };

const built = await buildMelee();
eq({ quickMelee, bayonetWeapons, meleeSource }, { quickMelee: { helldiver: built.helldiver, bayonet: built.bayonet }, bayonetWeapons: built.bayonetWeapons, meleeSource: built.source }, 'melee.js is out of date: run node scripts/build-melee.mjs');
// Wiki values are not pinned (a balance patch must not stop deploys): only their shape.
for (const [name, hit] of Object.entries(quickMelee)) ok(['damage', 'durable', 'ap'].every(key => Number.isFinite(hit[key])) && hit.damage > 0, `${name} melee: damage, durable damage and AP are numbers`);
ok(bayonetWeapons.every(id => personalWeapons.some(w => w.id === id)), 'every bayonet weapon is a gear item');

const { weaponDetail } = await import('../dist/ui/views/gear.js');
for (const w of personalWeapons.filter(item => ['primary', 'secondary'].includes(item.category) && item.type !== 'melee')) {
  const text = String(weaponDetail(w));
  const bayonet = bayonetWeapons.includes(w.id);
  ok(text.includes(`<dt>${bayonet ? '총검 공격' : '근접 공격'}</dt><dd class="">${bayonet ? 165 : 75}</dd>`), `${w.id}: ${bayonet ? 'bayonet' : 'quick melee'} row`);
}
const oneHanded = personalWeapons.filter(w => (w.traitTags || []).includes('one-handed'));
ok(!oneHanded.some(w => w.category === 'throwable'), `one-handed weapons: ${oneHanded.length}, none of them throwables`);
console.log(`PASS melee: ${checks} checks (quick melee ${quickMelee.helldiver.damage}, bayonet on ${bayonetWeapons.length} weapons, ${oneHanded.length} one-handed weapons).`);
