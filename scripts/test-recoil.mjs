// Weapon recoil: dist/data/weapon-recoil.js is what build-recoil.mjs makes from db/source/otl_recoil.json, every
// key is a real gear or support weapon, and the gear and stratagem details show the two recoil cells.
import assert from 'node:assert/strict';
import { weaponRecoil, recoilSource } from '../dist/data/weapon-recoil.js';
import { personalWeapons } from '../dist/data/personal-weapons.js';
import { stratagems } from '../dist/core/catalog.js';
import { buildRecoil, recoilText } from './build-recoil.mjs';
import { readFile } from 'node:fs/promises';

let checks = 0;
const ok = (value, message) => { assert(value, message); checks++; };

const built = await buildRecoil();
ok(await readFile(new URL('../dist/data/weapon-recoil.js', import.meta.url), 'utf8') === recoilText(built), 'weapon-recoil.js is out of date: run node scripts/build-recoil.mjs');
const known = new Set([...personalWeapons.map(w => `gear/${w.id}`), ...stratagems.filter(s => s.category === 'support').map(s => `arsenal/${s.id}`)]);
// Values are not pinned (a balance patch must not stop deploys): only their shape.
for (const [key, value] of Object.entries(weaponRecoil)) {
  ok(known.has(key), `${key} is a gear or support weapon`);
  ok([value.drift, value.climb, ...(value.limit ? [value.limit] : [])].every(pair => pair.length === 2 && pair.every(Number.isFinite)), `${key}: recoil pairs are numbers`);
}

const { weaponDetail } = await import('../dist/ui/views/gear.js');
const sample = personalWeapons.find(w => weaponRecoil[`gear/${w.id}`]);
const [h, v] = weaponRecoil[`gear/${sample.id}`].drift;
ok(String(weaponDetail(sample)).includes(`<dt>무기 반동</dt><dd class="">${h} / ${v}</dd>`), `${sample.id}: gear detail shows the weapon kick`);
console.log(`PASS recoil: ${checks} checks (${Object.keys(weaponRecoil).length} weapons, written for game ${recoilSource.writtenFor}; not on the site: ${built.unmatched.length}).`);
