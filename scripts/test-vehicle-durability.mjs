// Vehicle durability: dist/data/vehicle-durability.js is what build-vehicle-durability.mjs makes from
// the wiki Anatomy tables, and every vehicle shown is a site stratagem with a main body health. Wiki
// values are not pinned (a balance patch must not stop deploys); parts still in English, pages without a
// stratagem and pages without an Anatomy table yet (their table is hidden) are only 'to check'.
import assert from 'node:assert/strict';
import { vehicleDurability } from '../dist/data/vehicle-durability.js';
import { stratagemById } from '../dist/core/catalog.js';
import { buildVehicleDurability } from './build-vehicle-durability.mjs';
import { anatomyRows } from './anatomy-source.mjs';

let checks = 0;
const ok = (value, message) => { assert(value, message); checks++; };
const eq = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks++; };

const built = await buildVehicleDurability();
eq(vehicleDurability, built.vehicles, 'vehicle-durability.js is out of date: run node scripts/build-vehicle-durability.mjs');
for (const [id, vehicle] of Object.entries(vehicleDurability)) {
  ok(stratagemById.get(id), `${id}: a stratagem on the site`);
  const main = vehicle.parts.find(part => part.en === 'Main');
  ok(main && typeof main.health === 'number', `${id}: a main body with health`);
  for (const part of vehicle.parts) ok(part.name && (typeof part.health === 'number' || ['indestructible', 'main', null].includes(part.health)), `${id} ${part.en}: health is a number, indestructible or shared with main`);
}
// The row parser on a fixed sample (not the live wiki values).
const sample = anatomyRows([
  '{{Anatomy Table|',
  '  {{Anatomy Row',
  '    | part_name = Legs (2)',
  '    | health = 550',
  '    | fatal = No<br>(Downs)',
  '  }}',
  '}}',
].join('\n'));
eq(sample.map(row => [row.part_name, row.health, row.fatal]), [['Legs (2)', '550', 'No<br>(Downs)']], 'Anatomy row parser reads a vehicle row');
console.log(`PASS vehicle durability: ${checks} checks (${Object.keys(vehicleDurability).length} vehicles, ${Object.values(vehicleDurability).reduce((n, v) => n + v.parts.length, 0)} parts)${built.toCheck.length ? `; to check: ${built.toCheck.join('; ')}` : ''}.`);
