// Vehicle durability: dist/data/vehicle-durability.js is what build-vehicle-durability.mjs makes from
// the wiki Anatomy tables, every vehicle is a site stratagem with a main body that ends it, and known
// values hold. Parts still in English and pages without a stratagem are only 'to check'.
import assert from 'node:assert/strict';
import { vehicleDurability } from '../dist/data/vehicle-durability.js';
import { stratagemById } from '../dist/core/catalog.js';
import { buildVehicleDurability } from './build-vehicle-durability.mjs';

let checks = 0;
const ok = (value, message) => { assert(value, message); checks++; };
const eq = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks++; };

const built = await buildVehicleDurability();
eq(vehicleDurability, built.vehicles, 'vehicle-durability.js is out of date: run node scripts/build-vehicle-durability.mjs');
for (const [id, vehicle] of Object.entries(vehicleDurability)) {
  ok(stratagemById.get(id), `${id}: a stratagem on the site`);
  const main = vehicle.parts.find(part => part.en === 'Main');
  ok(main && main.fatal && typeof main.health === 'number', `${id}: a main body with health that ends the vehicle`);
  for (const part of vehicle.parts) ok(part.name && (typeof part.health === 'number' || ['indestructible', 'main', null].includes(part.health)), `${id} ${part.en}: health is a number, indestructible or shared with main`);
}
const patriot = vehicleDurability.patriot.parts;
eq([patriot[0].health, patriot[0].armor, patriot[0].bleed], [1800, 4, { health: 2000, perSecond: 400 }], 'Patriot main body: 1,800 health, armor 4, 2,000 bleed-out at 400/s');
ok(patriot.some(part => part.en === 'Legs' && part.count === 2 && part.downs), 'Patriot legs: two, down the exosuit when destroyed');
console.log(`PASS vehicle durability: ${checks} checks (${Object.keys(vehicleDurability).length} vehicles, ${Object.values(vehicleDurability).reduce((n, v) => n + v.parts.length, 0)} parts)${built.toCheck.length ? `; to check: ${built.toCheck.join('; ')}` : ''}.`);
