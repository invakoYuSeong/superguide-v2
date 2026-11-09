// Demolition structures against their wiki sources: thresholds from the
// Demolition summary table (db/source/wiki_names.json) or the structure's own
// page (db/source/wiki_structures.json), health from that page's Anatomy table,
// unverified thresholds staying unverified, and the picker icons.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { structures, demolitionProfiles } from '../dist/data/demolition-data.js';
import { pickerStructureImages } from '../dist/data/selector-images.js';
import { solveDemolition, healthDamage } from '../dist/core/demolition.js';
import { validateSvg } from './svg-safety.mjs';

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
const anatomyRows = text => text.split('{{Anatomy Row').slice(1).map(row => {
  const field = name => row.match(new RegExp(`\\|\\s*${name}\\s*=\\s*([^\\n|]*)`))?.[1].trim();
  const number = name => Number(field(name)?.replace(/[,%]/g, ''));
  return { hp: number('health'), armor: number('av'), durability: number('durability'), exdr: number('exdr') };
});
for (const structure of structures.filter(item => item.page)) {
  const page = pages[structure.page];
  ok(page && page.revision === structure.revision, `${structure.id}: wiki page "${structure.page}" revision ${structure.revision} (snapshot ${page?.revision})`);
  const forces = forcesOn(page.text);
  for (const route of structure.routes) {
    if (route.threshold == null) ok(!forces.size && !tableRows[structure.id], `${structure.id}/${route.id}: left unverified only while the wiki gives no threshold`);
    else ok(forces.has(route.threshold) || tableRows[structure.id]?.[route.id], `${structure.id}/${route.id}: threshold ${route.threshold} is on the wiki page`);
  }
  if (structure.health) {
    const h = structure.health;
    ok(anatomyRows(page.text).some(row => row.hp === h.hp && row.armor === h.armor && row.durability === h.durability && row.exdr === h.exdr),
      `${structure.id}: health ${h.hp} / armor ${h.armor} / durability ${h.durability}% / ExDR ${h.exdr}% is an Anatomy row`);
  }
}
for (const id of ['stalker-lair', 'infested-tower', 'spore-lung', 'bio-processor', 'megafactory-gate', 'terrorist-memorial', 'aa-emplacement', 'mortar-emplacement',
  'bunker-turret', 'transmission-network', 'dropship-base', 'cooling-tower', 'gazer', 'gazer-spire']) ok(byId.get(id)?.page, `${id}: added with its wiki page`);

// --- Engine: an unverified threshold never passes or fails -----------------------------
const options = [{}, { shieldCleared: true, jammerDisabled: true }];
for (const structure of structures.filter(item => item.routes.some(route => route.threshold == null))) {
  for (const profile of Object.values(demolitionProfiles)) for (const mode of profile.modes) for (const option of options) {
    const result = solveDemolition(structure, profile, mode, option);
    ok(result.method !== 'force' && result.outcome !== 'blocked', `${structure.id}: no force verdict without a threshold`);
    ok(result.routes.every(row => row.route.threshold != null || row.verdict === 'unknown'), `${structure.id}: route stays unknown`);
    if (!result.method) ok(result.reason === 'threshold-unknown', `${structure.id}: reason names the unverified threshold`);
  }
}
const aa = byId.get('aa-emplacement');
for (const [id, profile] of Object.entries(demolitionProfiles)) for (const mode of profile.modes) {
  const result = solveDemolition(aa, profile, mode);
  const blocked = result.conditions.some(item => item.kind === 'anti-air');
  ok(blocked === (id.startsWith('eagle-') && Boolean(result.method)), `${id}: Anti-Air Emplacement blocks Eagles only`);
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

console.log(`PASS structures: ${checks} checks (${structures.length} structures, ${table.size} Demolition table rows, ${structures.filter(item => item.page).length} wiki pages, ${structures.filter(item => item.routes.some(route => route.threshold == null)).length} thresholds left 미확인).`);
