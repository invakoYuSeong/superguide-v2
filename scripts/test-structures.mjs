// Demolition structures against their wiki sources: thresholds from the
// Demolition summary table (db/source/wiki_names.json) or the structure's own
// page (db/source/wiki_structures.json), health from that page's Anatomy table,
// unverified thresholds staying unverified, user-specified thresholds marked as
// such, the picker icons, and the Automaton defences now on the enemy page.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { structures, demolitionProfiles } from '../dist/data/demolition-data.js';
import { enemies, weaponProfiles } from '../dist/data/combat-data.js';
import { enemySizes, unmappedEnemySizes } from '../dist/data/enemy-sizes.js';
import { pickerStructureImages, pickerEnemyImages } from '../dist/data/selector-images.js';
import { solveDemolition, healthDamage } from '../dist/core/demolition.js';
import { solveMatchup } from '../dist/core/combat.js';
import { validateSvg } from './svg-safety.mjs';
import { anatomySnapshot, anatomyRows } from './anatomy-source.mjs';

let checks = 0;
const ok = (value, message) => { assert(value, message); checks++; };
const json = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const names = await json('../db/source/wiki_names.json');
const pages = (await json('../db/source/wiki_structures.json')).pages;

// --- Demolition summary table: "Label (Part)" -> force -----------------------------------
const label = cell => cell.replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, '$1').replace(/\{\{[^}]*\}\}/g, '').trim();
const table = new Map();
const section = names.demolition.split('=== Demolition Force vs. Structures ===')[1].split('|}')[0];
for (const row of section.split(/\n\|-/).slice(1)) {
  const cells = row.split('\n').filter(line => line.startsWith('|')).join('\n').replace(/^\|/, '').split(/\s*\|\|\s*|\n\|/).map(label);
  if (cells.length === 3 && /^\d+$/.test(cells[2])) table.set(cells[0], Number(cells[2]));
}
ok(table.size >= 30, `Demolition table parsed (${table.size} rows)`);
const tableRows = {
  container: { shell: 'Cargo Container' }, broadcast: { tower: 'Illegal Broadcast Tower' }, research: { building: 'Rogue Research Station' },
  'bug-hole': { outer: 'Bug Hole (Outer)', inner: 'Bug Hole (Inner)' }, 'titan-hole': { outer: 'Bile Titan Bug Hole' },
  'spore-spewer': { growth: 'Spore Spewer' }, 'shrieker-nest': { tower: 'Shrieker Nest Tower' }, 'infested-tower': { tower: 'Infested Tower' },
  fabricator: { outer: 'Fabricator (Outer)', vent: 'Fabricator (Vent)' }, 'bulk-fabricator': { outer: 'Bulk Fabricator (Outer)', vent: 'Bulk Fabricator (Vent)' },
  detector: { tower: 'Detector Tower' }, jammer: { tower: 'Stratagem Jammer' }, 'gunship-facility': { building: 'Gunship Facility' },
  'orbital-cannon': { cannon: 'Orbital Cannon' }, 'fuel-reserve': { storage: 'Fuel Reserve' }, 'bio-processor': { processor: 'Bio-Processor' },
  'megafactory-gate': { gate: 'Megafactory Gates' }, 'warp-ship': { hull: 'Grounded Warp Ship (Outer)', door: 'Grounded Warp Ship (Door)' },
  'lightning-spire': { spire: 'Lightning Spire' }, 'disruptor-psu': { power: 'Cognitive Disruptor PSU' }, monolith: { monolith: 'Monolith' },
  gazer: { gazer: 'Gazer' }, 'gazer-spire': { spire: 'Gazer Spire' },
};
const byId = new Map(structures.map(item => [item.id, item]));
ok(byId.size === structures.length, 'structure ids are unique');
for (const [id, routes] of Object.entries(tableRows)) for (const [routeId, row] of Object.entries(routes)) {
  const route = byId.get(id)?.routes.find(item => item.id === routeId);
  ok(route && table.has(row) && route.threshold === table.get(row), `${id}/${routeId}: threshold ${route?.threshold} = Demolition table "${row}" ${table.get(row)}`);
}

// --- Structure pages: revision, demolition numbers, Anatomy rows -----------------------
const forcesOn = text => new Set([
  ...text.matchAll(/\|\s*demo_force\s*=\s*(\d+)/g), ...text.matchAll(/\|\s*df\s*=\s*(\d+)/g),
  ...text.matchAll(/demo(?:lition)? force of (?:''')?(\d+)/gi),
].map(match => Number(match[1])));
const healthRows = text => anatomyRows(text).map(row => {
  const number = name => Number(row[name]?.replace(/[,%]/g, ''));
  return { hp: number('health'), armor: number('av'), durability: number('durability'), exdr: number('exdr') };
});
for (const structure of structures.filter(item => item.page)) {
  const page = pages[structure.page];
  ok(page && page.revision === structure.revision, `${structure.id}: wiki page "${structure.page}" revision ${structure.revision} (snapshot ${page?.revision})`);
  const forces = forcesOn(page.text);
  for (const route of structure.routes) {
    if (route.threshold == null) ok(!forces.size && !tableRows[structure.id], `${structure.id}/${route.id}: left unverified only while the wiki gives no threshold`);
    // A threshold the user set stands only while the wiki still gives none.
    else if (route.thresholdSource === 'user') ok(!forces.size && !tableRows[structure.id], `${structure.id}/${route.id}: user threshold ${route.threshold} only while the wiki gives none`);
    else ok(forces.has(route.threshold) || tableRows[structure.id]?.[route.id], `${structure.id}/${route.id}: threshold ${route.threshold} is on the wiki page`);
  }
  if (structure.health) {
    const h = structure.health;
    ok(healthRows(page.text).some(row => row.hp === h.hp && row.armor === h.armor && row.durability === h.durability && row.exdr === h.exdr),
      `${structure.id}: health ${h.hp} / armor ${h.armor} / durability ${h.durability}% / ExDR ${h.exdr}% is an Anatomy row`);
  }
}
for (const id of ['stalker-lair', 'infested-tower', 'spore-lung', 'bio-processor', 'megafactory-gate', 'terrorist-memorial',
  'transmission-network', 'cooling-tower', 'gazer', 'gazer-spire']) ok(byId.get(id)?.page, `${id}: added with its wiki page`);

// --- User-specified thresholds ---------------------------------------------------------
// Where the wiki gives no threshold, the user may set one (thresholdSource 'user').
// The Transmission Network tower's 10 is the user's value (2026-11-09); its note
// tells the reader that the number is not from the wiki.
const userRoutes = structures.flatMap(structure => structure.routes.filter(route => route.thresholdSource !== undefined).map(route => [structure, route]));
ok(userRoutes.every(([, route]) => route.thresholdSource === 'user' && Number.isFinite(route.threshold)), 'thresholdSource is only "user", on a number');
assert.deepEqual(userRoutes.map(([structure, route]) => `${structure.id}/${route.id}=${route.threshold}`), ['transmission-network/tower=10'], 'user-specified thresholds');
for (const [structure, route] of userRoutes) {
  ok(structure.page && structure.note?.includes(`철거력 ${route.threshold}은 위키 수치가 아니라`), `${structure.id}: note says the threshold ${route.threshold} is not from the wiki`);
  const passes = Object.values(demolitionProfiles).flatMap(profile => profile.modes.map(mode => solveDemolition(structure, profile, mode, { jammerDisabled: true })));
  ok(passes.some(result => result.method === 'force') && passes.every(result => result.reason !== 'threshold-unknown'), `${structure.id}: the user threshold gives verdicts`);
}

// --- Engine: an unverified threshold never passes or fails -----------------------------
// No structure is left without a threshold now, so the rule is also checked on a
// copy of the Transmission Network with its threshold taken away.
const options = [{}, { shieldCleared: true, jammerDisabled: true }];
const network = byId.get('transmission-network');
const unverified = { ...network, id: 'unverified-copy', routes: network.routes.map(({ thresholdSource, ...route }) => ({ ...route, threshold: null })) };
for (const structure of [unverified, ...structures.filter(item => item.routes.some(route => route.threshold == null))]) {
  for (const profile of Object.values(demolitionProfiles)) for (const mode of profile.modes) for (const option of options) {
    const result = solveDemolition(structure, profile, mode, option);
    ok(result.method !== 'force' && result.outcome !== 'blocked', `${structure.id}: no force verdict without a threshold`);
    ok(result.routes.every(row => row.route.threshold != null || row.verdict === 'unknown'), `${structure.id}: route stays unknown`);
    if (!result.method) ok(result.reason === 'threshold-unknown', `${structure.id}: reason names the unverified threshold`);
  }
}
// Megafactory Gates (800% durability): durable share at 87.5% or less does nothing.
const gate = byId.get('megafactory-gate');
const hit = durable => healthDamage(gate, { damage: { standard: 1000, durable, ap: 5, explosion: 0, explosionAp: 0 } }).direct;
ok(hit(875) === 0 && hit(500) === 0 && hit(1000) === 1000 && hit(1100) === 1800, 'gate durability 800% blends standard and durable damage');

// --- Picker icons ------------------------------------------------------------------------
for (const structure of structures) {
  const image = pickerStructureImages[structure.id];
  ok(image?.src && new URL(image.source).hostname === 'helldivers.wiki.gg', `${structure.id}: icon from the wiki`);
  const bytes = await readFile(new URL(`../dist/${image.src.replace(/^\.\//, '')}`, import.meta.url));
  ok(createHash('sha256').update(bytes).digest('hex') === image.sha256, `${structure.id}: icon bytes match the recorded hash`);
  if (image.src.endsWith('.svg')) ok(validateSvg(bytes), `${structure.id}: icon SVG is safe`);
}

// --- Automaton defences moved to the enemy page (2026-11-09) ----------------------------
// The emplacements, the Bunker Turret and the parked Air Base dropship are solved
// as enemies. Their Anatomy is read from the same saved pages (scripts/anatomy-source.mjs)
// and checked number by number in test-anatomy.mjs.
const anatomy = await anatomySnapshot();
const moved = { 'aa-emplacement': 'Anti-Air Emplacement', 'mortar-emplacement': 'Mortar Emplacement', 'bunker-turret': 'Bunker Turret', 'dropship-base': 'Sabotage Air Base' };
const antiTank = weaponProfiles['expendable-at'].modes[0];
const ap3 = weaponProfiles['machine-gun'].modes[0];
ok(antiTank.ap === 6 && ap3.ap === 3, 'reference attacks: EAT-17 (AP 6) and MG-43 (AP 3)');
for (const [id, title] of Object.entries(moved)) {
  const enemy = enemies.find(item => item.id === id);
  const page = pages[title];
  ok(!byId.has(id) && !pickerStructureImages[id], `${id}: no longer a demolition structure`);
  ok(enemy?.faction === '오토마톤', `${id}: an Automaton enemy`);
  ok(enemy.source === `https://helldivers.wiki.gg/wiki/${title.replaceAll(' ', '_')}` && enemy.sourceRevision === page.revision, `${id}: cites "${title}" revision ${page.revision}`);
  // Either snapshot may hold the page (an enemy Anatomy refetch can pick it up); test-anatomy.mjs compares the rows.
  const saved = anatomy.pages[title];
  ok(saved?.rows.length && enemy.anatomyRevision === saved.revision, `${id}: Anatomy rows of "${title}" revision ${saved?.revision}`);
  ok(enemySizes[id] === null && typeof unmappedEnemySizes[id] === 'string', `${id}: no wiki size category, so explicitly unmapped`);
  // Every one of these pages says any anti-tank weapon destroys it in one shot.
  const { best } = solveMatchup(enemy, antiTank);
  ok(best?.hits === 1 && best.outcome === 'kill', `${id}: one anti-tank shot destroys it, as the wiki says`);
  const image = pickerEnemyImages[id];
  ok(image?.src === `./assets/pickers/enemy-${id}.svg` && new URL(image.source).hostname === 'helldivers.wiki.gg', `${id}: portrait is the wiki icon`);
  const bytes = await readFile(new URL(`../dist/${image.src.replace(/^\.\//, '')}`, import.meta.url));
  ok(createHash('sha256').update(bytes).digest('hex') === image.sha256 && validateSvg(bytes), `${id}: portrait bytes match the recorded hash and the SVG is safe`);
}
// AP 3 gets through only the rear heatsink (armor 3), never the armor-4 body.
for (const id of ['aa-emplacement', 'mortar-emplacement', 'bunker-turret']) {
  const { rows } = solveMatchup(enemies.find(item => item.id === id), ap3);
  const route = part => rows.find(row => row.target.id === part);
  ok(route('body').hits == null && route('heatsink').hits > 0 && route('heatsink').outcome === 'kill', `${id}: AP 3 kills it only through the heatsink`);
}

// Explosion marker on the demolition page: one small wiki SVG, safe, drawn by CSS only.
{
  const icon = await readFile(new URL('../dist/assets/icons/damage-explosion.svg', import.meta.url));
  ok(icon.length <= 2048, `explosion icon stays small (${icon.length} bytes)`);
  ok((() => { try { validateSvg(icon); return true; } catch { return false; } })(), 'explosion icon passes the SVG safety check');
  const css = await readFile(new URL('../dist/ui/app.css', import.meta.url), 'utf8');
  ok((css.match(/damage-explosion\.svg/g) || []).length === 1, 'one CSS rule loads the explosion icon');
  const view = await readFile(new URL('../dist/ui/views/demolition.js', import.meta.url), 'utf8');
  ok(view.includes('route.explosiveOnly ? blastIcon('), 'explosive-only thresholds carry the explosion marker');
}
console.log(`PASS structures: ${checks} checks (${structures.length} structures, ${table.size} Demolition table rows, ${structures.filter(item => item.page).length} wiki pages, ${structures.filter(item => item.routes.some(route => route.threshold == null)).length} thresholds left 미확인, ${userRoutes.length} set by the user, ${Object.keys(moved).length} defences on the enemy page).`);
