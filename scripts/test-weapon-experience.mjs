// Weapon experience: dist/data/weapon-experience.js is what build-weapon-experience.mjs makes from the
// wiki Attachments table, totals only grow, and every attachment unlock level above 1 has a total. Wiki
// values are not pinned (a balance patch must not stop deploys).
import assert from 'node:assert/strict';
import { weaponExperience } from '../dist/data/weapon-experience.js';
import { weaponAttachments } from '../dist/data/weapon-attachments.js';
import { buildWeaponExperience } from './build-weapon-experience.mjs';

let checks = 0;
const ok = (value, message) => { assert(value, message); checks++; };
const eq = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks++; };

eq(weaponExperience, (await buildWeaponExperience()).levels, 'weapon-experience.js is out of date: run node scripts/build-weapon-experience.mjs');
const levels = Object.keys(weaponExperience).map(Number).sort((a, b) => a - b);
levels.slice(1).forEach((level, i) => ok(weaponExperience[level] > weaponExperience[levels[i]], `level ${level} needs more than level ${levels[i]}`));
const unlocks = new Set(Object.values(weaponAttachments).flat().map(item => item.level).filter(level => level > 1));
for (const level of unlocks) ok(weaponExperience[level] != null, `attachment unlock level ${level} has an experience total`);
console.log(`PASS weapon experience: ${checks} checks (levels ${levels[0]}-${levels.at(-1)}).`);
